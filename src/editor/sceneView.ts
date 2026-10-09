import type { GameObject } from "#/core/GameObject";
import type { WorldBounds } from "#/core/math/WorldBounds";
import { Camera } from "#/core/objects/Camera";
import type { Renderer } from "#/core/rendering/Renderer";
import type { Scene } from "#/core/Scene";
import { drawGizmo, type GizmoHandle, type GizmoMode } from "./gizmo";

/**
 * The editor's scene view: hit-testing for selection, and the world-space grid
 * plus the screen-space overlay (camera icons, selection, gizmo) drawn through
 * the scene-view camera. Kept out of the core so the engine stays editor-agnostic.
 */

/** The smallest world box for an empty object, so it can still be clicked (screen-constant). */
const EMPTY_HANDLE_RADIUS = 6;
/** The camera icon size in screen pixels, also used for hit-testing a camera. */
const CAMERA_ICON_WIDTH = 24;
const CAMERA_ICON_HEIGHT = 16;

/** The union of every component's world bounds, or a small handle for an empty object. */
export function getObjectWorldBounds(
	object: GameObject,
	camera: Camera,
): WorldBounds {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let found = false;

	const include = (bounds: WorldBounds) => {
		found = true;
		if (bounds.minX < minX) minX = bounds.minX;
		if (bounds.minY < minY) minY = bounds.minY;
		if (bounds.maxX > maxX) maxX = bounds.maxX;
		if (bounds.maxY > maxY) maxY = bounds.maxY;
	};

	for (const component of object.getComponents()) {
		const bounds = component.getWorldBounds();
		if (bounds) include(bounds);
	}

	// A camera draws an icon, so give it a matching box to click.
	if (object instanceof Camera) {
		const radiusX = CAMERA_ICON_WIDTH / 2 / camera.zoom;
		const radiusY = CAMERA_ICON_HEIGHT / 2 / camera.zoom;
		include({
			minX: matrixX(object) - radiusX,
			minY: matrixY(object) - radiusY,
			maxX: matrixX(object) + radiusX,
			maxY: matrixY(object) + radiusY,
		});
	}

	if (found) return { minX, minY, maxX, maxY };

	const radius = EMPTY_HANDLE_RADIUS / Math.max(camera.zoom, Number.EPSILON);
	return {
		minX: matrixX(object) - radius,
		minY: matrixY(object) - radius,
		maxX: matrixX(object) + radius,
		maxY: matrixY(object) + radius,
	};
}

function matrixX(object: GameObject): number {
	return object.transform.getWorldMatrix()[4];
}

function matrixY(object: GameObject): number {
	return object.transform.getWorldMatrix()[5];
}

/** The topmost visible object whose bounds contain the world point, or null. */
export function pickObject(
	scene: Scene,
	worldX: number,
	worldY: number,
	camera: Camera,
): GameObject | null {
	// Later objects draw on top, so search from the end of the draw order.
	for (let i = scene.allObjects.length - 1; i >= 0; i--) {
		const object = scene.allObjects[i];
		if (!object.isActiveInHierarchy() || !object.isVisibleInHierarchy()) {
			continue;
		}
		const bounds = getObjectWorldBounds(object, camera);
		if (
			worldX >= bounds.minX &&
			worldX <= bounds.maxX &&
			worldY >= bounds.minY &&
			worldY <= bounds.maxY
		) {
			return object;
		}
	}
	return null;
}

/** The scene-view background, so the 16:9 game area reads differently from the black overflow. */
const SCENE_BACKGROUND = "#1e1e22";

/** Fills the visible area with the scene-view background, then draws the grid. */
export function drawSceneBackground(
	renderer: Renderer,
	camera: Camera,
	uiScale: number,
): void {
	const bounds = camera.getVisibleBounds();
	renderer.setFillColor(SCENE_BACKGROUND);
	renderer.fillRect(
		bounds.minX,
		bounds.minY,
		bounds.maxX - bounds.minX,
		bounds.maxY - bounds.minY,
	);
	drawSceneGrid(renderer, camera, uiScale);
}

/** Draws a world-space grid that keeps a roughly constant spacing on screen. */
function drawSceneGrid(
	renderer: Renderer,
	camera: Camera,
	uiScale: number,
): void {
	const zoom = Math.max(camera.zoom, Number.EPSILON);
	// Thresholds are in CSS pixels; uiScale turns them into internal pixels.
	const minSpacing = 24 * uiScale;
	const maxSpacing = 96 * uiScale;
	let step = 50;
	while (step * zoom < minSpacing) step *= 2;
	while (step * zoom > maxSpacing) step /= 2;

	const bounds = camera.getVisibleBounds();
	const lineWidth = uiScale / zoom;

	renderer.setLineWidth(lineWidth);
	renderer.setStrokeColor("rgba(255, 255, 255, 0.06)");

	const startX = Math.floor(bounds.minX / step) * step;
	for (let x = startX; x <= bounds.maxX; x += step) {
		renderer.drawLine(x, bounds.minY, x, bounds.maxY);
	}
	const startY = Math.floor(bounds.minY / step) * step;
	for (let y = startY; y <= bounds.maxY; y += step) {
		renderer.drawLine(bounds.minX, y, bounds.maxX, y);
	}

	// Axes stand out a little more than the grid lines.
	renderer.setStrokeColor("rgba(255, 255, 255, 0.2)");
	renderer.setLineWidth(lineWidth * 1.5);
	renderer.drawLine(0, bounds.minY, 0, bounds.maxY);
	renderer.drawLine(bounds.minX, 0, bounds.maxX, 0);
}

/** Draws the camera icons, the selection box, and the gizmo, all in screen space. */
export function drawSceneOverlay(
	renderer: Renderer,
	camera: Camera,
	scene: Scene,
	selected: GameObject | null,
	gizmoMode: GizmoMode,
	activeHandle: GizmoHandle | null,
	uiScale: number,
): void {
	for (const object of scene.allObjects) {
		if (!(object instanceof Camera)) continue;
		if (!object.isActiveInHierarchy() || !object.isVisibleInHierarchy()) {
			continue;
		}
		const highlighted = object === selected;
		drawCameraView(renderer, camera, object, highlighted, uiScale);
		const matrix = object.transform.getWorldMatrix();
		const point = camera.worldToScreen(matrix[4], matrix[5]);
		drawCameraIcon(renderer, point.x, point.y, highlighted, uiScale);
	}

	if (!selected) return;

	drawSelection(renderer, camera, selected, uiScale);
	drawGizmo(renderer, camera, selected, gizmoMode, activeHandle, uiScale);
}

/** Outlines the world rectangle a camera sees, projected into the scene view. */
function drawCameraView(
	renderer: Renderer,
	sceneCamera: Camera,
	gameCamera: Camera,
	highlighted: boolean,
	uiScale: number,
): void {
	if (gameCamera.viewportWidth <= 0 || gameCamera.viewportHeight <= 0) return;

	const width = gameCamera.viewportWidth;
	const height = gameCamera.viewportHeight;
	const corners = [
		gameCamera.screenToWorld(0, 0),
		gameCamera.screenToWorld(width, 0),
		gameCamera.screenToWorld(width, height),
		gameCamera.screenToWorld(0, height),
	];

	renderer.setStrokeColor(highlighted ? "#7ec8ff" : "#5f86ab");
	renderer.setLineWidth(1.5 * uiScale);
	for (let i = 0; i < corners.length; i++) {
		const from = sceneCamera.worldToScreen(corners[i].x, corners[i].y);
		const next = corners[(i + 1) % corners.length];
		const to = sceneCamera.worldToScreen(next.x, next.y);
		renderer.drawLine(from.x, from.y, to.x, to.y);
	}
}

function drawSelection(
	renderer: Renderer,
	camera: Camera,
	object: GameObject,
	uiScale: number,
): void {
	const bounds = getObjectWorldBounds(object, camera);
	const min = camera.worldToScreen(bounds.minX, bounds.minY);
	const max = camera.worldToScreen(bounds.maxX, bounds.maxY);
	renderer.setStrokeColor("#007fd4");
	renderer.setLineWidth(1.5 * uiScale);
	renderer.strokeRect(
		Math.min(min.x, max.x),
		Math.min(min.y, max.y),
		Math.abs(max.x - min.x),
		Math.abs(max.y - min.y),
	);
}

function drawCameraIcon(
	renderer: Renderer,
	x: number,
	y: number,
	highlighted: boolean,
	uiScale: number,
): void {
	const width = CAMERA_ICON_WIDTH * uiScale;
	const height = CAMERA_ICON_HEIGHT * uiScale;
	const lens = 7 * uiScale;
	renderer.setLineWidth(1.5 * uiScale);
	renderer.setStrokeColor(highlighted ? "#007fd4" : "#c8ccd0");
	const left = x - width / 2;
	const top = y - height / 2;
	renderer.strokeRect(left, top, width, height);

	// A lens on the left, so the icon reads as a camera.
	renderer.drawLine(left, top, left - lens, top - lens);
	renderer.drawLine(left, top + height, left - lens, top + height + lens);
	renderer.drawLine(left - lens, top - lens, left - lens, top + height + lens);
}
