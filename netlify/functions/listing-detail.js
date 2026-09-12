/**
 * GET /.netlify/functions/listing-detail?key=<ListingKey>
 *
 * Backs /listings/details/ (see the Netlify redirect that maps the
 * pretty URL /listings/<ListingKey>/ to that one physical page — this
 * function is what actually resolves the key in the URL to real data).
 * Works for any status (Active or Closed): the Listings and Results
 * cards both link here, and a closed deal's facts (address, price, tax,
 * remarks) are just as real as an active one's.
 */

const { queryOData } = require("./lib/proptx");
const { mapListingDetail } = require("./lib/mapListing");

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

function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

exports.handler = async (event) => {
  const key = (event.queryStringParameters || {}).key;

  if (!key) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing listing key" }),
    };
  }

  try {
    const data = await queryOData("Property", {
      $filter: `ListingKey eq '${escapeODataString(key)}'`,
      // No top-level $select — see homepage-listings.js for why that
      // silently breaks when paired with this nested Media $select.
      $expand: `Media($select=${MEDIA_SELECT};$filter=MediaCategory eq 'Photo' and MediaStatus eq 'Active')`,
      $top: "1",
    });

    const record = (data.value || [])[0];
    const listing = mapListingDetail(record);

    if (!listing) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Listing not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
      body: JSON.stringify({ listing }),
    };
  } catch (error) {
    console.error("[listing-detail]", error.message, error.body || "");
    return {
      statusCode: error.status || 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to load this listing right now." }),
    };
  }
};
