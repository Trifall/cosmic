import { describe, expect, it } from 'vitest';
import { dateEquals, emptyToNull, getChangedFields } from './update-helpers';

describe('update-helpers', () => {
	describe('dateEquals', () => {
		it('should return true for equal dates', () => {
			const date1 = new Date('2024-01-01');
			const date2 = new Date('2024-01-01');
			expect(dateEquals(date1, date2)).toBe(true);
		});

		it('should return false for different dates', () => {
			const date1 = new Date('2024-01-01');
			const date2 = new Date('2024-01-02');
			expect(dateEquals(date1, date2)).toBe(false);
		});

		it('should handle null and undefined', () => {
			expect(dateEquals(null, null)).toBe(true);
			expect(dateEquals(undefined, undefined)).toBe(true);
			expect(dateEquals(null, undefined)).toBe(true);
			expect(dateEquals(undefined, null)).toBe(true);
			expect(dateEquals(null, new Date())).toBe(false);
			expect(dateEquals(new Date(), null)).toBe(false);
		});
	});

	describe('emptyToNull', () => {
		it('should convert empty string to null', () => {
			expect(emptyToNull('')).toBe(null);
		});

		it('should not convert undefined to null', () => {
			expect(emptyToNull(undefined)).toBe(undefined);
		});

		it('should pass through other values', () => {
			expect(emptyToNull('test')).toBe('test');
			expect(emptyToNull(123)).toBe(123);
			expect(emptyToNull(false)).toBe(false);
		});
	});

	describe('getChangedFields', () => {
		it('should detect changed string fields', () => {
			const current = { title: 'old title', content: 'same' };
			const update = { title: 'new title', content: 'same' };

			const changes = getChangedFields(current, update, {}, ['title', 'content']);

			expect(changes).toEqual({ title: 'new title' });
		});

		it('should detect changed number fields', () => {
			const current = { views: 10, likes: 5 };
			const update = { views: 15, likes: 5 };

			const changes = getChangedFields(current, update, {}, ['views', 'likes']);

			expect(changes).toEqual({ views: 15 });
		});

		it('should detect changed boolean fields', () => {
			const current = { published: false, archived: false };
			const update = { published: true, archived: false };

			const changes = getChangedFields(current, update, {}, ['published', 'archived']);

			expect(changes).toEqual({ published: true });
		});

		it('should handle null to value changes', () => {
			const current = { description: null as string | null };
			const update = { description: 'new description' };

			const changes = getChangedFields(current, update, {}, ['description']);

			expect(changes).toEqual({ description: 'new description' });
		});

		it('should handle value to null changes', () => {
			const current = { description: 'old description' as string | null };
			const update = { description: null };

			const changes = getChangedFields(current, update, {}, ['description']);

			expect(changes).toEqual({ description: null });
		});

		it('should use custom date comparator', () => {
			const date1 = new Date('2024-01-01');
			const date2 = new Date('2024-01-01');
			const date3 = new Date('2024-01-02');

			const current = { expiresAt: date1 };
			const update = { expiresAt: date2 };

			// without custom comparator, would be detected as different (different object references)
			const changes = getChangedFields(
				current,
				update,
				{
					expiresAt: { equals: dateEquals },
				},
				['expiresAt']
			);

			expect(changes).toEqual({});

			// now with actually different date
			const update2 = { expiresAt: date3 };
			const changes2 = getChangedFields(
				current,
				update2,
				{
					expiresAt: { equals: dateEquals },
				},
				['expiresAt']
			);

			expect(changes2).toEqual({ expiresAt: date3 });
		});

		it('should apply transform function', () => {
			const current = { customSlug: null as string | null };
			const update = { customSlug: '' };

			const changes = getChangedFields(
				current,
				update,
				{
					customSlug: { transform: emptyToNull },
				},
				['customSlug']
			);

			// empty string should be transformed to null, and since current is null, no change
			expect(changes).toEqual({});
		});

		it('should handle undefined values in update (skip them)', () => {
			const current = { title: 'old' as string | undefined, content: 'old' as string | undefined };
			const update = { title: 'new' }; // content is undefined (not provided)

			const changes = getChangedFields(current, update, {}, ['title', 'content']);

			// only title should be in changes, content was not provided in update
			expect(changes).toEqual({ title: 'new' });
		});

		it('should return empty object when nothing changed', () => {
			const current = { title: 'same', content: 'same' };
			const update = { title: 'same', content: 'same' };

			const changes = getChangedFields(current, update, {}, ['title', 'content']);

			expect(changes).toEqual({});
		});

		it('should handle complex nested scenario', () => {
			type Visibility = 'PUBLIC' | 'PRIVATE' | 'AUTHENTICATED';

			const current = {
				content: 'old content',
				title: 'old title',
				visibility: 'PUBLIC' as Visibility,
				expiresAt: new Date('2024-01-01') as Date | null,
				burnAfterReading: false,
				customSlug: null as string | null,
			};

			const update = {
				content: 'new content',
				title: 'old title', // unchanged
				visibility: 'PRIVATE' as Visibility, // changed
				expiresAt: new Date('2024-01-01'), // same date
				burnAfterReading: false, // unchanged
				customSlug: '', // should transform to null
			};

			const changes = getChangedFields(
				current,
				update,
				{
					expiresAt: { equals: dateEquals },
					customSlug: { transform: emptyToNull },
				},
				['content', 'title', 'visibility', 'expiresAt', 'burnAfterReading', 'customSlug']
			);

			expect(changes).toEqual({
				content: 'new content',
				visibility: 'PRIVATE',
			});
		});

		it('should handle map function for multi-field updates', () => {
			const current = {
				username: 'olduser',
				displayUsername: 'olduser',
				name: 'olduser',
			};

			const update = {
				username: 'NewUser',
			};

			const changes = getChangedFields(
				current,
				update,
				{
					username: {
						map: (value) => ({
							username: (value as string).toLowerCase(),
							displayUsername: value as string,
							name: value as string,
						}),
					},
				},
				['username']
			);

			expect(changes).toEqual({
				username: 'newuser',
				displayUsername: 'NewUser',
				name: 'NewUser',
			});
		});

		it('should not apply map function if value unchanged', () => {
			const current = {
				username: 'sameuser',
				displayUsername: 'sameuser',
				name: 'sameuser',
			};

			const update = {
				username: 'sameuser',
			};

			const changes = getChangedFields(
				current,
				update,
				{
					username: {
						map: (value) => ({
							username: (value as string).toLowerCase(),
							displayUsername: value as string,
							name: value as string,
						}),
					},
				},
				['username']
			);

			expect(changes).toEqual({});
		});

		it('should handle map function with access to current and update data', () => {
			const current = {
				banned: false,
				banReason: null as string | null,
				banExpires: null as Date | null,
			};

			const update = {
				banned: true,
			};

			const changes = getChangedFields(
				current,
				update,
				{
					banned: {
						map: (value, _current, updateData) => ({
							banned: value as boolean,
							banReason: value ? (updateData.banReason as string) || 'No reason provided' : null,
							banExpires: value ? null : null,
						}),
					},
				},
				['banned']
			);

			expect(changes).toEqual({
				banned: true,
				banReason: 'No reason provided',
				banExpires: null,
			});
		});

		it('should prefer map over transform when both are provided', () => {
			const current = {
				field: 'old',
				relatedField: 'old-related',
			};

			const update = {
				field: 'new',
			};

			const changes = getChangedFields(
				current,
				update,
				{
					field: {
						transform: (value) => (value as string).toUpperCase(),
						map: (value) => ({
							field: (value as string).toLowerCase(),
							relatedField: `${value}-related`,
						}),
					},
				},
				['field']
			);

			// map should be used, not transform
			expect(changes).toEqual({
				field: 'new',
				relatedField: 'new-related',
			});
		});

		it('should trigger map when dependent field changes', () => {
			const current = {
				banned: true,
				banReason: 'spam',
				banExpires: null as Date | null,
			};

			const update = {
				banned: true, // unchanged
				banReason: 'harassment', // changed
			};

			const changes = getChangedFields(
				current,
				update,
				{
					banned: {
						map: (value, _current, updateData) => ({
							banned: value as boolean,
							banReason: value ? (updateData.banReason as string) || null : null,
							banExpires: value ? null : null,
						}),
						dependsOn: ['banReason'],
					},
				},
				['banned']
			);

			// should detect the change even though banned didn't change
			expect(changes).toEqual({
				banned: true,
				banReason: 'harassment',
				banExpires: null,
			});
		});

		it('should not trigger map when neither main field nor dependent fields change', () => {
			const current = {
				banned: true,
				banReason: 'spam',
				banExpires: null as Date | null,
			};

			const update = {
				banned: true, // unchanged
				banReason: 'spam', // unchanged
			};

			const changes = getChangedFields(
				current,
				update,
				{
					banned: {
						map: (value, _current, updateData) => ({
							banned: value as boolean,
							banReason: value ? (updateData.banReason as string) || null : null,
							banExpires: value ? null : null,
						}),
						dependsOn: ['banReason'],
					},
				},
				['banned']
			);

			expect(changes).toEqual({});
		});

		it('should trigger map when main field changes even with dependsOn', () => {
			const current = {
				banned: false,
				banReason: null as string | null,
				banExpires: null as Date | null,
			};

			const update = {
				banned: true, // changed
				banReason: 'spam',
			};

			const changes = getChangedFields(
				current,
				update,
				{
					banned: {
						map: (value, _current, updateData) => ({
							banned: value as boolean,
							banReason: value ? (updateData.banReason as string) || null : null,
							banExpires: value ? null : null,
						}),
						dependsOn: ['banReason'],
					},
				},
				['banned']
			);

			expect(changes).toEqual({
				banned: true,
				banReason: 'spam',
				banExpires: null,
			});
		});

		it('should handle multiple dependent fields', () => {
			const current = {
				status: 'active',
				statusReason: 'initial',
				statusChangedBy: 'system',
			};

			const update = {
				status: 'active', // unchanged
				statusReason: 'manual update', // changed
				statusChangedBy: 'admin', // changed
			};

			const changes = getChangedFields(
				current,
				update,
				{
					status: {
						map: (value, _current, updateData) => ({
							status: value as string,
							statusReason: updateData.statusReason as string,
							statusChangedBy: updateData.statusChangedBy as string,
						}),
						dependsOn: ['statusReason', 'statusChangedBy'],
					},
				},
				['status']
			);

			expect(changes).toEqual({
				status: 'active',
				statusReason: 'manual update',
				statusChangedBy: 'admin',
			});
		});
	});
});
