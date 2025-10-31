import { browser } from '$app/environment';

export type PaginationData = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};

export type PaginationPageItem = {
	name: string;
	href: string;
	active: boolean;
};

/**
 * Generate URLs for prefetching in SvelteKit
 * @param pagination The pagination data
 * @param direction The direction of navigation ('previous' or 'next')
 * @returns The URL for prefetching
 */
export const getPaginationPreloadUrl = (
	pagination: PaginationData,
	direction: 'previous' | 'next',
	isResolve: boolean = false
): string => {
	// return empty string if pagination is not available
	if (!pagination) return '';

	// calculate the target page number based on direction
	let targetPage: number;
	if (direction === 'previous') {
		// check if already on the first page
		if (pagination.page <= 1) return '';
		targetPage = pagination.page - 1;
	} else {
		// next
		// check if already on the last page
		if (pagination.page >= pagination.totalPages) return '';
		targetPage = pagination.page + 1;
	}

	// generate the URL
	if (browser) {
		if (isResolve) {
			return `${window.location.pathname}?page=${targetPage}`;
		}

		const url = new URL(window.location.href);
		url.searchParams.set('page', targetPage.toString());
		return url.toString();
	}

	// fallback for SSR
	return `?page=${targetPage}`;
};

/**
 * Handle page change
 * @param newPage The new page number
 * @returns void
 */
export const handlePageChange = (newPage: number) => {
	if (browser) {
		const url = new URL(window.location.href);
		url.searchParams.set('page', newPage.toString());
		window.location.href = url.toString();
	}
};

/**
 * Handle previous page navigation
 * @param pagination The pagination data
 * @returns void
 */
export const handlePreviousPage = (pagination: PaginationData) => {
	if (pagination && pagination.page > 1) {
		handlePageChange(pagination.page - 1);
	}
};

/**
 * Handle next page navigation
 * @param pagination The pagination data
 * @returns void
 */
export const handleNextPage = (pagination: PaginationData) => {
	if (pagination && pagination.page < pagination.totalPages) {
		handlePageChange(pagination.page + 1);
	}
};
