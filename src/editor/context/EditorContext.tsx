import { createContext, type ReactNode, useContext, useState } from "react";
import type { GameObject } from "#/core/GameObject";
import { Scene } from "#/core/Scene";

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
 * Creates the editor's `Scene` and lets React know when the engine changes it.
 * The callback is set during render, before child effects run, so the viewport's
 * very first spawn already shows up in the hierarchy.
 */
export function EditorProvider({ children }: { children: ReactNode }) {
	const [scene] = useState(() => new Scene());
	const [selectedObject, setSelectedObject] = useState<GameObject | null>(null);
	const [hierarchyVersion, setHierarchyVersion] = useState(0);

	scene.onHierarchyChanged = () =>
		setHierarchyVersion((version) => version + 1);

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
