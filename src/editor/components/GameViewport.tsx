import { useEffect, useRef } from "react";
import type { GameObject } from "#/core/GameObject";
import { Camera } from "#/core/objects/Camera";
import { CanvasRenderer } from "#/core/rendering/CanvasRenderer";
import { useEditor } from "../context/EditorContext";
import {
	beginGizmoDrag,
	type GizmoDrag,
	type GizmoHandle,
	type GizmoMode,
	pickGizmoHandle,
	updateGizmoDrag,
} from "../gizmo";
import {
	drawSceneBackground,
	drawSceneOverlay,
	pickObject,
} from "../sceneView";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
// A left-press that moves more than this many CSS pixels is a drag, not a click.
const CLICK_SLOP = 4;

// The game renders at a fixed 16:9 resolution; the canvas is scaled to fit the
// dock, so the camera always sees the same world area no matter the window size.
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT;

/**
 * Hooks the canvas up to the editor's shared scene. In edit mode the scene view
 * draws through its own camera: middle-drag pans, the wheel zooms, a left click
 * picks an object, and dragging a gizmo handle moves, rotates, or scales it. In
 * play mode it becomes the game view and input drives gameplay.
 */
export function GameViewport() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cameraRef = useRef<Camera | null>(null);
	const selectedRef = useRef<GameObject | null>(null);
	const gizmoModeRef = useRef<GizmoMode>("translate");
	const activeHandleRef = useRef<GizmoHandle | null>(null);
	// Internal pixels per CSS pixel, so screen-space overlays stay constant on screen.
	const uiScaleRef = useRef(1);
	const {
		scene,
		selectedObject,
		setSelectedObject,
		gizmoMode,
		setGizmoMode,
		commit,
	} = useEditor();

	// The render hook reads these refs, so selecting an object or changing tools
	// does not tear the viewport down and rebuild the loop.
	useEffect(() => {
		selectedRef.current = selectedObject;
	}, [selectedObject]);
	useEffect(() => {
		gizmoModeRef.current = gizmoMode;
	}, [gizmoMode]);

	// Renderer, scene-view camera, overlay hooks, and the loop.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const camera = cameraRef.current ?? new Camera("Scene View");
		cameraRef.current = camera;
		scene.viewCamera = camera;
		scene.renderer = new CanvasRenderer(ctx);
		scene.onDrawEditorBackground = (renderer, activeCamera) =>
			drawSceneBackground(renderer, activeCamera, uiScaleRef.current);
		scene.onDrawEditorOverlay = (renderer, activeCamera) =>
			drawSceneOverlay(
				renderer,
				activeCamera,
				scene,
				selectedRef.current,
				gizmoModeRef.current,
				activeHandleRef.current,
				uiScaleRef.current,
			);
		scene.input.setBindings({
			left: ["ArrowLeft", "KeyA"],
			right: ["ArrowRight", "KeyD"],
			up: ["ArrowUp", "KeyW"],
			down: ["ArrowDown", "KeyS"],
		});

		const reportSize = () => {
			const parent = canvas.parentElement;
			const availableWidth = parent?.clientWidth ?? window.innerWidth;
			const availableHeight = parent?.clientHeight ?? window.innerHeight;

			// Fit the largest 16:9 rectangle inside the dock area.
			let width = availableWidth;
			let height = availableWidth / ASPECT_RATIO;
			if (height > availableHeight) {
				height = availableHeight;
				width = availableHeight * ASPECT_RATIO;
			}
			width = Math.max(1, Math.round(width));
			height = Math.max(1, Math.round(height));

			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			uiScaleRef.current = GAME_WIDTH / width;
			// Fixed internal resolution; the CSS size above scales it to fit.
			scene.resize(GAME_WIDTH, GAME_HEIGHT, 1);
		};

		window.addEventListener("resize", reportSize);

		// The window does not resize when a dock splitter moves, so watch the
		// canvas container directly and report its size to the scene.
		const resizeObserver = new ResizeObserver(reportSize);
		if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

		reportSize();

		scene.input.attach(canvas);
		canvas.focus();
		scene.startLoop();

		return () => {
			window.removeEventListener("resize", reportSize);
			resizeObserver.disconnect();
			scene.onDrawEditorBackground = null;
			scene.onDrawEditorOverlay = null;
			if (scene.viewCamera === camera) scene.viewCamera = null;
			scene.input.detach();
			scene.stopLoop();
		};
	}, [scene]);

	// Mouse interaction: pan, zoom, pick, and gizmo drag. Edit mode only.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const cameraAt = () => cameraRef.current;
		// Convert a pointer position from CSS pixels to internal pixels.
		const toInternal = (event: PointerEvent | WheelEvent) => {
			const rect = canvas.getBoundingClientRect();
			return {
				x: (event.clientX - rect.left) * (GAME_WIDTH / rect.width),
				y: (event.clientY - rect.top) * (GAME_HEIGHT / rect.height),
			};
		};

		let panning = false;
		let panStartX = 0;
		let panStartY = 0;
		let panCameraX = 0;
		let panCameraY = 0;
		let pressed = false;
		let pressX = 0;
		let pressY = 0;
		let moved = false;
		let drag: GizmoDrag | null = null;
		let dragObject: GameObject | null = null;
		let dragMoved = false;

		const onPointerDown = (event: PointerEvent) => {
			if (scene.mode !== "edit") return;
			const camera = cameraAt();
			if (!camera) return;

			if (event.button === 1) {
				event.preventDefault();
				panning = true;
				panStartX = event.clientX;
				panStartY = event.clientY;
				panCameraX = camera.transform.position.x;
				panCameraY = camera.transform.position.y;
				canvas.setPointerCapture(event.pointerId);
				return;
			}
			if (event.button !== 0) return;

			const selected = selectedRef.current;
			if (selected) {
				const point = toInternal(event);
				const handle = pickGizmoHandle(
					camera,
					selected,
					gizmoModeRef.current,
					point.x,
					point.y,
					uiScaleRef.current,
				);
				if (handle) {
					drag = beginGizmoDrag(camera, selected, handle, point.x, point.y);
					dragObject = selected;
					dragMoved = false;
					activeHandleRef.current = handle;
					canvas.setPointerCapture(event.pointerId);
					return;
				}
			}

			pressed = true;
			moved = false;
			pressX = event.clientX;
			pressY = event.clientY;
		};

		const onPointerMove = (event: PointerEvent) => {
			const camera = cameraAt();
			if (!camera) return;

			if (drag && dragObject) {
				const point = toInternal(event);
				dragMoved = true;
				updateGizmoDrag(
					camera,
					dragObject,
					gizmoModeRef.current,
					drag,
					point.x,
					point.y,
				);
				return;
			}

			if (panning) {
				const rect = canvas.getBoundingClientRect();
				camera.transform.position.x =
					panCameraX -
					((event.clientX - panStartX) * (GAME_WIDTH / rect.width)) /
						camera.zoom;
				camera.transform.position.y =
					panCameraY -
					((event.clientY - panStartY) * (GAME_HEIGHT / rect.height)) /
						camera.zoom;
			} else if (pressed) {
				if (
					Math.hypot(event.clientX - pressX, event.clientY - pressY) >
					CLICK_SLOP
				) {
					moved = true;
				}
			}
		};

		const onPointerUp = (event: PointerEvent) => {
			if (drag && event.button === 0) {
				const movedObject = dragMoved ? dragObject : null;
				const mode = gizmoModeRef.current;
				drag = null;
				dragObject = null;
				dragMoved = false;
				activeHandleRef.current = null;
				if (canvas.hasPointerCapture(event.pointerId)) {
					canvas.releasePointerCapture(event.pointerId);
				}
				if (movedObject) {
					const verb =
						mode === "translate"
							? "Move"
							: mode === "rotate"
								? "Rotate"
								: "Scale";
					const kind = mode === "translate" ? "move" : mode;
					commit(`${verb} ${movedObject.name}`, kind);
				}
				return;
			}
			if (panning && event.button === 1) {
				panning = false;
				if (canvas.hasPointerCapture(event.pointerId)) {
					canvas.releasePointerCapture(event.pointerId);
				}
			}
			if (pressed && event.button === 0) {
				pressed = false;
				if (moved) return;
				const camera = cameraAt();
				if (!camera) return;
				const point = toInternal(event);
				const world = camera.screenToWorld(point.x, point.y);
				setSelectedObject(pickObject(scene, world.x, world.y, camera));
			}
		};

		const onWheel = (event: WheelEvent) => {
			if (scene.mode !== "edit") return;
			const camera = cameraAt();
			if (!camera) return;

			event.preventDefault();
			const point = toInternal(event);
			const before = camera.screenToWorld(point.x, point.y);

			const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
			camera.zoom = Math.min(
				MAX_ZOOM,
				Math.max(MIN_ZOOM, camera.zoom * factor),
			);

			// Keep the world point under the cursor pinned while zooming.
			const after = camera.screenToWorld(point.x, point.y);
			camera.transform.position.x += before.x - after.x;
			camera.transform.position.y += before.y - after.y;
		};

		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("pointermove", onPointerMove);
		canvas.addEventListener("pointerup", onPointerUp);
		canvas.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerup", onPointerUp);
			canvas.removeEventListener("wheel", onWheel);
		};
	}, [scene, setSelectedObject, commit]);

	// W/E/R switch the active gizmo tool.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			const key = event.key.toLowerCase();
			if (key === "w") setGizmoMode("translate");
			else if (key === "e") setGizmoMode("rotate");
			else if (key === "r") setGizmoMode("scale");
			else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [setGizmoMode]);

	return (
		<div className="flex h-full w-full items-center justify-center overflow-hidden bg-black">
			<canvas
				ref={canvasRef}
				className="block outline-none"
				tabIndex={0}
				onPointerDown={() => canvasRef.current?.focus()}
				onContextMenu={(event) => event.preventDefault()}
			/>
		</div>
	);
}
