import { describe, expect, it } from 'vitest';
import { type Err, type Ok, type Result, err, ok } from '../result';

describe('Result Type', () => {
	describe('ok', () => {
		it('should create a successful result with value', () => {
			const result = ok(42);

			expect(result.ok).toBe(true);
			expect(result.value).toBe(42);
		});

		it('should create ok result with string value', () => {
			const result = ok('success');

			expect(result.ok).toBe(true);
			expect(result.value).toBe('success');
		});

		it('should create ok result with object value', () => {
			const data = { id: 1, name: 'Test' };
			const result = ok(data);

			expect(result.ok).toBe(true);
			expect(result.value).toEqual(data);
		});

		it('should create ok result with array value', () => {
			const data = [1, 2, 3];
			const result = ok(data);

			expect(result.ok).toBe(true);
			expect(result.value).toEqual(data);
		});

		it('should create ok result with null value', () => {
			const result = ok(null);

			expect(result.ok).toBe(true);
			expect(result.value).toBeNull();
		});

		it('should create ok result with undefined value', () => {
			const result = ok(undefined);

			expect(result.ok).toBe(true);
			expect(result.value).toBeUndefined();
		});

		it('should have correct type structure', () => {
			const result: Ok<number> = ok(42);

			expect(result).toHaveProperty('ok', true);
			expect(result).toHaveProperty('value');
			expect(result).not.toHaveProperty('error');
		});
	});

	describe('err', () => {
		it('should create an error result with error', () => {
			const error = new Error('Something went wrong');
			const result = err(error);

			expect(result.ok).toBe(false);
			expect(result.error).toBe(error);
		});

		it('should create err result with string error', () => {
			const result = err('Error message');

			expect(result.ok).toBe(false);
			expect(result.error).toBe('Error message');
		});

		it('should create err result with custom error object', () => {
			const customError = { code: 'ERR_001', message: 'Custom error' };
			const result = err(customError);

			expect(result.ok).toBe(false);
			expect(result.error).toEqual(customError);
		});

		it('should create err result with number error code', () => {
			const result = err(404);

			expect(result.ok).toBe(false);
			expect(result.error).toBe(404);
		});

		it('should have correct type structure', () => {
			const result: Err<Error> = err(new Error('Test'));

			expect(result).toHaveProperty('ok', false);
			expect(result).toHaveProperty('error');
			expect(result).not.toHaveProperty('value');
		});
	});

	describe('Result Type Usage', () => {
		it('should allow type narrowing with ok check', () => {
			const result: Result<number, string> = ok(42);

			if (result.ok) {
				// TypeScript should know result.value exists
				expect(result.value).toBe(42);
			} else {
				// this branch should not execute
				expect.fail('Should not reach error branch');
			}
		});

		it('should allow type narrowing with not ok check', () => {
			const result: Result<number, string> = err('Something failed');

			if (!result.ok) {
				// TypeScript should know result.error exists
				expect(result.error).toBe('Something failed');
			} else {
				// this branch should not execute
				expect.fail('Should not reach ok branch');
			}
		});

		it('should work with pattern matching', () => {
			const processResult = (result: Result<string, Error>): string => {
				if (result.ok) {
					return `Success: ${result.value}`;
				} else {
					return `Error: ${result.error.message}`;
				}
			};

			expect(processResult(ok('data'))).toBe('Success: data');
			expect(processResult(err(new Error('failed')))).toBe('Error: failed');
		});

		it('should work in function return types', () => {
			const divide = (a: number, b: number): Result<number, string> => {
				if (b === 0) {
					return err('Division by zero');
				}
				return ok(a / b);
			};

			const successResult = divide(10, 2);
			expect(successResult.ok).toBe(true);
			if (successResult.ok) {
				expect(successResult.value).toBe(5);
			}

			const errorResult = divide(10, 0);
			expect(errorResult.ok).toBe(false);
			if (!errorResult.ok) {
				expect(errorResult.error).toBe('Division by zero');
			}
		});

		it('should work with async functions', async () => {
			const fetchData = async (): Promise<Result<string, Error>> => {
				try {
					// simulate async operation
					await Promise.resolve();
					return ok('data');
				} catch (e) {
					return err(e instanceof Error ? e : new Error('Unknown error'));
				}
			};

			const result = await fetchData();
			expect(result.ok).toBe(true);
		});
	});

	describe('Complex Type Scenarios', () => {
		it('should handle nested Result types', () => {
			const innerResult: Result<number, string> = ok(42);
			const outerResult: Result<Result<number, string>, Error> = ok(innerResult);

			expect(outerResult.ok).toBe(true);
			if (outerResult.ok) {
				expect(outerResult.value.ok).toBe(true);
				if (outerResult.value.ok) {
					expect(outerResult.value.value).toBe(42);
				}
			}
		});

		it('should handle Result with union types', () => {
			type Data = { type: 'user'; name: string } | { type: 'post'; title: string };
			const result: Result<Data, string> = ok({ type: 'user', name: 'John' });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.type).toBe('user');
			}
		});

		it('should handle Result with generic constraints', () => {
			interface Entity {
				id: string;
			}
			const createEntity = <T extends Entity>(data: T): Result<T, string> => {
				if (!data.id) {
					return err('ID is required');
				}
				return ok(data);
			};

			const result = createEntity({ id: '123', name: 'Test' });
			expect(result.ok).toBe(true);
		});
	});

	describe('Edge Cases', () => {
		it('should handle boolean values', () => {
			const trueResult = ok(true);
			const falseResult = ok(false);

			expect(trueResult.ok).toBe(true);
			expect(trueResult.value).toBe(true);
			expect(falseResult.ok).toBe(true);
			expect(falseResult.value).toBe(false);
		});

		it('should handle empty objects and arrays', () => {
			const emptyObjectResult = ok({});
			const emptyArrayResult = ok([]);

			expect(emptyObjectResult.ok).toBe(true);
			expect(emptyObjectResult.value).toEqual({});
			expect(emptyArrayResult.ok).toBe(true);
			expect(emptyArrayResult.value).toEqual([]);
		});

		it('should preserve error stack traces', () => {
			const error = new Error('Test error');
			const result = err(error);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.stack).toBeDefined();
			}
		});

		it('should handle symbol values', () => {
			const sym = Symbol('test');
			const result = ok(sym);

			expect(result.ok).toBe(true);
			expect(result.value).toBe(sym);
		});
	});
});
