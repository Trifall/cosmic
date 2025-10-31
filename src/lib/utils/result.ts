/**
 * A Result type that can be either Ok or Err
 * Used for returning success or error from functions
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Represents a successful result
 */
export interface Ok<T> {
	ok: true;
	value: T;
}

/**
 * Represents an error result
 */
export interface Err<E> {
	ok: false;
	error: E;
}

/**
 * Creates a successful result
 * @param value The value to wrap in a successful result
 * @returns An Ok result containing the value
 */
export const ok = <T>(value: T): Ok<T> => {
	return { ok: true, value };
};

/**
 * Creates an error result
 * @param error The error to wrap in an error result
 * @returns An Err result containing the error
 */
export const err = <E>(error: E): Err<E> => {
	return { ok: false, error };
};
