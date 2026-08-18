(() => {
	const CONFIG = {
		// Bar collapses to logo + toggle below this. Matches the 64rem tier in nav.less.
		DESKTOP: 64 * 16,
		// Don't retract until past this — stops a flicker on small scrolls near the top.
		HIDE_AFTER: 120,
		// Ignore jitter below this many pixels of movement.
		THRESHOLD: 6,
		CLASSES: {
			open: "cs-open",
			hidden: "cs-hidden",
			pastHero: "cs-past-hero",
		},
	};

	const nav = document.querySelector("#cs-navigation");
	if (!nav) return;

	const hero = document.querySelector("#hero");
	// The panel that rides up over the pinned hero.
	const curtain = document.querySelector("#statement");
	const body = document.body;
	const toggle = nav.querySelector("#cs-toggle");
	const panel = nav.querySelector("#cs-panel");
	const backdrop = nav.querySelector("#cs-backdrop");

	const isDesktop = () => window.innerWidth >= CONFIG.DESKTOP;

	/* -- Sheet -- */
	const sheet = {
		isOpen: () => nav.classList.contains(CONFIG.CLASSES.open),

		open() {
			// Never retract with the menu showing.
			nav.classList.remove(CONFIG.CLASSES.hidden);
			nav.classList.add(CONFIG.CLASSES.open);
			body.classList.add(CONFIG.CLASSES.open);
			toggle.setAttribute("aria-expanded", "true");
			toggle.setAttribute("aria-label", "Close menu");
			panel.inert = false;
		},

		close({ returnFocus = false } = {}) {
			if (!this.isOpen()) return;
			nav.classList.remove(CONFIG.CLASSES.open);
			body.classList.remove(CONFIG.CLASSES.open);
			toggle.setAttribute("aria-expanded", "false");
			toggle.setAttribute("aria-label", "Open menu");
			panel.inert = true;
			// Resync so the next scroll doesn't read as a large jump.
			lastY = window.scrollY;
			if (returnFocus) toggle.focus();
		},

		toggle() {
			this.isOpen() ? this.close() : this.open();
		},
	};

	const readSurface = () => {
		if (!hero && !curtain) {
			nav.classList.add(CONFIG.CLASSES.pastHero);
			return;
		}

		// With the hero pinned, its own bottom edge never rises — it sits at
		// the viewport floor for the whole curtain and the bar would stay
		// transparent over a cream panel. The curtain's TOP edge is what
		// actually passes under the bar, so that's what the flip reads.
		if (curtain) {
			const past = curtain.getBoundingClientRect().top <= nav.offsetHeight;
			nav.classList.toggle(CONFIG.CLASSES.pastHero, past);
			return;
		}

		// Inner pages: no curtain, so the hero's bottom edge still works.
		const past = hero.getBoundingClientRect().bottom <= nav.offsetHeight;
		nav.classList.toggle(CONFIG.CLASSES.pastHero, past);
	};

	/* -- Hide on scroll down, show on scroll up -- */
	let lastY = window.scrollY;
	let ticking = false;

	const readScroll = () => {
		ticking = false;

		// Runs every frame, not just past the threshold — the surface flip
		// has to land on the exact scroll position, not the nearest 6px.
		readSurface();

		const y = window.scrollY;
		const delta = y - lastY;

		if (Math.abs(delta) < CONFIG.THRESHOLD) return;

		// The menu holds the bar in place while it's open.
		if (!sheet.isOpen()) {
			const goingDown = delta > 0;
			nav.classList.toggle(CONFIG.CLASSES.hidden, goingDown && y > CONFIG.HIDE_AFTER);
		}

		lastY = y;
	};

	const onScroll = () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(readScroll);
	};

	/* -- Wiring -- */
	panel.inert = true;

	toggle.addEventListener("click", () => sheet.toggle());
	backdrop.addEventListener("click", () => sheet.close());

	// Closing on navigation keeps the sheet from surviving a same-page anchor jump.
	panel.addEventListener("click", (e) => {
		if (e.target.closest("a")) sheet.close();
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && sheet.isOpen()) sheet.close({ returnFocus: true });
	});

	// Tabbing past the sheet's last link should fall out of the menu, not behind it.
	document.addEventListener("focusin", (e) => {
		if (!sheet.isOpen() || isDesktop()) return;
		if (!nav.contains(e.target)) sheet.close();
	});

	// A retracted bar can't hold focus. Bring it back if anything inside is tabbed to.
	nav.addEventListener("focusin", () => nav.classList.remove(CONFIG.CLASSES.hidden));

	window.addEventListener("scroll", onScroll, { passive: true });

	let resizeFrame;
	window.addEventListener("resize", () => {
		cancelAnimationFrame(resizeFrame);
		resizeFrame = requestAnimationFrame(() => {
			// --navHeight changes at 64rem, so the flip point moves with it.
			readSurface();
			// The sheet's contents differ across the 64rem line, so reset rather than reflow mid-open.
			if (sheet.isOpen()) sheet.close();
		});
	});

	// Correct on load — a refresh partway down the page shouldn't open dark.
	readSurface();
})();