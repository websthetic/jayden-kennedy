/**
 * Listings index.
 *
 * The filter form is a real GET form, so every state is linkable and the page
 * degrades to the unfiltered grid without JS. This reads the query string back
 * on load and restores the selects, the count and the applied-filter label —
 * the parts the static build cannot know.
 *
 * //! CONFIRM — filtering itself is not wired here. Until the TRREB feed lands
 * //! there is nothing to filter against, so this only restores UI state.
 */

const FIELDS = ["region", "city", "price", "beds", "baths", "type", "status", "sort"];

/* Values that mean "no filter" even though the select has a value.
   Region defaults to the whole GTA and status to for-sale, so neither
   should count toward the collapsed toggle's badge. */
const DEFAULTS = { region: "gta", status: "active" };

function labelFor(select) {
  const option = select.options[select.selectedIndex];
  return option ? option.textContent.trim() : "";
}

/**
 * Restores the selects from the query string and writes the applied
 * label. Returns the count of meaningful filters so the collapsed
 * toggle can show it — see initFilterToggle.
 *
 * @returns {number} filters in effect, excluding sort and the defaults
 */
function restoreState() {
  const params = new URLSearchParams(window.location.search);
  const applied = [];

  FIELDS.forEach((name) => {
    const select = document.getElementById(name);
    if (!select) return;

    const value = params.get(name);
    if (value !== null) select.value = value;

    if (name === "sort") return;
    if (!select.value) return;
    if (DEFAULTS[name] === select.value) return;

    applied.push(labelFor(select));
  });

  const meaningful = applied.filter(Boolean);

  const appliedEl = document.querySelector("[data-applied]");
  const labelEl = document.querySelector("[data-applied-label]");
  if (!appliedEl || !labelEl) return meaningful.length;

  if (meaningful.length) {
    labelEl.textContent = meaningful.join(" \u00B7 ");
    appliedEl.hidden = false;
  } else {
    appliedEl.hidden = true;
  }

  return meaningful.length;
}

/**
 * Narrows the city list to the chosen region.
 *
 * Non-matching options are removed rather than disabled: a disabled
 * option is still announced by some screen readers, so the list would
 * read out cities the reader cannot pick. The full set is cached on
 * first run so switching back restores it.
 *
 * Runs before restoreState writes the selects — otherwise a city from
 * the query string could be removed before it is applied.
 */
function initRegionCity() {
  const region = document.querySelector("[data-region]");
  const city = document.querySelector("[data-city]");
  if (!region || !city) return;

  const all = Array.from(city.options).map((o) => ({
    value: o.value,
    text: o.text,
    region: o.dataset.region || "",
  }));

  function sync() {
    const r = region.value;
    const keep = city.value;

    city.textContent = "";

    all.forEach((o) => {
      // The blank "All cities" option has no region and always stays.
      // "gta" is every region, so nothing is filtered out under it.
      if (o.region && r && r !== "gta" && o.region !== r) return;

      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.text;
      if (o.region) opt.dataset.region = o.region;
      city.appendChild(opt);
    });

    const survived = Array.from(city.options).some((o) => o.value === keep);
    city.value = survived ? keep : "";
  }

  region.addEventListener("change", sync);
}

function syncCount() {
  const results = document.querySelector("[data-results]");
  const countEl = document.querySelector("[data-count]");
  if (!results || !countEl) return;

  const total = results.querySelectorAll(".cs-item").length;
  countEl.textContent = total === 1 ? "1 home" : total + " homes";

  const emptyEl = document.querySelector("[data-empty]");
  const moreEl = document.querySelector("[data-more]");

  if (emptyEl) emptyEl.hidden = total !== 0;
  if (moreEl) moreEl.hidden = total === 0;
  results.hidden = total === 0;
}

function initSort() {
  const sort = document.getElementById("sort");
  const form = document.getElementById("listings-form");
  if (!sort || !form) return;

  sort.addEventListener("change", () => {
    const params = new URLSearchParams(new FormData(form));
    params.set("sort", sort.value);
    window.location.search = params.toString();
  });
}

/**
 * Applies the filter row on change from 64rem up, where the Apply
 * button is hidden. Below that the button is visible and carries the
 * submit itself, so this would double up.
 */
function initAutoApply() {
  const form = document.getElementById("listings-form");
  if (!form) return;

  const wide = window.matchMedia("(min-width: 64rem)");

  form.addEventListener("change", (e) => {
    if (!wide.matches) return;
    if (!e.target.matches(".cs-select")) return;
    form.submit();
  });
}

/**
 * Collapses the filter form behind a button on phones.
 *
 * The collapse itself is CSS — .cs-open on the form, gated on .js in
 * listings.less — so there is no flash of an open form before this
 * runs, and no-JS gets the form open with no button at all.
 *
 * The count is the whole point of the pattern. A collapsed bar reading
 * only "Filters" lets someone stare at four homes without registering
 * that a filter is hiding the rest; "Filters (2)" does not.
 *
 * @param {number} count - filters in effect, from restoreState
 */
function initFilterToggle(count) {
  const toggle = document.querySelector("[data-filter-toggle]");
  const form = document.getElementById("listings-form");
  if (!toggle || !form) return;

  const countEl = toggle.querySelector("[data-filter-count]");
  if (countEl) {
    countEl.textContent = count;
    countEl.hidden = count === 0;
  }

  // Open on arrival when something is already applied — landing on a
  // filtered URL behind a closed bar hides the reason for the result.
  if (count > 0) {
    form.classList.add("cs-open");
    toggle.setAttribute("aria-expanded", "true");
  }

  toggle.addEventListener("click", () => {
    const open = form.classList.toggle("cs-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

window.revealScan?.();
initRegionCity();
initFilterToggle(restoreState());
syncCount();
initSort();
initAutoApply();