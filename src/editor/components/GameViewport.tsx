import { useEffect, useRef } from "react";
import { DataTypes } from "#/core/components/DataTypes";
import { PlayerController } from "#/core/components/PlayerController";
import { SpriteRenderer } from "#/core/components/SpriteRenderer";
import { GameObject } from "#/core/GameObject";
import { useEditor } from "../context/EditorContext";

/**
 * Hooks the canvas up to the editor's shared scene: gives it the 2D context,
 * seeds the sample player once, then starts the loop. Keyboard and pointer
 * listeners sit on the canvas, so typing in a panel never drives the game.
 */
export function GameViewport() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const initializedRef = useRef(false);
	const { scene } = useEditor();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		scene.ctx = ctx;
		scene.input.setBindings({
			left: ["ArrowLeft", "KeyA"],
			right: ["ArrowRight", "KeyD"],
			up: ["ArrowUp", "KeyW"],
			down: ["ArrowDown", "KeyS"],
		});

		const reportSize = () => {
			const parent = canvas.parentElement;
			const width = parent?.clientWidth ?? window.innerWidth;
			const height = parent?.clientHeight ?? window.innerHeight;
			scene.resize(width, height, window.devicePixelRatio || 1);
		};

		window.addEventListener("resize", reportSize);

		// The window does not resize when a dock splitter moves, so watch the
		// canvas container directly and report its size to the scene.
		const resizeObserver = new ResizeObserver(reportSize);
		if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

		reportSize();

		// Register the prefab and seed the scene only once per scene instance.
		if (!initializedRef.current) {
			initializedRef.current = true;
			scene.registerPrefab("Player", () => {
				// The parent holds the controls; the sprite is its child.
				const player = new GameObject("Player");
				player.addComponent(PlayerController);
				// Exercises every inspector field type on the controls object.
				player.addComponent(DataTypes);

				const sprite = new GameObject("Sprite");
				const renderer = sprite.addComponent(SpriteRenderer);
				renderer.imageUrl =
					"https://placehold.co/100x100/FF4500/FFF?text=Voxen";
				sprite.setParent(player, false);

				return player;
			});

			scene.spawn("Player", 500, 300);
		}

		scene.input.attach(canvas);
		canvas.focus();
		scene.startLoop();

		return () => {
			window.removeEventListener("resize", reportSize);
			resizeObserver.disconnect();
			scene.input.detach();
			scene.stopLoop();
		};
	}, [scene]);

	return (
		<div className="h-full w-full bg-canvas">
			<canvas
				ref={canvasRef}
				className="block h-full w-full outline-none"
				tabIndex={0}
				onPointerDown={() => canvasRef.current?.focus()}
			/>
		</div>
	);
}
