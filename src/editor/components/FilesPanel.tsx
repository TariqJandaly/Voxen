/**
 * The files explorer, docked under the hierarchy and scene. It will be the home
 * for project assets once there is an asset pipeline; for now it says there is
 * nothing here.
 */
export function FilesPanel() {
	return (
		<div className="flex h-full flex-col bg-panel text-xs text-content">
			<div className="border-b border-edge bg-header px-2 py-1">Files</div>
			<div className="flex-1 overflow-y-auto p-2 text-muted">
				No project files yet.
			</div>
		</div>
	);
}
