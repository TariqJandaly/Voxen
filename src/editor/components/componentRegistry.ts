import type { Component } from "#/core/Component";
import { DataTypes } from "#/core/components/DataTypes";
import { PlayerController } from "#/core/components/PlayerController";
import { SpriteRenderer } from "#/core/components/SpriteRenderer";

/** Components that show up in the inspector's add-component search. */
export const COMPONENT_REGISTRY: ReadonlyArray<new () => Component> = [
	DataTypes,
	PlayerController,
	SpriteRenderer,
];

/** The same components keyed by class name, for rebuilding a saved scene. */
export const COMPONENT_TYPES: Record<string, new () => Component> =
	Object.fromEntries(
		COMPONENT_REGISTRY.map((ComponentClass) => [
			ComponentClass.name,
			ComponentClass,
		]),
	);
