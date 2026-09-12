/**
 * Listings map (/listings/map/).
 *
 * PropTx supplies no coordinates at all (verified against live data —
 * Latitude/Longitude aren't null, they're absent from the schema
 * entirely), so every pin here is geocoded client-side from the
 * listing's real address via Mapbox's Geocoding API, using the same
 * public token as the map itself. That's the intended way to use a
 * Mapbox token — it's restricted by URL/referrer allowlisting in the
 * Mapbox account dashboard, not by keeping it secret — unlike the
 * PropTx/FUB tokens elsewhere in this project, which stay server-side.
 *
 * Geocoded coordinates are cached in sessionStorage keyed by the exact
 * address string, so re-filtering or revisiting within the same tab
 * doesn't re-geocode addresses already resolved — geocoding calls count
 * against Mapbox's free-tier quota same as map loads do.
 *
 * No side list — each pin's own popup (photo, price, address, specs) is
 * the "card" for that listing. The first pin's popup (most recently
 * updated listing, per the default sort) opens automatically on load
 * rather than waiting for a click, so the page reads at a glance rather
 * than requiring interaction first; the rest open on click, same as any
 * other map.
 */

(function () {
  "use strict";

  const mapEl = document.querySelector("[data-map]");
  const form = document.getElementById("listings-form");
  if (!mapEl || !form) return;

  // Set MAPBOX_TOKEN in Netlify's dashboard env vars (production) or
  // .env.local (local dev) — see src/config/processors/javascript.js,
  // which substitutes this at BUILD time via esbuild's `define`. It
  // isn't a runtime env lookup (there's no server here to do that
  // against); the actual token value still ends up in the shipped JS
  // bundle either way, same as any Mapbox public token must, since the
  // browser has to send it to Mapbox's API directly. The point of doing
  // it this way isn't to hide the value from the browser — it's to keep
  // it out of source control, so rotating it is a dashboard edit, not a
  // commit, and so a real value never sits in git history where GitHub's
  // secret scanning (correctly) blocks pushing it, hardcoded literal or
  // not.
  const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || "";

  const countEl = document.querySelector("[data-count]");
  const emptyEl = document.querySelector("[data-empty]");

  const currency = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

  function show(el, visible) {
    if (!el) return;
    el.classList.toggle("cs-hidden", !visible);
    el.hidden = !visible;
  }

  function setCount(total) {
    if (!countEl) return;
    countEl.textContent = total === 1 ? "1 home" : total + " homes";
  }

  function currentParams() {
    return new URLSearchParams(new FormData(form));
  }

  // sessionStorage, not localStorage: geocoding results are cheap to
  // redo across visits and this avoids the small risk of a stale pin
  // surviving indefinitely if an address is ever corrected upstream.
  function cacheGet(address) {
    try {
      const raw = sessionStorage.getItem("jk:geocode:" + address);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function cacheSet(address, coords) {
    try {
      sessionStorage.setItem("jk:geocode:" + address, JSON.stringify(coords));
    } catch {
      // Private mode or storage full/disabled — geocoding still works
      // for this page view, just re-fetched on the next one.
    }
  }

  async function geocode(address) {
    const cached = cacheGet(address);
    if (cached) return cached;

    const url =
      "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
      encodeURIComponent(address) +
      ".json?limit=1&country=CA&access_token=" +
      encodeURIComponent(MAPBOX_TOKEN);

    const response = await fetch(url);
    if (!response.ok) throw new Error("geocoding " + response.status);

    const data = await response.json();
    const feature = data.features && data.features[0];
    if (!feature) return null;

    // Mapbox returns [lng, lat] — GeoJSON order, not the more common
    // lat/lng — kept in that order here since Mapbox GL's own marker
    // API expects the same order back.
    const coords = feature.center;
    cacheSet(address, coords);
    return coords;
  }

  function cardHtml(listing) {
    const price = typeof listing.price === "number" ? currency.format(listing.price) : "";
    const specs = [
      listing.beds != null ? listing.beds + " bed" : null,
      listing.baths != null ? listing.baths + " bath" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      '<a class="cs-map-popup-card" href="/listings/' + encodeURIComponent(listing.key) + '/">' +
      '<img src="' + (listing.cardPhoto || "/assets/images/listings/listing-01.jpg") + '" alt="" loading="lazy">' +
      '<span class="cs-map-popup-price">' + price + "</span>" +
      '<span class="cs-map-popup-address">' + (listing.address || "") + "</span>" +
      (specs ? '<span class="cs-map-popup-specs">' + specs + "</span>" : "") +
      "</a>"
    );
  }

  function popupHtml(listingsAtPin) {
    // A shared address (a multi-unit building — two of the current
    // listings are literally the same street address, unit letter
    // aside) geocodes to the exact same coordinates. Without grouping,
    // the second marker draws directly on top of the first and is
    // effectively invisible — the count above the map would say one
    // more than what's actually visible. One marker per pin, one popup
    // holding every listing there, is the fix.
    const wrapperClass = listingsAtPin.length > 1 ? "cs-map-popup cs-map-popup-multi" : "cs-map-popup";
    return '<div class="' + wrapperClass + '">' + listingsAtPin.map(cardHtml).join("") + "</div>";
  }

  // Same coordinates, rounded, share one marker — see popupHtml above.
  // 5 decimal places is roughly 1 metre of precision, tight enough that
  // two genuinely distinct nearby addresses won't accidentally merge.
  function coordKey(coords) {
    return coords[0].toFixed(5) + "," + coords[1].toFixed(5);
  }

  async function plotListings(map, listings) {
    const bounds = new mapboxgl.LngLatBounds();
    const byCoord = new Map();

    // Sequential, not Promise.all: Mapbox's Geocoding API has a request
    // rate limit per token, and this page's listing count (currently a
    // handful) makes the wait from going one-at-a-time negligible. A
    // much larger board would want batching here instead.
    for (const listing of listings) {
      if (!listing.address) continue;

      let coords;
      try {
        coords = await geocode(listing.address);
      } catch (error) {
        console.warn("[listings-map] geocoding failed for", listing.address, error.message);
        continue;
      }
      if (!coords) continue;

      const key = coordKey(coords);
      if (!byCoord.has(key)) byCoord.set(key, { coords, listings: [] });
      byCoord.get(key).listings.push(listing);
    }

    let plotted = 0;
    let pinIndex = 0;
    const allPopups = [];

    // byCoord preserves insertion order, which is the order `listings`
    // arrived in (server-sorted — ModificationTimestamp desc by
    // default), so the first entry here is the most recently updated
    // listing. Only that one's popup opens automatically; the rest wait
    // for a click, or the page reads as one long wall of open cards
    // rather than a map.
    byCoord.forEach(({ coords, listings: listingsAtPin }) => {
      const popup = new mapboxgl.Popup({ offset: 24, maxWidth: "none", closeButton: true, closeOnClick: false }).setHTML(
        popupHtml(listingsAtPin)
      );

      // Mapbox gives each marker its own independent popup — clicking a
      // second marker opens its popup without touching the first one's,
      // so left alone this map accumulates every popup ever clicked.
      // 'open' fires for both a marker click (Marker wires this
      // internally) and the auto-open below, so closing every other
      // tracked popup here keeps at most one open at a time regardless
      // of which path triggered it.
      popup.on("open", () => {
        allPopups.forEach((p) => {
          if (p !== popup) p.remove();
        });
      });
      allPopups.push(popup);

      new mapboxgl.Marker({ color: "#3B2A20" }).setLngLat(coords).setPopup(popup).addTo(map);

      // addTo(map) must run first: a Mapbox popup has nothing to attach
      // to until its marker is on the map.
      if (pinIndex === 0) popup.addTo(map);
      pinIndex += 1;

      bounds.extend(coords);
      plotted += listingsAtPin.length;
    });

    if (plotted > 0) {
      map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 });
    }

    return plotted;
  }

  function initMap() {
    if (typeof mapboxgl === "undefined") {
      mapEl.innerHTML =
        '<p class="cs-map-error">The map library didn’t load. Check your connection and refresh.</p>';
      return null;
    }

    if (!MAPBOX_TOKEN) {
      // esbuild substitutes an empty string when the MAPBOX_TOKEN env
      // var isn't set at build time — see the `define` in
      // src/config/processors/javascript.js.
      mapEl.innerHTML =
        '<p class="cs-map-error">Map is not configured yet. //! CONFIRM — set MAPBOX_TOKEN in Netlify’s dashboard env vars or .env.local, then rebuild.</p>';
      return null;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    return new mapboxgl.Map({
      container: mapEl,
      style: "mapbox://styles/mapbox/light-v11",
      // Ontario-wide fallback view, replaced by fitBounds once real
      // pins are plotted — only visible for an instant, or at all if
      // geocoding comes back empty.
      center: [-79.38, 43.9],
      zoom: 8,
    });
  }

  async function load(map) {
    if (countEl) countEl.textContent = "Loading…";
    show(emptyEl, false);

    try {
      const response = await fetch("/.netlify/functions/listings-map?" + currentParams().toString());
      if (!response.ok) throw new Error("listings-map " + response.status);

      const data = await response.json();
      const listings = Array.isArray(data.listings) ? data.listings : [];

      setCount(listings.length);
      show(emptyEl, listings.length === 0);

      if (!listings.length) return;

      await plotListings(map, listings);
    } catch (error) {
      console.warn("[listings-map]", error.message);
      if (countEl) countEl.textContent = "Unable to load listings";
    }
  }

  const map = initMap();
  if (!map) return;

  map.on("load", () => {
    load(map);

    // Re-filtering resubmits the form (a real navigation, per
    // listings-filter-form.html's method="get") on wide viewports where
    // Apply auto-submits on change — the page reloads with the new
    // query string and this whole script re-runs from scratch, so
    // there's no separate "refetch without reload" path to wire here.
  });
})();
