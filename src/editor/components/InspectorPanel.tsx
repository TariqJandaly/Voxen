import { useEffect, useRef, useState } from "react";
import type {
	FolderApi as TweakpaneFolder,
	Pane as TweakpanePane,
} from "tweakpane";
import type { Component } from "#/core/Component";
import {
	cloneFieldValue,
	isRecord,
	reflectFields,
	reflectObjectFields,
	viewFromValue,
} from "../componentFields";
import { useEditor } from "../context/EditorContext";
import {
	ContextMenu,
	type ContextMenuState,
	contextMenuState,
} from "./ContextMenu";
import { COMPONENT_REGISTRY } from "./componentRegistry";

/** Turns a field name into a title like `Number Value`. */
function formatLabel(name: string): string {
	const spaced = name
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim();
	if (!spaced) return name;

	return spaced
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/** Builds the Tweakpane binding params for a field view. */
function bindingParams(name: string, view: string): Record<string, unknown> {
	const params: Record<string, unknown> = { label: formatLabel(name) };
	if (view.startsWith("point")) params.view = view;
	return params;
}

function channelToHex(value: number): string {
	return Math.round(Math.min(255, Math.max(0, value)))
		.toString(16)
		.padStart(2, "0");
}

function rgbToHex(color: Record<string, unknown>): string {
	return `#${channelToHex(Number(color.r))}${channelToHex(Number(color.g))}${channelToHex(Number(color.b))}`;
}

function colorToCss(color: Record<string, unknown>): string {
	const r = Number(color.r);
	const g = Number(color.g);
	const b = Number(color.b);
	const a = typeof color.a === "number" ? color.a / 255 : 1;
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const value = hex.replace("#", "");
	return {
		r: Number.parseInt(value.slice(0, 2), 16),
		g: Number.parseInt(value.slice(2, 4), 16),
		b: Number.parseInt(value.slice(4, 6), 16),
	};
}

/**
 * Builds a Tweakpane panel for whatever is selected: the transform first, then
 * every public field on each component. Values pick their own view (number,
 * string, boolean, point, color) and names get prettied up. Right-click a
 * component to reset or remove it, the Transform header to reset the transform,
 * or any value to copy or reset it. The box at the bottom adds components.
 * Edits go straight to the live objects, and Tweakpane is loaded on demand so it
 * never runs on the server.
 */
export function InspectorPanel() {
	const { selectedObject } = useEditor();
	const containerRef = useRef<HTMLDivElement>(null);
	const [query, setQuery] = useState("");
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	// Bumped when the component list changes so the Tweakpane pane is rebuilt.
	const [revision, setRevision] = useState(0);

	const attached = new Set(
		selectedObject?.getComponents().map((component) => component.constructor),
	);
	const term = query.trim().toLowerCase();
	const matches =
		selectedObject && term
			? COMPONENT_REGISTRY.filter(
					(ComponentClass) =>
						ComponentClass.name.toLowerCase().includes(term) ||
						formatLabel(ComponentClass.name).toLowerCase().includes(term),
				)
			: [];

	const addComponent = (ComponentClass: new () => Component) => {
		if (!selectedObject) return;
		selectedObject.addComponent(ComponentClass);
		setQuery("");
		setRevision((value) => value + 1);
	};

	useEffect(() => {
		// `revision` is only read here to rebuild the pane when components change.
		void revision;
		const container = containerRef.current;
		if (!container || !selectedObject) return;

		let disposed = false;
		let pane: TweakpanePane | null = null;
		let refreshTimer: ReturnType<typeof setInterval> | undefined;
		// Custom controls (color swatches) that need re-syncing with the engine.
		const syncers: Array<() => void> = [];

		const removeComponent = (component: Component) => {
			selectedObject.removeComponent(component);
			setRevision((value) => value + 1);
		};

		const resetComponent = (component: Component) => {
			const ComponentClass =
				component.constructor as unknown as new () => Component;
			selectedObject.removeComponent(component);
			selectedObject.addComponent(ComponentClass);
			setRevision((value) => value + 1);
		};

		const copyValue = (value: unknown) => {
			const text =
				typeof value === "object" && value !== null
					? JSON.stringify(value)
					: String(value);
			void navigator.clipboard?.writeText(text);
		};

		// Reset a field to the value a fresh instance of its owner starts with.
		// Object values are mutated in place so Tweakpane's binding stays valid.
		const resetValue = (target: Record<string, unknown>, key: string) => {
			const fresh = new (
				target.constructor as new () => Record<string, unknown>
			)();
			const fallback = fresh[key];
			const current = target[key];
			if (isRecord(current) && isRecord(fallback)) {
				for (const property of Object.keys(current)) {
					current[property] = cloneFieldValue(fallback[property]);
				}
				return;
			}
			target[key] = cloneFieldValue(fallback);
		};

		// Reset every channel of a color field to a fresh instance's default.
		const resetColorField = (
			component: object,
			name: string,
			color: Record<string, unknown>,
		) => {
			const fresh = new (
				component.constructor as new () => Record<string, unknown>
			)();
			const fallback = fresh[name];
			if (!isRecord(fallback)) return;
			for (const key of ["r", "g", "b", "a"]) {
				if (key in fallback) color[key] = cloneFieldValue(fallback[key]);
			}
		};

		// Right-click a value for copy and reset. Scoped to the value so the
		// component title menu is not triggered.
		const attachValueMenu = (
			element: HTMLElement,
			read: () => unknown,
			reset: () => void,
		) => {
			element.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				event.stopPropagation();
				setContextMenu(
					contextMenuState(event.clientX, event.clientY, [
						{ label: "Copy Value", onSelect: () => copyValue(read()) },
						{ label: "Reset Value", onSelect: reset },
					]),
				);
			});
		};

		const resetTransform = () => {
			const { position, rotation, scale } = selectedObject.transform;
			position.x = 0;
			position.y = 0;
			position.z = 0;
			rotation.x = 0;
			rotation.y = 0;
			rotation.z = 0;
			scale.x = 1;
			scale.y = 1;
			scale.z = 1;
		};

		void import("tweakpane").then(({ Pane }) => {
			if (disposed) return;

			pane = new Pane({ container });

			const transform = pane.addFolder({ title: "Transform" });
			const transformTitle =
				transform.element.querySelector<HTMLElement>(".tp-fldv_t") ??
				transform.element;
			transformTitle.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				event.stopPropagation();
				setContextMenu(
					contextMenuState(event.clientX, event.clientY, [
						{ label: "Reset Transform", onSelect: resetTransform },
					]),
				);
			});

			const transformTarget = selectedObject.transform as unknown as Record<
				string,
				unknown
			>;
			for (const field of ["position", "rotation", "scale"]) {
				const binding = transform.addBinding(transformTarget, field, {
					label: formatLabel(field),
					view: "point3d",
				});
				attachValueMenu(
					binding.element,
					() => transformTarget[field],
					() => resetValue(transformTarget, field),
				);
			}

			// Renders the fields of an object or component into a folder. Used for
			// both the object's own fields (a camera's zoom) and each component.
			const addReflectedFields = (
				folder: TweakpaneFolder,
				owner: object,
				target: Record<string, unknown>,
				fields: string[],
			) => {
				for (const name of fields) {
					const value = target[name];
					const view = viewFromValue(value);
					if (!view) continue;

					// A color is edited as separate R, G, B, and A inputs.
					if (view === "color") {
						const color = value as Record<string, unknown>;
						const colorFolder = folder.addFolder({
							title: formatLabel(name),
							expanded: true,
						});

						// A preview swatch and a native color picker above the channels.
						const control = document.createElement("div");
						control.className = "flex items-center gap-2 px-2 py-1";
						const swatch = document.createElement("span");
						swatch.className = "h-4 w-8 shrink-0 border border-edge";
						const picker = document.createElement("input");
						picker.type = "color";
						picker.className =
							"h-6 min-w-0 flex-1 cursor-pointer border border-edge bg-input";
						picker.setAttribute("aria-label", `Pick ${formatLabel(name)}`);
						control.append(swatch, picker);
						const content =
							colorFolder.element.querySelector(".tp-fldv_c") ??
							colorFolder.element;
						content.prepend(control);

						const syncColor = () => {
							picker.value = rgbToHex(color);
							swatch.style.backgroundColor = colorToCss(color);
						};
						picker.addEventListener("input", () => {
							const rgb = hexToRgb(picker.value);
							color.r = rgb.r;
							color.g = rgb.g;
							color.b = rgb.b;
							syncColor();
						});
						attachValueMenu(
							control,
							() => ({ ...color }),
							() => {
								resetColorField(owner, name, color);
								syncColor();
							},
						);
						syncColor();
						syncers.push(syncColor);

						const channels =
							"a" in color ? ["r", "g", "b", "a"] : ["r", "g", "b"];
						for (const channel of channels) {
							const binding = colorFolder.addBinding(color, channel, {
								label: channel.toUpperCase(),
								min: 0,
								max: 255,
								step: 1,
							});
							attachValueMenu(
								binding.element,
								() => color[channel],
								() => {
									resetValue(color, channel);
									syncColor();
								},
							);
						}
						continue;
					}

					const binding = folder.addBinding(
						target,
						name,
						bindingParams(name, view),
					);
					attachValueMenu(
						binding.element,
						() => target[name],
						() => resetValue(target, name),
					);
				}
			};

			// The object's own fields, such as a camera's zoom.
			const objectFields = reflectObjectFields(selectedObject);
			if (objectFields.length > 0) {
				addReflectedFields(
					pane.addFolder({
						title: formatLabel(selectedObject.constructor.name),
					}),
					selectedObject,
					selectedObject as unknown as Record<string, unknown>,
					objectFields,
				);
			}

			for (const component of selectedObject.getComponents()) {
				const target = component as unknown as Record<string, unknown>;
				const folder = pane.addFolder({
					title: formatLabel(component.constructor.name),
				});

				// Right-click the component title for its actions. Scoped to the
				// title so right-clicking a field (for example to paste) is not
				// hijacked.
				const titleElement =
					folder.element.querySelector<HTMLElement>(".tp-fldv_t") ??
					folder.element;
				titleElement.addEventListener("contextmenu", (event) => {
					event.preventDefault();
					event.stopPropagation();
					setContextMenu(
						contextMenuState(event.clientX, event.clientY, [
							{ label: "Reset", onSelect: () => resetComponent(component) },
							{
								label: "Remove",
								onSelect: () => removeComponent(component),
								danger: true,
							},
						]),
					);
				});

				addReflectedFields(folder, component, target, reflectFields(component));
			}

			// The engine can move objects between frames; re-read values so the
			// inspector does not drift while the scene is running.
			refreshTimer = setInterval(() => {
				pane?.refresh();
				for (const sync of syncers) sync();
			}, 100);
		});

		return () => {
			disposed = true;
			if (refreshTimer) clearInterval(refreshTimer);
			pane?.dispose();
		};
	}, [selectedObject, revision]);

	return (
		<div className="flex h-full flex-col bg-panel text-xs text-content">
			<div className="flex items-center justify-between border-b border-edge bg-header px-2 py-1">
				<span>Inspector</span>
				{selectedObject && (
					<span className="text-muted">{selectedObject.name}</span>
				)}
			</div>
			{selectedObject ? (
				<>
					<div
						ref={containerRef}
						className="voxen-inspector min-h-0 flex-1 overflow-y-auto"
					/>

					{matches.length > 0 && (
						<div className="max-h-40 shrink-0 overflow-y-auto border-t border-edge">
							{matches.map((ComponentClass) => (
								<button
									key={ComponentClass.name}
									type="button"
									onClick={() => addComponent(ComponentClass)}
									className="block w-full px-2 py-1 text-left text-xs text-content transition-colors hover:bg-panel-alt-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none"
								>
									{formatLabel(ComponentClass.name)}
									{attached.has(ComponentClass) && (
										<span className="text-muted"> (added)</span>
									)}
								</button>
							))}
						</div>
					)}

					{term && matches.length === 0 && (
						<div className="shrink-0 border-t border-edge px-2 py-1 text-muted">
							No components match.
						</div>
					)}

					<div className="shrink-0 border-t border-edge p-2">
						<input
							type="text"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && matches[0]) {
									event.preventDefault();
									addComponent(matches[0]);
								}
							}}
							placeholder="Add component…"
							aria-label="Search components to add"
							className="w-full border border-edge bg-input px-2 py-1 text-xs text-content transition-colors placeholder:text-muted hover:border-muted focus-visible:border-focus focus-visible:outline-none motion-reduce:transition-none"
						/>
					</div>
				</>
			) : (
				<div className="flex-1 p-2 text-muted">
					Select an object to inspect it.
				</div>
			)}
			{contextMenu && (
				<ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
			)}
		</div>
	);
}
