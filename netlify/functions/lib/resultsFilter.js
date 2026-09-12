/**
 * Translates the /results/ form's query-string params (municipality,
 * tenure, sort) into an OData $filter / $orderby pair for the Property
 * resource. StandardStatus eq 'Closed' is always applied — this page is
 * an archive of closed deals, not a live board — narrowed further by an
 * optional City filter (municipality) and an optional tenure filter on
 * TransactionType.
 *
 * CITY_MAP is built from src/_data/listingFilters.json's resultsCities
 * list — the same file results.html's municipality dropdown renders
 * from (see that page's {% for %} loop) — rather than hardcoded here a
 * second time. That file is editable in the CMS under "Listing Search
 * Filters", so adding or removing a closed-deal city needs no code
 * change. A separate list from listingsFilter.js's regions/cities: a
 * closed deal can be anywhere Jayden has ever transacted, not just the
 * areas with current active inventory.
 */

const filters = require("../../../src/_data/listingFilters.json");

// City <option value> -> the RESO City field's actual casing (resoValue).
const CITY_MAP = Object.fromEntries((filters.resultsCities || []).map((c) => [c.value, c.resoValue]));

function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

function eq(field, value) {
  return `${field} eq '${escapeODataString(value)}'`;
}

/**
 * @param {URLSearchParams} params
 * @returns {{ filter: string, orderby: string }}
 */
function buildQuery(params) {
  const clauses = [eq("StandardStatus", "Closed")];

  const municipality = params.get("municipality");
  if (municipality && CITY_MAP[municipality]) clauses.push(eq("City", CITY_MAP[municipality]));

  // tenure="" is the form's "Sold or leased" default — no TransactionType
  // filter, both kinds of closing show.
  const tenure = params.get("tenure");
  if (tenure === "sold") clauses.push(eq("TransactionType", "For Sale"));
  if (tenure === "leased") clauses.push(eq("TransactionType", "For Lease"));

  // ClosePrice/CloseDate aren't in this feed (see lib/mapListing.js) —
  // PurchaseContractDate (accepted-offer date) is the closest available
  // stand-in for "how recent is this closing".
  const sort = params.get("sort") || "newest";
  const orderby =
    sort === "price-desc" ? "ListPrice desc" : sort === "price-asc" ? "ListPrice asc" : "PurchaseContractDate desc";

  return { filter: clauses.join(" and "), orderby };
}

module.exports = { buildQuery, CITY_MAP };
