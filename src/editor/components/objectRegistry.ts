import { Camera } from "#/core/objects/Camera";
import { GameObject } from "#/core/GameObject";

/** One entry in the hierarchy's create menu. */
export interface CreatableObject {
	label: string;
	create: (name: string) => GameObject;
}

/** GameObject kinds the hierarchy can create. */
export const OBJECT_REGISTRY: ReadonlyArray<CreatableObject> = [
	{ label: "Empty Object", create: (name) => new GameObject(name) },
	{ label: "Camera", create: (name) => new Camera(name) },
];

/** The same object classes keyed by class name, for rebuilding a saved scene. */
export const OBJECT_TYPES: Record<string, new (name?: string) => GameObject> = {
	GameObject,
	Camera,
};