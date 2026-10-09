import type { SerializedScene } from "./SceneSerializer";

/** The category of an edit, used to pick an icon in the history panel. */
export type HistoryActionKind =
	| "initial"
	| "create"
	| "delete"
	| "rename"
	| "move"
	| "rotate"
	| "scale"
	| "visibility"
	| "enable"
	| "reparent"
	| "duplicate"
	| "component"
	| "field";

/**
 * One state the document passed through. Nodes form a tree: a new edit becomes
 * a child of the current node, so going back and editing again branches instead
 * of discarding the old future. Each node stores the whole scene, so jumping to
 * it is a plain deserialize and the tree persists as-is.
 */
export interface HistoryNode {
	id: string;
	parentId: string | null;
	children: string[];
	/** The child that redo follows when a node has more than one. */
	preferredChildId?: string;
	label: string;
	kind: HistoryActionKind;
	at: number;
	scene: SerializedScene;
	selectedId: string | null;
}

/** The tree plus the node the document is currently at. */
export interface SerializedHistory {
	rootId: string;
	currentId: string;
	nodes: Record<string, HistoryNode>;
}

/** The older linear shape, kept only so existing projects can be migrated. */
export interface SerializedHistoryEntry {
	id: string;
	label: string;
	kind: HistoryActionKind;
	at: number;
	scene: SerializedScene;
	selectedId: string | null;
}

/** How many nodes we keep before pruning the oldest branches. */
export const HISTORY_LIMIT = 200;

/** A fresh id for a history node. */
export function newHistoryId(): string {
	return typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: Math.random().toString(36).substring(2, 11);
}

/** A new, childless node. */
export function makeHistoryNode(
	label: string,
	kind: HistoryActionKind,
	scene: SerializedScene,
	parentId: string | null,
	selectedId: string | null,
): HistoryNode {
	return {
		id: newHistoryId(),
		parentId,
		children: [],
		label,
		kind,
		at: Date.now(),
		scene,
		selectedId,
	};
}

/** The nodes from the current node up to the root, inclusive. */
export function historyPath(history: SerializedHistory): Set<string> {
	const path = new Set<string>();
	let id: string | null = history.currentId;
	while (id && history.nodes[id]) {
		path.add(id);
		id = history.nodes[id].parentId;
	}
	return path;
}

/**
 * Drops the oldest branches until the tree fits the limit, keeping the current
 * path intact. If only the current path remains it re-roots to its oldest
 * child, so a long linear history still shrinks.
 */
export function pruneHistory(
	history: SerializedHistory,
	limit = HISTORY_LIMIT,
): SerializedHistory {
	const nodes = history.nodes;
	let rootId = history.rootId;
	const count = () => Object.keys(nodes).length;
	if (count() <= limit) return history;

	while (count() > limit) {
		const protectedIds = historyPath(history);
		const leaves = Object.values(nodes)
			.filter(
				(node) => !protectedIds.has(node.id) && node.children.length === 0,
			)
			.sort((a, b) => a.at - b.at);

		if (leaves.length > 0) {
			const victim = leaves[0];
			const parent = victim.parentId ? nodes[victim.parentId] : null;
			if (parent) {
				parent.children = parent.children.filter((id) => id !== victim.id);
				if (parent.preferredChildId === victim.id) {
					parent.preferredChildId = parent.children[parent.children.length - 1];
				}
			}
			delete nodes[victim.id];
			continue;
		}

		// Everything left is on the current path; drop the oldest and re-root.
		const root = nodes[rootId];
		const childId = root?.preferredChildId ?? root?.children[0];
		if (!root || !childId || !nodes[childId]) break;
		nodes[childId].parentId = null;
		rootId = childId;
		delete nodes[root.id];
	}

	return { rootId, currentId: history.currentId, nodes };
}

/**
 * Accepts the current tree shape or the older linear shape and returns a tree,
 * or null when there is nothing usable.
 */
export function normalizeHistory(raw: unknown): SerializedHistory | null {
	if (!raw || typeof raw !== "object") return null;
	const value = raw as Record<string, unknown>;

	if (value.nodes && value.currentId && value.rootId) {
		return raw as SerializedHistory;
	}

	const entries = value.entries;
	if (Array.isArray(entries) && entries.length > 0) {
		const list = entries as SerializedHistoryEntry[];
		const nodes: Record<string, HistoryNode> = {};
		let parentId: string | null = null;
		for (const entry of list) {
			nodes[entry.id] = {
				id: entry.id,
				parentId,
				children: [],
				label: entry.label,
				kind: entry.kind,
				at: entry.at,
				scene: entry.scene,
				selectedId: entry.selectedId,
			};
			if (parentId) {
				nodes[parentId].children.push(entry.id);
				nodes[parentId].preferredChildId = entry.id;
			}
			parentId = entry.id;
		}
		const index =
			typeof value.index === "number" ? value.index : list.length - 1;
		const currentId = list[Math.max(0, Math.min(index, list.length - 1))].id;
		return { rootId: list[0].id, currentId, nodes };
	}

	return null;
}
