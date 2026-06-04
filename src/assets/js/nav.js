(() => {
	// Configuration
	const CONFIG = {
		BREAKPOINTS: {
			MOBILE: 1023.5,
		},
		SELECTORS: {
			body: "body",
			navigation: "#cs-navigation",
			hamburger: "#cs-navigation .cs-toggle",
			menuWrapper: "#cs-navigation .cs-ul-wrapper",
			dropdownToggle: ".cs-dropdown-toggle",
			dropdown: ".cs-dropdown",
			dropdownMenu: ".cs-drop-ul",
			navButton: ".cs-nav-button",
			darkModeToggle: "#dark-mode-toggle",
		},
		CLASSES: {
			active: "cs-active",
			menuOpen: "cs-open",
			scrolled: "cs-scrolled",
		},
	};

	// DOM Elements
	const elements = {
		body: document.querySelector(CONFIG.SELECTORS.body),
		navigation: document.querySelector(CONFIG.SELECTORS.navigation),
		hamburger: document.querySelector(CONFIG.SELECTORS.hamburger),
		menuWrapper: document.querySelector(CONFIG.SELECTORS.menuWrapper),
		navButton: document.querySelector(CONFIG.SELECTORS.navButton),
		darkModeToggle: document.querySelector(CONFIG.SELECTORS.darkModeToggle),
	};

	// Utilities
	const isMobile = () => window.matchMedia(`(max-width: ${CONFIG.BREAKPOINTS.MOBILE}px)`).matches;

	const toggleAttribute = (element, attribute, value1 = "true", value2 = "false") => {
		if (!element) return;
		const current = element.getAttribute(attribute);
		element.setAttribute(attribute, current === value1 ? value2 : value1);
	};

	const toggleInert = (element) => element && (element.inert = !element.inert);

	// Scroll Management — hide on scroll down, reveal white on scroll up
	const scrollManager = {
		lastScrollY: window.scrollY,
		ticking: false,
		SCROLL_THRESHOLD: 80,
		SCROLL_UP_DELTA: 10,

		handleScroll() {
			if (!elements.navigation) return;

			const currentScrollY = window.scrollY;
			const scrolledDown = currentScrollY > this.lastScrollY;
			const scrolledUp = currentScrollY < this.lastScrollY - this.SCROLL_UP_DELTA;

			if (currentScrollY <= this.SCROLL_THRESHOLD) {
				// At the top — transparent, no classes
				elements.navigation.classList.remove("cs-hidden", CONFIG.CLASSES.scrolled);
			} else if (scrolledDown) {
				// Scrolling down — hide nav
				elements.navigation.classList.add("cs-hidden");
				elements.navigation.classList.remove(CONFIG.CLASSES.scrolled);
			} else if (scrolledUp) {
				// Scrolling up — show white nav
				elements.navigation.classList.remove("cs-hidden");
				elements.navigation.classList.add(CONFIG.CLASSES.scrolled);
			}

			this.lastScrollY = currentScrollY;
			this.ticking = false;
		},

		init() {
			window.addEventListener("scroll", () => {
				if (!this.ticking) {
					window.requestAnimationFrame(this.handleScroll.bind(this));
					this.ticking = true;
				}
			}, { passive: true });
			this.handleScroll();
		},
	};

	// Dropdown Management
	const dropdownManager = {
		close(dropdown, shouldFocus = false) {
			if (!dropdown || !dropdown.classList.contains(CONFIG.CLASSES.active)) return false;

			dropdown.classList.remove(CONFIG.CLASSES.active);
			const button = dropdown.querySelector(CONFIG.SELECTORS.dropdownToggle);
			const menu = dropdown.querySelector(CONFIG.SELECTORS.dropdownMenu);

			if (button) {
				button.setAttribute("aria-expanded", "false");
				shouldFocus && button.focus();
			}

			if (menu) {
				menu.inert = true;
			}

			return true;
		},

		toggle(element) {
			element.classList.toggle(CONFIG.CLASSES.active);
			const button = element.querySelector(CONFIG.SELECTORS.dropdownToggle);
			const menu = element.querySelector(CONFIG.SELECTORS.dropdownMenu);

			button && toggleAttribute(button, "aria-expanded");
			menu && toggleInert(menu);
		},

		closeAll() {
			if (!elements.navigation) return false;
			let closed = false;

			elements.navigation.querySelectorAll(`${CONFIG.SELECTORS.dropdown}.${CONFIG.CLASSES.active}`).forEach((dropdown) => {
				this.close(dropdown, true);
				closed = true;
			});

			return closed;
		},
	};

	// Menu Management
	const menuManager = {
		toggle() {
			if (!elements.hamburger || !elements.navigation) return;

			const isClosing = elements.navigation.classList.contains(CONFIG.CLASSES.active);

			[elements.hamburger, elements.navigation].forEach((el) => el.classList.toggle(CONFIG.CLASSES.active));
			elements.body.classList.toggle(CONFIG.CLASSES.menuOpen);
			toggleAttribute(elements.hamburger, "aria-expanded");

			if (elements.menuWrapper && isMobile()) {
				toggleInert(elements.menuWrapper);
			}

			isClosing && dropdownManager.closeAll();
		},
	};

	// Keyboard Management
	const keyboardManager = {
		handleEscape() {
			if (!elements.navigation) return;

			const dropdownsClosed = dropdownManager.closeAll();
			if (dropdownsClosed) return;

			if (elements.hamburger && elements.hamburger.classList.contains(CONFIG.CLASSES.active)) {
				menuManager.toggle();
				elements.hamburger.focus();
			}
		},
	};

	// Event Management
	const eventManager = {
		handleDropdownClick(event) {
			if (!isMobile()) return;

			const button = event.target.closest(CONFIG.SELECTORS.dropdownToggle);
			if (!button) return;

			event.preventDefault();
			const dropdown = button.closest(CONFIG.SELECTORS.dropdown);
			if (dropdown) {
				dropdownManager.toggle(dropdown);
			}
		},

		handleDropdownKeydown(event) {
			if (event.key !== "Enter" && event.key !== " ") return;

			const button = event.target.closest(CONFIG.SELECTORS.dropdownToggle);
			if (!button) return;

			event.preventDefault();
			const dropdown = button.closest(CONFIG.SELECTORS.dropdown);
			if (dropdown) {
				dropdownManager.toggle(dropdown);
			}
		},

		handleFocusOut(event) {
			setTimeout(() => {
				if (!event.relatedTarget) return;

				const dropdown = event.target.closest(CONFIG.SELECTORS.dropdown);
				if (dropdown?.classList.contains(CONFIG.CLASSES.active) && !dropdown.contains(event.relatedTarget)) {
					dropdownManager.close(dropdown);
				}
			}, 10);
		},

		handleMobileFocus(event) {
			if (!isMobile() || !elements.navigation.classList.contains(CONFIG.CLASSES.active)) return;
			if (elements.menuWrapper.contains(event.target) || elements.hamburger.contains(event.target)) return;

			menuManager.toggle();
		},

		handleDropdownHover(event) {
			if (isMobile()) return;

			const dropdown = event.target.closest(CONFIG.SELECTORS.dropdown);
			if (!dropdown) return;

			const menu = dropdown.querySelector(CONFIG.SELECTORS.dropdownMenu);
			if (!menu) return;

			if (event.type === "mouseenter") {
				menu.inert = false;
			} else if (event.type === "mouseleave") {
				setTimeout(() => {
					if (!dropdown.matches(":hover")) {
						menu.inert = true;
					}
				}, 1);
			}
		},
	};

	// Initialization
	const init = {
		inertState() {
			if (!elements.menuWrapper) return;

			elements.menuWrapper.inert = isMobile();

			if (elements.navigation) {
				const dropdownMenus = elements.navigation.querySelectorAll(CONFIG.SELECTORS.dropdownMenu);
				dropdownMenus.forEach((dropdown) => {
					dropdown.inert = true;
				});
			}
		},

		eventListeners() {
			if (!elements.hamburger || !elements.navigation) return;

			elements.hamburger.addEventListener("click", menuManager.toggle.bind(menuManager));
			elements.navigation.addEventListener("click", (e) => {
				if (e.target === elements.navigation && elements.navigation.classList.contains(CONFIG.CLASSES.active)) {
					menuManager.toggle();
				}
			});

			elements.navigation.addEventListener("click", eventManager.handleDropdownClick);
			elements.navigation.addEventListener("keydown", eventManager.handleDropdownKeydown);
			elements.navigation.addEventListener("focusout", eventManager.handleFocusOut);

			elements.navigation.addEventListener("mouseenter", eventManager.handleDropdownHover, true);
			elements.navigation.addEventListener("mouseleave", eventManager.handleDropdownHover, true);

			document.addEventListener("keydown", (e) => e.key === "Escape" && keyboardManager.handleEscape());
			document.addEventListener("focusin", eventManager.handleMobileFocus);

			window.addEventListener("resize", () => {
				this.inertState();
				if (!isMobile() && elements.navigation.classList.contains(CONFIG.CLASSES.active)) {
					menuManager.toggle();
				}
			});
		},
	};

	// Run
	init.inertState();
	init.eventListeners();
	scrollManager.init();
})();