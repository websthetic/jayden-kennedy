/**
 * GET /.netlify/functions/listings-search
 *
 * Backs the /listings/ board: translates the filter form's query string
 * into a PropTx query and returns one page of cards plus a cursor for
 * "Load more". Every filter param (region, city, price, beds, baths,
 * type, status) is optional and independent — see lib/listingsFilter.js
 * for how each one maps to an OData clause and how they combine.
 *
 * Pagination is PropTx's own server-driven $skiptoken, not $skip/$offset
 * — verified live that plain $skip is not how this API pages results.
 * The token is opaque to the client: page 1 returns it as `nextCursor`,
 * "Load more" sends it back as `after`, and this function re-issues it
 * as $skiptoken alongside the SAME $filter/$orderby (a skiptoken encodes
 * a position in one particular sort order and is only valid against the
 * query that produced it).
 */

const { queryOData } = require("./lib/proptx");
const { mapListing } = require("./lib/mapListing");
const { buildQuery } = require("./lib/listingsFilter");

const PAGE_SIZE = 12;

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

function extractSkiptoken(nextLink) {
  if (!nextLink) return null;
  try {
    return new URL(nextLink).searchParams.get("$skiptoken");
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const { filter, orderby } = buildQuery(params);
    const after = params.get("after");

    const query = {
      $filter: filter,
      $orderby: orderby,
      // No top-level $select — see homepage-listings.js for why that
      // silently breaks when paired with this nested Media $select.
      $expand: `Media($select=${MEDIA_SELECT};$filter=MediaCategory eq 'Photo' and MediaStatus eq 'Active')`,
      $top: String(PAGE_SIZE),
    };

    // Total is only meaningful (and only fetched) on the first page —
    // it doesn't change page to page and re-requesting it on every
    // "Load more" click would be wasted work.
    if (!after) query.$count = "true";
    if (after) query.$skiptoken = after;

    const data = await queryOData("Property", query);

    const listings = (data.value || []).map(mapListing).filter(Boolean);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
      body: JSON.stringify({
        listings,
        total: after ? undefined : data["@odata.count"],
        nextCursor: extractSkiptoken(data["@odata.nextLink"]),
      }),
    };
  } catch (error) {
    console.error("[listings-search]", error.message, error.body || "");
    return {
      statusCode: error.status || 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to search listings right now." }),
    };
  }
};
