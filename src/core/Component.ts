import type { GameObject } from "./GameObject";
import type { Scene } from "./Scene";

/**
 * Base class for anything you attach to a GameObject. Subclass it and override
 * the hooks you need. The engine fills in `gameObject` and `scene` for you.
 */
export abstract class Component {
	// Set by GameObject.addComponent.
	public gameObject!: GameObject;
	public scene!: Scene;

	public isActive = false;
	private hasStarted = false;

	/** Runs once, the first time the component is enabled. Load assets and set up state here. */
	public start(): void {}

	/** Runs every frame while the object is active. */
	public update(_deltaTime: number): void {}

	/** Runs each time the host object is enabled, including when it comes back from the pool. */
	public onEnable(): void {}

	/** Runs each time the host object is disabled or returned to the pool. */
	public onDisable(): void {}

	/** Engine internal: makes sure `start()` runs once per allocation. */
	public __internal_start(): void {
		if (this.hasStarted) return;
		this.isActive = true;
		this.start();
		this.hasStarted = true;
	}
}
