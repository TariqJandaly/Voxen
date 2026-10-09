import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEditor } from "../context/EditorContext";
import type { GizmoMode } from "../gizmo";

/**
 * The top menu bar. The labels are placeholders for now; the gizmo tools and
 * transport controls on the right drive the editor and the play state machine.
 */
const MENUS = ["File", "Edit", "View", "Settings", "Help"];

const GIZMO_TOOLS: ReadonlyArray<{
	mode: GizmoMode;
	label: string;
	shortcut: string;
	icon: ReactNode;
}> = [
	{ mode: "translate", label: "Move", shortcut: "W", icon: <MoveIcon /> },
	{ mode: "rotate", label: "Rotate", shortcut: "E", icon: <RotateIcon /> },
	{ mode: "scale", label: "Scale", shortcut: "R", icon: <ScaleIcon /> },
];

export function MenuBar() {
	const {
		playState,
		play,
		pause,
		resume,
		stop,
		gizmoMode,
		setGizmoMode,
		canUndo,
		canRedo,
		undo,
		redo,
	} = useEditor();
	const playing = playState !== "edit";

	return (
		<div className="flex h-7 items-center gap-1 border-b border-edge bg-header px-2 text-xs text-content">
			<Link
				to="/projects"
				className="mr-2 px-2 py-1 text-xs font-semibold text-content transition-colors hover:bg-panel-alt-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
			>
				Voxen
			</Link>
			{MENUS.map((label) => (
				<button
					key={label}
					type="button"
					className="cursor-default border-0 bg-transparent px-2 py-1 text-xs text-content transition-colors hover:bg-panel-alt-hover motion-reduce:transition-none"
				>
					{label}
				</button>
			))}

			<div className="ml-auto flex items-center gap-0.5">
				{!playing && (
					<div className="mr-2 flex items-center gap-0.5">
						<TransportButton
							label="Undo (Ctrl+Z)"
							onClick={undo}
							disabled={!canUndo}
						>
							<UndoIcon />
						</TransportButton>
						<TransportButton
							label="Redo (Ctrl+Shift+Z)"
							onClick={redo}
							disabled={!canRedo}
						>
							<RedoIcon />
						</TransportButton>
					</div>
				)}

				{!playing && (
					<div className="mr-2 flex items-center gap-0.5">
						{GIZMO_TOOLS.map((tool) => (
							<button
								key={tool.mode}
								type="button"
								onClick={() => setGizmoMode(tool.mode)}
								aria-label={`${tool.label} (${tool.shortcut})`}
								aria-pressed={gizmoMode === tool.mode}
								title={`${tool.label} (${tool.shortcut})`}
								className={`flex h-5 w-6 cursor-pointer items-center justify-center border-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none ${
									gizmoMode === tool.mode
										? "bg-selection text-white"
										: "bg-transparent text-content hover:bg-panel-alt-hover"
								}`}
							>
								{tool.icon}
							</button>
						))}
					</div>
				)}

				{!playing && (
					<TransportButton label="Play" onClick={play}>
						<PlayIcon />
					</TransportButton>
				)}
				{playState === "playing" && (
					<TransportButton label="Pause" onClick={pause}>
						<PauseIcon />
					</TransportButton>
				)}
				{playState === "paused" && (
					<TransportButton label="Resume" onClick={resume}>
						<PlayIcon />
					</TransportButton>
				)}
				{playing && (
					<TransportButton label="Stop" onClick={stop}>
						<StopIcon />
					</TransportButton>
				)}
			</div>
		</div>
	);
}

function TransportButton({
	label,
	onClick,
	children,
	disabled,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			className={`flex h-5 w-6 items-center justify-center border-0 bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none ${
				disabled
					? "cursor-default text-muted opacity-50"
					: "cursor-pointer text-content hover:bg-panel-alt-hover"
			}`}
		>
			{children}
		</button>
	);
}

function PlayIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3 fill-current"
		>
			<path d="M3 1.5l7 4.5-7 4.5z" />
		</svg>
	);
}

function PauseIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3 fill-current"
		>
			<rect x="2.5" y="1.5" width="2.5" height="9" />
			<rect x="7" y="1.5" width="2.5" height="9" />
		</svg>
	);
}

function StopIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3 fill-current"
		>
			<rect x="2.5" y="2.5" width="7" height="7" />
		</svg>
	);
}

function MoveIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.1"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M6 1.5v9M1.5 6h9" />
			<path d="M4.6 2.9L6 1.5l1.4 1.4M4.6 9.1L6 10.5l1.4-1.4M2.9 4.6L1.5 6l1.4 1.4M9.1 4.6L10.5 6 9.1 7.4" />
		</svg>
	);
}

function RotateIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.1"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M9.9 4.3A3.6 3.6 0 1 0 10.3 7" />
			<path d="M7.4 1.7l2.5 2.4-2.5 2.4" />
		</svg>
	);
}

function ScaleIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.1"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M2.5 9.5L9.5 2.5" />
			<path d="M9.5 2.5H6.3M9.5 2.5v3.2M2.5 9.5h3.2M2.5 9.5V6.3" />
		</svg>
	);
}

function UndoIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3.5 4.5H7.5a2.5 2.5 0 0 1 0 5H5" />
			<path d="M5.5 2.5L3.5 4.5l2 2" />
		</svg>
	);
}

function RedoIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			aria-hidden="true"
			className="h-3 w-3"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M8.5 4.5H4.5a2.5 2.5 0 0 0 0 5H7" />
			<path d="M6.5 2.5l2 2-2 2" />
		</svg>
	);
}
