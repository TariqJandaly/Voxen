import { GameObject } from "../GameObject";
import type { Matrix2D } from "../math/Matrix2D";
import { invertMatrix } from "../math/Matrix2D";
import { Vector2 } from "../math/Vector2";

/** An axis-aligned rectangle in world space. */
export interface WorldBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/**
 * A camera is a GameObject: it has a transform, can be parented, and lives in
 * the scene like anything else. Its world transform decides what the scene view
 * looks at, so you can move or attach a camera with the same tools you use for
 * sprites. The first active camera in the scene is the one the engine renders
 * through.
 */
export class Camera extends GameObject {
	/** How far in the view is scaled. 1 shows one world unit per screen unit. */
	public zoom = 1;

	/** Viewport size in CSS pixels, kept in sync by the scene on resize. */
	public viewportWidth = 0;
	public viewportHeight = 0;

	constructor(name = "Camera") {
		super(name);
	}

	/** Engine internal: the scene updates this whenever the canvas resizes. */
	public setViewport(width: number, height: number): void {
		this.viewportWidth = width;
		this.viewportHeight = height;
	}

	/**
	 * The matrix that maps world space onto the viewport. Apply it before drawing
	 * world objects: it centres the camera position and applies zoom and rotation.
	 */
	public getViewMatrix(): Matrix2D {
		const zoom = Math.max(this.zoom, Number.EPSILON);
		// A camera can be parented, so use its world transform, not the local one.
		const world = this.transform.getWorldMatrix();
		const rotation = Math.atan2(world[1], world[0]);
		const cos = Math.cos(rotation) * zoom;
		const sin = Math.sin(rotation) * zoom;

		// Rotate by -rotation, scale by zoom, then centre on the viewport.
		const a = cos;
		const b = -sin;
		const c = sin;
		const d = cos;
		const centerX = this.viewportWidth / 2;
		const centerY = this.viewportHeight / 2;
		const positionX = world[4];
		const positionY = world[5];

		return [
			a,
			b,
			c,
			d,
			centerX - (a * positionX + c * positionY),
			centerY - (b * positionX + d * positionY),
		];
	}

	/** Maps a world point to viewport (CSS pixel) coordinates. */
	public worldToScreen(
		worldX: number,
		worldY: number,
		out = new Vector2(),
	): Vector2 {
		const matrix = this.getViewMatrix();
		out.x = matrix[0] * worldX + matrix[2] * worldY + matrix[4];
		out.y = matrix[1] * worldX + matrix[3] * worldY + matrix[5];
		return out;
	}

	/** Maps a viewport (CSS pixel) point back to world space. */
	public screenToWorld(
		screenX: number,
		screenY: number,
		out = new Vector2(),
	): Vector2 {
		const inverse = invertMatrix(this.getViewMatrix());
		if (!inverse) {
			out.x = 0;
			out.y = 0;
			return out;
		}
		out.x = inverse[0] * screenX + inverse[2] * screenY + inverse[4];
		out.y = inverse[1] * screenX + inverse[3] * screenY + inverse[5];
		return out;
	}

	/** The smallest world-space rectangle containing everything the camera can see. */
	public getVisibleBounds(): WorldBounds {
		const corners = [
			this.screenToWorld(0, 0),
			this.screenToWorld(this.viewportWidth, 0),
			this.screenToWorld(0, this.viewportHeight),
			this.screenToWorld(this.viewportWidth, this.viewportHeight),
		];

		return {
			minX: Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x),
			minY: Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y),
			maxX: Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x),
			maxY: Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y),
		};
	}
}
