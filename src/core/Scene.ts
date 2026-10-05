import type { GameObject } from "./GameObject";
import { InputManager } from "./inputs/InputManager";

export class Scene {
	public ctx!: CanvasRenderingContext2D;

	/** Keyboard state shared by all components. Attach it to a target to start listening. */
	public readonly input = new InputManager();

	// Object pooling
	private pools = new Map<string, GameObject[]>();
	private prefabs = new Map<string, () => GameObject>();
	private allObjects: GameObject[] = [];

	// Game loop
	private lastTime = 0;
	private isRunning = false;

	/** Tells the engine how to build a prefab when its pool is empty. */
	public registerPrefab(name: string, factory: () => GameObject): void {
		this.prefabs.set(name, factory);
		this.pools.set(name, []);
	}

	/** Creates or recycles a prefab instance at the given position. */
	public spawn(prefabName: string, x: number, y: number): GameObject {
		const pool = this.pools.get(prefabName);
		const factory = this.prefabs.get(prefabName);
		if (!pool || !factory) {
			throw new Error(`Prefab "${prefabName}" is not registered.`);
		}

		// Reuse a pooled instance when one is available.
		let obj = pool.find((candidate) => !candidate.isActive);

		if (!obj) {
			obj = factory();
			obj.scene = this;
			pool.push(obj);
			this.allObjects.push(obj);
		}

		obj.x = x;
		obj.y = y;
		obj.enable();

		return obj;
	}

	/** Starts the requestAnimationFrame loop. */
	public startLoop(): void {
		if (this.isRunning) return;
		this.isRunning = true;
		this.lastTime = performance.now();
		requestAnimationFrame((time) => this.tick(time));
	}

	public stopLoop(): void {
		this.isRunning = false;
	}

	private tick(currentTime: number): void {
		if (!this.isRunning) return;

		const deltaTime = (currentTime - this.lastTime) / 1000;
		this.lastTime = currentTime;

		this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

		for (let i = 0; i < this.allObjects.length; i++) {
			const object = this.allObjects[i];
			if (object.isActive) {
				object.update(deltaTime);
			}
		}

		// Clear per-frame input edges after every component has observed them.
		this.input.endFrame();

		this.drawDebugOverlay();
		requestAnimationFrame((time) => this.tick(time));
	}

	/** Temporary on-screen diagnostics, drawn on top of the frame. */
	private drawDebugOverlay(): void {
		this.ctx.fillStyle = "white";
		this.ctx.font = "20px monospace";
		this.ctx.fillText(
			`Loop Running! Objects: ${this.allObjects.length}`,
			30,
			50,
		);
		this.ctx.fillText(
			`Canvas Size: ${this.ctx.canvas.width}x${this.ctx.canvas.height}`,
			30,
			80,
		);
	}
}
