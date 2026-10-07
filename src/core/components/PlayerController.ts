import { Component } from "../Component";

/** Moves its object with the `left`, `right`, `up`, and `down` input actions. */
export class PlayerController extends Component {
	/** Movement speed in pixels per second. */
	public speed = 200;

	public update(deltaTime: number): void {
		const input = this.scene.input;

		let directionX = 0;
		let directionY = 0;

		if (input.isDown("left")) directionX -= 1;
		if (input.isDown("right")) directionX += 1;
		if (input.isDown("up")) directionY -= 1;
		if (input.isDown("down")) directionY += 1;

		// Keep diagonals from being faster than straight lines.
		if (directionX !== 0 && directionY !== 0) {
			directionX *= Math.SQRT1_2;
			directionY *= Math.SQRT1_2;
		}

		const position = this.gameObject.transform.position;
		position.x += directionX * this.speed * deltaTime;
		position.y += directionY * this.speed * deltaTime;
	}
}
