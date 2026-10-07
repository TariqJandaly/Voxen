import type { Matrix2D } from "../math/Matrix2D";

/**
 * The drawing surface the engine talks to. Components draw through this instead
 * of touching a canvas context, so a different backend (WebGL, WebGPU) can be
 * added later without changing them.
 */
export interface Renderer {
	readonly width: number;
	readonly height: number;

	/** Sizes the backing buffer. `pixelRatio` is the device pixel ratio. */
	resize(width: number, height: number, pixelRatio: number): void;
	clear(): void;

	save(): void;
	restore(): void;
	applyTransform(matrix: Matrix2D): void;

	setFillColor(color: string): void;
	fillRect(x: number, y: number, width: number, height: number): void;
	drawImage(
		image: CanvasImageSource,
		dx: number,
		dy: number,
		dw: number,
		dh: number,
	): void;

	setFont(font: string): void;
	drawText(text: string, x: number, y: number): void;
	measureText(text: string): number;
}
