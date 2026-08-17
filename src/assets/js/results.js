/* results.js
   Pairs the stat panels with the photos by index and drives both off the
   track's scroll position. Deliberately not a scrubbed animation — the
   panels cut between discrete states, so this only needs to know which
   third of the track it's in, not a continuous progress value.

   Nothing here runs below 64rem or under reduced motion. The .cs-live
   class is the switch: the CSS pins and stacks only when it's present, so
   a teardown returns the section to the plain two-column layout. */
(function () {
	const section = document.querySelector('#results');
	if (!section) return;

	const track = section.querySelector('.cs-track');
	const stage = section.querySelector('.cs-stage');
	const panels = Array.from(section.querySelectorAll('.cs-stat'));
	const shots = Array.from(section.querySelectorAll('.cs-shot'));
	const ticks = Array.from(section.querySelectorAll('.cs-tick'));

	if (!track || !stage || panels.length === 0) return;

	const wide = window.matchMedia('(min-width: 64rem)');
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');

	let active = -1;
	let queued = false;

	function mark(list, index) {
		list.forEach(function (el, n) {
			el.classList.toggle('cs-in', n === index);
		});
	}

	function setActive(index) {
		if (index === active) return;
		active = index;
		mark(panels, index);
		mark(shots, index);
		mark(ticks, index);
	}

	function measure() {
		/* Travel is the track minus the pinned stage — the distance the
		   track moves while the stage stays put. */
		const travel = track.offsetHeight - stage.offsetHeight;
		if (travel <= 0) return;

		const scrolled = -track.getBoundingClientRect().top;
		const p = Math.min(1, Math.max(0, scrolled / travel));

		/* Equal thirds. Math.min catches p === 1 exactly, which would
		   otherwise index one past the last panel. */
		setActive(Math.min(panels.length - 1, Math.floor(p * panels.length)));
	}

	function onScroll() {
		if (queued) return;
		queued = true;
		requestAnimationFrame(function () {
			measure();
			queued = false;
		});
	}

	function teardown() {
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', onScroll);
		section.classList.remove('cs-live');
		active = -1;
		mark(panels, -1);
		mark(shots, -1);
		mark(ticks, -1);
	}

	function sync() {
		teardown();
		if (!wide.matches || still.matches) return;

		section.classList.add('cs-live');
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		measure();
	}

	wide.addEventListener('change', sync);
	still.addEventListener('change', sync);
	sync();
})();