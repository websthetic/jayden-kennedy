/**
 * GET /.netlify/functions/homepage-listings
 *
 * Featured-listings feed for the homepage. No City/CountyOrParish filter
 * — this token is already scoped to just this agent's own listings (see
 * lib/proptx.js), and a live survey showed his current Active inventory
 * spread across Brantford, Clarington (Durham) and Newmarket (York), not
 * one fixed farm area. An earlier version hardcoded City eq 'Ajax' and
 * CountyOrParish eq 'Durham', which matched zero of his real listings —
 * the homepage silently fell back to its static placeholder cards every
 * time. StandardStatus eq 'Active' is the only filter that should ever
 * be needed here; this is not a general-purpose search endpoint (see
 * listings-search for that).
 */

const { queryOData } = require("./lib/proptx");
const { mapListing } = require("./lib/mapListing");

const FILTER = "StandardStatus eq 'Active'";

// //! CONFIRM — no top-level $select here. PropTx returns HTTP 200 with
// an EMPTY body (no error) when a top-level $select on Property is
// combined with a nested $select inside $expand=Media(...) — verified
// against the live API, reproducible, no workaround found. The nested
// Media $select is the one worth keeping (media rows repeat 5-10x per
// photo across size variants); mapListing() already only reads the
// Property fields it needs, so the unselected ~400-field RESO schema
// just costs some bytes of nulls, not correctness.
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

exports.handler = async () => {
  try {
    const data = await queryOData("Property", {
      $filter: FILTER,
      // Nested $select/$filter narrows Media server-side; isPublicPhoto()
      // in mapListing still re-checks Permission client-side regardless,
      // since that's the field the public site can never get wrong.
      $expand: `Media($select=${MEDIA_SELECT};$filter=MediaCategory eq 'Photo' and MediaStatus eq 'Active')`,
      $top: "12",
      $orderby: "ModificationTimestamp desc",
    });

    const listings = (data.value || [])
      .map(mapListing)
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // Short edge cache: keeps repeat homepage loads cheap without
        // going stale for long against a feed that updates continuously.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
      body: JSON.stringify({ listings }),
    };
  } catch (error) {
    console.error("[homepage-listings]", error.message, error.body || "");
    return {
      statusCode: error.status || 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to load listings right now." }),
    };
  }
};
