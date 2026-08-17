// ============================================
//                  PARALLAX
// ============================================
//
// Fallback only. Where the browser supports scroll-driven animations, each
// section's CSS owns its transform outright — those run on the compositor
// thread and are never a frame behind the scroll. This file exists for the
// browsers that don't have them yet.
//
// Sets --p on any [data-parallax] section — 0 as its top edge meets the
// bottom of the viewport, 1 as its bottom edge clears the top. Each section's
// CSS decides what to do with that, so this file knows nothing about
// distances, directions, or how far anything travels.
//
// Driven by a continuous rAF loop rather than the scroll event. Scroll fires
// asynchronously from the compositor, so a transform written from a scroll
// handler can land a frame behind the pixels that have already moved. Reading
// position every frame narrows that gap as far as JS can — it cannot close
// it, which is why the CSS path above is preferred where it exists.

(() => {
	// The CSS in each section is gated on the same query via @supports. Both
	// paths must never run at once, or the JS transform would fight the
	// animation's.
	if (window.CSS && CSS.supports("animation-timeline: view()")) return;

	const sections = Array.from(document.querySelectorAll("[data-parallax]"));
	if (!sections.length) return;

	const still = window.matchMedia("(prefers-reduced-motion: reduce)");

	// The sections currently in view. A Set rather than a filter over all of
	// them each frame — on a long page most are off-screen at any moment.
	const live = new Set();

	let running = false;
	let frame = 0;

	const tick = () => {
		if (!running) return;

		const view = window.innerHeight;

		live.forEach((section) => {
			const rect = section.getBoundingClientRect();

			// Full transit: from the section entering at the bottom to leaving
			// at the top. The section's own height is in the denominator, so a
			// taller section doesn't travel faster.
			const raw = (view - rect.top) / (view + rect.height);
			const p = Math.min(1, Math.max(0, raw));

			// Only write when the value changes at the precision the CSS uses.
			// A custom property write invalidates style on the subtree, so
			// writing an identical value costs a recalc for nothing.
			const next = p.toFixed(4);
			if (section.dataset.p !== next) {
				section.dataset.p = next;
				section.style.setProperty("--p", next);
			}
		});

		frame = requestAnimationFrame(tick);
	};

	const start = () => {
		if (running || still.matches || !live.size) return;
		running = true;
		frame = requestAnimationFrame(tick);
	};

	const stop = () => {
		running = false;
		cancelAnimationFrame(frame);
	};

	// rootMargin gives the loop a head start, so --p is already correct by the
	// time a section's first pixel is visible rather than being corrected on
	// the first frame after.
	const watcher = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				entry.isIntersecting ? live.add(entry.target) : live.delete(entry.target);
			});

			live.size ? start() : stop();
		},
		{ rootMargin: "100px 0px" }
	);

	sections.forEach((section) => watcher.observe(section));

	const onMotionChange = () => {
		if (still.matches) {
			stop();
			// Each section's CSS falls back to a centred, untravelled image.
			// Removing the property rather than pinning it keeps that fallback
			// in one place.
			sections.forEach((section) => {
				section.style.removeProperty("--p");
				delete section.dataset.p;
			});
		} else {
			start();
		}
	};

	still.addEventListener("change", onMotionChange);
	onMotionChange();
})();