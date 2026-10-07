import { Color } from "#/core/math/Color";
import { Vector2 } from "#/core/math/Vector2";
import { Vector3 } from "#/core/math/Vector3";
import { Vector4 } from "#/core/math/Vector4";
import {
	cloneFieldValue,
	componentFieldNames,
	isRecord,
	objectFieldNames,
} from "#/core/serialization/fields";

export { cloneFieldValue, isRecord };

/** The kinds of field the inspector knows how to draw. */
export type FieldView =
	| "number"
	| "string"
	| "boolean"
	| "color"
	| "point2d"
	| "point3d"
	| "point4d";

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

/** The public fields of a component that map to a view. */
export function reflectFields(component: object): string[] {
	const target = component as Record<string, unknown>;
	return componentFieldNames(component).filter((name) =>
		viewFromValue(target[name]),
	);
}

/** The GameObject's own public fields (like a camera's zoom) that map to a view. */
export function reflectObjectFields(object: object): string[] {
	const target = object as Record<string, unknown>;
	return objectFieldNames(object).filter((name) => viewFromValue(target[name]));
}

/** Copies the object's own public fields (not its components) onto another object. */
export function copyObjectFields(source: object, target: object): void {
	const sourceRecord = source as Record<string, unknown>;
	const targetRecord = target as Record<string, unknown>;

	for (const name of objectFieldNames(source)) {
		const value = sourceRecord[name];
		if (value === null || value === undefined) continue;
		if (typeof value === "function") continue;
		targetRecord[name] = cloneFieldValue(value);
	}
}

/** Copies the public fields from one object to another, deep-copying value types. */
export function copyFields(source: object, target: object): void {
	const sourceRecord = source as Record<string, unknown>;
	const targetRecord = target as Record<string, unknown>;

	for (const name of componentFieldNames(source)) {
		const value = sourceRecord[name];
		if (value === null || value === undefined) continue;
		if (typeof value === "function") continue;
		targetRecord[name] = cloneFieldValue(value);
	}
}
