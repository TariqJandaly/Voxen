import { useEffect, useRef } from "react";

export interface ContextMenuItem {
	label: string;
	onSelect: () => void;
	/** Draws the label in the danger color. */
	danger?: boolean;
}

export interface ContextMenuState {
	x: number;
	y: number;
	items: ContextMenuItem[];
}

/** Places a menu at the pointer and nudges it back on screen if it would overflow. */
export function contextMenuState(
	clientX: number,
	clientY: number,
	items: ContextMenuItem[],
): ContextMenuState {
	const width = 176;
	const height = items.length * 28 + 8;
	return {
		x: Math.max(0, Math.min(clientX, window.innerWidth - width)),
		y: Math.max(0, Math.min(clientY, window.innerHeight - height)),
		items,
	};
}

/**
 * A small menu pinned where the pointer was. Closes on an outside click, on
 * Escape, or once an item is picked.
 */
export function ContextMenu({
	menu,
	onClose,
}: {
	menu: ContextMenuState;
	onClose: () => void;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handlePointerDown = (event: PointerEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) onClose();
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("pointerdown", handlePointerDown, true);
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown, true);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose]);

	return (
		<div
			ref={ref}
			role="menu"
			style={{ left: menu.x, top: menu.y }}
			className="fixed z-50 min-w-44 border border-edge bg-header py-1 text-xs text-content shadow-lg"
		>
			{menu.items.map((item) => (
				<button
					key={item.label}
					type="button"
					role="menuitem"
					onClick={() => {
						onClose();
						item.onSelect();
					}}
					className={`block w-full px-3 py-1 text-left transition-colors hover:bg-panel-alt-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none ${
						item.danger ? "text-danger" : "text-content"
					}`}
				>
					{item.label}
				</button>
			))}
		</div>
	);
}
