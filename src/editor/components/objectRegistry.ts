import { GameObject } from "#/core/GameObject";

/** A GameObject subclass as the hierarchy creates it: `new Class(name)`. */
export type GameObjectClass = new (name?: string) => GameObject;

/** One entry in the hierarchy's create menu. */
export interface CreatableObject {
	label: string;
	create: (name: string) => GameObject;
}

// Every module under `core/objects/` is scanned, so adding a file that exports a
// GameObject subclass is all it takes to give it a place in the create menu.
const modules = import.meta.glob<Record<string, unknown>>(
	"../../core/objects/*.ts",
	{ eager: true },
);

function isGameObjectClass(value: unknown): value is GameObjectClass {
	return typeof value === "function" && value.prototype instanceof GameObject;
}

/** Collects the GameObject classes exported by the scanned modules, sorted by name. */
function collectGameObjectTypes(): GameObjectClass[] {
	const found = new Map<string, GameObjectClass>();
	for (const module of Object.values(modules)) {
		for (const exported of Object.values(module)) {
			if (isGameObjectClass(exported)) found.set(exported.name, exported);
		}
	}
	return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const GAME_OBJECT_TYPES = collectGameObjectTypes();

/** Turns a class name into a menu label, like `EnemySpawner` into `Enemy Spawner`. */
function humanize(name: string): string {
	const spaced = name
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim();
	return spaced || name;
}

/** The create-menu entries: the plain object first, then every discovered subclass. */
export const OBJECT_REGISTRY: ReadonlyArray<CreatableObject> = [
	{ label: "Empty Object", create: (name: string) => new GameObject(name) },
	...GAME_OBJECT_TYPES.map((GameObjectType) => ({
		label: humanize(GameObjectType.name),
		create: (name: string) => new GameObjectType(name),
	})),
];

/** The same classes keyed by class name, used to rebuild a saved scene. */
export const OBJECT_TYPES: Record<string, GameObjectClass> = {
	GameObject,
	...Object.fromEntries(
		GAME_OBJECT_TYPES.map((GameObjectType) => [
			GameObjectType.name,
			GameObjectType,
		]),
	),
};
