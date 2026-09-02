/* ============================================
   finder-relocate.js
   ============================================

   Moves #finder into the hero's copy column at 64rem and up, and puts it
   back below the hero under that. Self-initialising, same as reveal.js.

   CSS can restyle across a breakpoint but it cannot reparent a node, and
   the two arrangements have different parents. So the node moves.

   The markup order is the mobile order and the no-JS order: #finder sits
   after #hero in the document, which is where it belongs on a phone and
   where it stays if this file never runs.

   appendChild moves rather than clones, so there is one form, one set of
   IDs, and any selection the visitor has already made survives a resize
   across the breakpoint. */

(function () {
    "use strict";

    /* rem rather than px, to stay keyed to the LESS. Media queries resolve
       rem against the initial 16px font size regardless of any root
       override, and matchMedia evaluates identically — so this and the
       64rem blocks in hero.less and finder.less flip on the same pixel. */
    var QUERY = "(min-width: 64rem)";

    function init() {
        var hero = document.querySelector("#hero");
        var finder = document.querySelector("#finder");

        if (!hero || !finder) return;

        var column = hero.querySelector(".cs-container");
        if (!column) return;

        /* Captured before anything moves. nextSibling is very often a text
           node, which is fine — insertBefore takes one, and a null anchor
           degrades to an append at the end of the parent. */
        var home = finder.parentNode;
        var anchor = finder.nextSibling;

        var mq = window.matchMedia(QUERY);

        function apply(wide) {
            var nested = hero.contains(finder);

            /* Fires on every resize, not just breakpoint crossings in some
               browsers. Bail unless the DOM actually disagrees with the
               query — moving a node that is already in the right place
               would drop focus and restart the reveal transition. */
            if (wide === nested) return;

            /* A resize can land mid-interaction. Moving a node blows away
               focus, so put it back where it was. */
            var active = document.activeElement;
            var refocus = active && finder.contains(active) ? active : null;

            if (wide) {
                /* Fourth child of the copy column. The stagger in hero.less
                   has a matching nth-child(4) delay. */
                column.appendChild(finder);
                hero.classList.add("cs-finder-nested");
            } else {
                home.insertBefore(finder, anchor);
                hero.classList.remove("cs-finder-nested");
            }

            if (refocus) refocus.focus({ preventScroll: true });
        }

        apply(mq.matches);

        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", function (event) {
                apply(event.matches);
            });
        } else if (typeof mq.addListener === "function") {
            /* Safari below 14 */
            mq.addListener(function (event) {
                apply(event.matches);
            });
        }
    }

    /* Runs the move before reveal.js sets .cs-visible, provided this file's
       script tag precedes it. If the finder arrived after the reveal had
       already fired it would still be visible — the reveal rules are
       descendant selectors and apply to a new child immediately — but it
       would appear without its 620ms place in the stagger. */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();