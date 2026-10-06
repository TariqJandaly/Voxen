import { createFileRoute } from "@tanstack/react-router";
import { Layout, Model, type TabNode } from "flexlayout-react";
import "flexlayout-react/style/dark.css";
import { useEffect, useRef, useState } from "react";
import { FilesPanel } from "#/editor/components/FilesPanel";
import { GameViewport } from "#/editor/components/GameViewport";
import { HierarchyPanel } from "#/editor/components/HierarchyPanel";
import { InspectorPanel } from "#/editor/components/InspectorPanel";
import { defaultLayout } from "#/editor/components/LayoutModel";
import { MenuBar } from "#/editor/components/MenuBar";
import { EditorProvider } from "#/editor/context/EditorContext";

/**
 * The `/engine` route. Builds the dock layout once and hands each tab to its
 * panel.
 */
function Engine() {
	// Build the model a single time; recreating it would reset the dock layout.
	const [model] = useState(() => Model.fromJson(defaultLayout));
	const rootRef = useRef<HTMLDivElement>(null);

	// The editor supplies its own context menus, so suppress the browser's.
	useEffect(() => {
		const element = rootRef.current;
		if (!element) return;
		const suppress = (event: Event) => event.preventDefault();
		element.addEventListener("contextmenu", suppress);
		return () => element.removeEventListener("contextmenu", suppress);
	}, []);

	// flexlayout calls this for every tab and expects a React node per component.
	const factory = (node: TabNode) => {
		switch (node.getComponent()) {
			case "scene":
				return <GameViewport />;
			case "hierarchy":
				return <HierarchyPanel />;
			case "files":
				return <FilesPanel />;
			case "inspector":
				return <InspectorPanel />;
			default:
				return <div>Unknown Panel</div>;
		}
	};

	return (
		<EditorProvider>
			<div
				ref={rootRef}
				className="absolute inset-0 flex select-none flex-col overflow-hidden"
			>
				<MenuBar />
				{/* Positioned so flexlayout's absolute root stays below the menu bar. */}
				<div className="relative min-h-0 flex-1">
					<Layout model={model} factory={factory} />
				</div>
			</div>
		</EditorProvider>
	);
}

export const Route = createFileRoute("/engine")({
	component: Engine,
});
