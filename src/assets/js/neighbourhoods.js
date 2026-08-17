// ============================================
//               NEIGHBOURHOODS
// ============================================
//
// A centred card with its neighbours held at the frame edges. Positions are
// classes, not inline styles — the CSS owns every value, so the peek distance
// retunes per breakpoint without touching this. The one exception is the
// progress width, which depends on the count.
//
// Five slots, not three: far-before, before, active, after, far-after. The
// far pair sits off-frame, so a card entering the visible peek has somewhere
// adjacent to come from and travels one step sideways. With only three, it
// had to arrive from wherever it was parked and cut across the stage.

(() => {
	const section = document.querySelector("#neighbourhoods");
	if (!section) return;

	const slides = Array.from(section.querySelectorAll(".cs-slide"));
	const names = Array.from(section.querySelectorAll(".cs-name"));
	const bar = section.querySelector(".cs-bar");
	if (slides.length < 2) return;

	const SLOTS = ["cs-before", "cs-active", "cs-after", "cs-far-before", "cs-far-after"];

	let index = 0;

	// Distance forward from the active card, wrapping. Everything else reads
	// off this single number.
	const slotFor = (offset, count) => {
		if (offset === 0) return "cs-active";
		if (offset === 1) return "cs-after";
		if (offset === count - 1) return "cs-before";
		// Checked after the near pair so a short list can't hand one slide two
		// slots — with four or fewer cards these ranges start to overlap.
		if (offset === 2) return "cs-far-after";
		if (offset === count - 2) return "cs-far-before";
		// Parked. Repositions with no transition, off-frame and invisible.
		return null;
	};

	const show = (next) => {
		const count = slides.length;
		// Wraps both ways, so neither arrow is ever a dead end
		index = (next + count) % count;

		slides.forEach((slide, i) => {
			const slot = slotFor((i - index + count) % count, count);
			slide.classList.remove(...SLOTS);
			if (slot) slide.classList.add(slot);
		});

		names.forEach((name, i) => {
			const active = i === index;
			name.classList.toggle("cs-active", active);
			// The stack holds every name in one cell; hiding the inactive
			// ones stops a screen reader reading the whole list aloud.
			name.setAttribute("aria-hidden", String(!active));
		});

		if (bar) {
			bar.style.width = `${((index + 1) / count) * 100}%`;
		}
	};

	section.querySelectorAll(".cs-arrow").forEach((btn) => {
		btn.addEventListener("click", () => {
			show(index + (btn.dataset.dir === "next" ? 1 : -1));
		});
	});

	// Arrow keys work when focus is anywhere in the section
	section.addEventListener("keydown", (e) => {
		if (e.key === "ArrowLeft") show(index - 1);
		if (e.key === "ArrowRight") show(index + 1);
	});

	show(0);
})();