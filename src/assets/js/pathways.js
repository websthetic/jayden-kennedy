// ============================================
//              VISITOR PATHWAYS
// ============================================
//
// Vertical scroll drives horizontal travel. Sets --p on the section, which
// the CSS uses to translate the rail, and switches the active pathway and
// dot at the thirds.

(() => {
	const section = document.querySelector("#pathways");
	if (!section) return;

	const track = section.querySelector(".cs-track");
	const pathways = section.querySelectorAll("[data-pathway]");
	const dots = section.querySelectorAll("[data-dot]");
	if (!track || !pathways.length) return;

	const desktop = window.matchMedia("(min-width: 64rem)");
	const still = window.matchMedia("(prefers-reduced-motion: reduce)");

	let ticking = false;
	let active = -1;

	const setActive = (index) => {
		// Only touch the DOM when the panel actually changes — this runs on
		// every frame of scroll otherwise.
		if (index === active) return;
		active = index;

		pathways.forEach((el, i) => el.classList.toggle("cs-active", i === index));
		dots.forEach((el, i) => el.classList.toggle("cs-active", i === index));
	};

	const read = () => {
		ticking = false;

		// Both fallbacks are stacked layouts where every pathway is visible,
		// so drop --p and make sure nothing is left hidden by a stale class.
		if (!desktop.matches || still.matches) {
			section.style.removeProperty("--p");
			if (active !== -1) {
				pathways.forEach((el) => el.classList.add("cs-active"));
				dots.forEach((el) => el.classList.remove("cs-active"));
				active = -1;
			}
			return;
		}

		const rect = track.getBoundingClientRect();
		// The stage is pinned for one viewport, so the scrollable distance is
		// the track's height less that viewport.
		const travel = rect.height - window.innerHeight;
		const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / travel));

		section.style.setProperty("--p", p.toFixed(4));

		// Thirds. The rail moves continuously while the card cuts — that
		// mismatch is deliberate: the images read as a filmstrip, the copy
		// as discrete choices.
		setActive(p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2);
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
})();