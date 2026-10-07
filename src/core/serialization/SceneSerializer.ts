import type { Component } from "../Component";
import { GameObject } from "../GameObject";
import type { Scene } from "../Scene";
import { cloneFieldValue, componentFieldNames, isRecord } from "./fields";

export interface SerializedComponent {
	type: string;
	data: Record<string, unknown>;
}

export interface SerializedObject {
	name: string;
	x: number;
	y: number;
	rotation: number;
	scaleX: number;
	scaleY: number;
	components: SerializedComponent[];
	children: SerializedObject[];
}

export interface SerializedScene {
	version: 1;
	name: string;
	objects: SerializedObject[];
}

/** Component classes keyed by `constructor.name`, used to rebuild a scene. */
export type ComponentTypes = Record<string, new () => Component>;

/** Snapshots a scene: the object tree with transforms and component fields. */
export function serializeScene(scene: Scene): SerializedScene {
	// Roots are active objects whose parent is missing or inactive.
	const roots = scene.allObjects.filter(
		(object) => object.isActive && (!object.parent || !object.parent.isActive),
	);

	return { version: 1, name: scene.name, objects: roots.map(serializeObject) };
}

function serializeObject(object: GameObject): SerializedObject {
	return {
		name: object.name,
		x: object.x,
		y: object.y,
		rotation: object.rotation,
		scaleX: object.scaleX,
		scaleY: object.scaleY,
		components: object.getComponents().map(serializeComponent),
		children: object
			.getChildren()
			.filter((child) => child.isActive)
			.map(serializeObject),
	};
}

function serializeComponent(component: Component): SerializedComponent {
	const target = component as unknown as Record<string, unknown>;
	const data: Record<string, unknown> = {};

	for (const name of componentFieldNames(component)) {
		const value = target[name];
		if (value === null || value === undefined) continue;
		if (typeof value === "function") continue;
		data[name] = cloneFieldValue(value);
	}

	return { type: component.constructor.name, data };
}

/** Rebuilds the objects from a snapshot, replacing whatever is in the scene. */
export function deserializeScene(
	scene: Scene,
	data: SerializedScene,
	types: ComponentTypes,
): void {
	// Replace, do not append. Loading twice must not double the objects.
	scene.clear();
	scene.name = data.name || scene.name;

	for (const serialized of data.objects) {
		scene.add(createObject(serialized, types));
	}
}

function createObject(
	serialized: SerializedObject,
	types: ComponentTypes,
): GameObject {
	const object = new GameObject(serialized.name);
	object.x = serialized.x;
	object.y = serialized.y;
	object.rotation = serialized.rotation;
	object.scaleX = serialized.scaleX;
	object.scaleY = serialized.scaleY;

	for (const saved of serialized.components) {
		const ComponentClass = types[saved.type];
		if (!ComponentClass) continue;
		writeComponent(object.addComponent(ComponentClass), saved.data);
	}

	for (const child of serialized.children) {
		createObject(child, types).setParent(object, false);
	}

	return object;
}

/**
 * Writes saved data onto a fresh component. Object values (points, colors) are
 * mutated in place so the component keeps its typed instance.
 */
function writeComponent(
	component: Component,
	data: Record<string, unknown>,
): void {
	const target = component as unknown as Record<string, unknown>;

	for (const [name, value] of Object.entries(data)) {
		const current = target[name];
		if (isRecord(current) && isRecord(value)) {
			for (const key of Object.keys(current)) {
				if (key in value) current[key] = cloneFieldValue(value[key]);
			}
			continue;
		}
		target[name] = cloneFieldValue(value);
	}
}
