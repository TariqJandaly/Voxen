/** A 2D affine matrix laid out as `[a, b, c, d, e, f]`, same as `ctx.transform`. */
export type Matrix2D = [number, number, number, number, number, number];

/** The do-nothing matrix. */
export const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0];

/** Multiplies two matrices: apply `a` first, then `b`. */
export function multiplyMatrix(a: Matrix2D, b: Matrix2D): Matrix2D {
	return [
		a[0] * b[0] + a[2] * b[1],
		a[1] * b[0] + a[3] * b[1],
		a[0] * b[2] + a[2] * b[3],
		a[1] * b[2] + a[3] * b[3],
		a[0] * b[4] + a[2] * b[5] + a[4],
		a[1] * b[4] + a[3] * b[5] + a[5],
	];
}

/** Returns the inverse, or null when the matrix has no area (determinant 0). */
export function invertMatrix(matrix: Matrix2D): Matrix2D | null {
	const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
	if (determinant === 0) return null;

	const inverse = 1 / determinant;
	return [
		matrix[3] * inverse,
		-matrix[1] * inverse,
		-matrix[2] * inverse,
		matrix[0] * inverse,
		(matrix[2] * matrix[5] - matrix[3] * matrix[4]) * inverse,
		(matrix[1] * matrix[4] - matrix[0] * matrix[5]) * inverse,
	];
}

/** The pieces a matrix breaks down into. */
export interface Transform2D {
	x: number;
	y: number;
	rotation: number;
	scaleX: number;
	scaleY: number;
}

/** Splits a matrix back into translation, rotation, and scale. Assumes there is no shear. */
export function decomposeMatrix(matrix: Matrix2D): Transform2D {
	const scaleX = Math.hypot(matrix[0], matrix[1]);
	const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
	return {
		x: matrix[4],
		y: matrix[5],
		rotation: Math.atan2(matrix[1], matrix[0]),
		scaleX,
		scaleY: scaleX === 0 ? 0 : determinant / scaleX,
	};
}
