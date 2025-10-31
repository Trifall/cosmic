import { browser } from '$app/environment';

const MOBILE_BREAKPOINT = 768;

export class IsMobile {
	#current = $state(false);

	constructor() {
		if (browser) {
			const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
			this.#current = mediaQuery.matches;

			mediaQuery.addEventListener('change', (e) => {
				this.#current = e.matches;
			});
		}
	}

	get current() {
		return this.#current;
	}
}
