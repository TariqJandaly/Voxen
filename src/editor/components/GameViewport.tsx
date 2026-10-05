import { useEffect, useRef } from "react";
import { PlayerController } from "#/core/components/PlayerController";
import { SpriteRenderer } from "#/core/components/SpriteRenderer";
import { GameObject } from "#/core/GameObject";
import { Scene } from "#/core/Scene";

export function GameViewport() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const scene = new Scene();
		scene.ctx = ctx;
		scene.input.setBindings({
			left: ["ArrowLeft", "KeyA"],
			right: ["ArrowRight", "KeyD"],
			up: ["ArrowUp", "KeyW"],
			down: ["ArrowDown", "KeyS"],
		});

		const resizeCanvas = () => {
			const width = canvas.parentElement?.clientWidth ?? window.innerWidth;
			const height = canvas.parentElement?.clientHeight ?? window.innerHeight;
			const pixelRatio = window.devicePixelRatio || 1;
			canvas.width = width * pixelRatio;
			canvas.height = height * pixelRatio;
			ctx.scale(pixelRatio, pixelRatio);
		};

		window.addEventListener("resize", resizeCanvas);
		resizeCanvas();

		scene.registerPrefab("Player", () => {
			const obj = new GameObject("Player");

			const sprite = obj.addComponent(SpriteRenderer);
			sprite.imageUrl = "https://placehold.co/100x100/FF4500/FFF?text=Voxen";

			obj.addComponent(PlayerController);

			return obj;
		});

		scene.spawn("Player", 500, 300);
		scene.input.attach(canvas);
		canvas.focus();
		scene.startLoop();

		return () => {
			window.removeEventListener("resize", resizeCanvas);
			scene.input.detach();
			scene.stopLoop();
		};
	}, []);

	return (
		<div className="h-full w-full bg-[#1e1e1e]">
			<canvas
				ref={canvasRef}
				className="block h-full w-full outline-none"
				tabIndex={0}
				onPointerDown={() => canvasRef.current?.focus()}
			/>
		</div>
	);
}
