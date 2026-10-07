import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { getProject, type Project } from "#/projects/projectStore";

export const Route = createFileRoute("/engine/$id")({
	component: EngineRoute,
});

/** Loads the project, then hands off to the editor. Unknown ids go to /projects. */
function EngineRoute() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const [project, setProject] = useState<Project | null>(null);

	useEffect(() => {
		let active = true;
		void getProject(id).then((found) => {
			if (!active) return;
			if (found) setProject(found);
			else void navigate({ to: "/projects", replace: true });
		});
		return () => {
			active = false;
		};
	}, [id, navigate]);

	if (!project) {
		return (
			<div className="flex h-dvh items-center justify-center bg-canvas text-sm text-muted">
				Loading project…
			</div>
		);
	}

	return <Editor project={project} />;
}

/**
 * The editor dock. Builds the layout once and hands each tab to its panel. The
 * editor supplies its own context menus, so the browser's are suppressed.
 */
function Editor({ project }: { project: Project }) {
	const [model] = useState(() => Model.fromJson(defaultLayout));
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = rootRef.current;
		if (!element) return;
		const suppress = (event: Event) => event.preventDefault();
		element.addEventListener("contextmenu", suppress);
		return () => element.removeEventListener("contextmenu", suppress);
	}, []);

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
		<EditorProvider project={project}>
			<div
				ref={rootRef}
				className="absolute inset-0 flex select-none flex-col overflow-hidden"
			>
				<MenuBar />
				<div className="relative min-h-0 flex-1">
					<Layout model={model} factory={factory} />
				</div>
			</div>
		</EditorProvider>
	);
}
