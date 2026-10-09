import type { Scene } from "#/core/Scene";

/** The drag-and-drop MIME type carrying an asset id. */
export const ASSET_DRAG_MIME = "application/x-voxen-asset";

/** The drag-and-drop MIME type carrying a folder id. */
export const FOLDER_DRAG_MIME = "application/x-voxen-folder";

/**
 * Counts how many components reference each asset id, using the `assetFields`
 * convention (a static list of field names that hold asset ids).
 */
export function collectAssetRefs(scene: Scene): Map<string, number> {
	const counts = new Map<string, number>();
	for (const object of scene.allObjects) {
		for (const component of object.getComponents()) {
			const fields = (component.constructor as { assetFields?: string[] })
				.assetFields;
			if (!fields) continue;
			const record = component as unknown as Record<string, unknown>;
			for (const field of fields) {
				const value = record[field];
				if (typeof value === "string" && value) {
					counts.set(value, (counts.get(value) ?? 0) + 1);
				}
			}
		}
	}
	return counts;
}
