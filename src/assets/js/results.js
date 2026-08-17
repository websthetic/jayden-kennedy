// ============================================
//                   RESULTS
// ============================================
//
// Counts each figure up once when the stats row enters view. The final value
// is already in the markup, so with JS off or reduced motion on, the numbers
// simply sit there — nothing here is load-bearing.

(() => {
	const stats = document.querySelector("#results .cs-stats");
	if (!stats) return;

	const figures = stats.querySelectorAll("[data-count]");
	if (!figures.length) return;

	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const DURATION = 1600;

	// Ease-out. A linear count reads like a loading spinner; decelerating
	// into the final value reads like an arrival.
	const ease = (t) => 1 - Math.pow(1 - t, 3);

	const run = (el) => {
		const target = Number(el.dataset.count);
		const suffix = el.dataset.suffix || "";
		if (!Number.isFinite(target)) return;

		const start = performance.now();

		const step = (now) => {
			const t = Math.min(1, (now - start) / DURATION);
			el.textContent = Math.round(ease(t) * target) + suffix;
			if (t < 1) requestAnimationFrame(step);
		};

		// Start from zero rather than letting the first frame land mid-count
		el.textContent = "0" + suffix;
		requestAnimationFrame(step);
	};

	// Watches the row, not each figure — the three should count together
	// rather than firing as each one crosses the line.
	const seen = new IntersectionObserver(
		(entries, obs) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				figures.forEach(run);
				obs.disconnect();
			});
		},
		{ rootMargin: "0px 0px -20% 0px", threshold: 0 }
	);

	seen.observe(stats);
})();