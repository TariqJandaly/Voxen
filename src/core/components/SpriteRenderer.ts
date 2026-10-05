import { Component } from "../Component";

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
		const obj = this.gameObject;

		ctx.save();
		ctx.translate(obj.x, obj.y);
		ctx.rotate(obj.rotation);
		ctx.scale(obj.scaleX, obj.scaleY);

		if (this.isLoaded && this.image) {
			ctx.drawImage(
				this.image,
				-this.width / 2,
				-this.height / 2,
				this.width,
				this.height,
			);
		} else {
			// Placeholder shown while the image loads over the network.
			ctx.fillStyle = "hotpink";
			ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
		}

		ctx.restore();
	}
}
