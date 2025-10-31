/**
 * Utility functions for handling partial updates with change detection
 */

/**
 * Configuration for comparing a field
 */
type FieldComparator<TValue, TRecord extends Record<string, unknown> = Record<string, unknown>> = {
	/**
	 * Custom equality check function
	 * If not provided, uses strict equality (===)
	 */
	equals?: (current: TValue | null | undefined, updated: TValue | null | undefined) => boolean;
	/**
	 * Transform function to apply when the value has changed
	 * Useful for converting empty strings to null, etc.
	 * Returns a single value for the same field
	 */
	transform?: (value: TValue | null | undefined) => TValue | null;
	/**
	 * Map function for complex transformations that affect multiple fields
	 * When a field changes, this function can return an object with multiple field updates
	 * Example: username change updates username, displayUsername, and name
	 */
	map?: (
		value: TValue | null | undefined,
		currentData: TRecord,
		updateData: TRecord
	) => Record<string, unknown>;
	/**
	 * List of dependent fields that should trigger this field's map function
	 * Constrained to keys of the record type for type safety
	 * Example: if banned depends on banReason changing, list 'banReason' here
	 */
	dependsOn?: (keyof TRecord)[];
};

/**
 * Compare two values with optional custom comparator
 */
function compareValues<T, TRecord extends Record<string, unknown> = Record<string, unknown>>(
	currentValue: T | null | undefined,
	newValue: T | null | undefined,
	comparator?: FieldComparator<T, TRecord>
): boolean {
	if (comparator?.equals) {
		return comparator.equals(currentValue, newValue);
	}

	// handle Date objects specially
	if (currentValue instanceof Date && newValue instanceof Date) {
		return currentValue.getTime() === newValue.getTime();
	}

	// handle null/undefined edge cases
	if (currentValue === null && newValue === undefined) return true;
	if (currentValue === undefined && newValue === null) return true;

	return currentValue === newValue;
}

/**
 * Compare current data with update data and return only changed fields
 *
 * @param currentData - Current values from database
 * @param updateData - New values to update (partial)
 * @param fieldComparators - Optional custom comparators for specific fields
 * @param fieldsToCheck - Explicit list of fields to check (ensures type safety)
 * @returns Object containing only changed fields
 *
 * @example
 * ```ts
 * const changes = getChangedFields(
 *   currentPaste,
 *   updateData,
 *   {
 *     expiresAt: {
 *       equals: (a, b) => a?.getTime() === b?.getTime(),
 *     },
 *     customSlug: {
 *       transform: (v) => v || null,
 *     },
 *   },
 *   ['content', 'visibility', 'customSlug', 'language', 'title', 'description', 'passwordHash', 'expiresAt', 'burnAfterReading']
 * );
 * ```
 */
export function getChangedFields<TCurrent extends Record<string, unknown>>(
	currentData: TCurrent,
	updateData: Partial<Record<keyof TCurrent, unknown>>,
	fieldComparators?: Partial<Record<keyof TCurrent, FieldComparator<unknown, TCurrent>>>,
	fieldsToCheck?: (keyof TCurrent)[]
): Partial<TCurrent> {
	const changes: Partial<TCurrent> = {};

	// if fieldsToCheck is provided, only check those fields
	// otherwise check all keys in updateData
	const keysToCheck = fieldsToCheck || (Object.keys(updateData) as (keyof TCurrent)[]);

	for (const key of keysToCheck) {
		// skip if field is not provided in update data
		if (!(key in updateData)) continue;

		// ensure key exists in both current and update (type guard)
		if (!(key in currentData)) continue;
		const newValue: unknown = updateData[key];

		if (newValue === undefined) continue;

		const currentValue = currentData[key];
		const comparator = fieldComparators?.[key as string];

		// if map function is provided, use it to generate multiple field updates
		if (comparator?.map) {
			// check if the main field changed
			let hasChanged = !compareValues(currentValue, newValue, comparator);

			// also check if any dependent fields changed
			if (!hasChanged && comparator.dependsOn) {
				for (const depField of comparator.dependsOn) {
					if (depField in updateData && depField in currentData) {
						const depCurrentValue = currentData[depField];
						const depNewValue: unknown = updateData[depField];
						if (
							depNewValue !== undefined &&
							!compareValues(depCurrentValue, depNewValue as TCurrent[keyof TCurrent], undefined)
						) {
							hasChanged = true;
							break;
						}
					}
				}
			}

			if (hasChanged) {
				const mappedFields = comparator.map(
					newValue,
					currentData as TCurrent,
					updateData as TCurrent
				);
				Object.assign(changes, mappedFields);
			}
		} else {
			// apply transform BEFORE comparison if provided
			let transformedValue: unknown = newValue;
			if (comparator?.transform) {
				transformedValue = comparator.transform(newValue);

				if (transformedValue === undefined) continue;
			}

			// check if values are different (after transformation)
			const hasChanged = !compareValues(currentValue, transformedValue, comparator);
			if (hasChanged) {
				changes[key] = transformedValue as TCurrent[keyof TCurrent];
			}
		}
	}

	return changes;
}

/**
 * Type-safe helper to ensure all updatable fields are handled
 * This creates a compile-time check that all fields in the update type are considered
 *
 * @example
 * ```ts
 * // This will give a TypeScript error if you forget a field
 * const fieldMap = createFieldMap<UpdatePasteData>()({
 *   content: {},
 *   visibility: {},
 *   customSlug: { transform: (v) => v || null },
 *   // ... if you forget a field, TypeScript will error
 * });
 * ```
 */
export function createFieldMap<TUpdate>() {
	return <TMap extends { [K in keyof Required<TUpdate>]: FieldComparator<TUpdate[K]> }>(
		map: TMap
	): TMap => map;
}

/**
 * Date comparison helper
 */
export const dateEquals = (a: unknown, b: unknown): boolean => {
	// handle null/undefined
	if (a === null && b === null) return true;
	if (a === undefined && b === undefined) return true;
	if (a === null && b === undefined) return true;
	if (a === undefined && b === null) return true;
	if (!a || !b) return false;

	// check if both are Date objects
	if (!(a instanceof Date) || !(b instanceof Date)) return false;

	return a.getTime() === b.getTime();
};

/**
 * Transform empty strings to null
 */
export const emptyToNull = <T>(value: T | null | undefined): T | null | undefined => {
	if (value === undefined) return undefined; // dont transform undefined
	if (value === '') return null;
	return value as T;
};
