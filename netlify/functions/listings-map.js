/**
 * GET /.netlify/functions/listings-map
 *
 * Backs /listings/map/. Same filter params and same lib/listingsFilter.js
 * query-building as listings-search, but returns every matching listing
 * in one response instead of a 12-per-page cursor — a map needs every
 * pin at once, there's no "Load more" equivalent for a viewport of dots.
 * $top is a generous cap (200) rather than unbounded, purely as a
 * runaway-cost guard against this token's own inventory ever growing
 * far beyond what it is today; nothing in the current data gets close.
 *
 * Coordinates are NOT resolved here. PropTx's Property resource has no
 * Latitude/Longitude fields at all (verified against live data — not
 * null, entirely absent from the schema), so every listing this returns
 * still needs geocoding from its address. That happens client-side, in
 * listings-map.js, against Mapbox's Geocoding API directly — Mapbox's
 * public token is designed to be used from the browser (restricted by
 * URL/referrer allowlisting in the Mapbox account, not by secrecy),
 * unlike the PropTx/FUB tokens this project keeps server-side. Doing it
 * there also means each visitor's browser can cache geocoded addresses
 * in sessionStorage rather than this function re-geocoding on every
 * request.
 */

const { queryOData } = require("./lib/proptx");
const { mapListing } = require("./lib/mapListing");
const { buildQuery } = require("./lib/listingsFilter");

// PropTx caps $top at 100 whenever $expand is present (confirmed live:
// $top=200 + $expand=Media returns a 400, "1108 - $top limited to 100 if
// $expand is specified") — 100 is the actual ceiling, not a choice.
const MAP_CAP = 100;

const MEDIA_SELECT = [
  "MediaObjectID",
  "MediaKey",
  "MediaURL",
  "Order",
  "MediaCategory",
  "ImageSizeDescription",
  "PreferredPhotoYN",
  "Permission",
  "MediaStatus",
].join(",");

exports.handler = async (event) => {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const { filter, orderby } = buildQuery(params);

    const data = await queryOData("Property", {
      $filter: filter,
      $orderby: orderby,
      // No top-level $select — see homepage-listings.js for why that
      // silently breaks when paired with this nested Media $select.
      $expand: `Media($select=${MEDIA_SELECT};$filter=MediaCategory eq 'Photo' and MediaStatus eq 'Active')`,
      $top: String(MAP_CAP),
    });

    const listings = (data.value || []).map(mapListing).filter(Boolean);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
      body: JSON.stringify({ listings }),
    };
  } catch (error) {
    console.error("[listings-map]", error.message, error.body || "");
    return {
      statusCode: error.status || 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to load the map right now." }),
    };
  }
};
