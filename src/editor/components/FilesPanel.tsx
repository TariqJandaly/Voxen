import {
	type DragEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { AssetMeta } from "#/projects/assetStore";
import { getAssetThumbnail } from "#/projects/assetStore";
import type { Folder } from "#/projects/folderStore";
import {
	ASSET_DRAG_MIME,
	collectAssetRefs,
	FOLDER_DRAG_MIME,
} from "../assetRefs";
import { useEditor } from "../context/EditorContext";
import {
	ContextMenu,
	type ContextMenuItem,
	type ContextMenuState,
	contextMenuState,
} from "./ContextMenu";

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasDragType(event: DragEvent, mime: string): boolean {
	return event.dataTransfer.types.includes(mime);
}

/**
 * The project's asset browser. Create and navigate folders, import images by
 * button or drop, drag assets and folders between folders, recolour and rename
 * folders, and drag a tile onto the scene to place a sprite.
 */
export function FilesPanel() {
	const {
		assets,
		folders,
		importAssets,
		renameAsset,
		deleteAsset,
		moveAsset,
		createFolder,
		renameFolder,
		setFolderColor,
		deleteFolder,
		moveFolder,
		scene,
	} = useEditor();
	const inputRef = useRef<HTMLInputElement>(null);
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const dragDepth = useRef(0);

	const folderMap = useMemo(
		() => new Map(folders.map((folder) => [folder.id, folder])),
		[folders],
	);

	// If the current folder was deleted, fall back to the root.
	useEffect(() => {
		if (currentFolderId && !folderMap.has(currentFolderId)) {
			setCurrentFolderId(null);
		}
	}, [currentFolderId, folderMap]);

	const childFolders = folders.filter(
		(folder) => folder.parentId === currentFolderId,
	);
	const childAssets = assets.filter(
		(asset) => (asset.folderId ?? null) === currentFolderId,
	);

	const crumbs: Folder[] = [];
	let cursor = currentFolderId;
	while (cursor) {
		const folder = folderMap.get(cursor);
		if (!folder) break;
		crumbs.unshift(folder);
		cursor = folder.parentId;
	}

	const references = collectAssetRefs(scene);

	const handleFiles = async (files: FileList | File[]) => {
		const list = Array.from(files);
		if (list.length === 0) return;
		setError(await importAssets(list, currentFolderId));
	};

	// A drop on the panel background imports files or moves a dragged item here.
	const handleBackgroundDrop = (event: DragEvent) => {
		event.preventDefault();
		dragDepth.current = 0;
		setDragging(false);
		if (event.dataTransfer.files.length > 0) {
			void handleFiles(event.dataTransfer.files);
			return;
		}
		moveDragged(event, currentFolderId);
	};

	const moveDragged = (event: DragEvent, targetFolderId: string | null) => {
		const assetId = event.dataTransfer.getData(ASSET_DRAG_MIME);
		const folderId = event.dataTransfer.getData(FOLDER_DRAG_MIME);
		if (assetId) void moveAsset(assetId, targetFolderId);
		else if (folderId) void moveFolder(folderId, targetFolderId);
	};

	const handleNewFolder = async () => {
		const folder = await createFolder("New Folder", currentFolderId);
		setEditingId(folder.id);
	};

	const handleDeleteFolder = (folder: Folder) => {
		if (
			window.confirm(`Delete folder "${folder.name}"? Its contents move up.`)
		) {
			void deleteFolder(folder.id);
		}
	};

	const handleDeleteAsset = (asset: AssetMeta) => {
		const count = references.get(asset.id) ?? 0;
		const warning =
			count > 0
				? `${asset.name} is used by ${count} object${count === 1 ? "" : "s"}. Delete it anyway?`
				: `Delete ${asset.name}?`;
		if (window.confirm(warning)) void deleteAsset(asset.id);
	};

	const openFolderMenu = (
		event: { clientX: number; clientY: number },
		folder: Folder,
	) => {
		const items: ContextMenuItem[] = [
			{ label: "Open", onSelect: () => setCurrentFolderId(folder.id) },
			{ label: "Rename", onSelect: () => setEditingId(folder.id) },
			{
				label: "Delete",
				danger: true,
				onSelect: () => handleDeleteFolder(folder),
			},
		];
		setContextMenu(contextMenuState(event.clientX, event.clientY, items));
	};

	const openAssetMenu = (
		event: { clientX: number; clientY: number },
		asset: AssetMeta,
	) => {
		const items: ContextMenuItem[] = [
			{ label: "Rename", onSelect: () => setEditingId(asset.id) },
			{
				label: "Delete",
				danger: true,
				onSelect: () => handleDeleteAsset(asset),
			},
		];
		setContextMenu(contextMenuState(event.clientX, event.clientY, items));
	};

	const isEmpty = childFolders.length === 0 && childAssets.length === 0;

	return (
		<section
			aria-label="Project files"
			className="flex h-full flex-col bg-panel text-xs text-content"
			onDragEnter={(event) => {
				if (!hasDragType(event, "Files")) return;
				dragDepth.current++;
				setDragging(true);
			}}
			onDragLeave={() => {
				dragDepth.current = Math.max(0, dragDepth.current - 1);
				if (dragDepth.current === 0) setDragging(false);
			}}
			onDragOver={(event) => {
				if (hasDragType(event, "Files")) {
					event.preventDefault();
					event.dataTransfer.dropEffect = "copy";
				}
			}}
			onDrop={handleBackgroundDrop}
		>
			<div className="flex items-center gap-1 border-b border-edge bg-header px-2 py-1">
				<nav
					aria-label="Folder path"
					className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
				>
					<Breadcrumb
						label="Root"
						active={currentFolderId === null}
						folderId={null}
						onOpen={setCurrentFolderId}
						onMove={moveDragged}
					/>
					{crumbs.map((folder) => (
						<span key={folder.id} className="flex min-w-0 items-center">
							<span className="text-muted">/</span>
							<Breadcrumb
								label={folder.name}
								active={folder.id === currentFolderId}
								folderId={folder.id}
								onOpen={setCurrentFolderId}
								onMove={moveDragged}
							/>
						</span>
					))}
				</nav>
				<button
					type="button"
					onClick={handleNewFolder}
					className="shrink-0 cursor-pointer border border-edge bg-panel-alt px-2 py-0.5 text-content transition-colors hover:bg-panel-alt-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
				>
					New Folder
				</button>
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					className="shrink-0 cursor-pointer border border-edge bg-panel-alt px-2 py-0.5 text-content transition-colors hover:bg-panel-alt-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
				>
					Import…
				</button>
				<input
					ref={inputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={(event) => {
						if (event.target.files) void handleFiles(event.target.files);
						event.target.value = "";
					}}
				/>
			</div>

			{error && (
				<div
					role="alert"
					className="border-b border-edge bg-danger/15 px-2 py-1 text-danger"
				>
					{error}
				</div>
			)}

			{isEmpty ? (
				<div
					className={`flex flex-1 items-center justify-center p-3 text-center text-muted ${
						dragging ? "bg-selection/20" : ""
					}`}
				>
					Drop images here, or use Import.
				</div>
			) : (
				<ul className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2 overflow-y-auto p-2">
					{childFolders.map((folder) => (
						<FolderTile
							key={folder.id}
							folder={folder}
							editing={editingId === folder.id}
							onOpen={() => setCurrentFolderId(folder.id)}
							onStartEdit={() => setEditingId(folder.id)}
							onRename={(name) => {
								setEditingId(null);
								void renameFolder(folder.id, name);
							}}
							onColor={(color) => void setFolderColor(folder.id, color)}
							onDrop={(event) => {
								if (
									!hasDragType(event, ASSET_DRAG_MIME) &&
									!hasDragType(event, FOLDER_DRAG_MIME)
								) {
									return;
								}
								event.preventDefault();
								event.stopPropagation();
								moveDragged(event, folder.id);
							}}
							onContextMenu={(event) => openFolderMenu(event, folder)}
						/>
					))}
					{childAssets.map((asset) => (
						<AssetTile
							key={asset.id}
							asset={asset}
							editing={editingId === asset.id}
							onStartEdit={() => setEditingId(asset.id)}
							onRename={(name) => {
								setEditingId(null);
								void renameAsset(asset.id, name);
							}}
							onDelete={() => handleDeleteAsset(asset)}
							onContextMenu={(event) => openAssetMenu(event, asset)}
						/>
					))}
				</ul>
			)}

			{contextMenu && (
				<ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
			)}
		</section>
	);
}

function Breadcrumb({
	label,
	active,
	folderId,
	onOpen,
	onMove,
}: {
	label: string;
	active: boolean;
	folderId: string | null;
	onOpen: (id: string | null) => void;
	onMove: (event: DragEvent, folderId: string | null) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onOpen(folderId)}
			onDragOver={(event) => {
				if (
					hasDragType(event, ASSET_DRAG_MIME) ||
					hasDragType(event, FOLDER_DRAG_MIME)
				) {
					event.preventDefault();
					event.stopPropagation();
				}
			}}
			onDrop={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onMove(event, folderId);
			}}
			className={`min-w-0 truncate border-0 bg-transparent px-1 py-0.5 ${
				active ? "text-content" : "text-muted hover:text-content"
			} cursor-pointer`}
		>
			{label}
		</button>
	);
}

function FolderTile({
	folder,
	editing,
	onOpen,
	onStartEdit,
	onRename,
	onColor,
	onDrop,
	onContextMenu,
}: {
	folder: Folder;
	editing: boolean;
	onOpen: () => void;
	onStartEdit: () => void;
	onRename: (name: string) => void;
	onColor: (color: string) => void;
	onDrop: (event: DragEvent) => void;
	onContextMenu: (event: { clientX: number; clientY: number }) => void;
}) {
	const colorRef = useRef<HTMLInputElement>(null);

	return (
		<li
			draggable
			onDragStart={(event: DragEvent) => {
				event.dataTransfer.setData(FOLDER_DRAG_MIME, folder.id);
				event.dataTransfer.effectAllowed = "move";
			}}
			onDragOver={(event) => {
				if (
					hasDragType(event, ASSET_DRAG_MIME) ||
					hasDragType(event, FOLDER_DRAG_MIME)
				) {
					event.preventDefault();
				}
			}}
			onDrop={onDrop}
			onContextMenu={(event) => {
				event.preventDefault();
				onContextMenu(event);
			}}
			className="group flex flex-col gap-1"
		>
			<div className="relative flex aspect-square items-center justify-center border border-edge bg-canvas">
				<button
					type="button"
					onClick={onOpen}
					aria-label={`Open ${folder.name}`}
					className="flex h-full w-full cursor-pointer items-center justify-center border-0 bg-transparent"
				>
					<FolderIcon color={folder.color} />
				</button>
				<button
					type="button"
					onClick={() => colorRef.current?.click()}
					aria-label={`Change colour of ${folder.name}`}
					title="Change colour"
					style={{ backgroundColor: folder.color }}
					className="absolute right-1 bottom-1 h-3.5 w-3.5 cursor-pointer border border-black/40"
				/>
				<input
					ref={colorRef}
					type="color"
					value={folder.color}
					onChange={(event) => onColor(event.target.value)}
					className="pointer-events-none absolute h-0 w-0 opacity-0"
					tabIndex={-1}
					aria-hidden="true"
				/>
			</div>

			{editing ? (
				<input
					ref={(element) => element?.focus()}
					defaultValue={folder.name}
					onBlur={(event) => onRename(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") onRename(event.currentTarget.value);
						if (event.key === "Escape") onRename(folder.name);
					}}
					className="min-w-0 border border-focus bg-input px-1 text-xs text-white outline-none"
				/>
			) : (
				<button
					type="button"
					onDoubleClick={onStartEdit}
					className="min-w-0 truncate border-0 bg-transparent p-0 text-left text-content"
					title={`${folder.name} (double-click to rename)`}
				>
					{folder.name}
				</button>
			)}
		</li>
	);
}

function FolderIcon({ color }: { color: string }) {
	return (
		<svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8">
			<path
				d="M3 7a2 2 0 0 1 2-2h7l3 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
				fill={color}
				stroke="rgba(0,0,0,0.35)"
				strokeWidth="1"
			/>
		</svg>
	);
}

function AssetTile({
	asset,
	editing,
	onStartEdit,
	onRename,
	onDelete,
	onContextMenu,
}: {
	asset: AssetMeta;
	editing: boolean;
	onStartEdit: () => void;
	onRename: (name: string) => void;
	onDelete: () => void;
	onContextMenu: (event: { clientX: number; clientY: number }) => void;
}) {
	return (
		<li
			draggable
			onDragStart={(event: DragEvent) => {
				event.dataTransfer.setData(ASSET_DRAG_MIME, asset.id);
				event.dataTransfer.setData("text/plain", asset.name);
				event.dataTransfer.effectAllowed = "copy";
			}}
			onContextMenu={(event) => {
				event.preventDefault();
				onContextMenu(event);
			}}
			title={`${asset.name} · ${asset.width}×${asset.height} · ${formatBytes(asset.size)}`}
			className="group flex flex-col gap-1"
		>
			<div className="relative aspect-square overflow-hidden border border-edge bg-canvas">
				<AssetThumbnail id={asset.id} />
				<button
					type="button"
					onClick={onDelete}
					aria-label={`Delete ${asset.name}`}
					className="absolute top-0 right-0 cursor-pointer border-0 bg-black/60 px-1 text-danger opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
				>
					×
				</button>
			</div>

			{editing ? (
				<input
					ref={(element) => element?.focus()}
					defaultValue={asset.name}
					onBlur={(event) => onRename(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") onRename(event.currentTarget.value);
						if (event.key === "Escape") onRename(asset.name);
					}}
					className="min-w-0 border border-focus bg-input px-1 text-xs text-white outline-none"
				/>
			) : (
				<button
					type="button"
					onDoubleClick={onStartEdit}
					className="min-w-0 cursor-text truncate border-0 bg-transparent p-0 text-left text-content"
					title={asset.name}
				>
					{asset.name}
				</button>
			)}
			<span className="truncate text-[10px] text-muted">
				{asset.width}×{asset.height}
			</span>
		</li>
	);
}

/** Loads an asset's thumbnail lazily and revokes the URL on unmount. */
function AssetThumbnail({ id }: { id: string }): ReactNode {
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		let objectUrl: string | null = null;
		void getAssetThumbnail(id).then((blob) => {
			if (!active || !blob) return;
			objectUrl = URL.createObjectURL(blob);
			setUrl(objectUrl);
		});
		return () => {
			active = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [id]);

	if (!url) return <div className="h-full w-full bg-panel-alt" />;
	return (
		<img
			src={url}
			alt=""
			draggable={false}
			className="h-full w-full object-contain"
		/>
	);
}
