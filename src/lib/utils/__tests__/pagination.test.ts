/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type PaginationData,
	getPaginationPreloadUrl,
	handleNextPage,
	handlePageChange,
	handlePreviousPage,
} from '../pagination';

// mock SvelteKit's browser environment - default to false
vi.mock('$app/environment', () => ({
	get browser() {
		return typeof window !== 'undefined';
	},
}));

describe('Pagination Utils', () => {
	const mockPagination: PaginationData = {
		page: 3,
		limit: 10,
		total: 100,
		totalPages: 10,
	};

	beforeEach(() => {
		// reset window.location for each test
		delete (global as any).window;
	});

	describe('getPaginationPreloadUrl', () => {
		describe('Browser Environment', () => {
			beforeEach(() => {
				// mock browser environment with proper URL object
				(global as any).window = {
					location: {
						href: 'http://localhost:3000/admin/users?page=3&search=test',
						pathname: '/admin/users',
					},
					URL: global.URL,
				};
			});

			it('should generate previous page URL', () => {
				const url = getPaginationPreloadUrl(mockPagination, 'previous', false);
				expect(url).toContain('page=2');
				expect(url).toContain('search=test');
			});

			it('should generate next page URL', () => {
				const url = getPaginationPreloadUrl(mockPagination, 'next', false);
				expect(url).toContain('page=4');
				expect(url).toContain('search=test');
			});

			it('should generate resolved URL when isResolve is true', () => {
				const url = getPaginationPreloadUrl(mockPagination, 'previous', true);
				expect(url).toBe('/admin/users?page=2');
				expect(url).not.toContain('search');
			});

			it('should return empty string when on first page and going previous', () => {
				const firstPagePagination = { ...mockPagination, page: 1 };
				const url = getPaginationPreloadUrl(firstPagePagination, 'previous', false);
				expect(url).toBe('');
			});

			it('should return empty string when on last page and going next', () => {
				const lastPagePagination = { ...mockPagination, page: 10, totalPages: 10 };
				const url = getPaginationPreloadUrl(lastPagePagination, 'next', false);
				expect(url).toBe('');
			});

			it('should preserve existing query parameters', () => {
				(global as any).window.location.href =
					'http://localhost:3000/admin/users?page=3&search=test&filter=active';

				const url = getPaginationPreloadUrl(mockPagination, 'next', false);
				expect(url).toContain('page=4');
				expect(url).toContain('search=test');
				expect(url).toContain('filter=active');
			});
		});

		describe('SSR Environment', () => {
			it('should return simple query string in SSR', () => {
				const url = getPaginationPreloadUrl(mockPagination, 'previous', false);
				expect(url).toBe('?page=2');
			});

			it('should return empty string when invalid in SSR', () => {
				const firstPagePagination = { ...mockPagination, page: 1 };
				const url = getPaginationPreloadUrl(firstPagePagination, 'previous', false);
				expect(url).toBe('');
			});
		});

		it('should return empty string when pagination is null/undefined', () => {
			const url = getPaginationPreloadUrl(null as any, 'next', false);
			expect(url).toBe('');
		});
	});

	describe('handlePageChange', () => {
		it('should update URL and navigate in browser', () => {
			const mockLocation = {
				href: 'http://localhost:3000/admin/users?page=3',
			};
			(global as any).window = { location: mockLocation };

			handlePageChange(5);

			expect(mockLocation.href).toContain('page=5');
		});

		it('should do nothing in SSR environment', () => {
			// no window object
			expect(() => handlePageChange(5)).not.toThrow();
		});
	});

	describe('handlePreviousPage', () => {
		beforeEach(() => {
			(global as any).window = {
				location: {
					href: 'http://localhost:3000/admin/users?page=3',
				},
			};
		});

		it('should navigate to previous page when not on first page', () => {
			const mockLocation = { href: 'http://localhost:3000/admin/users?page=3' };
			(global as any).window = { location: mockLocation };

			handlePreviousPage(mockPagination);

			expect(mockLocation.href).toContain('page=2');
		});

		it('should not navigate when on first page', () => {
			const firstPagePagination = { ...mockPagination, page: 1 };
			const originalHref = 'http://localhost:3000/admin/users?page=1';
			const mockLocation = { href: originalHref };
			(global as any).window = { location: mockLocation };

			handlePreviousPage(firstPagePagination);

			expect(mockLocation.href).toBe(originalHref);
		});

		it('should handle null pagination gracefully', () => {
			expect(() => handlePreviousPage(null as any)).not.toThrow();
		});
	});

	describe('handleNextPage', () => {
		beforeEach(() => {
			(global as any).window = {
				location: {
					href: 'http://localhost:3000/admin/users?page=3',
				},
			};
		});

		it('should navigate to next page when not on last page', () => {
			const mockLocation = { href: 'http://localhost:3000/admin/users?page=3' };
			(global as any).window = { location: mockLocation };

			handleNextPage(mockPagination);

			expect(mockLocation.href).toContain('page=4');
		});

		it('should not navigate when on last page', () => {
			const lastPagePagination = { ...mockPagination, page: 10, totalPages: 10 };
			const originalHref = 'http://localhost:3000/admin/users?page=10';
			const mockLocation = { href: originalHref };
			(global as any).window = { location: mockLocation };

			handleNextPage(lastPagePagination);

			expect(mockLocation.href).toBe(originalHref);
		});

		it('should handle null pagination gracefully', () => {
			expect(() => handleNextPage(null as any)).not.toThrow();
		});
	});

	describe('Edge Cases', () => {
		it('should handle page 0 safely', () => {
			const zeroPagination = { ...mockPagination, page: 0 };
			const url = getPaginationPreloadUrl(zeroPagination, 'previous', false);
			expect(url).toBe('');
		});

		it('should handle negative page numbers', () => {
			const negativePagination = { ...mockPagination, page: -1 };
			const url = getPaginationPreloadUrl(negativePagination, 'previous', false);
			expect(url).toBe('');
		});

		it('should handle totalPages of 1', () => {
			const singlePagePagination = { ...mockPagination, page: 1, totalPages: 1 };
			const prevUrl = getPaginationPreloadUrl(singlePagePagination, 'previous', false);
			const nextUrl = getPaginationPreloadUrl(singlePagePagination, 'next', false);

			expect(prevUrl).toBe('');
			expect(nextUrl).toBe('');
		});

		it('should handle page exceeding totalPages', () => {
			const beyondPagination = { ...mockPagination, page: 15, totalPages: 10 };
			const url = getPaginationPreloadUrl(beyondPagination, 'next', false);
			expect(url).toBe('');
		});
	});
});
