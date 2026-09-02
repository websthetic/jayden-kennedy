/* ============================================
   reviews.js
   ============================================

   Drives the one-at-a-time review pager in #reviews. Self-initialising,
   same as reveal.js and finder-relocate.js.

   Progressive by construction: the markup ships every review, visible and
   stacked, and this file opts the section into the single-review view by
   setting .cs-ready. If the script never runs — blocked, errored, still
   loading — the reader gets six reviews and no controls, which is a worse
   layout and a perfectly good page. Nothing is hidden by CSS that this
   file has not already proven it can show again. */

(function () {
    "use strict";

    function init() {
        var section = document.querySelector("#reviews");
        if (!section) return;

        var viewer = section.querySelector(".cs-viewer");
        var items = [].slice.call(section.querySelectorAll("[data-review]"));
        var pager = section.querySelector("[data-pager]");
        var prev = section.querySelector("[data-prev]");
        var next = section.querySelector("[data-next]");
        var count = section.querySelector("[data-count]");

        /* One review needs no pager, and zero needs no section. Either
           way, leave the stacked markup alone rather than half-applying
           the behaviour. */
        if (!viewer || !pager || !prev || !next || items.length < 2) return;

        var index = 0;

        function pad(n) {
            return n < 10 ? "0" + n : String(n);
        }

        /* Locks the viewer to the tallest review before anything is
           hidden, so the pager holds its line as the copy changes length.
           Measured rather than guessed: the tallest review is a function
           of the column width and the font, and both move.

           Cleared first — on a re-measure the old floor would otherwise
           be the tallest thing in the box and every review would report
           back the same height. */
        function lock() {
            viewer.style.minHeight = "";

            var was = section.classList.contains("cs-ready");
            section.classList.remove("cs-ready");

            var tallest = 0;
            items.forEach(function (item) {
                var h = item.getBoundingClientRect().height;
                if (h > tallest) tallest = h;
            });

            if (was) section.classList.add("cs-ready");
            if (tallest) viewer.style.minHeight = Math.ceil(tallest) + "px";
        }

        function show(n) {
            items[index].classList.remove("cs-active");
            index = (n + items.length) % items.length;
            items[index].classList.add("cs-active");
            if (count) count.textContent = pad(index + 1) + " / " + pad(items.length);
        }

        lock();

        section.classList.add("cs-ready");
        pager.removeAttribute("hidden");
        show(0);

        prev.addEventListener("click", function () {
            show(index - 1);
        });

        next.addEventListener("click", function () {
            show(index + 1);
        });

        /* Width changes rewrap the quotes, so the tallest one can change
           identity as well as height. rAF-debounced: a drag across a
           desktop window fires resize continuously and each lock() forces
           a synchronous layout of every review. */
        var queued = false;
        window.addEventListener("resize", function () {
            if (queued) return;
            queued = true;
            window.requestAnimationFrame(function () {
                queued = false;
                lock();
            });
        });

        /* The first measure runs against the fallback stack if Cinzel has
           not landed yet, and Cinzel is wider than Times at the same size.
           Re-measure once the real face is in. */
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(lock);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();