import { Component } from "../Component";
import type { WorldBounds } from "../math/WorldBounds";
import type { Renderer } from "../rendering/Renderer";

/**
 * Draws an image at the object's world transform. The image is a project asset,
 * referenced by id; the scene resolves it to a URL. Until it loads, it fills the
 * same space with a placeholder rectangle, so an entity is never invisible.
 */
export class SpriteRenderer extends Component {
	/** The id of the project asset to draw. Empty draws the placeholder. */
	public assetId = "";
	public width = 100;
	public height = 100;

	/** Fields the inspector renders as an asset picker. */
	public static readonly assetFields = ["assetId"];

	private image: HTMLImageElement | null = null;
	private isLoaded = false;
	private loadToken = 0;

	public start(): void {
		void this.loadImage();
	}

	/** Resolves `assetId` to an image. Call again after changing `assetId`. */
	public async loadImage(): Promise<void> {
		const token = ++this.loadToken;
		this.isLoaded = false;
		this.image = null;

		const resolver = this.scene.assetResolver;
		const url =
			this.assetId && resolver ? await resolver(this.assetId) : undefined;
		if (token !== this.loadToken || !url) return;

		const image = new Image();
		image.onload = () => {
			if (token === this.loadToken) this.isLoaded = true;
		};
		image.src = url;
		this.image = image;
	}

	public render(renderer: Renderer): void {
		const matrix = this.gameObject.transform.getWorldMatrix();

		renderer.save();
		renderer.applyTransform(matrix);

		if (this.isLoaded && this.image) {
			renderer.drawImage(
				this.image,
				-this.width / 2,
				-this.height / 2,
				this.width,
				this.height,
			);
		} else {
			// Stand-in while the asset is missing or still loading.
			renderer.setFillColor("hotpink");
			renderer.fillRect(
				-this.width / 2,
				-this.height / 2,
				this.width,
				this.height,
			);
		}

		renderer.restore();
	}

	/** The sprite's four corners mapped to world space, as an axis-aligned box. */
	public getWorldBounds(): WorldBounds | null {
		const matrix = this.gameObject.transform.getWorldMatrix();
		const halfWidth = this.width / 2;
		const halfHeight = this.height / 2;
		const corners: Array<[number, number]> = [
			[-halfWidth, -halfHeight],
			[halfWidth, -halfHeight],
			[halfWidth, halfHeight],
			[-halfWidth, halfHeight],
		];

		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const [x, y] of corners) {
			const worldX = matrix[0] * x + matrix[2] * y + matrix[4];
			const worldY = matrix[1] * x + matrix[3] * y + matrix[5];
			if (worldX < minX) minX = worldX;
			if (worldY < minY) minY = worldY;
			if (worldX > maxX) maxX = worldX;
			if (worldY > maxY) maxY = worldY;
		}

		return { minX, minY, maxX, maxY };
	}
}
