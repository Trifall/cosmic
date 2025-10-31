import { describe, expect, it } from 'vitest';
import { isActiveRoute } from './active-route';

describe('isActiveRoute', () => {
	describe('root path', () => {
		it('should return true when href is / and pathname is /', () => {
			expect(isActiveRoute('/', '/')).toBe(true);
		});

		it('should return false when href is / and pathname is not /', () => {
			expect(isActiveRoute('/admin', '/')).toBe(false);
			expect(isActiveRoute('/settings', '/')).toBe(false);
		});
	});

	describe('exact matches', () => {
		it('should return true when pathname exactly matches href', () => {
			expect(isActiveRoute('/admin', '/admin')).toBe(true);
			expect(isActiveRoute('/settings', '/settings')).toBe(true);
			expect(isActiveRoute('/admin/settings', '/admin/settings')).toBe(true);
		});

		it('should handle trailing slashes correctly', () => {
			expect(isActiveRoute('/admin/', '/admin')).toBe(true);
			expect(isActiveRoute('/admin', '/admin/')).toBe(true);
			expect(isActiveRoute('/admin/', '/admin/')).toBe(true);
		});
	});

	describe('parent and child routes', () => {
		it('should return false when pathname is a child of href', () => {
			// a	dmin section tests
			expect(isActiveRoute('/admin/settings', '/admin')).toBe(false);
			expect(isActiveRoute('/admin/users', '/admin')).toBe(false);
			expect(isActiveRoute('/admin/library', '/admin')).toBe(false);

			// settings section tests
			expect(isActiveRoute('/settings/profile', '/settings')).toBe(false);
			expect(isActiveRoute('/settings/appearance', '/settings')).toBe(false);
		});

		it('should return false for deeply nested routes', () => {
			expect(isActiveRoute('/admin/users/add', '/admin')).toBe(false);
			expect(isActiveRoute('/admin/users/12341/edit', '/admin/users')).toBe(false);
		});
	});

	describe('unrelated routes', () => {
		it('should return false when paths are completely different', () => {
			expect(isActiveRoute('/admin', '/settings')).toBe(false);
			expect(isActiveRoute('/settings', '/admin')).toBe(false);
			expect(isActiveRoute('/dashboard', '/admin')).toBe(false);
		});

		it('should return false for paths with similar prefixes but not parent-child', () => {
			expect(isActiveRoute('/admin-panel', '/admin')).toBe(false);
			expect(isActiveRoute('/settings-page', '/settings')).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle empty paths correctly', () => {
			expect(isActiveRoute('', '/')).toBe(false);
			expect(isActiveRoute('/', '')).toBe(false);
		});

		it('should handle case sensitivity correctly', () => {
			expect(isActiveRoute('/Admin', '/admin')).toBe(false);
			expect(isActiveRoute('/admin', '/Admin')).toBe(false);
		});
	});
});
