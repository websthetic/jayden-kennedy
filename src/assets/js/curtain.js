// ============================================
//                   CURTAIN
// ============================================
//
// Slides the block below the statement up into place, once, when it enters
// view. Adds .cs-in and stops observing — that unobserve is what makes this
// a reveal rather than a scroll-linked toggle.

(() => {
	const curtain = document.querySelector(".cs-curtain-statement");
	if (!curtain) return;

	const desktop = window.matchMedia("(min-width: 64rem)");
	const still = window.matchMedia("(prefers-reduced-motion: reduce)");

	// Both fallbacks are handled in CSS, but the class still has to land —
	// otherwise a runtime change to either media query would leave the panel
	// stuck at opacity 0.
	if (!desktop.matches || still.matches) {
		curtain.classList.add("cs-in");
		return;
	}

	const seen = new IntersectionObserver(
		(entries, obs) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				entry.target.classList.add("cs-in");
				obs.unobserve(entry.target);
			});
		},
		{
			// Fires when the panel's top edge is a fifth of the way up the
			// viewport. Firing at first contact would run the slide while it
			// is still below the fold and the reveal would go unseen.
			rootMargin: "0px 0px -20% 0px",
			threshold: 0,
		}
	);

	seen.observe(curtain);
})();