import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	createProject,
	deleteProject,
	listProjects,
	type Project,
	renameProject,
} from "#/projects/projectStore";

export const Route = createFileRoute("/projects")({
	component: ProjectsPage,
});

const linkFocus =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none";

const fieldClass =
	"border border-edge bg-input px-3 py-2 text-sm text-content placeholder:text-muted focus-visible:border-focus focus-visible:outline-none";

const primaryClass = `bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover ${linkFocus}`;
const secondaryClass = `border border-edge bg-panel px-4 py-2 text-sm text-content transition-colors hover:bg-panel-alt ${linkFocus}`;

const dateFormat = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

function ProjectsPage() {
	const navigate = useNavigate();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [projects, setProjects] = useState<Project[] | null>(null);
	const [newName, setNewName] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);

	const refresh = () => {
		void listProjects().then(setProjects);
	};

	useEffect(() => {
		let active = true;
		void listProjects().then((loaded) => {
			if (active) setProjects(loaded);
		});
		return () => {
			active = false;
		};
	}, []);

	const openCreate = () => {
		setNewName("");
		dialogRef.current?.showModal();
	};

	const handleCreate = async () => {
		const project = await createProject(newName);
		dialogRef.current?.close();
		await navigate({ to: "/engine/$id", params: { id: project.id } });
	};

	const handleRename = async (project: Project, name: string) => {
		setEditingId(null);
		await renameProject(project.id, name);
		refresh();
	};

	const handleDelete = async (project: Project) => {
		if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
			return;
		}
		await deleteProject(project.id);
		refresh();
	};

	return (
		<div className="flex min-h-dvh flex-col bg-canvas text-content">
			<header className="border-b border-edge bg-header px-6 py-4">
				<div className="mx-auto flex w-full max-w-5xl items-center justify-between">
					<Link to="/" className={`flex items-center gap-2 ${linkFocus}`}>
						<img src="/logo.svg" width="24" height="24" alt="" />
						<span className="text-sm font-semibold">Voxen</span>
					</Link>
					<nav className="flex items-center gap-4">
						<Link
							to="/"
							className={`text-sm text-muted transition-colors hover:text-content ${linkFocus}`}
						>
							Home
						</Link>
					</nav>
				</div>
			</header>

			<main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
				<div className="flex items-center justify-between gap-4">
					<h1 className="text-2xl font-semibold">Projects</h1>
					<button type="button" onClick={openCreate} className={primaryClass}>
						New Project
					</button>
				</div>

				{projects === null ? (
					<p className="mt-8 text-sm text-muted">Loading projects…</p>
				) : projects.length === 0 ? (
					<p className="mt-8 text-sm text-muted">
						No projects yet. Create one to start building.
					</p>
				) : (
					<ul className="mt-8 divide-y divide-edge border border-edge">
						{projects.map((project) => (
							<li
								key={project.id}
								className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-panel motion-reduce:transition-none"
							>
								{editingId === project.id ? (
									<input
										ref={(element) => element?.focus()}
										defaultValue={project.name}
										aria-label={`Rename ${project.name}`}
										onBlur={(event) =>
											handleRename(project, event.target.value)
										}
										onKeyDown={(event) => {
											if (event.key === "Enter") {
												handleRename(project, event.currentTarget.value);
											} else if (event.key === "Escape") {
												setEditingId(null);
											}
										}}
										className={`min-w-0 flex-1 ${fieldClass}`}
									/>
								) : (
									<button
										type="button"
										onClick={() =>
											navigate({
												to: "/engine/$id",
												params: { id: project.id },
											})
										}
										className={`min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left ${linkFocus}`}
									>
										<span className="block truncate text-sm font-medium">
											{project.name}
										</span>
										<span className="block text-xs text-muted">
											Updated {dateFormat.format(project.updatedAt)}
										</span>
									</button>
								)}

								<div className="flex shrink-0 items-center gap-2">
									<button
										type="button"
										onClick={() => setEditingId(project.id)}
										className={secondaryClass}
									>
										Rename
									</button>
									<button
										type="button"
										onClick={() => handleDelete(project)}
										className={`border border-edge bg-panel px-4 py-2 text-sm text-danger transition-colors hover:bg-panel-alt ${linkFocus}`}
									>
										Delete
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</main>

			<dialog
				ref={dialogRef}
				aria-label="New project"
				className="m-auto w-full max-w-md border border-edge bg-panel p-0 text-content"
			>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void handleCreate();
					}}
					className="flex flex-col gap-4 p-6"
				>
					<h2 className="text-lg font-semibold">New Project</h2>
					<label className="flex flex-col gap-1 text-sm">
						<span className="text-muted">Name</span>
						<input
							type="text"
							value={newName}
							onChange={(event) => setNewName(event.target.value)}
							placeholder="My game…"
							className={fieldClass}
						/>
					</label>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => dialogRef.current?.close()}
							className={secondaryClass}
						>
							Cancel
						</button>
						<button type="submit" className={primaryClass}>
							Create Project
						</button>
					</div>
				</form>
			</dialog>
		</div>
	);
}
