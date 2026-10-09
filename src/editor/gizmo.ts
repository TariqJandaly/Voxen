import type { GameObject } from "#/core/GameObject";
import { Vector2 } from "#/core/math/Vector2";
import type { Camera } from "#/core/objects/Camera";
import type { Renderer } from "#/core/rendering/Renderer";

/** Which transform tool is active. */
export type GizmoMode = "translate" | "rotate" | "scale";

/** Which part of the gizmo is being used. */
export type GizmoHandle = "x" | "y" | "ring";

// All sizes are in CSS pixels. Callers pass `uiScale` (internal pixels per CSS
// pixel) so the gizmo stays the same on-screen size at any zoom or window size.
const AXIS_LENGTH = 64;
const RING_RADIUS = 56;
const PICK_RADIUS = 9;
const HANDLE_SIZE = 9;

const AXIS_X_COLOR = "#e0533c";
const AXIS_Y_COLOR = "#5cbf5c";
const RING_COLOR = "#3f9adf";
const ACTIVE_COLOR = "#ffffff";

interface GizmoFrame {
	origin: Vector2;
	xAxis: Vector2;
	yAxis: Vector2;
}

function normalize(x: number, y: number): Vector2 {
	const length = Math.hypot(x, y) || 1;
	return new Vector2(x / length, y / length);
}

/** The gizmo origin and the world X/Y axes as screen-space unit directions. */
function gizmoFrame(camera: Camera, object: GameObject): GizmoFrame {
	const matrix = object.transform.getWorldMatrix();
	const origin = camera.worldToScreen(matrix[4], matrix[5]);
	const view = camera.getViewMatrix();
	return {
		origin,
		xAxis: normalize(view[0], view[1]),
		yAxis: normalize(view[2], view[3]),
	};
}

function axisEnd(origin: Vector2, axis: Vector2, length: number): Vector2 {
	return new Vector2(origin.x + axis.x * length, origin.y + axis.y * length);
}

function distanceToSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const lengthSq = dx * dx + dy * dy;
	if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
	let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The handle under a screen point, or null. */
export function pickGizmoHandle(
	camera: Camera,
	object: GameObject,
	mode: GizmoMode,
	screenX: number,
	screenY: number,
	uiScale: number,
): GizmoHandle | null {
	const { origin, xAxis, yAxis } = gizmoFrame(camera, object);
	const axis = AXIS_LENGTH * uiScale;
	const ring = RING_RADIUS * uiScale;
	const pick = PICK_RADIUS * uiScale;

	if (mode === "rotate") {
		const distance = Math.hypot(screenX - origin.x, screenY - origin.y);
		return Math.abs(distance - ring) <= pick ? "ring" : null;
	}

	const xEnd = axisEnd(origin, xAxis, axis);
	const yEnd = axisEnd(origin, yAxis, axis);

	if (mode === "scale") {
		if (Math.hypot(screenX - xEnd.x, screenY - xEnd.y) <= pick) return "x";
		if (Math.hypot(screenX - yEnd.x, screenY - yEnd.y) <= pick) return "y";
		return null;
	}

	const toX = distanceToSegment(
		screenX,
		screenY,
		origin.x,
		origin.y,
		xEnd.x,
		xEnd.y,
	);
	const toY = distanceToSegment(
		screenX,
		screenY,
		origin.x,
		origin.y,
		yEnd.x,
		yEnd.y,
	);
	if (toX <= pick && toX <= toY) return "x";
	if (toY <= pick) return "y";
	return null;
}

/** Draws the gizmo for the selected object. `active` lights up the used handle. */
export function drawGizmo(
	renderer: Renderer,
	camera: Camera,
	object: GameObject,
	mode: GizmoMode,
	active: GizmoHandle | null,
	uiScale: number,
): void {
	const { origin, xAxis, yAxis } = gizmoFrame(camera, object);
	const axis = AXIS_LENGTH * uiScale;
	const ring = RING_RADIUS * uiScale;
	const handle = HANDLE_SIZE * uiScale;
	renderer.setLineWidth(2 * uiScale);

	if (mode === "rotate") {
		renderer.setStrokeColor(active === "ring" ? ACTIVE_COLOR : RING_COLOR);
		renderer.drawCircle(origin.x, origin.y, ring);
		return;
	}

	const xEnd = axisEnd(origin, xAxis, axis);
	const yEnd = axisEnd(origin, yAxis, axis);
	renderer.setStrokeColor(active === "x" ? ACTIVE_COLOR : AXIS_X_COLOR);
	renderer.drawLine(origin.x, origin.y, xEnd.x, xEnd.y);
	renderer.setStrokeColor(active === "y" ? ACTIVE_COLOR : AXIS_Y_COLOR);
	renderer.drawLine(origin.x, origin.y, yEnd.x, yEnd.y);

	if (mode === "scale") {
		renderer.setStrokeColor(active === "x" ? ACTIVE_COLOR : AXIS_X_COLOR);
		renderer.strokeRect(
			xEnd.x - handle / 2,
			xEnd.y - handle / 2,
			handle,
			handle,
		);
		renderer.setStrokeColor(active === "y" ? ACTIVE_COLOR : AXIS_Y_COLOR);
		renderer.strokeRect(
			yEnd.x - handle / 2,
			yEnd.y - handle / 2,
			handle,
			handle,
		);
	}
}

/** State captured when a gizmo drag starts. */
export interface GizmoDrag {
	handle: GizmoHandle;
	startScreenX: number;
	startScreenY: number;
	startWorldX: number;
	startWorldY: number;
	positionX: number;
	positionY: number;
	rotation: number;
	scaleX: number;
	scaleY: number;
	startAngle: number;
}

export function beginGizmoDrag(
	camera: Camera,
	object: GameObject,
	handle: GizmoHandle,
	screenX: number,
	screenY: number,
): GizmoDrag {
	const { origin } = gizmoFrame(camera, object);
	const world = camera.screenToWorld(screenX, screenY);
	const transform = object.transform;
	return {
		handle,
		startScreenX: screenX,
		startScreenY: screenY,
		startWorldX: world.x,
		startWorldY: world.y,
		positionX: transform.position.x,
		positionY: transform.position.y,
		rotation: transform.rotation.z,
		scaleX: transform.scale.x,
		scaleY: transform.scale.y,
		startAngle: Math.atan2(screenY - origin.y, screenX - origin.x),
	};
}

function clampScale(value: number): number {
	const magnitude = Math.min(1000, Math.max(0.01, Math.abs(value)));
	return value < 0 ? -magnitude : magnitude;
}

/** Applies an in-progress drag to the object's transform. */
export function updateGizmoDrag(
	camera: Camera,
	object: GameObject,
	mode: GizmoMode,
	drag: GizmoDrag,
	screenX: number,
	screenY: number,
): void {
	const transform = object.transform;

	if (mode === "translate") {
		const world = camera.screenToWorld(screenX, screenY);
		if (drag.handle === "x") {
			transform.position.x = drag.positionX + (world.x - drag.startWorldX);
		} else if (drag.handle === "y") {
			transform.position.y = drag.positionY + (world.y - drag.startWorldY);
		}
		return;
	}

	// Scale and rotation pivot on the object's world origin, which does not move.
	const matrix = transform.getWorldMatrix();
	const origin = camera.worldToScreen(matrix[4], matrix[5]);

	if (mode === "rotate") {
		const angle = Math.atan2(screenY - origin.y, screenX - origin.x);
		transform.rotation.z = drag.rotation + (angle - drag.startAngle);
		return;
	}

	if (drag.handle === "x") {
		const startDistance = drag.startScreenX - origin.x;
		if (Math.abs(startDistance) > 1) {
			transform.scale.x = clampScale(
				drag.scaleX * ((screenX - origin.x) / startDistance),
			);
		}
	} else if (drag.handle === "y") {
		const startDistance = drag.startScreenY - origin.y;
		if (Math.abs(startDistance) > 1) {
			transform.scale.y = clampScale(
				drag.scaleY * ((screenY - origin.y) / startDistance),
			);
		}
	}
}
