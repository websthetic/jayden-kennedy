/**
 * PropTx / AMPRE RESO Web API client.
 *
 * The DLA token lives only in server-side env vars (Netlify env in
 * production, .env.local for `netlify dev`) and never reaches the
 * browser — every front-end call goes through a Netlify Function that
 * imports this instead of calling ampre.ca directly.
 */

const BASE_URL = process.env.PROPTX_BASE_URL || "https://query.ampre.ca/odata";

function getToken() {
  const token = process.env.PROPTX_DLA_TOKEN;
  if (!token) {
    throw new Error(
      "PROPTX_DLA_TOKEN is not set. Add it to .env.local (dev) or the Netlify site's environment variables (production)."
    );
  }
  return token;
}

/**
 * Runs a query against a RESO resource (e.g. "Property", "Media").
 *
 * @param {string} resource - RESO resource name, e.g. "Property".
 * @param {Record<string, string>} params - OData query options, e.g.
 *   { $filter: "City eq 'Ajax'", $expand: "Media", $top: "12" }.
 */
async function queryOData(resource, params = {}) {
  // Built by hand rather than via URLSearchParams: URLSearchParams
  // percent-encodes keys, turning "$filter" into "%24filter". PropTx's
  // OData server matches query option names as literal "$filter" and
  // never decodes the key back — a %24-encoded key is silently treated
  // as an unrecognized param, and combined with $select it comes back
  // as a cryptic "Edm.Boolean and Edm.String are not compatible" 400
  // rather than a clear "unknown parameter". Values are still encoded
  // normally; only the leading "$" on the option name is kept literal.
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  const url = `${BASE_URL}/${resource}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(`PropTx ${resource} query failed: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return response.json();
}

module.exports = { queryOData, BASE_URL };
