import type { ReactNode } from "react";
import {
	type HistoryActionKind,
	historyPath,
} from "#/core/serialization/history";
import { useEditor } from "../context/EditorContext";

// Indentation per branch level, capped so a deep tree never runs off the panel.
const INDENT = 10;
const MAX_INDENT_LEVELS = 8;

/**
 * The undo history, newest first. Each node is indented by its depth in the
 * tree, the path to the current state is highlighted, and a node with more than
 * one child shows a branch badge. Clicking any node jumps the document to it,
 * so old branches stay reachable.
 */
export function HistoryPanel() {
	const { history, historyVersion, jumpTo } = useEditor();
	// `historyVersion` changes whenever the tree does; read the live object.
	void historyVersion;

	const { nodes, currentId } = history;
	const path = historyPath(history);

	const depthOf = (id: string): number => {
		let depth = 0;
		let parent = nodes[id]?.parentId ?? null;
		while (parent && nodes[parent]) {
			depth++;
			parent = nodes[parent].parentId;
		}
		return depth;
	};

	// Most recent edit at the top.
	const ordered = Object.values(nodes).sort((a, b) => b.at - a.at);

	return (
		<div className="flex h-full min-h-0 flex-col bg-panel text-xs text-content">
			<div className="flex shrink-0 items-center justify-between border-b border-edge bg-header px-2 py-1">
				<span>History</span>
				<span className="text-muted">{ordered.length} states</span>
			</div>

			<ul
				aria-label="Edit history"
				className="min-h-0 flex-1 list-none overflow-x-hidden overflow-y-auto p-1"
			>
				{ordered.map((node) => {
					const isCurrent = node.id === currentId;
					const onPath = path.has(node.id);
					const depth = Math.min(depthOf(node.id), MAX_INDENT_LEVELS);

					return (
						<li key={node.id}>
							<button
								type="button"
								aria-current={isCurrent ? "true" : undefined}
								onClick={() => jumpTo(node.id)}
								title={new Date(node.at).toLocaleTimeString()}
								style={{ paddingLeft: `${8 + depth * INDENT}px` }}
								className={`flex w-full items-center gap-2 py-1 pr-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none ${
									isCurrent
										? "bg-selection text-white"
										: onPath
											? "text-content hover:bg-panel-alt-hover"
											: "text-muted hover:bg-panel-alt-hover"
								}`}
							>
								<HistoryIcon kind={node.kind} />
								<span className="min-w-0 flex-1 truncate">{node.label}</span>
								{node.children.length > 1 && (
									<span
										title={`${node.children.length} branches`}
										className="flex shrink-0 items-center gap-0.5 border border-edge px-1 text-[10px] tabular-nums text-muted"
									>
										<BranchIcon />
										{node.children.length}
									</span>
								)}
								{isCurrent && (
									<span className="shrink-0 text-[10px] uppercase tracking-wide">
										now
									</span>
								)}
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function BranchIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.3"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 2v4a2 2 0 0 0 2 2h4" />
			<path d="M3 10V6a2 2 0 0 1 2-2h4" />
		</svg>
	);
}

function HistoryIcon({ kind }: { kind: HistoryActionKind }) {
	return (
		<svg
			viewBox="0 0 16 16"
			aria-hidden="true"
			className="h-3.5 w-3.5 shrink-0"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.3"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{ICON_PATHS[kind]}
		</svg>
	);
}

const ICON_PATHS: Record<HistoryActionKind, ReactNode> = {
	initial: <circle cx="8" cy="8" r="3.2" />,
	create: <path d="M8 3v10M3 8h10" />,
	delete: <path d="M4 4l8 8M12 4l-8 8" />,
	rename: (
		<path d="M3 12.5l7.5-7.5 1.5 1.5L4.5 14H3zM10 4l1.5-1.5L13 4l-1.5 1.5z" />
	),
	move: (
		<path d="M8 2v12M2 8h12M8 2L6 4M8 2l2 2M8 14l-2-2M8 14l2-2M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2" />
	),
	rotate: <path d="M12.5 6.5A4.5 4.5 0 1 0 13 9M9 3l3 3-3 3" />,
	scale: <path d="M3 13L13 3M13 3H9M13 3v4M3 13h4M3 13V9" />,
	visibility: (
		<>
			<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
			<circle cx="8" cy="8" r="1.8" />
		</>
	),
	enable: <path d="M3 8.5l3 3 7-7" />,
	reparent: <path d="M3 3v8h6M9 11l3-3-3-3M9 11H3" />,
	duplicate: (
		<>
			<rect x="5" y="5" width="8" height="8" />
			<path d="M3 11V3h8" />
		</>
	),
	component: (
		<>
			<rect x="3" y="3" width="10" height="10" />
			<path d="M3 8h10M8 3v10" />
		</>
	),
	field: <path d="M3 5h10M3 8h10M3 11h10M6 3.5v3M10 7.5v3M6 10.5v3" />,
};
