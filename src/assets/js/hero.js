// ============================================
//              HERO + STATEMENT
// ============================================
//
// Two independent mechanisms in one file:
//   1. --p, scrubbed from scroll position, drives the frame's travel
//   2. .cs-in, added once on entry, drives the statement reveal
//
// They're deliberately different. The frame is dragged by the scroll; the
// statement arrives on its own and stays.

(() => {
	const hero = document.querySelector("#hero");
	if (!hero) return;

	const desktop = window.matchMedia("(min-width: 64rem)");
	const still = window.matchMedia("(prefers-reduced-motion: reduce)");

	/* -- Frame travel -- */

	const track = hero.querySelector(".cs-track");
	let ticking = false;

	const read = () => {
		ticking = false;
		if (!track) return;

		// The CSS handles both of these on its own — bail rather than fight
		// it with an inline custom property.
		if (!desktop.matches || still.matches) {
			hero.style.removeProperty("--p");
			return;
		}

		const rect = track.getBoundingClientRect();
		// Distance scrolled into the track over the distance available. The
		// stage is pinned for exactly one viewport, so that's the divisor.
		const travel = rect.height - window.innerHeight;
		const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / travel));

		hero.style.setProperty("--p", p.toFixed(4));
	};

	const onScroll = () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(read);
	};

	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onScroll, { passive: true });
	desktop.addEventListener("change", read);
	still.addEventListener("change", read);

	read();

	/* -- Statement reveal -- */

	const items = hero.querySelectorAll("[data-reveal]");
	if (!items.length) return;

	// Reduced motion gets the end state with no transition — the CSS already
	// sets that, but the class still has to land or the items stay at
	// opacity 0 if the media query is toggled at runtime.
	if (still.matches) {
		items.forEach((el) => el.classList.add("cs-in"));
		return;
	}

	const seen = new IntersectionObserver(
		(entries, obs) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				entry.target.classList.add("cs-in");
				// Once only. Unobserving is what makes this a reveal rather
				// than a scroll-linked toggle.
				obs.unobserve(entry.target);
			});
		},
		{
			// Fires when the element is a quarter of the way up the viewport.
			// Firing at first contact would animate the payoff while it's
			// still below the fold, and the reveal would go unseen.
			rootMargin: "0px 0px -25% 0px",
			threshold: 0,
		}
	);

	items.forEach((el) => seen.observe(el));
})();