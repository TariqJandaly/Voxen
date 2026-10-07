import type { GameObject } from "./GameObject";
import { InputManager } from "./inputs/InputManager";
import { Camera } from "./objects/Camera";
import type { Renderer } from "./rendering/Renderer";

/**
 * The container for a level. It owns the object list, the prefab pools, input,
 * and the requestAnimationFrame loop. Set `renderer` before starting the loop.
 */
export class Scene {
	public renderer!: Renderer;

	/** Canvas size in CSS pixels, kept in sync with the renderer. */
	public viewportWidth = 0;
	public viewportHeight = 0;

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
		this.attach(object);
		this.enableSubtree(object);
	}

	/**
	 * Adds an object and its children to the scene without enabling them. Used
	 * when loading a scene, where each object's saved state is restored after.
	 */
	public attach(object: GameObject): void {
		object.scene = this;
		this.registerSubtree(object);
		this.onHierarchyChanged();
	}

	/** Adds an object and its descendants to `allObjects`. */
	private registerSubtree(object: GameObject): void {
		if (!this.allObjects.includes(object)) this.allObjects.push(object);
		if (object instanceof Camera) {
			object.setViewport(this.viewportWidth, this.viewportHeight);
		}
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

	/**
	 * Takes the object and its children out of the scene for good. Unlike
	 * `destroy`, nothing is kept for pooling, so it disappears from the editor.
	 */
	public remove(object: GameObject): void {
		object.parent?.removeChild(object);
		this.unregisterSubtree(object);
		this.onHierarchyChanged();
	}

	private unregisterSubtree(object: GameObject): void {
		this.allObjects = this.allObjects.filter(
			(candidate) => candidate !== object,
		);
		const children = object.getChildren();
		for (let i = 0; i < children.length; i++) {
			this.unregisterSubtree(children[i]);
		}
	}

	/** Removes every object from the scene. */
	public clear(): void {
		const roots = this.allObjects.filter((object) => !object.parent);
		for (let i = 0; i < roots.length; i++) this.remove(roots[i]);
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
		this.viewportWidth = width;
		this.viewportHeight = height;
		this.updateCameraViewports();
		if (this.isRunning && this.renderer) {
			this.pendingResize = { width, height, pixelRatio };
			return;
		}
		this.applyResize(width, height, pixelRatio);
	}

	private updateCameraViewports(): void {
		for (let i = 0; i < this.allObjects.length; i++) {
			const object = this.allObjects[i];
			if (object instanceof Camera) {
				object.setViewport(this.viewportWidth, this.viewportHeight);
			}
		}
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
			if (object.isActiveInHierarchy()) {
				object.update(deltaTime);
			}
		}

		// Clear per-frame input edges after every component has read them.
		this.input.endFrame();

		this.renderFrame();
		this.drawDebugOverlay();
		requestAnimationFrame((time) => this.tick(time));
	}

	/** The camera the scene renders through, or null when there is none. */
	public getActiveCamera(): Camera | null {
		for (let i = 0; i < this.allObjects.length; i++) {
			const object = this.allObjects[i];
			if (object instanceof Camera && object.isActiveInHierarchy()) {
				return object;
			}
		}
		return null;
	}

	/** Draws every visible object through the active camera. */
	private renderFrame(): void {
		const camera = this.getActiveCamera();
		if (!camera) {
			this.renderNoCamera();
			return;
		}

		this.renderer.save();
		this.renderer.applyTransform(camera.getViewMatrix());
		for (let i = 0; i < this.allObjects.length; i++) {
			const object = this.allObjects[i];
			if (object.isActiveInHierarchy() && object.isVisibleInHierarchy()) {
				object.render(this.renderer);
			}
		}
		this.renderer.restore();
	}

	/** Black screen with a hint, shown when the scene has no active camera. */
	private renderNoCamera(): void {
		this.renderer.setFillColor("#000000");
		this.renderer.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
		this.renderer.setFillColor("#ffffff");
		this.renderer.setFont("16px monospace");
		const text = "No camera active";
		const textWidth = this.renderer.measureText(text);
		this.renderer.drawText(
			text,
			(this.viewportWidth - textWidth) / 2,
			this.viewportHeight / 2,
		);
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
