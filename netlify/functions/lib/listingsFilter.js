/**
 * Translates the /listings/ form's query-string params (region, city,
 * price, beds, baths, type, status, sort) into an OData $filter / $orderby
 * pair for the Property resource.
 *
 * CITY_MAP and REGION_COUNTIES are built from src/_data/listingFilters.json
 * — the same file the listings.html and homepage-finder dropdowns render
 * from (see the {% for %} loops there) — rather than hardcoded here a
 * second time. That file is editable in the CMS under "Listing Search
 * Filters", so adding or removing a searchable region/city needs no code
 * change. It's a static require of a JSON file, so Netlify's function
 * bundler traces and packages it same as any other local module.
 *
 * PropertySubType groupings below are separate — not CMS-managed, since
 * they're TRREB Data Dictionary enum values, not content.
 */

const filters = require("../../../src/_data/listingFilters.json");

// City <option value> -> the RESO City field's actual casing (resoValue),
// which is kept distinct from the dropdown label since MLS spelling and
// display copy don't always match.
const CITY_MAP = Object.fromEntries(filters.cities.map((c) => [c.value, c.resoValue]));

// Region <option value> -> CountyOrParish value(s). Blank ("All areas")
// means no CountyOrParish filter at all; there's no dictionary entry for
// it and buildQuery below relies on that (REGION_COUNTIES[""] is
// undefined).
const REGION_COUNTIES = Object.fromEntries(filters.regions.map((r) => [r.value, [r.resoValue]]));

// type <option value> -> PropertySubType value(s). TRREB's dictionary
// has far more granular subtypes than this five-way UI; each bucket is
// an OR-group over the subtypes that plausibly belong in it.
const TYPE_SUBTYPES = {
  detached: ["Detached"],
  "semi-detached": ["Semi-Detached"],
  townhouse: ["Att/Row/Townhouse"],
  condo: ["Condo Apartment", "Condo Townhouse"],
  multiplex: ["Duplex", "Triplex", "Fourplex", "Multiplex"],
};

function escapeODataString(value) {
  // OData string literals escape a single quote by doubling it.
  return String(value).replace(/'/g, "''");
}

function eq(field, value) {
  return `${field} eq '${escapeODataString(value)}'`;
}

function orGroup(field, values) {
  if (values.length === 1) return eq(field, values[0]);
  return `(${values.map((v) => eq(field, v)).join(" or ")})`;
}

/**
 * @param {URLSearchParams} params
 * @returns {{ filter: string, orderby: string }}
 */
function buildQuery(params) {
  const clauses = [];

  const region = params.get("region") || "";
  const counties = REGION_COUNTIES[region];
  if (counties) clauses.push(orGroup("CountyOrParish", counties));

  const city = params.get("city");
  if (city && CITY_MAP[city]) clauses.push(eq("City", CITY_MAP[city]));

  const price = params.get("price");
  if (price) {
    const [minRaw, maxRaw] = price.split("-");
    const min = Number(minRaw);
    const max = Number(maxRaw);
    if (minRaw && Number.isFinite(min) && min > 0) clauses.push(`ListPrice ge ${min}`);
    if (maxRaw && Number.isFinite(max) && max > 0) clauses.push(`ListPrice le ${max}`);
  }

  const beds = Number(params.get("beds"));
  if (beds > 0) clauses.push(`BedroomsTotal ge ${beds}`);

  const baths = Number(params.get("baths"));
  if (baths > 0) clauses.push(`BathroomsTotalInteger ge ${baths}`);

  const type = params.get("type");
  if (type && TYPE_SUBTYPES[type]) clauses.push(orGroup("PropertySubType", TYPE_SUBTYPES[type]));

  // status=active (the form's default) shows only current inventory;
  // "any" is the form's "For sale and sold" option — Cancelled/Expired/
  // Terminated records are never shown on the public board either way.
  const status = params.get("status") || "active";
  if (status === "any") {
    clauses.push(orGroup("StandardStatus", ["Active", "Closed"]));
  } else {
    clauses.push(eq("StandardStatus", "Active"));
  }

  const sort = params.get("sort") || "newest";
  const orderby =
    sort === "price-desc"
      ? "ListPrice desc"
      : sort === "price-asc"
      ? "ListPrice asc"
      : "ModificationTimestamp desc";

  return { filter: clauses.join(" and "), orderby };
}

module.exports = { buildQuery, CITY_MAP, REGION_COUNTIES, TYPE_SUBTYPES };
