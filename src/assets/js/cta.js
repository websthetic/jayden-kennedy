// ============================================
//                     CTA
// ============================================
//
// Vertical parallax. Sets --p on the section — 0 as the section's top edge
// meets the bottom of the viewport, 1 as its bottom edge clears the top. The
// CSS maps that to the media's travel, so this file knows nothing about
// distances or directions.
//
// Driven by a continuous rAF loop rather than the scroll event. Scroll fires
// asynchronously from the compositor, so a transform written from a scroll
// handler can land a frame behind the pixels that have already moved —
// visible as the image dragging behind the page. Reading position every frame
// keeps them in step.
//
// The loop only runs while the section is on screen. An IntersectionObserver
// starts and stops it, so nothing is burning frames further down the page.

(() => {
	const section = document.querySelector("#cta");
	if (!section) return;

	const still = window.matchMedia("(prefers-reduced-motion: reduce)");

	let running = false;
	let frame = 0;
	let last = -1;

	const tick = () => {
		if (!running) return;

		const rect = section.getBoundingClientRect();
		const view = window.innerHeight;

		// Full transit: from the section entering at the bottom to leaving at
		// the top. The section's own height is in the denominator, so a taller
		// section doesn't travel faster.
		const raw = (view - rect.top) / (view + rect.height);
		const p = Math.min(1, Math.max(0, raw));

		// Only write when the value actually changes at the precision the CSS
		// uses. A custom property write invalidates style on the subtree, so
		// writing an identical value costs a recalc for nothing.
		const next = Number(p.toFixed(4));
		if (next !== last) {
			last = next;
			section.style.setProperty("--p", next);
		}

		frame = requestAnimationFrame(tick);
	};

	const start = () => {
		if (running || still.matches) return;
		running = true;
		frame = requestAnimationFrame(tick);
	};

	const stop = () => {
		running = false;
		cancelAnimationFrame(frame);
	};

	// rootMargin gives the loop a head start, so --p is already correct by the
	// time the section's first pixel is visible rather than being corrected on
	// the first frame after.
	const watcher = new IntersectionObserver(
		(entries) => {
			entries[0].isIntersecting ? start() : stop();
		},
		{ rootMargin: "100px 0px" }
	);

	watcher.observe(section);

	const onMotionChange = () => {
		if (still.matches) {
			stop();
			// The CSS falls back to a centred, untravelled image. Removing the
			// property rather than pinning it to 0.5 keeps that fallback in
			// one place.
			section.style.removeProperty("--p");
			last = -1;
		} else {
			start();
		}
	};

	still.addEventListener("change", onMotionChange);
	onMotionChange();
})();