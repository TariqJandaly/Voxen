import { type IDBPDatabase, openDB } from "idb";
import type { SerializedScene } from "#/core/serialization/SceneSerializer";

/** A saved project with its scene snapshot. */
export interface Project {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	scene?: SerializedScene;
}

const DB_NAME = "voxen";
const DB_VERSION = 2;
const STORE_NAME = "projects";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(database) {
				// Drop the store an earlier build used, then make sure ours exists.
				if (database.objectStoreNames.contains("scenes")) {
					database.deleteObjectStore("scenes");
				}
				if (!database.objectStoreNames.contains(STORE_NAME)) {
					database.createObjectStore(STORE_NAME, { keyPath: "id" });
				}
			},
		});
	}
	return dbPromise;
}

function newId(): string {
	return typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: Math.random().toString(36).substring(2, 11);
}

/** All projects, most recently updated first. */
export async function listProjects(): Promise<Project[]> {
	const db = await getDb();
	const projects = (await db.getAll(STORE_NAME)) as Project[];
	return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** One project, or null when the id is unknown. */
export async function getProject(id: string): Promise<Project | null> {
	const db = await getDb();
	const project = (await db.get(STORE_NAME, id)) as Project | undefined;
	return project ?? null;
}

/** Creates a project and returns it. Falls back to a default name when blank. */
export async function createProject(name: string): Promise<Project> {
	const now = Date.now();
	const project: Project = {
		id: newId(),
		name: name.trim() || "Untitled Project",
		createdAt: now,
		updatedAt: now,
	};

	const db = await getDb();
	await db.put(STORE_NAME, project);
	return project;
}

/** Renames a project. Ignored when the id is unknown or the name is blank. */
export async function renameProject(id: string, name: string): Promise<void> {
	const trimmed = name.trim();
	if (!trimmed) return;

	const db = await getDb();
	const project = (await db.get(STORE_NAME, id)) as Project | undefined;
	if (!project) return;

	project.name = trimmed;
	project.updatedAt = Date.now();
	await db.put(STORE_NAME, project);
}

export async function deleteProject(id: string): Promise<void> {
	const db = await getDb();
	await db.delete(STORE_NAME, id);
}

/** Stores a scene snapshot on its project. Ignored when the id is unknown. */
export async function saveProjectScene(
	id: string,
	scene: SerializedScene,
): Promise<void> {
	const db = await getDb();
	const project = (await db.get(STORE_NAME, id)) as Project | undefined;
	if (!project) return;

	project.scene = scene;
	project.updatedAt = Date.now();
	await db.put(STORE_NAME, project);
}
