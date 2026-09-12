/**
 * GET /.netlify/functions/results-search
 *
 * Backs the /results/ archive: closed deals only, filtered by
 * municipality/tenure, sorted by PurchaseContractDate (see
 * lib/resultsFilter.js for why, not the missing CloseDate). Mirrors
 * listings-search.js's pagination — PropTx's own $skiptoken, surfaced
 * as an opaque `nextCursor` — see that file for why $skip isn't used.
 */

const { queryOData } = require("./lib/proptx");
const { mapListing } = require("./lib/mapListing");
const { buildQuery } = require("./lib/resultsFilter");

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

    if (!after) query.$count = "true";
    if (after) query.$skiptoken = after;

    const data = await queryOData("Property", query);

    const listings = (data.value || []).map(mapListing).filter(Boolean);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
      body: JSON.stringify({
        listings,
        total: after ? undefined : data["@odata.count"],
        nextCursor: extractSkiptoken(data["@odata.nextLink"]),
      }),
    };
  } catch (error) {
    console.error("[results-search]", error.message, error.body || "");
    return {
      statusCode: error.status || 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to load closings right now." }),
    };
  }
};
