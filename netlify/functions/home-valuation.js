/* ==========================================================================
   POST /.netlify/functions/home-valuation

   Fires alongside the home valuation form's real submission, which is
   still a native Netlify Forms POST (data-netlify="true" on the <form>
   in src/content/pages/home-value.html) — that's what stores the
   submission and sends Jayden the notification email, both handled by
   Netlify itself (Site settings → Forms → Form notifications; //! CONFIRM
   an email notification is actually configured there — this repo has no
   visibility into that dashboard setting). This function's only job is
   the one thing Netlify Forms can't do on its own: push the lead into
   Follow Up Boss.

   Called fire-and-forget from the client, in parallel with the Netlify
   Forms submission — it does not gate the confirmation step, the
   countdown, or the new-tab IDX search open, all of which depend only on
   the Netlify Forms POST succeeding. A visitor never sees a FUB failure;
   it's logged server-side (console.error, visible in Netlify's function
   logs) and Jayden still has the full lead in her inbox either way via
   Netlify's own notification.

   //! CONFIRM — this file used to live at src/assets/js/home-value.js,
   written as a Netlify Edge Function (`export default`, Web Request/
   Response) with its own Resend-based email fallback. Nothing pointed at
   it: no redirect, no [[edge_functions]] entry in netlify.toml, and it
   was sitting in the client JS folder, which meant esbuild was bundling
   it into a PUBLICLY SERVED file at /assets/js/home-value.js — dead
   code, reachable by anyone via direct URL, though no secret values
   leaked (only env var names and the FUB/Resend endpoint URLs, since
   esbuild doesn't substitute process.env at build time). Converted to a
   classic Netlify Function here; the Resend/email half was dropped since
   Netlify's native Forms notification already covers it.

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
   ========================================================================== */

const FUB_EVENTS = "https://api.followupboss.com/v1/events";

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Bad request" }),
    };
  }

  // Honeypot. Accept and look successful — a bot that learns it was
  // caught adapts. Nothing is sent to FUB.
  if (clean(payload.company, 100)) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  }

  const lead = {
    address: clean(payload.address, 200),
    name: clean(payload.name, 120),
    email: clean(payload.email, 160),
    phone: clean(payload.phone, 40),
    timeframe: clean(payload.timeframe, 40),
  };

  if (!lead.address || !lead.name || !lead.email || !lead.phone) {
    return {
      statusCode: 422,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  try {
    const fub = await postToFub(lead);
    if (!fub.ok) console.error("Follow Up Boss:", fub.detail);

    // Always 200 to the client — this call is fire-and-forget and never
    // gates the visitor's confirmation flow. The lead is already safe in
    // Netlify Forms + Jayden's inbox regardless of what FUB did with it.
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: fub.ok }) };
  } catch (err) {
    console.error("Follow Up Boss:", err.message);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false }) };
  }
};
