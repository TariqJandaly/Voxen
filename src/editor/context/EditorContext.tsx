import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type { GameObject } from "#/core/GameObject";
import { Scene } from "#/core/Scene";
import {
	deserializeScene,
	serializeScene,
} from "#/core/serialization/SceneSerializer";
import { type Project, saveProjectScene } from "#/projects/projectStore";
import { COMPONENT_TYPES } from "../components/componentRegistry";

/**
 * The state the editor shares. `hierarchyVersion` is just a counter we bump so
 * React re-renders when the engine changes its object list behind our back.
 */
interface EditorState {
	scene: Scene;
	selectedObject: GameObject | null;
	setSelectedObject: (obj: GameObject | null) => void;
	hierarchyVersion: number;
}

const EditorContext = createContext<EditorState | null>(null);

/**
 * Creates the editor's `Scene` for a project, loads its saved objects, and
 * autosaves back to IndexedDB. The change callback is set during render, before
 * child effects run, so the first spawn already shows up in the hierarchy.
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
		return created;
	});
	const [selectedObject, setSelectedObject] = useState<GameObject | null>(null);
	const [hierarchyVersion, setHierarchyVersion] = useState(0);
	// Guard so StrictMode's double effect does not load the scene twice.
	const loadedProjectRef = useRef<string | null>(null);

	scene.onHierarchyChanged = () =>
		setHierarchyVersion((version) => version + 1);

	// Build the scene from the saved project once.
	useEffect(() => {
		if (loadedProjectRef.current === project.id) return;
		loadedProjectRef.current = project.id;
		if (project.scene) deserializeScene(scene, project.scene, COMPONENT_TYPES);
	}, [scene, project.id, project.scene]);

	// Autosave the scene, and flush once more on the way out.
	useEffect(() => {
		const save = () => {
			void saveProjectScene(project.id, serializeScene(scene));
		};

		const interval = setInterval(save, 2000);
		window.addEventListener("beforeunload", save);
		return () => {
			clearInterval(interval);
			window.removeEventListener("beforeunload", save);
			save();
		};
	}, [scene, project.id]);

	return (
		<EditorContext.Provider
			value={{ scene, selectedObject, setSelectedObject, hierarchyVersion }}
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
