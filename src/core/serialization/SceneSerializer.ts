import type { Component } from "../Component";
import { GameObject } from "../GameObject";
import type { Scene } from "../Scene";
import {
	cloneFieldValue,
	componentFieldNames,
	isRecord,
	objectFieldNames,
} from "./fields";

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
	/** `constructor.name` of the GameObject, so subclasses like Camera rebuild. */
	type: string;
	name: string;
	active: boolean;
	visible: boolean;
	transform: SerializedTransform;
	/** Fields on the object itself, such as a camera's zoom. */
	objectData: Record<string, unknown>;
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

/** GameObject classes (including subclasses like Camera) keyed by `constructor.name`. */
export type GameObjectTypes = Record<string, new (name?: string) => GameObject>;

/** Snapshots a scene: the object tree with transforms and component fields. */
export function serializeScene(scene: Scene): SerializedScene {
	const roots = scene.allObjects.filter((object) => !object.parent);
	return { version: 2, name: scene.name, objects: roots.map(serializeObject) };
}

function serializeObject(object: GameObject): SerializedObject {
	const { position, rotation, scale } = object.transform;
	return {
		type: object.constructor.name,
		name: object.name,
		active: object.isActive,
		visible: object.isVisible,
		transform: {
			position: { x: position.x, y: position.y, z: position.z },
			rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
			scale: { x: scale.x, y: scale.y, z: scale.z },
		},
		objectData: serializeFields(object, objectFieldNames(object)),
		components: object.getComponents().map(serializeComponent),
		children: object.getChildren().map(serializeObject),
	};
}

function serializeComponent(component: Component): SerializedComponent {
	return {
		type: component.constructor.name,
		data: serializeFields(component, componentFieldNames(component)),
	};
}

/** Copies named public fields, skipping functions and empty values. */
function serializeFields(
	source: object,
	names: string[],
): Record<string, unknown> {
	const target = source as unknown as Record<string, unknown>;
	const data: Record<string, unknown> = {};

	for (const name of names) {
		const value = target[name];
		if (value === null || value === undefined) continue;
		if (typeof value === "function") continue;
		data[name] = cloneFieldValue(value);
	}

	return data;
}

/** Rebuilds the objects from a snapshot, replacing whatever is in the scene. */
export function deserializeScene(
	scene: Scene,
	data: AnySerializedScene,
	types: ComponentTypes,
	objectTypes: GameObjectTypes,
): void {
	// Replace, do not append. Loading twice must not double the objects.
	scene.clear();
	scene.name = data.name || scene.name;

	const objects =
		data.version === 1 ? data.objects.map(migrateObjectV1) : data.objects;
	for (const serialized of objects) {
		const object = createObject(serialized, types, objectTypes);
		scene.attach(object);
		restoreActiveState(object, serialized);
	}
}

/** Lifts a v1 flat transform onto the v2 shape. */
function migrateObjectV1(object: SerializedObjectV1): SerializedObject {
	return {
		type: "GameObject",
		name: object.name,
		active: true,
		visible: true,
		transform: {
			position: { x: object.x, y: object.y, z: 0 },
			rotation: { x: 0, y: 0, z: object.rotation },
			scale: { x: object.scaleX, y: object.scaleY, z: 1 },
		},
		objectData: {},
		components: object.components,
		children: object.children.map(migrateObjectV1),
	};
}

function createObject(
	serialized: SerializedObject,
	types: ComponentTypes,
	objectTypes: GameObjectTypes,
): GameObject {
	const GameObjectClass = objectTypes[serialized.type] ?? GameObject;
	const object = new GameObjectClass(serialized.name);
	object.isVisible = serialized.visible;

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

	writeFields(object, serialized.objectData);

	for (const saved of serialized.components) {
		const ComponentClass = types[saved.type];
		if (!ComponentClass) continue;
		writeFields(object.addComponent(ComponentClass), saved.data);
	}

	for (const child of serialized.children) {
		createObject(child, types, objectTypes).setParent(object, false);
	}

	return object;
}

/** Turns each object back on or off to match the snapshot. */
function restoreActiveState(
	object: GameObject,
	serialized: SerializedObject,
): void {
	if (serialized.active) {
		object.enable();
	} else {
		object.destroy();
	}

	const children = object.getChildren();
	for (let i = 0; i < children.length; i++) {
		restoreActiveState(children[i], serialized.children[i]);
	}
}

/**
 * Writes saved data onto a fresh object or component. Object values (points,
 * colors) are mutated in place so the target keeps its typed instance.
 */
function writeFields(target: object, data: Record<string, unknown>): void {
	const record = target as Record<string, unknown>;

	for (const [name, value] of Object.entries(data)) {
		const current = record[name];
		if (isRecord(current) && isRecord(value)) {
			for (const key of Object.keys(current)) {
				if (key in value) current[key] = cloneFieldValue(value[key]);
			}
			continue;
		}
		record[name] = cloneFieldValue(value);
	}
}
