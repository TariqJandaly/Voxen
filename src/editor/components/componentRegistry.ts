import { Component } from "#/core/Component";
import { Transform } from "#/core/components/Transform";

/** A component class the inspector can add. */
export type ComponentClass = new () => Component;

// Every module under `core/components/` is scanned, so adding a file that exports
// a Component subclass is all it takes to make it appear in the add-component box.
const modules = import.meta.glob<Record<string, unknown>>(
	"../../core/components/*.ts",
	{ eager: true },
);

function isComponentClass(value: unknown): value is ComponentClass {
	// Transform is owned by every GameObject, so it is never added by hand.
	return (
		typeof value === "function" &&
		value.prototype instanceof Component &&
		value !== Transform
	);
}

/** Collects the Component classes exported by the scanned modules, sorted by name. */
function collectComponentTypes(): ComponentClass[] {
	const found = new Map<string, ComponentClass>();
	for (const module of Object.values(modules)) {
		for (const exported of Object.values(module)) {
			if (isComponentClass(exported)) found.set(exported.name, exported);
		}
	}
	return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const COMPONENT_TYPES_LIST = collectComponentTypes();

/** Components that show up in the inspector's add-component search. */
export const COMPONENT_REGISTRY: ReadonlyArray<ComponentClass> =
	COMPONENT_TYPES_LIST;

/** The same components keyed by class name, for rebuilding a saved scene. */
export const COMPONENT_TYPES: Record<string, ComponentClass> =
	Object.fromEntries(
		COMPONENT_TYPES_LIST.map((ComponentType) => [
			ComponentType.name,
			ComponentType,
		]),
	);
