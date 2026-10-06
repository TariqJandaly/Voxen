import { Color } from "#/core/math/Color";
import { Vector2 } from "#/core/math/Vector2";
import { Vector3 } from "#/core/math/Vector3";
import { Vector4 } from "#/core/math/Vector4";

/** The kinds of field the inspector knows how to draw. */
export type FieldView =
	| "number"
	| "string"
	| "boolean"
	| "color"
	| "point2d"
	| "point3d"
	| "point4d";

/** Engine internals we never want to show as an editable field. */
export const INTERNAL_FIELDS = new Set([
	"gameObject",
	"scene",
	"isActive",
	"hasStarted",
	"image",
	"isLoaded",
	"constructor",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Works out which view fits a value. */
export function viewFromValue(value: unknown): FieldView | undefined {
	if (typeof value === "number") return "number";
	if (typeof value === "string") return "string";
	if (typeof value === "boolean") return "boolean";
	if (value instanceof Color) return "color";
	if (value instanceof Vector2) return "point2d";
	if (value instanceof Vector3) return "point3d";
	if (value instanceof Vector4) return "point4d";

	// Plain `{ r, g, b }` objects count as colors.
	if (
		isRecord(value) &&
		typeof value.r === "number" &&
		typeof value.g === "number" &&
		typeof value.b === "number"
	) {
		return "color";
	}

	// Plain `{ x, y }` objects count as points too.
	if (
		isRecord(value) &&
		typeof value.x === "number" &&
		typeof value.y === "number"
	) {
		if (typeof value.z === "number" && typeof value.w === "number") {
			return "point4d";
		}
		if (typeof value.z === "number") return "point3d";
		return "point2d";
	}
	return undefined;
}

/** Own enumerable keys of a component plus accessors declared on its prototypes. */
function fieldNames(component: object): string[] {
	const names = new Set<string>(Object.keys(component));

	let prototype = Object.getPrototypeOf(component);
	while (prototype && prototype !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
			if (descriptor?.get || descriptor?.set) names.add(name);
		}
		prototype = Object.getPrototypeOf(prototype);
	}
	return [...names];
}

/**
 * The public fields of a component that map to a view. Accessors count too (like
 * `SpriteRenderer.imageUrl`); `_private` fields and engine internals are skipped.
 */
export function reflectFields(component: object): string[] {
	const target = component as Record<string, unknown>;
	const fields: string[] = [];
	for (const name of fieldNames(component)) {
		if (INTERNAL_FIELDS.has(name) || name.startsWith("_")) continue;
		if (viewFromValue(target[name])) fields.push(name);
	}
	return fields;
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

/** Copies the public fields from one object to another, deep-copying value types. */
export function copyFields(source: object, target: object): void {
	const sourceRecord = source as Record<string, unknown>;
	const targetRecord = target as Record<string, unknown>;
	for (const name of fieldNames(source)) {
		if (INTERNAL_FIELDS.has(name) || name.startsWith("_")) continue;
		const value = sourceRecord[name];
		if (value === null || value === undefined) continue;
		if (typeof value === "function") continue;
		targetRecord[name] = cloneFieldValue(value);
	}
}
