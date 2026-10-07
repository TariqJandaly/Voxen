import type { Matrix2D } from "../math/Matrix2D";
import type { Renderer } from "./Renderer";

/** A `Renderer` backed by a Canvas 2D context. */
export class CanvasRenderer implements Renderer {
	constructor(private readonly ctx: CanvasRenderingContext2D) {}

	public get width(): number {
		return this.ctx.canvas.width;
	}

	public get height(): number {
		return this.ctx.canvas.height;
	}

	public resize(width: number, height: number, pixelRatio: number): void {
		const canvas = this.ctx.canvas;
		canvas.width = Math.max(1, Math.round(width * pixelRatio));
		canvas.height = Math.max(1, Math.round(height * pixelRatio));
		// Setting width/height resets the transform, so re-apply the DPI scale.
		this.ctx.scale(pixelRatio, pixelRatio);
	}

	public clear(): void {
		this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
	}

	public save(): void {
		this.ctx.save();
	}

	public restore(): void {
		this.ctx.restore();
	}

	public applyTransform(matrix: Matrix2D): void {
		this.ctx.transform(
			matrix[0],
			matrix[1],
			matrix[2],
			matrix[3],
			matrix[4],
			matrix[5],
		);
	}

	public setFillColor(color: string): void {
		this.ctx.fillStyle = color;
	}

	public fillRect(x: number, y: number, width: number, height: number): void {
		this.ctx.fillRect(x, y, width, height);
	}

	public drawImage(
		image: CanvasImageSource,
		dx: number,
		dy: number,
		dw: number,
		dh: number,
	): void {
		this.ctx.drawImage(image, dx, dy, dw, dh);
	}

	public setFont(font: string): void {
		this.ctx.font = font;
	}

	public drawText(text: string, x: number, y: number): void {
		this.ctx.fillText(text, x, y);
	}

	public measureText(text: string): number {
		return this.ctx.measureText(text).width;
	}
}
