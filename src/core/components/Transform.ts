import { Component } from "../Component";
import {
	decomposeMatrix,
	type Matrix2D,
	multiplyMatrix,
} from "../math/Matrix2D";
import { Vector3 } from "../math/Vector3";

/**
 * Position, rotation, and scale for a GameObject, relative to its parent. The
 * vectors carry a `z` for the eventual 3D work; 2D rendering uses `position.xy`,
 * `rotation.z`, and `scale.xy`. Every GameObject owns one, so it never needs to
 * be added or removed by hand.
 */
export class Transform extends Component {
	public position = new Vector3(0, 0, 0);
	public rotation = new Vector3(0, 0, 0);
	public scale = new Vector3(1, 1, 1);

	/** This transform as a 2D matrix, relative to the parent. */
	public getLocalMatrix(): Matrix2D {
		const cos = Math.cos(this.rotation.z);
		const sin = Math.sin(this.rotation.z);
		return [
			cos * this.scale.x,
			sin * this.scale.x,
			-sin * this.scale.y,
			cos * this.scale.y,
			this.position.x,
			this.position.y,
		];
	}

	/** The transform with every ancestor folded in. This is the one rendering uses. */
	public getWorldMatrix(): Matrix2D {
		const local = this.getLocalMatrix();
		const parent = this.gameObject.parent;
		return parent
			? multiplyMatrix(parent.transform.getWorldMatrix(), local)
			: local;
	}

	/** Sets the local transform from a matrix. Used to keep the world pose on reparent. */
	public setFromMatrix(matrix: Matrix2D): void {
		const local = decomposeMatrix(matrix);
		this.position.x = local.x;
		this.position.y = local.y;
		this.rotation.z = local.rotation;
		this.scale.x = local.scaleX;
		this.scale.y = local.scaleY;
	}
}
