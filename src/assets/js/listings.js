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

  // Shared between listings.html and results.html, which have different
  // field sets (region/city/... vs. municipality/tenure) — every name
  // is checked with getElementById and skipped if the current page
  // doesn't have it, so listing both here is safe and lets restoreState
  // restore either page's selects from its own query string.
  const FIELDS = ["region", "city", "price", "beds", "baths", "type", "status", "municipality", "tenure", "sort"];

  /* Values that mean "no filter" even though the select has a value.
     Status defaults to for-sale, so it shouldn't count toward the
     collapsed toggle's badge. Region's default is now the blank "All
     areas" option, which restoreState already treats as unset via its
     own `if (!select.value) return` check below — nothing to list here
     for it. */
  const DEFAULTS = { status: "active" };

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
   *
   * Wires every [data-region]/[data-city] pair on the page, not just
   * one — the homepage carries two independent finders (the hero
   * #finder and the #listings section's inline one) alongside the real
   * /listings/ and /listings/map/ boards, and each needs its own
   * narrowing without touching the others. A pair is a region select
   * and the [data-city] select inside the same <form>; querying within
   * that form rather than the whole document is what keeps two finders
   * on one page from cross-wiring each other's city list.
   */
  function initRegionCity() {
    const params = new URLSearchParams(window.location.search);

    document.querySelectorAll("[data-region]").forEach((region) => {
      const form = region.closest("form") || document;
      const city = form.querySelector("[data-city]");
      if (!city) return;

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
          // A blank region ("All areas") is every region, so nothing is
          // filtered out under it — the `r &&` short-circuits first.
          if (o.region && r && o.region !== r) return;

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
      // Brampton in the list. Harmless on a page whose own URL never
      // carries these params (the homepage's two finders, for
      // instance) — params.get returns null there and this falls
      // through to region.value, the same as before.
      sync(params.get("region") || region.value);
    });
  }

  /**
   * Live results, fed by the listings-search Netlify Function.
   *
   * The six static cards in the markup are the no-JS state and the
   * flash-of-content guard: they're cleared immediately (not left
   * showing their bracket placeholders) rather than swapped in place,
   * since a fetch failure showing "[UnparsedAddress]" to a visitor would
   * be worse than an honest empty state.
   *
   * The count comes from the API's @odata.count (`total`), not from
   * counting DOM cards — the previous version of this function counted
   * .cs-item nodes, which is right for a static six and wrong the
   * moment results paginate: page 1 of 34 would have read "12 homes".
   *
   * Pagination is PropTx's server-driven $skiptoken, surfaced by the
   * function as an opaque `nextCursor` string. "Load more" sends it
   * back as `after` and appends the new cards rather than replacing the
   * list — a full reload would lose scroll position and re-run the
   * request from page 1.
   */
  function initLiveResults() {
    const list = document.querySelector("[data-results]");
    const countEl = document.querySelector("[data-count]");
    const emptyEl = document.querySelector("[data-empty]");
    const moreEl = document.querySelector("[data-more]");
    const moreLink = moreEl ? moreEl.querySelector("a") : null;
    const form = document.getElementById("listings-form");
    // This file is shared with results.html, whose #listings-form has
    // different fields (municipality, tenure) and feeds sold case
    // studies, not this search endpoint or this card markup. #region
    // only exists on the real listings board — absence means this is
    // the Results page and this function has nothing to do here.
    if (!list || !form || !document.getElementById("region")) return;

    let nextCursor = null;
    let loading = false;

    function setCount(total) {
      if (!countEl || typeof total !== "number") return;
      countEl.textContent = total === 1 ? "1 home" : total + " homes";
    }

    function currentParams() {
      const params = new URLSearchParams();
      FIELDS.forEach((name) => {
        const field = document.getElementById(name);
        if (field && field.value) params.set(name, field.value);
      });
      return params;
    }

    async function fetchPage(after) {
      const params = currentParams();
      if (after) params.set("after", after);
      const response = await fetch("/.netlify/functions/listings-search?" + params.toString());
      if (!response.ok) throw new Error("listings-search " + response.status);
      return response.json();
    }

    function statusLabel(status) {
      if (status === "Active") return "For sale";
      if (status === "Closed") return "Sold";
      return status || "";
    }

    const currency = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    });

    function cardMarkup(listing, index) {
      const price = typeof listing.price === "number" ? currency.format(listing.price) : "";
      const meta = [
        listing.beds != null ? listing.beds + " bed" : null,
        listing.baths != null ? listing.baths + " bath" : null,
        listing.sqft ? listing.sqft + " sq ft" : null,
      ]
        .filter(Boolean)
        .join(" &middot; ");

      return (
        '<li class="cs-item cs-reveal" style="--reveal-i: ' + (index % 6) + '">' +
        '<a class="cs-link" href="/listings/' + encodeURIComponent(listing.key) + '/">' +
        '<picture class="cs-picture">' +
        '<img class="cs-img" src="' + (listing.cardPhoto || "/assets/images/listings/listing-01.jpg") + '" ' +
        'alt="' + (listing.address || "") + '" width="640" height="500" ' +
        'loading="' + (index < 3 ? "eager" : "lazy") + '" decoding="async">' +
        '<span class="cs-status">' + statusLabel(listing.status) + "</span>" +
        "</picture>" +
        '<div class="cs-info">' +
        '<span class="cs-price">' + price + "</span>" +
        '<span class="cs-address">' + (listing.address || "") + "</span>" +
        '<span class="cs-meta">' + meta + "</span>" +
        "</div>" +
        "</a>" +
        "</li>"
      );
    }

    async function loadInitial() {
      // Cleared up front rather than left showing bracket placeholders
      // while the request is in flight.
      list.innerHTML = "";
      show(list, false);

      try {
        const data = await fetchPage(null);
        const listings = Array.isArray(data.listings) ? data.listings : [];
        nextCursor = data.nextCursor || null;

        list.innerHTML = listings.map((l, i) => cardMarkup(l, i)).join("");
        setCount(typeof data.total === "number" ? data.total : listings.length);
        show(list, listings.length > 0);
        show(emptyEl, listings.length === 0);
        show(moreEl, Boolean(nextCursor));
      } catch (error) {
        console.warn("[listings]", error.message);
        list.innerHTML = "";
        show(list, false);
        show(emptyEl, true);
        show(moreEl, false);
      }
    }

    if (moreLink) {
      moreLink.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!nextCursor || loading) return;

        loading = true;
        moreLink.setAttribute("aria-busy", "true");

        try {
          const data = await fetchPage(nextCursor);
          const listings = Array.isArray(data.listings) ? data.listings : [];
          const start = list.children.length;

          list.insertAdjacentHTML("beforeend", listings.map((l, i) => cardMarkup(l, start + i)).join(""));
          nextCursor = data.nextCursor || null;
          show(moreEl, Boolean(nextCursor));
        } catch (error) {
          console.warn("[listings] load more failed", error.message);
        } finally {
          loading = false;
          moreLink.removeAttribute("aria-busy");
        }
      });
    }

    loadInitial();
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
   * The collapse itself is CSS, but the two pages disagree on which
   * element carries .cs-open: listings.less keys off the form itself
   * (`.cs-panel:has(.cs-form.cs-open)`), while results.less styles
   * `.cs-panel.cs-open` directly — a pre-existing divergence between the
   * two stylesheets, not something introduced here. #region only exists
   * on the Listings page, so it's used to pick the right target; get
   * this wrong and the mobile "Filters" button silently does nothing.
   *
   * The count is the whole point of the pattern. A collapsed bar reading
   * only "Filters" lets someone stare at four cards without registering
   * that a filter is hiding the rest; "Filters (2)" does not.
   *
   * @param {number} count - filters in effect, from restoreState
   */
  function initFilterToggle(count) {
    const toggle = document.querySelector("[data-filter-toggle]");
    const form = document.getElementById("listings-form");
    if (!toggle || !form) return;

    const target = document.getElementById("region")
      ? form
      : document.querySelector("#listings-filters .cs-panel") || form;

    const countEl = toggle.querySelector("[data-filter-count]");
    if (countEl) {
      countEl.textContent = count;
      show(countEl, count > 0);
    }

    // Open on arrival when something is already applied — landing on a
    // filtered URL behind a closed bar hides the reason for the result.
    if (count > 0) {
      target.classList.add("cs-open");
      toggle.setAttribute("aria-expanded", "true");
    }

    toggle.addEventListener("click", () => {
      const open = target.classList.toggle("cs-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  /**
   * Live results for /results/ — the closed-deals archive.
   *
   * Same shape as initLiveResults, against results-search instead of
   * listings-search, with results.html's own fields (municipality,
   * tenure) and card layout (no status badge in the source markup,
   * address/city/price/meta only). Guarded on #municipality so this
   * never fires on /listings/, which has no such field.
   *
   * ClosePrice/CloseDate aren't in this feed — see lib/mapListing.js on
   * the function side. This renders ListPrice alone, no "asking →
   * sold for" comparison; transactionType ("For Sale"/"For Lease")
   * labels each card instead so a lease's monthly rent is never shown
   * unlabelled next to a sale price.
   */
  function initResultsLiveResults() {
    const list = document.querySelector("[data-results]");
    const form = document.getElementById("listings-form");
    if (!list || !form || !document.getElementById("municipality")) return;

    const RESULTS_FIELDS = ["municipality", "tenure", "sort"];
    const countEl = document.querySelector("[data-count]");
    const emptyEl = document.querySelector("[data-empty]");
    const moreEl = document.querySelector("[data-more]");
    const moreLink = moreEl ? moreEl.querySelector("a") : null;

    let nextCursor = null;
    let loading = false;

    function setCount(total) {
      if (!countEl || typeof total !== "number") return;
      countEl.textContent = total === 1 ? "1 closing" : total + " closings";
    }

    function currentParams() {
      const params = new URLSearchParams();
      RESULTS_FIELDS.forEach((name) => {
        const field = document.getElementById(name);
        if (field && field.value) params.set(name, field.value);
      });
      return params;
    }

    async function fetchPage(after) {
      const params = currentParams();
      if (after) params.set("after", after);
      const response = await fetch("/.netlify/functions/results-search?" + params.toString());
      if (!response.ok) throw new Error("results-search " + response.status);
      return response.json();
    }

    function outcomeLabel(transactionType) {
      if (transactionType === "For Lease") return "Leased";
      if (transactionType === "For Sale") return "Sold";
      return "Closed";
    }

    const currency = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    });

    function cardMarkup(listing, index) {
      const price = typeof listing.price === "number" ? currency.format(listing.price) : "";
      // Outcome folds into the meta line rather than a badge on the
      // picture — results.less deliberately removed a <picture> overlay
      // pill on this page ("every card is a closing, a status pill on
      // all six is noise" — also <picture> only permits <source>/<img>).
      const meta = [
        outcomeLabel(listing.transactionType),
        listing.daysOnMarket != null ? listing.daysOnMarket + " days" : null,
        listing.beds != null ? listing.beds + " bed" : null,
        listing.baths != null ? listing.baths + " bath" : null,
      ]
        .filter(Boolean)
        .join(" &middot; ");

      // Same listing-detail page Listings cards use — listing-detail.js
      // doesn't filter by status, and a closed deal's facts (address,
      // price, tax, remarks) are just as real as an active one's.
      return (
        '<li class="cs-item cs-reveal" style="--reveal-i: ' + (index % 6) + '">' +
        '<a class="cs-link" href="/listings/' + encodeURIComponent(listing.key) + '/">' +
        '<picture class="cs-picture">' +
        '<img class="cs-img" src="' + (listing.cardPhoto || "/assets/images/results/result-01.jpg") + '" ' +
        'alt="' + (listing.address || "") + '" width="640" height="500" ' +
        'loading="' + (index < 3 ? "eager" : "lazy") + '" decoding="async">' +
        "</picture>" +
        '<div class="cs-info">' +
        '<span class="cs-address">' + (listing.address || "") + "</span>" +
        '<span class="cs-city">' + (listing.city || "") + "</span>" +
        // .cs-close, not a new class: same weight/size the "sold for"
        // figure used to have, minus the strikethrough .cs-ask carries.
        '<span class="cs-close">' + price + "</span>" +
        '<span class="cs-meta">' + meta + "</span>" +
        "</div>" +
        "</a>" +
        "</li>"
      );
    }

    async function loadInitial() {
      list.innerHTML = "";
      show(list, false);

      try {
        const data = await fetchPage(null);
        const listings = Array.isArray(data.listings) ? data.listings : [];
        nextCursor = data.nextCursor || null;

        list.innerHTML = listings.map((l, i) => cardMarkup(l, i)).join("");
        setCount(typeof data.total === "number" ? data.total : listings.length);
        show(list, listings.length > 0);
        show(emptyEl, listings.length === 0);
        show(moreEl, Boolean(nextCursor));
      } catch (error) {
        console.warn("[results]", error.message);
        list.innerHTML = "";
        show(list, false);
        show(emptyEl, true);
        show(moreEl, false);
      }
    }

    if (moreLink) {
      moreLink.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!nextCursor || loading) return;

        loading = true;
        moreLink.setAttribute("aria-busy", "true");

        try {
          const data = await fetchPage(nextCursor);
          const listings = Array.isArray(data.listings) ? data.listings : [];
          const start = list.children.length;

          list.insertAdjacentHTML("beforeend", listings.map((l, i) => cardMarkup(l, start + i)).join(""));
          nextCursor = data.nextCursor || null;
          show(moreEl, Boolean(nextCursor));
        } catch (error) {
          console.warn("[results] load more failed", error.message);
        } finally {
          loading = false;
          moreLink.removeAttribute("aria-busy");
        }
      });
    }

    loadInitial();
  }

  /**
   * Carries the current filter query string across the List <-> Map
   * toggle. The two links' hrefs in the markup are bare /listings/ and
   * /listings/map/ — the no-JS fallback, and a real destination either
   * way — so this only appends onto them, never replaces them outright.
   *
   * Guarded the same way as initResultsLiveResults: this file is shared
   * with results.html, which has no [data-view-link] anchors at all, so
   * the querySelectorAll below simply finds nothing there.
   */
  function initViewLinks() {
    const links = document.querySelectorAll("[data-view-link]");
    if (!links.length) return;

    const query = window.location.search;
    if (!query) return;

    links.forEach((link) => {
      const url = new URL(link.href, window.location.origin);
      url.search = query;
      link.href = url.pathname + url.search;
    });
  }

  window.revealScan?.();
  initRegionCity();
  initFilterToggle(restoreState());
  initLiveResults();
  initResultsLiveResults();
  initViewLinks();
  initSavedQuery();
  initSort();
  initAutoApply();
})();