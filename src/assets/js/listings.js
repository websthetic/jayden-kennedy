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

  const appliedEl = document.querySelector("[data-applied]");
  const labelEl = document.querySelector("[data-applied-label]");
  if (!appliedEl || !labelEl) return;

  const meaningful = applied.filter((text) => text && text !== "Active");

  if (meaningful.length) {
    labelEl.textContent = meaningful.join(" \u00B7 ");
    appliedEl.hidden = false;
  } else {
    appliedEl.hidden = true;
  }
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

window.revealScan?.();
restoreState();
syncCount();
initSort();