/* Reviews page — relative dates, expand/collapse, card levelling.
   Loaded deferred from reviews.html. Nothing inline: an inline copy of
   any of this would redeclare the same consts and fail silently. */

(function () {
    "use strict";

    var grid = document.querySelector("#reviews-grid");
    if (!grid) return;

    /* ---------------------------------------------
       Relative dates
       Markup holds an absolute date and prints the
       month as its fallback, so a page with no JS
       shows something true rather than something
       that expires.
    --------------------------------------------- */

    /* Average month, not 30. Over a year the drift from using 30 is a
       full week, which is enough to flip a label. */
    var MONTH = 30.44;

    function relativeLabel(iso) {
        /* Midday, not midnight — a bare date string is parsed as UTC and
           can land on the previous day in Eastern time. */
        var then = new Date(iso + "T12:00:00");
        if (isNaN(then)) return null;

        var now = new Date();
        if (then > now) return null;

        var days = (now - then) / 86400000;

        /* Rounded, not floored. Google rounds to the nearest month: a
           review 2 months and 24 days old reads as 3 months there, and
           flooring it to 2 makes the site disagree with the source it
           quotes. */
        var months = Math.round(days / MONTH);

        if (months < 1) return "this month";
        if (months === 1) return "a month ago";
        if (months < 12) return months + " months ago";

        /* Years floor. Google holds "a year ago" well past the twelve
           month mark, so rounding here would age a review early. */
        var years = Math.floor(months / 12);
        return years === 1 ? "a year ago" : years + " years ago";
    }

    var stamps = grid.querySelectorAll("time[data-relative]");
    for (var s = 0; s < stamps.length; s++) {
        var iso = stamps[s].getAttribute("datetime");
        var label = iso ? relativeLabel(iso) : null;
        /* A bad or future date leaves the absolute month in place. */
        if (label) {
            stamps[s].setAttribute("title", stamps[s].textContent.trim());
            stamps[s].textContent = label;
        }
    }

    /* ---------------------------------------------
       Expand and collapse

       CSS owns the open and closed states now. This
       used to set rest.hidden, which is display:
       none — nothing transitions out of display
       none, so the card snapped. The height, the
       fade and the visibility flip are all handled
       by .cs-open in reviews.less; all this does is
       toggle the class and keep aria-expanded
       honest.

       Nothing here needs to know the duration. The
       old approach of hiding the panel on a timer
       meant the JS and the CSS both carried the
       same number and drifted apart the first time
       either changed.
    --------------------------------------------- */

    var buttons = grid.querySelectorAll(".cs-more");

    for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", function () {
            var card = this.closest(".cs-item");
            var rest = document.getElementById(this.getAttribute("aria-controls"));
            if (!card || !rest) return;

            var open = card.classList.toggle("cs-open");
            this.setAttribute("aria-expanded", String(open));

            /* Collapsing a long card pulls the page up under the reader
               — the eight-paragraph review is taller than most screens,
               so the button they just pressed can end up well above the
               fold. If that happens, put the card back in view. */
            if (!open) {
                var top = card.getBoundingClientRect().top;
                if (top < 0) {
                    card.scrollIntoView({
                        block: "start",
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                            ? "auto"
                            : "smooth",
                    });
                }
            }
        });
    }

    /* ---------------------------------------------
       Card levelling
       The four cashmere cards share one collapsed
       height, set by the tallest opening. A fixed em
       floor would only hold until the copy changed.
    --------------------------------------------- */

    /* The feature card is excluded. Its opening is one sentence, and
       holding it to the group height would leave a tall empty green
       panel. */
    var levelled = grid.querySelectorAll(".cs-item:not(.cs-item-feature)");

    /* Matches the two-column breakpoint in reviews.less. Below it the
       grid is one column and equal heights are just dead space. */
    var wide = window.matchMedia("(min-width: 48rem)");

    function level() {
        var n;

        for (n = 0; n < levelled.length; n++) {
            levelled[n].style.minHeight = "";
        }

        if (!wide.matches) return;

        var tallest = 0;
        for (n = 0; n < levelled.length; n++) {
            if (!levelled[n].classList.contains("cs-open")) {
                tallest = Math.max(tallest, levelled[n].offsetHeight);
            }
        }

        if (!tallest) return;

        for (n = 0; n < levelled.length; n++) {
            levelled[n].style.minHeight = Math.ceil(tallest) + "px";
        }
    }

    var timer;
    window.addEventListener("resize", function () {
        clearTimeout(timer);
        timer = setTimeout(level, 120);
    });

    /* Measured against the fallback font, the floor locks in short and
       the cards go uneven once the webfont swaps in. */
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(level);
    }

    level();
})();