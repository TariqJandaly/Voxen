import { Color } from "../math/Color";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";
import { Vector4 } from "../math/Vector4";

/** Engine internals that are never saved or shown. */
export const INTERNAL_FIELDS = new Set([
	"gameObject",
	"scene",
	"isActive",
	"hasStarted",
	"image",
	"isLoaded",
	"loadToken",
	"constructor",
]);

/** Extra fields hidden when reflecting a GameObject's own (non-component) fields. */
const OBJECT_INTERNAL_FIELDS = new Set([
	"id",
	"name",
	"parent",
	"children",
	"transform",
	"components",
	"isVisible",
	"viewportWidth",
	"viewportHeight",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * The public field names on a component: its own keys plus accessors from the
 * prototype chain, minus engine internals and `_`-prefixed fields.
 */
export function componentFieldNames(component: object): string[] {
	const names = new Set<string>(Object.keys(component));

	let prototype = Object.getPrototypeOf(component);
	while (prototype && prototype !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
			if (descriptor?.get || descriptor?.set) names.add(name);
		}
		prototype = Object.getPrototypeOf(prototype);
	}

	return [...names].filter(
		(name) => !INTERNAL_FIELDS.has(name) && !name.startsWith("_"),
	);
}

/**
 * The public field names on a GameObject itself, like a camera's zoom. Uses the
 * same reflection as components but also hides the object-managed fields.
 */
export function objectFieldNames(object: object): string[] {
	return componentFieldNames(object).filter(
		(name) => !OBJECT_INTERNAL_FIELDS.has(name),
	);
}

/** Copies a field value so the copy does not share colors, vectors, arrays, or plain objects. */
export function cloneFieldValue(value: unknown): unknown {
	if (value instanceof Color) {
		return new Color(value.r, value.g, value.b, value.a);
	}
	if (value instanceof Vector2) return new Vector2(value.x, value.y);
	if (value instanceof Vector3) return new Vector3(value.x, value.y, value.z);
	if (value instanceof Vector4) {
		return new Vector4(value.x, value.y, value.z, value.w);
	}
	if (Array.isArray(value)) return value.map(cloneFieldValue);
	if (isRecord(value)) {
		const copy: Record<string, unknown> = {};
		for (const key of Object.keys(value))
			copy[key] = cloneFieldValue(value[key]);
		return copy;
	}
	return value;
}
