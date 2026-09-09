/* ==========================================================================
   netlify/functions/home-valuation.js

   Handles POST /api/home-valuation/ (see the redirect in netlify.toml).

   Order matters and is not arbitrary. Follow Up Boss is posted FIRST and
   the email second, because the CRM record is the record — an email in
   an inbox is a notification, not a lead that can be worked, assigned or
   followed up. If the two ever disagree, FUB wins.

   The lead is never dropped. If FUB rejects the post for any reason the
   email still goes out, with the failure written into the subject line
   and the body, so a broken key surfaces as a message Jayden actually
   reads rather than as silence. That is the "tell me straight away if
   the key does not authenticate" requirement: a 401 arrives in her inbox
   within seconds, attached to the lead it nearly lost.

   SECRETS — none of these live in the repo.
   Set them in Netlify under Site configuration → Environment variables:

     FUB_API_KEY        Follow Up Boss key. Basic auth username, blank
                        password. Regenerate this once the integration
                        is confirmed working — the current key came over
                        chat, so treat it as already exposed.
     FUB_SYSTEM         X-System header. Follow Up Boss asks integrators
                        to register a system name.  CONFIRM — register
                        at docs.followupboss.com and use the name issued.
     FUB_SYSTEM_KEY     X-System-Key header, issued with the above.
     RESEND_API_KEY     Transactional email.  CONFIRM — Resend assumed.
                        If the brokerage uses SendGrid or Postmark
                        instead, only sendEmail() below changes.
     VALUATION_TO       jayden@soldbykennedy.ca
     VALUATION_FROM     A verified sending address on the domain, e.g.
                        forms@soldbykennedy.ca. Not a Gmail address —
                        it has to pass SPF and DKIM for the domain.
   ========================================================================== */

const FUB_EVENTS = "https://api.followupboss.com/v1/events";
const RESEND_SEND = "https://api.resend.com/emails";

/* The brokerage's own IDX search, defaulted to Oshawa. Returned to the
   client rather than hardcoded in the page so the destination can move
   without a rebuild. */
const SEARCH_URL =
  "https://kw-energy.yourkwoffice.com/search/ON/Oshawa?searchedText=Oshawa%2C%20ON";

const TIMEFRAMES = {
  now: "Wants to sell now",
  "3-months": "Selling in the next 3 months",
  "12-months": "Selling in the next 12 months",
  curious: "Just curious what it is worth",
};

/* -------------------------------------------------------------------------- */

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max || 500);
}

function splitName(full) {
  const parts = clean(full, 120).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/* -------------------------------------------------------------------------- */

async function postToFub(lead) {
  const key = process.env.FUB_API_KEY;
  if (!key) throw new Error("FUB_API_KEY is not set");

  const { firstName, lastName } = splitName(lead.name);

  /* Seller Inquiry, not Registration: this is someone asking what their
     own property is worth. The type decides which action plan fires in
     FUB, so it is a business decision as much as a technical one.
     CONFIRM with Jayden that the seller action plan is the right one. */
  const body = {
    source: "soldbykennedy.ca",
    system: process.env.FUB_SYSTEM || "soldbykennedy.ca",
    type: "Seller Inquiry",
    message: [
      "Home valuation request from soldbykennedy.ca",
      "",
      "Property: " + lead.address,
      "Time frame: " + (TIMEFRAMES[lead.timeframe] || lead.timeframe || "not given"),
      "Consent to contact: yes, given on the form",
    ].join("\n"),
    person: {
      firstName: firstName,
      lastName: lastName,
      emails: lead.email ? [{ value: lead.email, type: "home" }] : [],
      phones: lead.phone ? [{ value: lead.phone, type: "mobile" }] : [],
      addresses: lead.address ? [{ street: lead.address, type: "home" }] : [],
      tags: ["Home valuation", "Website"],
      /* The time frame as a lead property rather than only as message
         text, so it can be filtered and reported on.

         CONFIRM — custom fields must already exist on the account and
         the key is whatever FUB generated, usually customTimeFrame.
         Call GET /v1/customFields with the same auth to read the real
         key, then correct the line below. An unknown key is ignored
         silently, which is why the time frame is also written into
         `message` above: worst case it is still on the record. */
      customTimeFrame: TIMEFRAMES[lead.timeframe] || lead.timeframe || "",
    },
  };

  const headers = {
    "Content-Type": "application/json",
    /* API key as username, blank password. */
    Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
  };

  if (process.env.FUB_SYSTEM) headers["X-System"] = process.env.FUB_SYSTEM;
  if (process.env.FUB_SYSTEM_KEY) headers["X-System-Key"] = process.env.FUB_SYSTEM_KEY;

  const res = await fetch(FUB_EVENTS, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  });

  /* 204 means the lead flow for this source has been archived in FUB —
     the post succeeded and was deliberately ignored. Worth surfacing,
     because it looks like success and behaves like a black hole. */
  if (res.status === 204) {
    return { ok: false, detail: "FUB returned 204 — the lead flow for this source is archived and the lead was ignored." };
  }

  if (!res.ok) {
    const text = await res.text().catch(function () { return ""; });
    const hint =
      res.status === 401
        ? "The API key did not authenticate."
        : "Follow Up Boss rejected the request.";
    return { ok: false, detail: hint + " HTTP " + res.status + ". " + text.slice(0, 300) };
  }

  return { ok: true, detail: "" };
}

/* -------------------------------------------------------------------------- */

async function sendEmail(lead, fub) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const failed = !fub.ok;

  const subject = failed
    ? "CRM FAILED — home valuation: " + lead.address
    : "Home valuation: " + lead.address;

  const lines = [
    failed ? "*** THIS LEAD IS NOT IN FOLLOW UP BOSS ***" : "",
    failed ? fub.detail : "",
    failed ? "Work it from this email until the integration is fixed." : "",
    failed ? "" : "",
    "Property address: " + lead.address,
    "Name: " + lead.name,
    "Email: " + lead.email,
    "Phone: " + lead.phone,
    "Time frame: " + (TIMEFRAMES[lead.timeframe] || lead.timeframe || "not given"),
    "",
    "Consent: agreed to contact by call, email or text.",
    "Source: soldbykennedy.ca home valuation form",
    "Received: " + new Date().toISOString(),
  ].filter(function (line) { return line !== ""; });

  const res = await fetch(RESEND_SEND, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({
      from: process.env.VALUATION_FROM,
      to: [process.env.VALUATION_TO || "jayden@soldbykennedy.ca"],
      reply_to: lead.email || undefined,
      subject: subject,
      text: lines.join("\n"),
    }),
  });

  return res.ok;
}

/* -------------------------------------------------------------------------- */

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  /* Honeypot. Accept and look successful rather than erroring — a bot
     that learns it was caught adapts. Nothing is sent anywhere. */
  if (clean(payload.company, 100)) {
    return new Response(JSON.stringify({ ok: true, searchUrl: SEARCH_URL }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lead = {
    address: clean(payload.address, 200),
    name: clean(payload.name, 120),
    email: clean(payload.email, 160),
    phone: clean(payload.phone, 40),
    timeframe: clean(payload.timeframe, 40),
  };

  /* The client validates too. This is the copy that matters, because
     the client's can be skipped. */
  if (!lead.address || !lead.name || !lead.email || !lead.phone) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (payload.consent !== "yes" && payload.consent !== true) {
    return new Response(JSON.stringify({ error: "Consent is required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  /* CRM first. A thrown error here (missing key, network) is caught and
     turned into the same shape a rejection produces, so the email path
     below always runs. */
  let fub;
  try {
    fub = await postToFub(lead);
  } catch (err) {
    fub = { ok: false, detail: "Could not reach Follow Up Boss: " + err.message };
  }

  if (!fub.ok) console.error("Follow Up Boss:", fub.detail);

  let emailed = false;
  try {
    emailed = await sendEmail(lead, fub);
  } catch (err) {
    console.error("Email:", err.message);
  }

  /* Both routes failed, so nothing recorded the lead anywhere. This is
     the only case where the visitor is told to try again — otherwise
     they would walk away believing the form worked. */
  if (!fub.ok && !emailed) {
    return new Response(JSON.stringify({ error: "Could not record the request" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, searchUrl: SEARCH_URL }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}