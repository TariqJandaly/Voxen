import type { Component } from "../Component";
import { GameObject } from "../GameObject";
import type { Scene } from "../Scene";
import { cloneFieldValue, componentFieldNames, isRecord } from "./fields";

export interface SerializedComponent {
	type: string;
	data: Record<string, unknown>;
}

/** The `z` fields are carried for the eventual 3D work; 2D ignores them. */
export interface SerializedTransform {
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number };
	scale: { x: number; y: number; z: number };
}

export interface SerializedObject {
	name: string;
	transform: SerializedTransform;
	components: SerializedComponent[];
	children: SerializedObject[];
}

export interface SerializedScene {
	version: 2;
	name: string;
	objects: SerializedObject[];
}

// The first format kept the transform flat on the object. Kept so old projects
// can still be loaded.
export interface SerializedObjectV1 {
	name: string;
	x: number;
	y: number;
	rotation: number;
	scaleX: number;
	scaleY: number;
	components: SerializedComponent[];
	children: SerializedObjectV1[];
}

export interface SerializedSceneV1 {
	version: 1;
	name: string;
	objects: SerializedObjectV1[];
}

/** Any scene format the loader understands. */
export type AnySerializedScene = SerializedSceneV1 | SerializedScene;

/** Component classes keyed by `constructor.name`, used to rebuild a scene. */
export type ComponentTypes = Record<string, new () => Component>;

/** Snapshots a scene: the object tree with transforms and component fields. */
export function serializeScene(scene: Scene): SerializedScene {
	// Roots are active objects whose parent is missing or inactive.
	const roots = scene.allObjects.filter(
		(object) => object.isActive && (!object.parent || !object.parent.isActive),
	);

	return { version: 2, name: scene.name, objects: roots.map(serializeObject) };
}

function serializeObject(object: GameObject): SerializedObject {
	const { position, rotation, scale } = object.transform;
	return {
		name: object.name,
		transform: {
			position: { x: position.x, y: position.y, z: position.z },
			rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
			scale: { x: scale.x, y: scale.y, z: scale.z },
		},
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
	data: AnySerializedScene,
	types: ComponentTypes,
): void {
	// Replace, do not append. Loading twice must not double the objects.
	scene.clear();
	scene.name = data.name || scene.name;

	const objects =
		data.version === 1 ? data.objects.map(migrateObjectV1) : data.objects;
	for (const serialized of objects) {
		scene.add(createObject(serialized, types));
	}
}

/** Lifts a v1 flat transform onto the v2 `transform` shape. */
function migrateObjectV1(object: SerializedObjectV1): SerializedObject {
	return {
		name: object.name,
		transform: {
			position: { x: object.x, y: object.y, z: 0 },
			rotation: { x: 0, y: 0, z: object.rotation },
			scale: { x: object.scaleX, y: object.scaleY, z: 1 },
		},
		components: object.components,
		children: object.children.map(migrateObjectV1),
	};
}

function createObject(
	serialized: SerializedObject,
	types: ComponentTypes,
): GameObject {
	const object = new GameObject(serialized.name);
	const { position, rotation, scale } = object.transform;
	position.x = serialized.transform.position.x;
	position.y = serialized.transform.position.y;
	position.z = serialized.transform.position.z;
	rotation.x = serialized.transform.rotation.x;
	rotation.y = serialized.transform.rotation.y;
	rotation.z = serialized.transform.rotation.z;
	scale.x = serialized.transform.scale.x;
	scale.y = serialized.transform.scale.y;
	scale.z = serialized.transform.scale.z;

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
