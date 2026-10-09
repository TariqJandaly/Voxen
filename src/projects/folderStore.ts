import { ASSET_STORE, FOLDER_STORE, getDb } from "./db";

/** A folder in the project's asset browser. Folders form a tree. */
export interface Folder {
	id: string;
	projectId: string;
	name: string;
	parentId: string | null;
	color: string;
	createdAt: number;
}

const DEFAULT_FOLDER_COLOR = "#5b8bb0";

function newId(): string {
	return typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: Math.random().toString(36).substring(2, 11);
}

/** Every folder in a project, oldest first. */
export async function listFolders(projectId: string): Promise<Folder[]> {
	const db = await getDb();
	const folders = (await db.getAllFromIndex(
		FOLDER_STORE,
		"projectId",
		projectId,
	)) as Folder[];
	return folders.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createFolder(
	projectId: string,
	name: string,
	parentId: string | null,
	color = DEFAULT_FOLDER_COLOR,
): Promise<Folder> {
	const folder: Folder = {
		id: newId(),
		projectId,
		name: name.trim() || "New Folder",
		parentId,
		color,
		createdAt: Date.now(),
	};
	const db = await getDb();
	await db.put(FOLDER_STORE, folder);
	return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
	const trimmed = name.trim();
	if (!trimmed) return;
	const db = await getDb();
	const folder = (await db.get(FOLDER_STORE, id)) as Folder | undefined;
	if (!folder) return;
	folder.name = trimmed;
	await db.put(FOLDER_STORE, folder);
}

export async function setFolderColor(id: string, color: string): Promise<void> {
	const db = await getDb();
	const folder = (await db.get(FOLDER_STORE, id)) as Folder | undefined;
	if (!folder) return;
	folder.color = color;
	await db.put(FOLDER_STORE, folder);
}

/** True when `candidate` is `id` itself or one of its descendants. */
function isInSubtree(
	folders: Folder[],
	id: string,
	candidate: string,
): boolean {
	let current: string | null = candidate;
	while (current) {
		if (current === id) return true;
		current = folders.find((folder) => folder.id === current)?.parentId ?? null;
	}
	return false;
}

/** Reparents a folder, refusing to move it into its own subtree. */
export async function moveFolder(
	id: string,
	parentId: string | null,
): Promise<void> {
	const db = await getDb();
	const folder = (await db.get(FOLDER_STORE, id)) as Folder | undefined;
	if (!folder) return;
	if (parentId && parentId === id) return;
	if (parentId) {
		const folders = (await db.getAllFromIndex(
			FOLDER_STORE,
			"projectId",
			folder.projectId,
		)) as Folder[];
		if (isInSubtree(folders, id, parentId)) return;
	}
	folder.parentId = parentId;
	await db.put(FOLDER_STORE, folder);
}

/**
 * Deletes a folder without losing anything: its direct subfolders and its
 * assets move up to its parent, and only the folder itself is removed.
 */
export async function deleteFolder(id: string): Promise<void> {
	const db = await getDb();
	const folder = (await db.get(FOLDER_STORE, id)) as Folder | undefined;
	if (!folder) return;
	const parentId = folder.parentId;

	const folders = (await db.getAllFromIndex(
		FOLDER_STORE,
		"projectId",
		folder.projectId,
	)) as Folder[];
	const childFolders = folders.filter((candidate) => candidate.parentId === id);

	const tx = db.transaction([FOLDER_STORE, ASSET_STORE], "readwrite");
	for (const child of childFolders) {
		child.parentId = parentId;
		await tx.objectStore(FOLDER_STORE).put(child);
	}
	const assets = await tx.objectStore(ASSET_STORE).index("projectId").getAll();
	for (const asset of assets as Array<{
		id: string;
		folderId: string | null;
	}>) {
		if (asset.folderId === id) {
			await tx.objectStore(ASSET_STORE).put({ ...asset, folderId: parentId });
		}
	}
	await tx.objectStore(FOLDER_STORE).delete(id);
	await tx.done;
}

/** Removes every folder belonging to a project. */
export async function deleteFoldersForProject(
	projectId: string,
): Promise<void> {
	const folders = await listFolders(projectId);
	if (folders.length === 0) return;
	const db = await getDb();
	const tx = db.transaction(FOLDER_STORE, "readwrite");
	for (const folder of folders) {
		await tx.objectStore(FOLDER_STORE).delete(folder.id);
	}
	await tx.done;
}
