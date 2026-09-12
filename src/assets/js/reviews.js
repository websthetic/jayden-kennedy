/* Reviews page — relative dates, expand/collapse, card levelling,
   fragment landings from the homepage.
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
       Fragment landings

       The homepage teaser links here as
       /reviews/#<slug>, where the slug is the id on
       the matching .cs-item. Arriving on one of
       those should show the whole review, not the
       opening paragraph with a Read more under it —
       the reader already pressed the equivalent of
       that button on the previous page.

       Opening is a class flip, same as a click. The
       scroll is separate and has to come after,
       because the browser resolves the fragment
       against the CLOSED height: by the time the
       card has expanded, the position it jumped to
       is stale. scroll-margin-top on .cs-item keeps
       both the native jump and this one clear of
       the fixed header.
    --------------------------------------------- */

    function cardFromHash() {
        var hash = window.location.hash;
        if (!hash || hash.length < 2) return null;

        var target;
        /* A hash can be any string — "#" plus a stray character throws
           in querySelector. Fall back to getElementById, which never
           does. */
        try {
            target = grid.querySelector(hash);
        } catch (e) {
            target = document.getElementById(hash.slice(1));
        }

        if (!target || !target.classList.contains("cs-item")) return null;
        return target;
    }

    function openCard(card, scroll) {
        if (!card) return;

        if (!card.classList.contains("cs-open")) {
            card.classList.add("cs-open");
            var button = card.querySelector(".cs-more");
            if (button) button.setAttribute("aria-expanded", "true");
        }

        if (!scroll) return;

        /* Re-measure after the class flip, and after level() below has
           cleared the min-height on the opened card. Two frames is
           enough — the height transition is still running, but
           scroll-margin-top is measured from the element's top edge,
           which does not move as it grows downward. */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                card.scrollIntoView({ block: "start", behavior: "auto" });
            });
        });
    }

    /* On load, and again if the hash changes while the page is open —
       an in-page link or the back button after one. */
    window.addEventListener("hashchange", function () {
        openCard(cardFromHash(), true);
    });

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

    /* Order matters: open first so level() measures the arriving card as
       open and leaves it out of the floor, then scroll to where it
       actually ended up. */
    var landing = cardFromHash();
    openCard(landing, false);
    level();
    openCard(landing, true);
})();