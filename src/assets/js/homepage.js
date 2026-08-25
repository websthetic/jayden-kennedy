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

(function () {
    const section = document.querySelector("#notes");
    if (!section) return;

    // Flip to false if you'd rather autoplay ignore Reduce Motion.
    const RESPECT_REDUCED_MOTION = true;
    const DEBUG = true;

    const cards = Array.from(section.querySelectorAll(".cs-frame"))
        .map((frame) => ({
            frame,
            video: frame.querySelector(".cs-video"),
            sound: frame.querySelector(".cs-sound"),
            control: frame.querySelector(".cs-control"),
            label: (frame.querySelector(".cs-frame-title") || {}).textContent || "",
            visible: false,
            wanted: false, // we asked this clip to play; retry when it can
        }))
        .filter((c) => c.video && c.sound && c.control);

    if (!cards.length) return;

    const reduceMotion =
        RESPECT_REDUCED_MOTION &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let active = 0;
    let soundOn = false;
    let userPaused = reduceMotion;

    if (DEBUG && reduceMotion) {
        console.info("[notes] Reduce Motion is on — autoplay suppressed.");
    }

    cards.forEach((c) => {
        c.video.muted = true;
    });

    function apply() {
        cards.forEach((c, i) => {
            const on = i === active && soundOn;
            c.video.muted = !on;
            c.frame.classList.toggle("is-unmuted", on);
            c.sound.setAttribute(
                "aria-label",
                (on ? "Turn sound off — " : "Turn sound on — ") + c.label
            );
        });
    }

    // One clip at a time. Everything that isn't active rewinds so the
    // chain always restarts a card from its first frame.
    function stopOthers() {
        cards.forEach((c, i) => {
            if (i === active) return;
            c.wanted = false;
            c.video.pause();
            if (c.video.currentTime) c.video.currentTime = 0;
        });
    }

    function tryPlay() {
        const c = cards[active];
        if (!c || userPaused || !c.visible) return;

        // Mark intent even if the attempt fails — the readiness events
        // below re-fire this once the CDN clip has data.
        c.wanted = true;

        const p = c.video.play();
        if (p && p.catch) {
            p.catch(function (err) {
                if (!DEBUG) return;
                // NotAllowedError here means the browser refused a muted
                // autoplay, which normally points at a missing muted or
                // playsinline attribute. AbortError means it wasn't ready
                // yet and the retry below will pick it up.
                console.warn("[notes] play() rejected on card " + active, err.name, err.message);
            });
        }
    }

    function setActive(index, rewind) {
        active = (index + cards.length) % cards.length;
        stopOthers();
        if (rewind) cards[active].video.currentTime = 0;
        apply();
        tryPlay();
    }

    cards.forEach((c, i) => {
        // Retry hooks. A play() that failed for want of data gets another
        // attempt the moment the clip is playable.
        ["loadeddata", "canplay", "canplaythrough"].forEach((evt) => {
            c.video.addEventListener(evt, function () {
                c.frame.classList.add("is-ready");
                if (active === i && c.wanted && c.video.paused) tryPlay();
            });
        });

        c.video.addEventListener("error", function () {
            const e = c.video.error;
            console.error(
                "[notes] card " + i + " failed to load: " + c.video.currentSrc,
                e ? "code " + e.code : ""
            );
        });

        c.video.addEventListener("stalled", function () {
            if (DEBUG) console.warn("[notes] card " + i + " stalled — check CDN response.");
        });

        c.video.addEventListener("playing", function () {
            c.frame.classList.add("is-ready");
            c.frame.classList.add("is-playing");
            c.control.setAttribute("aria-label", "Pause — " + c.label);
        });

        c.video.addEventListener("pause", function () {
            c.frame.classList.remove("is-playing");
            c.control.setAttribute("aria-label", "Play — " + c.label);
        });

        // 1 → 2 → 3 → back to 1.
        c.video.addEventListener("ended", function () {
            if (active === i) setActive(active + 1, true);
        });

        c.sound.addEventListener("click", function () {
            if (active === i) {
                soundOn = !soundOn;
                userPaused = false;
                apply();
                tryPlay();
            } else {
                // Tapping a different card takes over the chain, with sound.
                soundOn = true;
                userPaused = false;
                setActive(i, true);
            }
        });

        c.control.addEventListener("click", function () {
            if (active !== i) {
                soundOn = false;
                userPaused = false;
                setActive(i, true);
                return;
            }
            userPaused = !userPaused;
            if (userPaused) {
                c.wanted = false;
                c.video.pause();
            } else {
                tryPlay();
            }
        });
    });

    // 50% in view, per deck slide 17. Scrolling a card out pauses it
    // without clearing the user's play intent, so it resumes on return.
    const io = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                const c = cards.find(function (x) {
                    return x.frame === entry.target;
                });
                if (!c) return;
                c.visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
                if (cards[active] !== c) return;
                if (c.visible) tryPlay();
                else c.video.pause();
            });
        },
        { threshold: [0, 0.5, 1] }
    );

    cards.forEach(function (c) {
        io.observe(c.frame);
    });

    apply();
})();