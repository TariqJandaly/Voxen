import type { IJsonModel } from "flexlayout-react";

/**
 * The dock layout the editor opens with. The left side is a vertical split:
 * hierarchy and scene across the top, files underneath. The inspector runs the
 * full height on the right. A nested row flips orientation, which is how that
 * vertical split works. Tab `component` names are wired to panels in the engine
 * route.
 */
export const defaultLayout: IJsonModel = {
	global: {
		tabEnableClose: false,
		tabEnableRename: false,
		tabSetEnableMaximize: true,
	},
	layout: {
		type: "row",
		weight: 100,
		children: [
			{
				// Vertical: hierarchy and scene above, files below.
				type: "row",
				weight: 80,
				children: [
					{
						// Horizontal again, so the top two panels sit side by side.
						type: "row",
						weight: 70,
						children: [
							{
								type: "tabset",
								weight: 25,
								children: [
									{
										type: "tab",
										name: "Hierarchy",
										component: "hierarchy",
									},
								],
							},
							{
								type: "tabset",
								weight: 75,
								children: [
									{
										type: "tab",
										name: "Scene",
										component: "scene",
									},
								],
							},
						],
					},
					{
						type: "tabset",
						weight: 30,
						children: [
							{
								type: "tab",
								name: "Files",
								component: "files",
							},
						],
					},
				],
			},
			{
				type: "tabset",
				weight: 20,
				children: [
					{
						type: "tab",
						name: "Inspector",
						component: "inspector",
					},
				],
			},
		],
	},
};
