/**
 * Featured listings, homepage.
 *
 * #listings ships three static cards with bracketed RESO placeholders —
 * the no-JS state, and what stays on screen if the fetch below fails.
 * On success this replaces them with live PropTx data pulled through the
 * homepage-listings Netlify Function (the DLA token never reaches the
 * browser, so the card group must be filled in from here, not baked in
 * at build time).
 *
 * The section's own [data-reveal] is bound once by reveal.js on load,
 * against the section element itself, not the individual cards — so
 * swapping the cards' innerHTML later doesn't need a revealScan() call.
 * The stagger on each .cs-item is pure CSS keyed off the ancestor's
 * .cs-visible class plus --reveal-i, and applies to whatever is in the
 * DOM whenever that class lands.
 */

(function () {
  "use strict";

  const list = document.querySelector("#listings .cs-card-group");
  if (!list) return;

  const currency = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

  function statusLabel(status) {
    if (status === "Active") return "For sale";
    return status || "";
  }

  function cardMarkup(listing, index) {
    const price = typeof listing.price === "number" ? currency.format(listing.price) : "";
    const specs = [
      listing.beds != null ? `${listing.beds} bed` : null,
      listing.baths != null ? `${listing.baths} bath` : null,
      listing.sqft ? `${listing.sqft} sq ft` : null,
    ]
      .filter(Boolean)
      .join(" &middot; ");

    const photo = listing.cardPhoto || "/assets/images/portfolio/port1.jpg";

    // City, ON rather than a region label: inventory now spans Brantford,
    // Durham and York, and Brantford's own county name is also
    // "Brantford" — a hardcoded region suffix would read redundant there
    // and wrong elsewhere.
    return `
      <li class="cs-item cs-reveal" style="--reveal-i: ${index}">
        <a href="/listings/${encodeURIComponent(listing.key)}/" class="cs-link">
          <picture class="cs-picture">
            <img src="${photo}"
                 alt=""
                 width="1200" height="800"
                 loading="lazy" decoding="async">
          </picture>

          <div class="cs-info">
            <div class="cs-meta">
              <span class="cs-badge">${statusLabel(listing.status)}</span>
              <span class="cs-mls">MLS&reg; ${listing.key || ""}</span>
            </div>

            <span class="cs-address">${listing.address || ""}</span>
            <span class="cs-city">${listing.city || ""}, ON</span>

            <div class="cs-figures">
              <span class="cs-price">${price}</span>
              <span class="cs-specs">${specs}</span>
            </div>
          </div>
        </a>
      </li>
    `;
  }

  fetch("/.netlify/functions/homepage-listings")
    .then((response) => {
      if (!response.ok) throw new Error(`homepage-listings ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const listings = Array.isArray(data.listings) ? data.listings : [];
      if (!listings.length) return; // leave the static fallback cards in place

      list.innerHTML = listings
        .slice(0, 3)
        .map((listing, index) => cardMarkup(listing, index))
        .join("");
    })
    .catch((error) => {
      // Leave the static fallback cards in place — this is a homepage
      // teaser, not the primary search surface, so failing quiet beats
      // failing loud here.
      console.warn("[featured-listings]", error.message);
    });
})();
