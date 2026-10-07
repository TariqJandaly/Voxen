import { Link } from "@tanstack/react-router";

/**
 * The top menu bar. The labels are placeholders for now; there are no dropdowns
 * or actions behind them yet.
 */
const MENUS = ["File", "Edit", "View", "Settings", "Help"];

export function MenuBar() {
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
		</div>
	);
}
