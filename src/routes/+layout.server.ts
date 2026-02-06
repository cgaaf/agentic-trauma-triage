import { isMockMode } from '$lib/server/config.js';

export function load() {
	return {
		mockMode: isMockMode(),
	};
}
