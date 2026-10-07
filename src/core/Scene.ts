import type { GameObject } from "./GameObject";
import { InputManager } from "./inputs/InputManager";
import type { Renderer } from "./rendering/Renderer";

/**
 * The container for a level. It owns the object list, the prefab pools, input,
 * and the requestAnimationFrame loop. Set `renderer` before starting the loop.
 */
export class Scene {
	public renderer!: Renderer;

	/** Shown as the scene label in the editor. */
	public name = "Main";

	/** The editor uses this to refresh its tree. Starts as a no-op. */
	public onHierarchyChanged: () => void = () => {};

	/** Keyboard state shared by every component. Attach it to start listening. */
	public readonly input = new InputManager();

	// Object pooling
	private pools = new Map<string, GameObject[]>();
	private prefabs = new Map<string, () => GameObject>();

	/**
	 * Every object the scene has created, including inactive pooled ones. This
	 * is what the editor reads for the hierarchy, so check `isActive` before
	 * using an entry.
	 */
	public allObjects: GameObject[] = [];

	// Game loop
	private lastTime = 0;
	private isRunning = false;
	private pendingResize: {
		width: number;
		height: number;
		pixelRatio: number;
	} | null = null;

	/** Registers a factory. `spawn` uses it when the pool for this name is empty. */
	public registerPrefab(name: string, factory: () => GameObject): void {
		this.prefabs.set(name, factory);
		this.pools.set(name, []);
	}

	/** Creates or recycles a prefab at a position, then enables it and its children. */
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
		}

		obj.transform.position.x = x;
		obj.transform.position.y = y;

		// A prefab may return a parent with children; bring the whole subtree in.
		this.registerSubtree(obj);
		this.enableSubtree(obj);

		this.onHierarchyChanged();
		return obj;
	}

	/** Adds an existing object (and its children) to the scene and turns it on. */
	public add(object: GameObject): void {
		object.scene = this;
		this.registerSubtree(object);
		this.enableSubtree(object);
		this.onHierarchyChanged();
	}

	/** Adds an object and its descendants to `allObjects`. */
	private registerSubtree(object: GameObject): void {
		if (!this.allObjects.includes(object)) this.allObjects.push(object);
		const children = object.getChildren();
		for (let i = 0; i < children.length; i++) {
			children[i].scene = this;
			this.registerSubtree(children[i]);
		}
	}

	/** Turns an object and its descendants on. */
	private enableSubtree(object: GameObject): void {
		object.enable();
		const children = object.getChildren();
		for (let i = 0; i < children.length; i++) this.enableSubtree(children[i]);
	}

	/**
	 * Detaches the object from its parent and turns it and its children off.
	 * The subtree stays intact, so a later `spawn` can reuse it from the pool.
	 */
	public destroy(obj: GameObject): void {
		obj.parent?.removeChild(obj);
		this.deactivateSubtree(obj);
		this.onHierarchyChanged();
	}

	private deactivateSubtree(object: GameObject): void {
		object.destroy();
		const children = object.getChildren();
		for (let i = 0; i < children.length; i++) {
			this.deactivateSubtree(children[i]);
		}
	}

	/** Removes every active object from the scene. */
	public clear(): void {
		const roots = this.allObjects.filter(
			(object) =>
				object.isActive && (!object.parent || !object.parent.isActive),
		);
		for (let i = 0; i < roots.length; i++) this.destroy(roots[i]);
	}

	/** Starts the requestAnimationFrame loop. Calling it twice does nothing. */
	public startLoop(): void {
		if (this.isRunning) return;
		this.isRunning = true;
		this.lastTime = performance.now();
		requestAnimationFrame((time) => this.tick(time));
	}

	public stopLoop(): void {
		this.isRunning = false;
	}

	/**
	 * Reports the canvas viewport in CSS pixels. While the loop is running the
	 * resize waits for the start of the next frame, so the buffer is never
	 * cleared after a frame has already been drawn (that shows up as a flash).
	 */
	public resize(width: number, height: number, pixelRatio: number): void {
		if (this.isRunning && this.renderer) {
			this.pendingResize = { width, height, pixelRatio };
			return;
		}
		this.applyResize(width, height, pixelRatio);
	}

	private applyResize(width: number, height: number, pixelRatio: number): void {
		if (!this.renderer) return;
		this.renderer.resize(width, height, pixelRatio);
	}

	private tick(currentTime: number): void {
		if (!this.isRunning) return;

		const pending = this.pendingResize;
		if (pending) {
			this.pendingResize = null;
			this.applyResize(pending.width, pending.height, pending.pixelRatio);
		}

		const deltaTime = (currentTime - this.lastTime) / 1000;
		this.lastTime = currentTime;

		this.renderer.clear();

		for (let i = 0; i < this.allObjects.length; i++) {
			const object = this.allObjects[i];
			if (object.isActive) {
				object.update(deltaTime);
			}
		}

		// Clear per-frame input edges after every component has read them.
		this.input.endFrame();

		this.drawDebugOverlay();
		requestAnimationFrame((time) => this.tick(time));
	}

	/** Temporary numbers on the canvas. Drawn last so objects cannot cover them. */
	private drawDebugOverlay(): void {
		this.renderer.setFillColor("white");
		this.renderer.setFont("20px monospace");
		this.renderer.drawText(
			`Loop Running! Objects: ${this.allObjects.length}`,
			30,
			50,
		);
		this.renderer.drawText(
			`Canvas Size: ${this.renderer.width}x${this.renderer.height}`,
			30,
			80,
		);
	}
}
