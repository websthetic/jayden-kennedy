/*-- -------------------------- -->
<---        Scroll Reveal       -->
<--- -------------------------- -*/

/* One observer for every [data-reveal] group on every page. Loaded from
   base.html with `defer`, so the DOM is parsed before any of this runs —
   no DOMContentLoaded wrapper needed.

   This file used to be modules/reveal.js: an ES module that exported
   initReveal() and nothing called it. Two pages pointed a plain
   <script defer> at a stale unbundled copy, which threw on `export`
   before it could have done anything anyway. It self-initialises now.

   The class lands on the group, not on the item — the stagger is a
   property of the block, and latching items individually would start
   each one on its own clock and destroy the sequence.

   Fires once, then unobserves. These are reveals, not scrubs: an
   element that has arrived stays arrived, on the way back up as well.

   rootMargin shrinks the root's lower edge by 12%, so a group starts
   when its top crosses that line rather than the instant its first
   pixel appears. Below about 8% the leading item is still off-screen
   when its delay elapses, and the stagger arrives pre-spent.

   Reduced motion is handled in CSS, not here. The classes still land in
   the same order — root.less just flattens the transition to nothing.
   Gating in JS instead would leave .cs-visible off the group, and any
   future rule that hangs off it would silently never apply.

   #practice is excluded by design. Its three panels live inside a
   pinned frame, so all of them are intersecting from the moment the
   section locks — an observer would fire the whole track at once. If
   that copy should reveal, it has to hang off --swap the way the
   slide does, which is a separate mechanism. */

const observer =
    "IntersectionObserver" in window
        ? new IntersectionObserver(
              (entries, obs) => {
                  entries.forEach((entry) => {
                      if (!entry.isIntersecting) return;
                      entry.target.classList.add("cs-visible");
                      // Once only — never observed again, never re-fades
                      obs.unobserve(entry.target);
                  });
              },
              { threshold: 0, rootMargin: "0px 0px -12% 0px" }
          )
        : null;

/**
 * Observe every [data-reveal] group that isn't already accounted for.
 *
 * Safe to call repeatedly. Groups injected after load — listing results
 * once the TRREB feed lands, anything paginated in — need a rescan or
 * they stay at opacity 0 forever, because .js hides them the moment
 * they enter the document.
 *
 * @param {ParentNode} root - subtree to scan. Defaults to the document.
 */
function revealScan(root = document) {
    const groups = root.querySelectorAll("[data-reveal]:not(.cs-visible):not([data-reveal-bound])");
    if (!groups.length) return;

    // No IntersectionObserver: show everything rather than leave the
    // page blank. Matches the fail-open posture of the .js gate.
    if (!observer) {
        groups.forEach((group) => group.classList.add("cs-visible"));
        return;
    }

    groups.forEach((group) => {
        group.setAttribute("data-reveal-bound", "");
        observer.observe(group);
    });
}

revealScan();

/* Published on window rather than exported. esbuild bundles this config
   to an IIFE, which discards module exports — an `export` here would be
   silently dropped and any importer would get undefined. Scripts that
   inject markup call window.revealScan() instead. */
window.revealScan = revealScan;
