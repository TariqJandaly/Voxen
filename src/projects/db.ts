import { type IDBPDatabase, openDB } from "idb";

/**
 * The one IndexedDB database the app uses. Kept in its own module so the
 * project store and the asset store share a single connection and one schema.
 */
export const DB_NAME = "voxen";
export const DB_VERSION = 4;

export const PROJECT_STORE = "projects";
export const ASSET_STORE = "assets";
export const ASSET_BLOB_STORE = "assetBlobs";
export const ASSET_THUMB_STORE = "assetThumbs";
export const FOLDER_STORE = "folders";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(database) {
				// Drop the store an earlier build used.
				if (database.objectStoreNames.contains("scenes")) {
					database.deleteObjectStore("scenes");
				}
				if (!database.objectStoreNames.contains(PROJECT_STORE)) {
					database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
				}
				// Asset metadata is separate from the bytes, so listing assets never
				// loads blobs (the same split as Godot's .import vs imported cache).
				if (!database.objectStoreNames.contains(ASSET_STORE)) {
					const assets = database.createObjectStore(ASSET_STORE, {
						keyPath: "id",
					});
					assets.createIndex("projectId", "projectId");
				}
				if (!database.objectStoreNames.contains(ASSET_BLOB_STORE)) {
					database.createObjectStore(ASSET_BLOB_STORE, { keyPath: "id" });
				}
				if (!database.objectStoreNames.contains(ASSET_THUMB_STORE)) {
					database.createObjectStore(ASSET_THUMB_STORE, { keyPath: "id" });
				}
				if (!database.objectStoreNames.contains(FOLDER_STORE)) {
					const folders = database.createObjectStore(FOLDER_STORE, {
						keyPath: "id",
					});
					folders.createIndex("projectId", "projectId");
				}
			},
		});
	}
	return dbPromise;
}
