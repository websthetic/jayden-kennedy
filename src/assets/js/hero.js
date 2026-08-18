/*  Hero → statement scrub
    Writes every moving value as a resolved number rather than leaving CSS to
    compute it. The counter-scale needs division by a live expression, which
    calc() does not support reliably, so the four frame values are produced
    here and the stylesheet only consumes them. */
(function () {
	const track = document.querySelector(".cs-hero-track");
	if (!track) return;

	// Scoped to the track. Three other sections use .cs-stage, and a document
	// -wide query would return whichever happens to come first.
	const stage = track.querySelector(".cs-stage");
	if (!stage) return;

	const hero = track.querySelector("#hero");
	const statement = track.querySelector("#statement");
	if (!hero || !statement) return;

	// The hero copy column. Needed as an element, not just a CSS var target —
	// hit-testing can be turned off from the stylesheet, but the tab order
	// cannot.
	const heroCopy = hero.querySelector(".cs-container");
	if (!heroCopy) return;

	const DESKTOP = window.matchMedia("(min-width: 64rem)");
	const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

	// Landed geometry. These agree with transform-origin: 92.11% 35.83% in
	// critical.less and with the 6%/24% aside in local.less — changing one
	// without the others is what breaks the composition. Solved, these put the
	// landed card at 70%-94% across and 17.2%-69.2% down.
		const FX = 0.24; // landed frame width, fraction of stage
	const FY = 0.52; // landed frame height, fraction of stage
	const NET = 0.6; // net content scale, so the photo is cropped not shrunk

	// Completes at 70% of the available scroll, leaving the rest as a hold on
	// the composed layout.
	const COMPLETE = 0.7;

	// Point in the scrub at which the hero copy has fully cleared. Also the
	// point the CTA stops being clickable and focusable, so it is a real
	// boundary rather than a cosmetic one.
	const COPY_OUT = 0.4167;

	let ticking = false;
	let active = false;

	function clamp(v) {
		return v < 0 ? 0 : v > 1 ? 1 : v;
	}

	// A staggered arrival, expressed as the window it occupies rather than as
	// a rate. Stated as a rate, the completion point is start + 1/rate — an
	// invisible number that has to be re-derived by hand every time either
	// end moves, and that silently strands the element short of 1 when it
	// lands past the end of the scrub. Stated as a window, it cannot.
	function ramp(v, start, end) {
		return clamp((v - start) / (end - start));
	}

	function reset() {
		[hero, statement].forEach((el) => {
			[
				"--fx",
				"--fy",
				"--mx",
				"--my",
				"--scrim",
				"--copy",
				"--stmt",
				"--stmtY",
				"--aside",
				"--asideY",
				"--tick",
				"--copyEvents",
			].forEach((name) => el.style.removeProperty(name));
		});

		// The var falls back to auto on its own, but inert is a property on
		// the element — nothing in the stylesheet will lift it.
		heroCopy.inert = false;
	}

	function update() {
		ticking = false;

		const surplus = track.offsetHeight - stage.offsetHeight;
		if (surplus <= 0) return;

		const p = clamp(-track.getBoundingClientRect().top / surplus / COMPLETE);

		// Frame shrinks non-uniformly toward its landing box.
		const fx = 1 - p * (1 - FX);
		const fy = 1 - p * (1 - FY);

		// Media undoes that distortion and applies the net scale in one step.
		// fx * mx and fy * my resolve to the same number, which is why the
		// photograph never stretches.
		const net = 1 - p * (1 - NET);

		hero.style.setProperty("--fx", fx.toFixed(4));
		hero.style.setProperty("--fy", fy.toFixed(4));
		hero.style.setProperty("--mx", (net / fx).toFixed(4));
		hero.style.setProperty("--my", (net / fy).toFixed(4));

		// Scrim and copy both leave early — the scrim exists to bed the copy.
		hero.style.setProperty("--scrim", clamp(1 - p * 1.9).toFixed(3));

		const copy = 1 - ramp(p, 0, COPY_OUT);
		hero.style.setProperty("--copy", copy.toFixed(3));

		// Faded out, the copy is still a full-stage box with a live CTA in it,
		// sitting above #statement at z-index 3. Left armed it eats pointer
		// events aimed at the panel and keeps an invisible link in the tab
		// order. Both have to be withdrawn, not just the paint.
		const lit = copy > 0.01;
		hero.style.setProperty("--copyEvents", lit ? "auto" : "none");
		heroCopy.inert = !lit;

		// Three staggered arrivals: copy, then aside, then ticker. The offsets
		// are what give the panel a sequence instead of a single cut. Every
		// window closes before 1 so each element is fully landed while the
		// composed layout is held.
		const s = ramp(p, 0.4, 0.82);
		statement.style.setProperty("--stmt", s.toFixed(3));
		statement.style.setProperty("--stmtY", ((1 - s) * 16).toFixed(2) + "px");

		const a = ramp(p, 0.56, 0.94);
		statement.style.setProperty("--aside", a.toFixed(3));
		statement.style.setProperty("--asideY", ((1 - a) * 32).toFixed(2) + "px");

		statement.style.setProperty("--tick", ramp(p, 0.68, 0.96).toFixed(3));
	}

	function onScroll() {
		if (!active || ticking) return;
		ticking = true;
		requestAnimationFrame(update);
	}

	function sync() {
		const want = DESKTOP.matches && !REDUCED.matches;
		if (want === active) return;
		active = want;
		if (active) {
			update();
		} else {
			// Hand every element back to the stylesheet's fallbacks rather
			// than leaving a stale mid-scrub transform frozen on the page.
			reset();
		}
	}

	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onScroll, { passive: true });
	DESKTOP.addEventListener("change", sync);
	REDUCED.addEventListener("change", sync);

	sync();
})();