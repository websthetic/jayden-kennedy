// ============================================
//                TESTIMONIALS
// ============================================
//
// One slide visible at a time, all sharing a grid cell. The arrows wrap in
// both directions, so neither is ever disabled — the .cs-disabled style in
// the LESS is there for a variant that doesn't wrap.

(() => {
	const section = document.querySelector("#testimonials");
	if (!section) return;

	const slides = Array.from(section.querySelectorAll(".cs-slide"));
	if (slides.length < 2) return;

	let index = 0;

	const show = (next) => {
		// Wraps in both directions
		index = (next + slides.length) % slides.length;

		slides.forEach((slide, i) => {
			const active = i === index;
			slide.classList.toggle("cs-active", active);
			// aria-hidden follows the visual state so screen readers only ever
			// encounter the quote that is actually on screen
			slide.setAttribute("aria-hidden", String(!active));
		});
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
})();