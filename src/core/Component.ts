import type { GameObject } from "./GameObject";
import type { Scene } from "./Scene";

export abstract class Component {
	// Injected when the component is attached to a GameObject.
	public gameObject!: GameObject;
	public scene!: Scene;

	public isActive = false;
	private hasStarted = false;

	/** Called once, the first time the component is enabled. */
	public start(): void {}

	/** Called every frame while the GameObject is active. */
	public update(_deltaTime: number): void {}

	/** Called when the host object is enabled or pulled from the pool. */
	public onEnable(): void {}

	/** Called when the host object is disabled or returned to the pool. */
	public onDisable(): void {}

	/** Runs start() exactly once per allocation. */
	public __internal_start(): void {
		if (this.hasStarted) return;
		this.isActive = true;
		this.start();
		this.hasStarted = true;
	}
}
