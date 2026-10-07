import type { Component } from "./Component";
import { Transform } from "./components/Transform";
import { IDENTITY_MATRIX, invertMatrix, multiplyMatrix } from "./math/Matrix2D";
import type { Scene } from "./Scene";

/**
 * An entity in the scene. Every object owns a `Transform` (position, rotation,
 * scale) and a list of components, and it can sit under a parent with children
 * of its own. The transform is relative to the parent, so moving a parent moves
 * the whole branch.
 */
export class GameObject {
	public id: string =
		typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).substring(2, 11);

	public name: string;

	/** Position, rotation, and scale. Created with the object and never removed. */
	public readonly transform: Transform;

	// Hierarchy
	public parent: GameObject | null = null;
	private children: GameObject[] = [];

	// Pooling state
	public isActive = false;

	private _scene!: Scene;
	private components: Component[] = [];

	constructor(name = "GameObject") {
		this.name = name;
		this.transform = new Transform();
		this.transform.gameObject = this;
	}

	public get scene(): Scene {
		return this._scene;
	}

	/** Pointing the object at a scene also passes the scene down to its transform and components. */
	public set scene(value: Scene) {
		this._scene = value;
		this.transform.scene = value;
		for (let i = 0; i < this.components.length; i++) {
			this.components[i].scene = value;
		}
	}

	/** Creates a component, attaches it, and hands it back. Starts immediately if the object is running. */
	public addComponent<T extends Component>(ComponentClass: new () => T): T {
		const component = new ComponentClass();
		component.gameObject = this;
		component.scene = this._scene;
		this.components.push(component);

		// A component added to an already-active object must start right away.
		if (this.isActive) {
			component.__internal_start();
			component.onEnable();
		}

		return component;
	}

	/** Returns the first component of the given type, or null. */
	public getComponent<T extends Component>(
		ComponentClass: new () => T,
	): T | null {
		const component = this.components.find(
			(candidate): candidate is T => candidate instanceof ComponentClass,
		);
		return component ?? null;
	}

	/** The components on this object, in the order they were added. Live array; treat it as read-only. */
	public getComponents(): readonly Component[] {
		return this.components;
	}

	/** Detaches a component and disables it. */
	public removeComponent(component: Component): void {
		const index = this.components.indexOf(component);
		if (index === -1) return;
		if (component.isActive) component.onDisable();
		this.components.splice(index, 1);
	}

	/** The child objects, in the order they were added. Live array; treat it as read-only. */
	public getChildren(): readonly GameObject[] {
		return this.children;
	}

	/** Whether this object is `object` itself or one of its ancestors. */
	public isAncestorOf(object: GameObject): boolean {
		let current: GameObject | null = object;
		while (current) {
			if (current === this) return true;
			current = current.parent;
		}
		return false;
	}

	/**
	 * Moves this object under a new parent, or to the root when `parent` is null.
	 * By default it keeps its place on screen by recomputing the local transform.
	 * Parenting under your own descendant is ignored, since it would make a cycle.
	 */
	public setParent(parent: GameObject | null, keepWorld = true): void {
		if (parent === this.parent) return;
		if (parent && this.isAncestorOf(parent)) return;

		const world = keepWorld ? this.transform.getWorldMatrix() : null;

		this.parent?.removeChild(this);
		this.parent = parent;
		parent?.children.push(this);

		if (!world) return;

		const parentWorld = parent
			? parent.transform.getWorldMatrix()
			: IDENTITY_MATRIX;
		const inverse = invertMatrix(parentWorld);
		if (inverse) this.transform.setFromMatrix(multiplyMatrix(inverse, world));
	}

	/** Detaches a child and clears its parent link. */
	public removeChild(child: GameObject): void {
		const index = this.children.indexOf(child);
		if (index === -1) return;
		this.children.splice(index, 1);
		if (child.parent === this) child.parent = null;
	}

	/** Engine internal: runs `update` on every active component. */
	public update(deltaTime: number): void {
		if (!this.isActive) return;
		for (let i = 0; i < this.components.length; i++) {
			const component = this.components[i];
			if (!component.isActive) continue;
			component.update(deltaTime);
		}
	}

	/** Engine internal: turns the object on. Components start once, then `onEnable` fires on every reuse. */
	public enable(): void {
		if (this.isActive) return;
		this.isActive = true;
		for (let i = 0; i < this.components.length; i++) {
			this.components[i].__internal_start();
			this.components[i].onEnable();
		}
	}

	/** Engine internal: turns the object off so the pool can hand it out again. */
	public destroy(): void {
		if (!this.isActive) return;
		this.isActive = false;
		for (let i = 0; i < this.components.length; i++) {
			this.components[i].onDisable();
		}
	}
}
