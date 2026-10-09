import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type { GameObject } from "#/core/GameObject";
import { Scene } from "#/core/Scene";
import {
	type HistoryActionKind,
	makeHistoryNode,
	normalizeHistory,
	pruneHistory,
	type SerializedHistory,
} from "#/core/serialization/history";
import {
	type AnySerializedScene,
	deserializeScene,
	serializeScene,
} from "#/core/serialization/SceneSerializer";
import {
	AssetImportError,
	type AssetMeta,
	deleteAsset as deleteAssetStore,
	getAssetBlob,
	importAsset,
	listAssets,
	moveAsset as moveAssetStore,
	renameAsset as renameAssetStore,
} from "#/projects/assetStore";
import {
	createFolder as createFolderStore,
	deleteFolder as deleteFolderStore,
	type Folder,
	listFolders,
	moveFolder as moveFolderStore,
	renameFolder as renameFolderStore,
	setFolderColor as setFolderColorStore,
} from "#/projects/folderStore";
import { type Project, saveProjectState } from "#/projects/projectStore";
import { COMPONENT_TYPES } from "../components/componentRegistry";
import { OBJECT_TYPES } from "../components/objectRegistry";
import type { GizmoMode } from "../gizmo";

/** Edit is the authoring view; play runs the game; paused freezes it in place. */
export type PlayState = "edit" | "playing" | "paused";

/**
 * The state the editor shares. `hierarchyVersion` and `historyVersion` are
 * counters we bump so React re-renders when the engine changes behind our back.
 */
interface EditorState {
	scene: Scene;
	selectedObject: GameObject | null;
	setSelectedObject: (obj: GameObject | null) => void;
	hierarchyVersion: number;
	playState: PlayState;
	play: () => void;
	pause: () => void;
	resume: () => void;
	stop: () => void;
	gizmoMode: GizmoMode;
	setGizmoMode: (mode: GizmoMode) => void;
	assets: AssetMeta[];
	/** Imports image files into a folder; resolves to an error message, or null. */
	importAssets: (
		files: File[],
		folderId?: string | null,
	) => Promise<string | null>;
	renameAsset: (id: string, name: string) => Promise<void>;
	deleteAsset: (id: string) => Promise<void>;
	moveAsset: (id: string, folderId: string | null) => Promise<void>;
	folders: Folder[];
	createFolder: (name: string, parentId: string | null) => Promise<Folder>;
	renameFolder: (id: string, name: string) => Promise<void>;
	setFolderColor: (id: string, color: string) => Promise<void>;
	deleteFolder: (id: string) => Promise<void>;
	moveFolder: (id: string, parentId: string | null) => Promise<void>;
	history: SerializedHistory;
	historyVersion: number;
	canUndo: boolean;
	canRedo: boolean;
	commit: (label: string, kind: HistoryActionKind) => void;
	/** Commits after a short pause, coalescing rapid edits into one entry. */
	commitSoon: (label: string, kind: HistoryActionKind) => void;
	undo: () => void;
	redo: () => void;
	jumpTo: (nodeId: string) => void;
}

const EditorContext = createContext<EditorState | null>(null);

const COMMIT_DEBOUNCE_MS = 400;

/**
 * Creates the editor's `Scene` for a project, loads its saved objects and undo
 * tree, and autosaves both back to IndexedDB. The change callback is set during
 * render, before child effects run, so the first spawn already shows up in the
 * hierarchy.
 */
export function EditorProvider({
	children,
	project,
}: {
	children: ReactNode;
	project: Project;
}) {
	const [scene] = useState(() => {
		const created = new Scene();
		created.name = project.name;
		created.mode = "edit";
		return created;
	});
	const [selectedObject, setSelectedObject] = useState<GameObject | null>(null);
	const [hierarchyVersion, setHierarchyVersion] = useState(0);
	const [historyVersion, setHistoryVersion] = useState(0);
	const [playState, setPlayState] = useState<PlayState>("edit");
	const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
	const [assets, setAssets] = useState<AssetMeta[]>([]);
	const [folders, setFolders] = useState<Folder[]>([]);
	const historyRef = useRef<SerializedHistory>({
		rootId: "",
		currentId: "",
		nodes: {},
	});
	const selectedRef = useRef<GameObject | null>(null);
	const pendingCommitRef = useRef<{
		label: string;
		kind: HistoryActionKind;
	} | null>(null);
	const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// True when there is something new to persist, so the autosave can skip idle ticks.
	const dirtyRef = useRef(true);
	// The document as it was when play started, restored on stop.
	const playSnapshotRef = useRef<AnySerializedScene | null>(null);
	// Guard so StrictMode's double effect does not load the scene twice.
	const loadedProjectRef = useRef<string | null>(null);

	scene.onHierarchyChanged = () =>
		setHierarchyVersion((version) => version + 1);

	useEffect(() => {
		selectedRef.current = selectedObject;
	}, [selectedObject]);

	// Resolve asset ids to object URLs, loading bytes on demand. Declared before
	// the scene-load effect so components can resolve as they start.
	useEffect(() => {
		scene.assetResolver = async (assetId: string) => {
			const cached = scene.assets.get(assetId);
			if (cached) return cached;
			const blob = await getAssetBlob(assetId);
			if (!blob) return undefined;
			const url = URL.createObjectURL(blob);
			scene.assets.set(assetId, url);
			return url;
		};
		return () => {
			scene.assetResolver = null;
			scene.assets.clear();
		};
	}, [scene]);

	// Load the project's assets and folders (metadata only, no blobs).
	useEffect(() => {
		let active = true;
		void Promise.all([listAssets(project.id), listFolders(project.id)]).then(
			([assetList, folderList]) => {
				if (!active) return;
				setAssets(assetList);
				setFolders(folderList);
			},
		);
		return () => {
			active = false;
		};
	}, [project.id]);

	// Build the scene and history tree from the saved project once.
	useEffect(() => {
		if (loadedProjectRef.current === project.id) return;
		loadedProjectRef.current = project.id;

		const restored = normalizeHistory(project.history);
		if (restored?.nodes[restored.currentId]) {
			historyRef.current = restored;
			const node = restored.nodes[restored.currentId];
			deserializeScene(scene, node.scene, COMPONENT_TYPES, OBJECT_TYPES);
			setSelectedObject(
				node.selectedId
					? (scene.allObjects.find((o) => o.id === node.selectedId) ?? null)
					: null,
			);
		} else {
			if (project.scene) {
				deserializeScene(scene, project.scene, COMPONENT_TYPES, OBJECT_TYPES);
			}
			const root = makeHistoryNode(
				"Initial",
				"initial",
				serializeScene(scene),
				null,
				null,
			);
			historyRef.current = {
				rootId: root.id,
				currentId: root.id,
				nodes: { [root.id]: root },
			};
		}
		setHistoryVersion((version) => version + 1);
	}, [scene, project.id, project.scene, project.history]);

	const cancelPending = useCallback(() => {
		if (pendingTimerRef.current) {
			clearTimeout(pendingTimerRef.current);
			pendingTimerRef.current = null;
		}
		pendingCommitRef.current = null;
	}, []);

	/** Adds a child of the current node. Nothing is ever discarded. */
	const commit = useCallback(
		(label: string, kind: HistoryActionKind) => {
			if (scene.mode !== "edit") return;
			const history = historyRef.current;
			const parentId = history.currentId;
			const node = makeHistoryNode(
				label,
				kind,
				serializeScene(scene),
				parentId,
				selectedRef.current?.id ?? null,
			);
			history.nodes[node.id] = node;
			const parent = history.nodes[parentId];
			if (parent) {
				parent.children.push(node.id);
				parent.preferredChildId = node.id;
			}
			historyRef.current = pruneHistory({ ...history, currentId: node.id });
			dirtyRef.current = true;
			setHistoryVersion((version) => version + 1);
		},
		[scene],
	);

	const commitSoon = useCallback(
		(label: string, kind: HistoryActionKind) => {
			if (scene.mode !== "edit") return;
			pendingCommitRef.current = { label, kind };
			if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
			pendingTimerRef.current = setTimeout(() => {
				pendingTimerRef.current = null;
				pendingCommitRef.current = null;
				commit(label, kind);
			}, COMMIT_DEBOUNCE_MS);
		},
		[scene, commit],
	);

	/** Runs a queued debounced commit now, so saving never mutates a node. */
	const flushPending = useCallback(() => {
		const pending = pendingCommitRef.current;
		if (!pending) return;
		cancelPending();
		commit(pending.label, pending.kind);
	}, [commit, cancelPending]);

	// Autosave the scene and history, and flush once more on the way out. History
	// nodes are immutable: a pending edit is committed first, never written into
	// the current node. Play mode is not saved.
	useEffect(() => {
		const save = () => {
			if (scene.mode !== "edit") return;
			flushPending();
			if (!dirtyRef.current) return;
			void saveProjectState(
				project.id,
				serializeScene(scene),
				historyRef.current,
			);
			dirtyRef.current = false;
		};

		const interval = setInterval(save, 2000);
		window.addEventListener("beforeunload", save);
		return () => {
			clearInterval(interval);
			window.removeEventListener("beforeunload", save);
			save();
		};
	}, [scene, project.id, flushPending]);

	/** Rebuilds the scene at a node and restores the selection. */
	const restore = useCallback(
		(nodeId: string) => {
			cancelPending();
			const history = historyRef.current;
			const node = history.nodes[nodeId];
			if (!node) return;
			deserializeScene(scene, node.scene, COMPONENT_TYPES, OBJECT_TYPES);
			const parent = node.parentId ? history.nodes[node.parentId] : null;
			if (parent) parent.preferredChildId = nodeId;
			historyRef.current = { ...history, currentId: nodeId };
			setSelectedObject(
				node.selectedId
					? (scene.allObjects.find((o) => o.id === node.selectedId) ?? null)
					: null,
			);
			dirtyRef.current = true;
			setHistoryVersion((version) => version + 1);
		},
		[scene, cancelPending],
	);

	const undo = useCallback(() => {
		const { nodes, currentId } = historyRef.current;
		const parentId = nodes[currentId]?.parentId;
		if (parentId) restore(parentId);
	}, [restore]);

	const redo = useCallback(() => {
		const { nodes, currentId } = historyRef.current;
		const node = nodes[currentId];
		if (!node) return;
		const childId =
			node.preferredChildId ?? node.children[node.children.length - 1];
		if (childId && nodes[childId]) restore(childId);
	}, [restore]);

	const jumpTo = useCallback(
		(nodeId: string) => {
			if (nodeId !== historyRef.current.currentId) restore(nodeId);
		},
		[restore],
	);

	const refreshAssets = useCallback(async () => {
		const [assetList, folderList] = await Promise.all([
			listAssets(project.id),
			listFolders(project.id),
		]);
		setAssets(assetList);
		setFolders(folderList);
	}, [project.id]);

	const importAssets = useCallback(
		async (files: File[], folderId: string | null = null) => {
			try {
				for (const file of files) {
					await importAsset(project.id, file, folderId);
				}
				await refreshAssets();
				return null;
			} catch (error) {
				return error instanceof AssetImportError
					? error.message
					: "Could not import the file.";
			}
		},
		[project.id, refreshAssets],
	);

	const renameAsset = useCallback(
		async (id: string, name: string) => {
			await renameAssetStore(id, name);
			await refreshAssets();
		},
		[refreshAssets],
	);

	const deleteAsset = useCallback(
		async (id: string) => {
			scene.assets.delete(id);
			await deleteAssetStore(id);
			await refreshAssets();
		},
		[scene, refreshAssets],
	);

	const moveAsset = useCallback(
		async (id: string, folderId: string | null) => {
			await moveAssetStore(id, folderId);
			await refreshAssets();
		},
		[refreshAssets],
	);

	const createFolder = useCallback(
		async (name: string, parentId: string | null) => {
			const folder = await createFolderStore(project.id, name, parentId);
			await refreshAssets();
			return folder;
		},
		[project.id, refreshAssets],
	);

	const renameFolder = useCallback(
		async (id: string, name: string) => {
			await renameFolderStore(id, name);
			await refreshAssets();
		},
		[refreshAssets],
	);

	const setFolderColor = useCallback(
		async (id: string, color: string) => {
			await setFolderColorStore(id, color);
			await refreshAssets();
		},
		[refreshAssets],
	);

	const deleteFolder = useCallback(
		async (id: string) => {
			await deleteFolderStore(id);
			await refreshAssets();
		},
		[refreshAssets],
	);

	const moveFolder = useCallback(
		async (id: string, parentId: string | null) => {
			await moveFolderStore(id, parentId);
			await refreshAssets();
		},
		[refreshAssets],
	);

	const play = () => {
		if (scene.mode === "play") return;
		cancelPending();
		playSnapshotRef.current = serializeScene(scene);
		scene.mode = "play";
		scene.paused = false;
		setPlayState("playing");
	};

	const pause = () => {
		if (scene.mode !== "play" || scene.paused) return;
		scene.paused = true;
		setPlayState("paused");
	};

	const resume = () => {
		if (scene.mode !== "play" || !scene.paused) return;
		scene.paused = false;
		setPlayState("playing");
	};

	const stop = () => {
		cancelPending();
		const snapshot = playSnapshotRef.current;
		if (snapshot) {
			deserializeScene(scene, snapshot, COMPONENT_TYPES, OBJECT_TYPES);
		}
		playSnapshotRef.current = null;
		scene.mode = "edit";
		scene.paused = false;
		setSelectedObject(null);
		setPlayState("edit");
	};

	// Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			if (!(event.ctrlKey || event.metaKey)) return;
			const key = event.key.toLowerCase();
			if (key === "z") {
				event.preventDefault();
				if (event.shiftKey) redo();
				else undo();
			} else if (key === "y") {
				event.preventDefault();
				redo();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [undo, redo]);

	const history = historyRef.current;
	const currentNode = history.nodes[history.currentId];

	return (
		<EditorContext.Provider
			value={{
				scene,
				selectedObject,
				setSelectedObject,
				hierarchyVersion,
				playState,
				play,
				pause,
				resume,
				stop,
				gizmoMode,
				setGizmoMode,
				assets,
				importAssets,
				renameAsset,
				deleteAsset,
				moveAsset,
				folders,
				createFolder,
				renameFolder,
				setFolderColor,
				deleteFolder,
				moveFolder,
				history,
				historyVersion,
				canUndo: Boolean(currentNode?.parentId),
				canRedo: (currentNode?.children.length ?? 0) > 0,
				commit,
				commitSoon,
				undo,
				redo,
				jumpTo,
			}}
		>
			{children}
		</EditorContext.Provider>
	);
}

/** Reads the editor context. Throws when used outside an `EditorProvider`. */
export function useEditor(): EditorState {
	const context = useContext(EditorContext);
	if (!context) {
		throw new Error("useEditor must be used within an EditorProvider");
	}
	return context;
}
