// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// Six jobs:
//   1. Open and close the panel under 900px
//   2. Open and close the Approach and About groups
//   3. On coarse pointers, make a group link's first tap open rather than
//      navigate — otherwise a touch user can never reach the children
//   4. Close everything on Escape, returning focus where it came from
//   5. Swap the transparent variant to solid once the hero has passed,
//      on pages that opt in with data-transparent
//   6. Hide the bar on scroll down and bring it back on scroll up,
//      on pages that opt in with data-hide-on-scroll
//
// CSS owns hover and focus-within on desktop. This file only ever adds or
// removes .cs-group-open, so the two never fight.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
    "use strict";

    const header = document.querySelector("#header");
    if (!header) return;

    const toggle = header.querySelector("#cs-toggle");
    const panel = header.querySelector("#cs-panel");
    const groups = Array.prototype.slice.call(header.querySelectorAll("[data-group]"));

    // Matches the paired 900px exception in global.less
    const mobile = window.matchMedia("(max-width: 56.24rem)");

    // Touch and pen. Hover menus are unreachable here, so the first tap on a
    // group link opens instead of following it.
    const coarse = window.matchMedia("(hover: none)");

    // ── Groups ───────────────────────────────────────────────────────────────

    function closeGroup(group) {
        group.classList.remove("cs-group-open");
        const btn = group.querySelector(".cs-group-toggle");
        if (btn) btn.setAttribute("aria-expanded", "false");
    }

    function openGroup(group) {
        // One at a time. Two flyouts open at once is never intended.
        groups.forEach(function (other) {
            if (other !== group) closeGroup(other);
        });

        group.classList.add("cs-group-open");
        const btn = group.querySelector(".cs-group-toggle");
        if (btn) btn.setAttribute("aria-expanded", "true");
    }

    function closeAllGroups() {
        groups.forEach(closeGroup);
    }

    groups.forEach(function (group) {
        const btn = group.querySelector(".cs-group-toggle");
        const link = group.querySelector(".cs-li-link");

        if (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                if (group.classList.contains("cs-group-open")) {
                    closeGroup(group);
                } else {
                    openGroup(group);
                }
            });
        }

        if (link) {
            link.addEventListener("click", function (e) {
                // Fine pointer: the link is just a link. Hover already opened
                // the menu, and blocking navigation would strand the user.
                if (!coarse.matches) return;

                // Already open, so this tap is a deliberate second one
                if (group.classList.contains("cs-group-open")) return;

                e.preventDefault();
                openGroup(group);
            });
        }
    });

    // A click anywhere else closes an open flyout. Desktop only — inside the
    // panel the groups are expanding rows and should stay where the user put
    // them while they read down the list.
    document.addEventListener("click", function (e) {
        if (mobile.matches) return;
        if (header.contains(e.target)) return;
        closeAllGroups();
    });

    // ── Panel ────────────────────────────────────────────────────────────────

    function openPanel() {
        header.classList.add("cs-open");
        document.body.classList.add("cs-nav-open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close menu");

        // A hidden header can't host a visible panel
        header.classList.remove("cs-hidden");
    }

    function closePanel(returnFocus) {
        header.classList.remove("cs-open");
        document.body.classList.remove("cs-nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");

        // Groups collapse with the panel, so reopening starts clean
        closeAllGroups();

        if (returnFocus) toggle.focus();
    }

    function isOpen() {
        return header.classList.contains("cs-open");
    }

    if (toggle && panel) {
        toggle.addEventListener("click", function () {
            isOpen() ? closePanel(false) : openPanel();
        });

        // Following a link closes the panel. The group toggle and the group
        // link that was intercepted above are not navigations.
        panel.addEventListener("click", function (e) {
            if (!isOpen()) return;
            if (e.target.closest(".cs-group-toggle")) return;
            if (e.defaultPrevented) return;
            if (e.target.closest("a")) closePanel(false);
        });

        // Widening past the breakpoint leaves no orphaned open state
        mobile.addEventListener("change", function (e) {
            if (!e.matches && isOpen()) closePanel(false);
            closeAllGroups();
        });
    }

    // ── Escape ───────────────────────────────────────────────────────────────

    // An open group takes priority over the panel: Escape backs out one
    // layer at a time rather than closing everything at once.
    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;

        const openGroupEl = groups.filter(function (g) {
            return g.classList.contains("cs-group-open");
        })[0];

        if (openGroupEl) {
            const btn = openGroupEl.querySelector(".cs-group-toggle");
            closeGroup(openGroupEl);
            if (btn) btn.focus();
            return;
        }

        if (isOpen()) closePanel(true);
    });

    // ── Scroll behaviour ─────────────────────────────────────────────────────
    //
    // One boundary governs both jobs: the point where the hero's bottom edge
    // meets the bar. Above it the header is transparent and always present.
    // Below it the header is solid and free to hide.
    //
    // The colour swap never happens on screen. Going down, the bar leaves
    // first and turns solid once the transform has finished; coming up it is
    // already off screen, so it turns solid before sliding back in. Watching
    // a transparent bar go white and then slide away is the thing this
    // avoids — two events where the eye expects one.

    (function () {
        const wantsSolid = header.hasAttribute("data-transparent");
        const wantsHide = header.hasAttribute("data-hide-on-scroll");
        if (!wantsSolid && !wantsHide) return;

        // Marked in the template. Absent on inner pages, which have no hero.
        const hero = document.querySelector("[data-hero]");

        // Pages without a hero still need somewhere to start hiding —
        // roughly one bar's worth of scroll, or the header flinches at a nudge.
        const FALLBACK = 140;

        // Ignore anything smaller. Trackpad inertia and iOS rubber-banding
        // both throw off a lot of 1–2px noise in both directions.
        const DELTA = 8;

        let boundary = FALLBACK;
        let last = window.scrollY;
        let ticking = false;

        // Set when the bar starts hiding before it has turned solid. The
        // transform's transitionend cashes it in.
        let solidPending = false;

        function measure() {
            if (!hero) {
                boundary = FALLBACK;
                return;
            }

            // offsetHeight rather than a rect: this runs on resize, not on
            // every frame, and the value is wanted in document space.
            boundary = hero.getBoundingClientRect().bottom + window.scrollY - header.offsetHeight;

            // A hero shorter than the bar would put the boundary at or above zero
            if (boundary < FALLBACK) boundary = FALLBACK;
        }

        function setSolid(on) {
            if (wantsSolid) header.classList.toggle("cs-solid", on);
        }

        function hidden() {
            return header.classList.contains("cs-hidden");
        }

        // Fires once the bar is fully out of sight. Reduced motion kills the
        // transition and this never runs — harmless, because the reveal path
        // below sets the class outright.
        header.addEventListener("transitionend", function (e) {
            if (e.target !== header) return;
            if (e.propertyName !== "transform") return;
            if (!solidPending || !hidden()) return;

            solidPending = false;
            setSolid(true);
        });

        function update() {
            const y = window.scrollY;
            const diff = y - last;

            // ── Over the hero ──
            if (y <= boundary) {
                solidPending = false;
                header.classList.remove("cs-hidden");
                setSolid(false);
                last = y;
                ticking = false;
                return;
            }

            // ── Past the hero ──
            if (!wantsHide) {
                setSolid(true);
                last = y;
                ticking = false;
                return;
            }

            // Only advance the reference point once a move has counted, or
            // slow scrolling never accumulates enough to register
            if (Math.abs(diff) > DELTA) {
                if (isOpen()) {
                    // An open panel pins the bar in place
                    solidPending = false;
                    setSolid(true);
                    header.classList.remove("cs-hidden");
                } else if (diff > 0) {
                    // Down: leave first, change colour out of sight
                    if (!hidden()) {
                        header.classList.add("cs-hidden");
                        if (!header.classList.contains("cs-solid")) solidPending = true;
                    }
                } else {
                    // Up: already gone, so arrive solid rather than turn solid
                    solidPending = false;
                    setSolid(true);
                    header.classList.remove("cs-hidden");
                }

                last = y;
            }

            ticking = false;
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }

        // Fonts and images landing late change the hero's height
        window.addEventListener("load", function () {
            measure();
            update();
        });

        window.addEventListener("resize", function () {
            measure();
            update();
        }, { passive: true });

        // Correct state on load, in case the page restores mid-scroll
        measure();
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
    })();
})();