import { Component } from "../Component";
import type { Renderer } from "../rendering/Renderer";

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
			// Stand-in while the image is still coming over the network.
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
}
