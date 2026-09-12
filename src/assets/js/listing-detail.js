/**
 * Listing detail page.
 *
 * One physical page (/listings/details/) serves every listing — see
 * src/_redirects, which rewrites the pretty /listings/<ListingKey>/ URL
 * to this file while keeping that URL in the address bar. This script
 * reads the key back out of window.location.pathname (the rewrite is
 * transparent to the browser, so the address bar still shows the real
 * path) and fetches the record from the listing-detail Netlify Function.
 *
 * Sections start with the `hidden` attribute in the markup and are only
 * revealed once real data is in hand — never a flash of empty labels or
 * broken images. The existing sitewide reveal.js observer already binds
 * to #listing-gallery/#listing-main during its initial page-load scan
 * (querySelectorAll doesn't care about the hidden attribute), so once
 * this script removes `hidden`, the section lays out and the observer's
 * ongoing layout tracking picks it up on its own — no revealScan() call
 * needed here.
 */

(function () {
  "use strict";

  const gallerySection = document.querySelector("#listing-gallery");
  const galleryContainer = document.querySelector("[data-gallery]");
  const mainSection = document.querySelector("#listing-main");
  const notFoundSection = document.querySelector("#listing-not-found");
  if (!mainSection || !notFoundSection) return;

  // //! CONFIRM — down payment / rate / amortization are assumptions,
  // not MLS data (nothing in the feed supplies them). Change here if
  // Jayden wants different defaults; every visitor sees the same figure
  // regardless of their actual financing.
  const CARRYING_COST_ASSUMPTIONS = {
    downPaymentPercent: 0.20,
    annualRatePercent: 5.99,
    amortizationYears: 25,
  };

  const currency = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

  function keyFromUrl() {
    // /listings/<key>/ — the rewrite means this file is physically at
    // /listings/details/, but the browser's own URL (what the rewrite
    // preserves) is what's actually being read here.
    const match = window.location.pathname.match(/^\/listings\/([^/]+)\/?$/);
    const key = match ? match[1] : null;
    return key && key !== "details" ? key : null;
  }

  function setField(name, value) {
    const el = document.querySelector('[data-field="' + name + '"]');
    if (el) el.textContent = value;
  }

  function statusLabel(status) {
    if (status === "Active") return "For sale";
    if (status === "Closed") return "Sold";
    return status || "";
  }

  function monthlyMortgagePayment(price) {
    const { downPaymentPercent, annualRatePercent, amortizationYears } = CARRYING_COST_ASSUMPTIONS;
    const principal = price * (1 - downPaymentPercent);
    const monthlyRate = annualRatePercent / 100 / 12;
    const numPayments = amortizationYears * 12;

    if (monthlyRate === 0) return principal / numPayments;

    const factor = Math.pow(1 + monthlyRate, numPayments);
    return (principal * monthlyRate * factor) / (factor - 1);
  }

  function galleryMarkup(photos, altBase) {
    const shown = photos.slice(0, 3);
    if (!shown.length) return "";

    const [lead, ...stack] = shown;

    let html =
      '<picture class="cs-picture cs-picture-lead cs-reveal">' +
      '<img class="cs-img" src="' + lead + '" alt="' + altBase + ', exterior" ' +
      'width="1400" height="1050" loading="eager" decoding="async">' +
      "</picture>";

    if (stack.length) {
      html +=
        '<div class="cs-stack">' +
        stack
          .map(
            (url, i) =>
              '<picture class="cs-picture cs-reveal">' +
              '<img class="cs-img" src="' + url + '" alt="' + altBase + ', photo ' + (i + 2) + '" ' +
              'width="700" height="525" loading="' + (i === 0 ? "eager" : "lazy") + '" decoding="async">' +
              "</picture>"
          )
          .join("") +
        "</div>";
    }

    return html;
  }

  function renderRemarks(text) {
    const container = document.querySelector('[data-field="remarks"]');
    if (!container) return;

    if (!text) {
      container.innerHTML = '<p class="cs-note">No description provided for this listing.</p>';
      return;
    }

    // RESO remarks are plain text, not HTML — split on blank lines into
    // paragraphs rather than dumping one unbroken block, and escape
    // anything that looks like a tag so a stray "<" in the copy can't
    // be interpreted as markup.
    const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    container.innerHTML = (paragraphs.length ? paragraphs : [text])
      .map((p) => '<p class="cs-note">' + escape(p) + "</p>")
      .join("");
  }

  function render(listing) {
    const isLease = listing.transactionType === "For Lease";

    document.title = listing.address + ", " + listing.city + " | Jayden Kennedy";

    setField("status", statusLabel(listing.status));
    setField("title", listing.address + ", " + listing.city);

    const meta = [
      // "/mo" on a lease's price — without it, $2,500 reads as an oddly
      // cheap purchase price rather than what it actually is, monthly rent.
      typeof listing.price === "number" ? currency.format(listing.price) + (isLease ? "/mo" : "") : null,
      listing.beds != null ? listing.beds + " bed" : null,
      listing.baths != null ? listing.baths + " bath" : null,
      listing.sqft ? listing.sqft + " sq ft" : null,
      listing.propertyType,
    ]
      .filter(Boolean)
      .join(" · ");
    setField("meta", meta);

    renderRemarks(listing.publicRemarks);

    // A tenant doesn't carry a mortgage, and property tax/maintenance
    // are the owner's costs, not theirs — the rent in the meta line
    // above is the whole picture for a lease. Running the mortgage
    // formula against a lease's price (a monthly rent figure, not a
    // purchase price) previously produced a nonsensical few-dollar
    // "carrying cost" — this block is skipped entirely for a lease
    // rather than shown with wrong numbers.
    const ownershipCosts = document.querySelector('[data-field-group="ownership-costs"]');
    if (ownershipCosts) ownershipCosts.hidden = isLease;

    if (!isLease) {
      setField(
        "tax",
        typeof listing.taxAnnualAmount === "number" ? currency.format(listing.taxAnnualAmount) + "/yr" : "Not available"
      );

      const maintenanceGroup = document.querySelector('[data-field-group="maintenance"]');
      if (maintenanceGroup) {
        const hasFee = typeof listing.associationFee === "number" && listing.associationFee > 0;
        maintenanceGroup.hidden = !hasFee;
        if (hasFee) setField("maintenance", currency.format(listing.associationFee) + "/mo");
      }

      if (typeof listing.price === "number") {
        setField("carrying", currency.format(monthlyMortgagePayment(listing.price)) + "/mo");
      }

      const { downPaymentPercent, annualRatePercent, amortizationYears } = CARRYING_COST_ASSUMPTIONS;
      setField(
        "carrying-footnote",
        "Estimated at " + Math.round(downPaymentPercent * 100) + "% down over " + amortizationYears +
          " years at an assumed " + annualRatePercent + "% rate. Calculated, not quoted — ask for the real numbers."
      );
    }

    setField("mls-number", listing.key || "");

    if (gallerySection && galleryContainer) {
      const markup = galleryMarkup(listing.galleryPhotos || [], listing.address);
      if (markup) {
        galleryContainer.innerHTML = markup;
        gallerySection.hidden = false;
      }
    }

    mainSection.hidden = false;
  }

  function showNotFound() {
    notFoundSection.hidden = false;
  }

  const key = keyFromUrl();
  if (!key) {
    showNotFound();
    return;
  }

  fetch("/.netlify/functions/listing-detail?key=" + encodeURIComponent(key))
    .then((response) => {
      if (!response.ok) throw new Error("listing-detail " + response.status);
      return response.json();
    })
    .then((data) => {
      if (!data.listing) throw new Error("no listing in response");
      render(data.listing);
    })
    .catch((error) => {
      console.warn("[listing-detail]", error.message);
      showNotFound();
    });
})();
