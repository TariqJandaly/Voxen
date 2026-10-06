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
