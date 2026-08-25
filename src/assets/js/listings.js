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

const FIELDS = ["municipality", "price", "beds", "type", "status", "sort"];

function labelFor(select) {
  const option = select.options[select.selectedIndex];
  return option ? option.textContent.trim() : "";
}

/**
 * Restores the selects from the query string and writes the applied
 * label. Returns the count of meaningful filters so the collapsed
 * toggle can show it — see initFilterToggle.
 *
 * @returns {number} filters in effect, excluding sort and the default status
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
    if (select.value) applied.push(labelFor(select));
  });

  const meaningful = applied.filter((text) => text && text !== "Active");

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
initFilterToggle(restoreState());
syncCount();
initSort();