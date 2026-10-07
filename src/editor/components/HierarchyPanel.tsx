import { type DragEvent, type MouseEvent, useState } from "react";
import type { Component } from "#/core/Component";
import { GameObject } from "#/core/GameObject";
import { copyFields } from "../componentFields";
import { useEditor } from "../context/EditorContext";
import {
	ContextMenu,
	type ContextMenuItem,
	type ContextMenuState,
	contextMenuState,
} from "./ContextMenu";

/**
 * The scene as a tree. Click to select, double-click to rename, drag a row onto
 * another to parent it, and right-click for actions. The + button adds a root
 * object.
 */
export function HierarchyPanel() {
	const { scene, selectedObject, setSelectedObject, hierarchyVersion } =
		useEditor();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [dropTargetId, setDropTargetId] = useState<string | null>(null);

	const findObject = (id: string): GameObject | null =>
		scene.allObjects.find((object) => object.id === id) ?? null;

	const handleRenameSubmit = (object: GameObject, newName: string) => {
		if (newName.trim()) object.name = newName;
		setEditingId(null);
		// The name lives on the object, so nudge React to show the new value.
		scene.onHierarchyChanged();
	};

	const deleteObject = (object: GameObject) => {
		if (selectedObject === object) setSelectedObject(null);
		scene.destroy(object);
	};

	const createEmpty = (parent: GameObject | null) => {
		const object = new GameObject(`Entity_${scene.allObjects.length}`);
		// An object only ticks and draws once enabled, so wire and enable it
		// before it appears in the list.
		object.scene = scene;
		if (parent) object.setParent(parent, false);
		scene.allObjects.push(object);
		object.enable();
		if (parent) {
			setCollapsed((previous) => {
				const next = new Set(previous);
				next.delete(parent.id);
				return next;
			});
		}
		scene.onHierarchyChanged();
		setSelectedObject(object);
	};

	const duplicateObject = (source: GameObject) => {
		const copy = new GameObject(`${source.name} copy`);
		copyFields(source.transform, copy.transform);
		copy.scene = scene;
		if (source.parent) copy.setParent(source.parent, false);

		for (const component of source.getComponents()) {
			const ComponentClass =
				component.constructor as unknown as new () => Component;
			copyFields(component, copy.addComponent(ComponentClass));
		}

		scene.allObjects.push(copy);
		copy.enable();
		scene.onHierarchyChanged();
		setSelectedObject(copy);
	};

	const toggleCollapsed = (id: string) => {
		setCollapsed((previous) => {
			const next = new Set(previous);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const isValidDrop = (dragged: GameObject, target: GameObject): boolean =>
		dragged !== target && !dragged.isAncestorOf(target);

	const clearDrag = () => {
		setDraggingId(null);
		setDropTargetId(null);
	};

	const handleDrop = (target: GameObject | null) => {
		const dragged = draggingId ? findObject(draggingId) : null;
		if (dragged && (!target || isValidDrop(dragged, target))) {
			dragged.setParent(target, true);
			if (target) {
				setCollapsed((previous) => {
					const next = new Set(previous);
					next.delete(target.id);
					return next;
				});
			}
			scene.onHierarchyChanged();
		}
		clearDrag();
	};

	const handleDragOver = (event: DragEvent, target: GameObject) => {
		const dragged = draggingId ? findObject(draggingId) : null;
		if (!dragged || !isValidDrop(dragged, target)) return;
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = "move";
		setDropTargetId(target.id);
	};

	const handleDelete = (event: MouseEvent, object: GameObject) => {
		event.stopPropagation();
		deleteObject(object);
	};

	// Build the visible rows: active roots and their active descendants.
	const active = scene.allObjects.filter((object) => object.isActive);
	const activeSet = new Set(active);
	const rows: { object: GameObject; depth: number }[] = [];
	const visit = (object: GameObject, depth: number) => {
		rows.push({ object, depth });
		if (collapsed.has(object.id)) return;
		for (const child of object.getChildren()) {
			if (activeSet.has(child)) visit(child, depth + 1);
		}
	};
	for (const object of active) {
		if (!object.parent || !activeSet.has(object.parent)) visit(object, 0);
	}

	return (
		<div className="flex h-full flex-col bg-panel text-xs text-content">
			{/* The project has one scene; show which one the hierarchy belongs to. */}
			<div className="border-b border-edge bg-panel-alt px-2 py-1 text-content-strong">
				<span className="text-muted">Scene: </span>
				<span>{scene.name}</span>
			</div>

			<div className="flex items-center justify-between border-b border-edge bg-header px-2 py-1">
				<span>Hierarchy</span>
				<button
					type="button"
					onClick={() => createEmpty(null)}
					aria-label="Create object"
					className="cursor-pointer border-0 bg-transparent px-1 text-base leading-3 text-content hover:text-white"
				>
					+
				</button>
			</div>

			<div
				role="tree"
				aria-label="Scene hierarchy"
				data-version={hierarchyVersion}
				onDragOver={(event) => {
					if (draggingId) event.preventDefault();
				}}
				onDrop={(event) => {
					event.preventDefault();
					handleDrop(null);
				}}
				className="flex-1 overflow-y-auto p-1"
			>
				{rows.map(({ object, depth }) => {
					const hasChildren = object.getChildren().length > 0;
					const expanded = !collapsed.has(object.id);
					const selected = selectedObject === object;

					return (
						<div
							key={object.id}
							role="treeitem"
							tabIndex={-1}
							aria-selected={selected}
							aria-expanded={hasChildren ? expanded : undefined}
							draggable
							onDragStart={(event) => {
								event.dataTransfer.setData("text/plain", object.id);
								event.dataTransfer.effectAllowed = "move";
								setDraggingId(object.id);
							}}
							onDragOver={(event) => handleDragOver(event, object)}
							onDrop={(event) => {
								event.preventDefault();
								event.stopPropagation();
								handleDrop(object);
							}}
							onDragEnd={clearDrag}
							onContextMenu={(event) => {
								event.preventDefault();
								setSelectedObject(object);
								const items: ContextMenuItem[] = [
									{ label: "Rename", onSelect: () => setEditingId(object.id) },
									{ label: "Add Child", onSelect: () => createEmpty(object) },
								];
								if (object.parent) {
									items.push({
										label: "Unparent",
										onSelect: () => {
											object.setParent(null, true);
											scene.onHierarchyChanged();
										},
									});
								}
								items.push(
									{
										label: "Duplicate",
										onSelect: () => duplicateObject(object),
									},
									{
										label: "Delete",
										onSelect: () => deleteObject(object),
										danger: true,
									},
								);
								setContextMenu(
									contextMenuState(event.clientX, event.clientY, items),
								);
							}}
							style={{ paddingLeft: `${6 + depth * 12}px` }}
							className={`group flex items-center gap-1 py-1 pr-1 ${
								dropTargetId === object.id ? "ring-1 ring-focus" : ""
							} ${
								selected
									? "bg-selection text-white"
									: "text-content hover:bg-panel-alt-hover"
							}`}
						>
							{hasChildren ? (
								<button
									type="button"
									onClick={() => toggleCollapsed(object.id)}
									aria-label={expanded ? "Collapse" : "Expand"}
									className="flex h-4 w-4 shrink-0 items-center justify-center text-muted hover:text-content"
								>
									<svg
										viewBox="0 0 12 12"
										aria-hidden="true"
										className={`h-3 w-3 transition-transform motion-reduce:transition-none ${
											expanded ? "rotate-90" : ""
										}`}
									>
										<path
											d="M4 2l4 4-4 4"
											fill="none"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</button>
							) : (
								<span className="h-4 w-4 shrink-0" aria-hidden="true" />
							)}

							{editingId === object.id ? (
								<input
									ref={(element) => element?.focus()}
									defaultValue={object.name}
									onBlur={(event) =>
										handleRenameSubmit(object, event.target.value)
									}
									onKeyDown={(event) =>
										event.key === "Enter" &&
										handleRenameSubmit(object, event.currentTarget.value)
									}
									className="min-w-0 flex-1 border border-focus bg-input px-1 text-xs text-white outline-none"
								/>
							) : (
								<button
									type="button"
									onClick={() => setSelectedObject(object)}
									onDoubleClick={() => setEditingId(object.id)}
									className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-xs"
								>
									{object.name}
								</button>
							)}

							{editingId !== object.id && (
								<button
									type="button"
									onClick={(event) => handleDelete(event, object)}
									aria-label={`Delete ${object.name}`}
									className={`shrink-0 cursor-pointer border-0 bg-transparent px-1 text-danger transition-opacity motion-reduce:transition-none ${
										selected
											? "opacity-100"
											: "opacity-0 group-hover:opacity-100"
									}`}
								>
									x
								</button>
							)}
						</div>
					);
				})}
			</div>

			{contextMenu && (
				<ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
			)}
		</div>
	);
}
