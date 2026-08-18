/*  Statement backdrop parallax
    Writes --statement-parallax on the image. The scrub is expressed as a
    fraction of the panel's own height, not a pixel constant, so it stays
    proportional across breakpoints and never outruns the 15% overhang the
    CSS reserves. */
(function () {
	const img = document.querySelector("#statement .cs-backdrop-img");
	if (!img) return;

	// Honour the OS setting. The CSS already parks the transform; this stops
	// us from paying for a scroll listener that can't do anything.
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const panel = document.querySelector("#statement .cs-body");

	// Fraction of panel height the image travels end to end. 0.20 against a
	// 30% total overhang leaves margin — raise cautiously.
	const TRAVEL = 0.2;

	let visible = false;
	let ticking = false;

	function update() {
		ticking = false;
		const rect = panel.getBoundingClientRect();
		const vh = window.innerHeight;

		// 0 when the panel's top edge is at the bottom of the viewport,
		// 1 when its bottom edge has cleared the top. Denominator includes
		// panel height so tall panels don't finish their scrub early.
		let progress = (vh - rect.top) / (vh + rect.height);
		progress = Math.min(1, Math.max(0, progress));

		// Centred on 0 so the image sits at its natural position when the
		// panel is mid-viewport, and drifts symmetrically either side.
		const offset = (progress - 0.5) * rect.height * TRAVEL;
		img.style.setProperty("--statement-parallax", offset.toFixed(2) + "px");
	}

	function onScroll() {
		if (!visible || ticking) return;
		ticking = true;
		requestAnimationFrame(update);
	}

	// Gate on visibility so we're not reading layout on every scroll frame
	// for a panel that's three screens away.
	const io = new IntersectionObserver(
		(entries) => {
			visible = entries[0].isIntersecting;
			if (visible) update();
		},
		{ rootMargin: "10% 0px" }
	);

	io.observe(panel);

	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onScroll, { passive: true });
	update();
})();