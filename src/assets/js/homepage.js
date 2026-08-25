/*-- -------------------------- -->
<---          Homepage          -->
<--- -------------------------- -*/

/* Loaded with `defer`, so the DOM is parsed before any of this runs —
   no DOMContentLoaded wrapper needed.

   The hero only. It reveals on load, because it sits above the fold
   and has no scroll to key off — everything below the fold is handled
   by the sitewide observer in reveal.js, which this file used to
   duplicate. Both flip .cs-visible and let CSS run the stagger; the
   timing lives in the stylesheet, never here. */


/*-- -------------------------- -->
<---        Hero Reveal         -->
<--- -------------------------- -*/

/* Fires on load rather than on scroll. The stagger lives in CSS as
   transition-delay; this only flips the class that releases it.

   Gated on the hero photograph so the copy resolves onto an image
   rather than onto empty ground. */

const hero = document.querySelector("#hero");
const heroImg = hero?.querySelector(".cs-background img");

function revealHero() {
    if (!hero || hero.classList.contains("cs-visible")) return;
    // Two frames: guarantees the browser has painted opacity 0 before
    // the class flips, so the transition actually runs.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => hero.classList.add("cs-visible"));
    });
}

if (hero) {
    // `complete` is true for cached images, which never fire load
    if (!heroImg || heroImg.complete) {
        revealHero();
    } else {
        heroImg.addEventListener("load", revealHero, { once: true });
        heroImg.addEventListener("error", revealHero, { once: true });
    }

    // Never let a slow image hold the copy hostage. Without this, a
    // failed CDN request leaves the headline invisible indefinitely.
    setTimeout(revealHero, 1200);
}
