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
 *
 * Wrapped in an IIFE. Every name below was previously in global script scope,
 * where a second classic script declaring any of them is a SyntaxError that
 * kills both files with nothing in the console naming the cause — the failure
 * already seen on Results.
 */

(function () {
  "use strict";

  const FIELDS = ["region", "city", "price", "beds", "baths", "type", "status", "sort"];

  /* Values that mean "no filter" even though the select has a value.
     Region defaults to the whole GTA and status to for-sale, so neither
     should count toward the collapsed toggle's badge. */
  const DEFAULTS = { region: "gta", status: "active" };

  /**
   * Show and hide.
   *
   * Not the hidden attribute. Its UA rule is [hidden] { display: none },
   * which any author display on .cs-card-group, .cs-empty or .cs-more
   * beats on specificity — the grid would stay visible and the empty
   * state, which ships hidden in the markup, would render permanently.
   * .cs-hidden carries !important in listings.less and always wins.
   */
  function show(el, visible) {
    if (!el) return;
    el.classList.toggle("cs-hidden", !visible);
    el.hidden = !visible;
  }

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
      show(appliedEl, true);
    } else {
      show(appliedEl, false);
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
   *
   * The region is read from the query string here rather than from the
   * select, because restoreState has not run yet and the select still
   * holds the markup default.
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

    function sync(forRegion) {
      const r = forRegion === undefined ? region.value : forRegion;
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

    region.addEventListener("change", () => sync());

    // Was missing. Without it the narrowing only ever happened after a
    // manual region change: landing on ?region=durham left Markham and
    // Brampton in the list.
    const params = new URLSearchParams(window.location.search);
    sync(params.get("region") || region.value);
  }

  /**
   * //! CONFIRM — the count is the number of cards in the DOM, which is
   * //! right while the grid is a static six and wrong the moment the
   * //! feed paginates: showing 12 of 34 would read "12 homes". Replace
   * //! with the total from the feed response when TRREB lands.
   */
  function syncCount() {
    const results = document.querySelector("[data-results]");
    const countEl = document.querySelector("[data-count]");
    if (!results || !countEl) return;

    const total = results.querySelectorAll(".cs-item").length;
    countEl.textContent = total === 1 ? "1 home" : total + " homes";

    show(results, total > 0);
    show(document.querySelector("[data-empty]"), total === 0);
    show(document.querySelector("[data-more]"), total > 0);
  }

  /**
   * Writes the live filter state into the save-search form.
   *
   * Without this the hidden input posts empty and every saved search is
   * the unfiltered board — the handler's fallback becomes the only path
   * and the feature quietly does nothing.
   *
   * Sort is dropped: it changes the order of the results, not which
   * results match, and a saved search has no order.
   */
  function initSavedQuery() {
    const form = document.getElementById("listings-form");
    const target = document.querySelector("[data-saved-query]");
    if (!form || !target) return;

    function sync() {
      const params = new URLSearchParams(new FormData(form));
      params.delete("sort");

      // Defaults carry no meaning, and leaving them in makes two
      // identical searches look different to the handler.
      Object.keys(DEFAULTS).forEach((name) => {
        if (params.get(name) === DEFAULTS[name]) params.delete(name);
      });

      // Empty selects mean "any" and post as name= with no value.
      Array.from(params.keys()).forEach((name) => {
        if (!params.get(name)) params.delete(name);
      });

      target.value = params.toString();
    }

    form.addEventListener("change", sync);
    sync();
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
   *
   * requestSubmit rather than submit: submit() skips both the submit
   * event and constraint validation, which costs nothing today with an
   * all-select row but silently bypasses validation the first time a
   * text input joins it.
   */
  function initAutoApply() {
    const form = document.getElementById("listings-form");
    if (!form) return;

    const wide = window.matchMedia("(min-width: 64rem)");

    form.addEventListener("change", (e) => {
      if (!wide.matches) return;
      if (!e.target.matches(".cs-select")) return;
      form.requestSubmit();
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
      show(countEl, count > 0);
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
  initSavedQuery();
  initSort();
  initAutoApply();
})();