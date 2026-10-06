import { Component } from "../Component";

/**
 * Draws an image at the object's world transform. Until the image finishes
 * loading it fills the same space with a placeholder rectangle, so an entity is
 * never invisible.
 */
export class SpriteRenderer extends Component {
	public imageUrl = "";
	public width = 100;
	public height = 100;

	private image: HTMLImageElement | null = null;
	private isLoaded = false;

	public start(): void {
		if (!this.imageUrl) return;

		const image = new Image();
		image.onload = () => {
			this.isLoaded = true;
		};
		image.src = this.imageUrl;
		this.image = image;
	}

	public update(): void {
		const ctx = this.scene.ctx;
		const matrix = this.gameObject.getWorldMatrix();

		ctx.save();
		ctx.transform(
			matrix[0],
			matrix[1],
			matrix[2],
			matrix[3],
			matrix[4],
			matrix[5],
		);

		if (this.isLoaded && this.image) {
			ctx.drawImage(
				this.image,
				-this.width / 2,
				-this.height / 2,
				this.width,
				this.height,
			);
		} else {
			// Stand-in while the image is still coming over the network.
			ctx.fillStyle = "hotpink";
			ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
		}

		ctx.restore();
	}
}
