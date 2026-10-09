import { ASSET_BLOB_STORE, ASSET_STORE, ASSET_THUMB_STORE, getDb } from "./db";

/** Asset metadata, stored apart from the bytes so listing stays cheap. */
export interface AssetMeta {
	id: string;
	projectId: string;
	/** The folder it lives in, or null for the project root. */
	folderId: string | null;
	name: string;
	mimeType: string;
	size: number;
	width: number;
	height: number;
	/** Content hash, used to skip re-importing an identical file. */
	hash: string;
	createdAt: number;
}

interface BlobRecord {
	id: string;
	blob: Blob;
}

const THUMBNAIL_MAX = 256;

/** A user-facing import failure, safe to show in the panel. */
export class AssetImportError extends Error {}

function newId(): string {
	return typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: Math.random().toString(36).substring(2, 11);
}

/** Every asset in a project, oldest first. Metadata only, no blobs. */
export async function listAssets(projectId: string): Promise<AssetMeta[]> {
	const db = await getDb();
	const assets = (await db.getAllFromIndex(
		ASSET_STORE,
		"projectId",
		projectId,
	)) as AssetMeta[];
	return assets.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getAssetBlob(id: string): Promise<Blob | undefined> {
	const db = await getDb();
	const record = (await db.get(ASSET_BLOB_STORE, id)) as BlobRecord | undefined;
	return record?.blob;
}

export async function getAssetThumbnail(id: string): Promise<Blob | undefined> {
	const db = await getDb();
	const record = (await db.get(ASSET_THUMB_STORE, id)) as
		| BlobRecord
		| undefined;
	return record?.blob;
}

/**
 * A content hash for dedupe. Uses SHA-256 when Web Crypto is available (secure
 * contexts) and a fast non-crypto hash otherwise, so imports work over plain
 * HTTP on a network origin where `crypto.subtle` is undefined.
 */
async function hashBlob(blob: Blob): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	if (typeof crypto !== "undefined" && crypto.subtle) {
		try {
			const digest = await crypto.subtle.digest("SHA-256", bytes);
			return [...new Uint8Array(digest)]
				.map((byte) => byte.toString(16).padStart(2, "0"))
				.join("");
		} catch {
			// Fall through to the non-crypto hash.
		}
	}
	return cyrb53(bytes);
}

/** cyrb53: a fast 53-bit hash with good distribution, no crypto needed. */
function cyrb53(bytes: Uint8Array, seed = 0): string {
	let h1 = 0xdeadbeef ^ seed;
	let h2 = 0x41c6ce57 ^ seed;
	for (let i = 0; i < bytes.length; i++) {
		const byte = bytes[i];
		h1 = Math.imul(h1 ^ byte, 2654435761);
		h2 = Math.imul(h2 ^ byte, 1597334677);
	}
	h1 =
		Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
		Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 =
		Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
		Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

async function decodeImage(
	blob: Blob,
): Promise<{ thumbnail: Blob | null; width: number; height: number }> {
	const bitmap = await createImageBitmap(blob);
	const { width, height } = bitmap;
	const scale = Math.min(1, THUMBNAIL_MAX / Math.max(width, height));
	const thumbWidth = Math.max(1, Math.round(width * scale));
	const thumbHeight = Math.max(1, Math.round(height * scale));

	const canvas = document.createElement("canvas");
	canvas.width = thumbWidth;
	canvas.height = thumbHeight;
	const context = canvas.getContext("2d");
	let thumbnail: Blob | null = null;
	if (context) {
		context.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight);
		thumbnail = await new Promise((resolve) =>
			canvas.toBlob((blob) => resolve(blob), "image/png"),
		);
	}
	bitmap.close();
	return { thumbnail, width, height };
}

/**
 * Validates, decodes, and stores an image. Returns the existing asset when a
 * file with the same bytes is already in the project.
 */
export async function importAsset(
	projectId: string,
	file: File,
	folderId: string | null = null,
): Promise<AssetMeta> {
	if (file.size === 0) {
		throw new AssetImportError(`${file.name} is empty.`);
	}
	if (!file.type.startsWith("image/")) {
		throw new AssetImportError(`${file.name} is not an image.`);
	}

	const hash = await hashBlob(file);
	const existing = await listAssets(projectId);
	const duplicate = existing.find((asset) => asset.hash === hash);
	if (duplicate) return duplicate;

	let decoded: Awaited<ReturnType<typeof decodeImage>>;
	try {
		decoded = await decodeImage(file);
	} catch {
		throw new AssetImportError(
			`${file.name} could not be decoded as an image.`,
		);
	}
	const { thumbnail, width, height } = decoded;
	const meta: AssetMeta = {
		id: newId(),
		projectId,
		folderId,
		name: file.name,
		mimeType: file.type,
		size: file.size,
		width,
		height,
		hash,
		createdAt: Date.now(),
	};

	const db = await getDb();
	const tx = db.transaction(
		[ASSET_STORE, ASSET_BLOB_STORE, ASSET_THUMB_STORE],
		"readwrite",
	);
	await tx.objectStore(ASSET_STORE).put(meta);
	await tx.objectStore(ASSET_BLOB_STORE).put({ id: meta.id, blob: file });
	if (thumbnail) {
		await tx.objectStore(ASSET_THUMB_STORE).put({
			id: meta.id,
			blob: thumbnail,
		});
	}
	await tx.done;
	return meta;
}

export async function renameAsset(id: string, name: string): Promise<void> {
	const trimmed = name.trim();
	if (!trimmed) return;
	const db = await getDb();
	const meta = (await db.get(ASSET_STORE, id)) as AssetMeta | undefined;
	if (!meta) return;
	meta.name = trimmed;
	await db.put(ASSET_STORE, meta);
}

/** Moves an asset into a folder (or the root when `folderId` is null). */
export async function moveAsset(
	id: string,
	folderId: string | null,
): Promise<void> {
	const db = await getDb();
	const meta = (await db.get(ASSET_STORE, id)) as AssetMeta | undefined;
	if (!meta) return;
	meta.folderId = folderId;
	await db.put(ASSET_STORE, meta);
}

export async function deleteAsset(id: string): Promise<void> {
	const db = await getDb();
	const tx = db.transaction(
		[ASSET_STORE, ASSET_BLOB_STORE, ASSET_THUMB_STORE],
		"readwrite",
	);
	await tx.objectStore(ASSET_STORE).delete(id);
	await tx.objectStore(ASSET_BLOB_STORE).delete(id);
	await tx.objectStore(ASSET_THUMB_STORE).delete(id);
	await tx.done;
}

/** Removes every asset (and its bytes) belonging to a project. */
export async function deleteAssetsForProject(projectId: string): Promise<void> {
	const metas = await listAssets(projectId);
	if (metas.length === 0) return;
	const db = await getDb();
	const tx = db.transaction(
		[ASSET_STORE, ASSET_BLOB_STORE, ASSET_THUMB_STORE],
		"readwrite",
	);
	for (const meta of metas) {
		await tx.objectStore(ASSET_STORE).delete(meta.id);
		await tx.objectStore(ASSET_BLOB_STORE).delete(meta.id);
		await tx.objectStore(ASSET_THUMB_STORE).delete(meta.id);
	}
	await tx.done;
}
