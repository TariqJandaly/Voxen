import type { Component } from "./Component";
import type { Scene } from "./Scene";

export class GameObject {
	public id: string =
		typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).substring(2, 11);

	public name: string;

	// Transform
	public x = 0;
	public y = 0;
	public rotation = 0;
	public scaleX = 1;
	public scaleY = 1;

	// Pooling state
	public isActive = false;

	private _scene!: Scene;
	private components: Component[] = [];

	constructor(name = "GameObject") {
		this.name = name;
	}

	public get scene(): Scene {
		return this._scene;
	}

	/** Assigning the scene wires the reference into every attached component. */
	public set scene(value: Scene) {
		this._scene = value;
		for (let i = 0; i < this.components.length; i++) {
			this.components[i].scene = value;
		}
	}

	/** Adds a component and wires up its references. */
	public addComponent<T extends Component>(ComponentClass: new () => T): T {
		const component = new ComponentClass();
		component.gameObject = this;
		component.scene = this._scene;
		this.components.push(component);

		// A component added to an already-active object must start immediately.
		if (this.isActive) {
			component.__internal_start();
			component.onEnable();
		}

		return component;
	}

	/** Fetches a component by its class type. */
	public getComponent<T extends Component>(
		ComponentClass: new () => T,
	): T | null {
		const component = this.components.find(
			(candidate): candidate is T => candidate instanceof ComponentClass,
		);
		return component ?? null;
	}

	/** Engine internal: ticks all attached components. */
	public update(deltaTime: number): void {
		if (!this.isActive) return;
		for (let i = 0; i < this.components.length; i++) {
			const component = this.components[i];
			if (!component.isActive) continue;
			component.update(deltaTime);
		}
	}

	/** Called by Scene when the object is spawned or recycled. */
	public enable(): void {
		if (this.isActive) return;
		this.isActive = true;
		for (let i = 0; i < this.components.length; i++) {
			this.components[i].__internal_start();
			this.components[i].onEnable();
		}
	}

	/** Deactivates the object so it can be reused from the pool. */
	public destroy(): void {
		if (!this.isActive) return;
		this.isActive = false;
		for (let i = 0; i < this.components.length; i++) {
			this.components[i].onDisable();
		}
	}
}
