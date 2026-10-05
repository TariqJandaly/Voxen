# Contributing to Voxen

Thanks for wanting to help. This page covers how to get set up, the conventions we follow, and what a pull request needs before it can be reviewed.

## Requirements

- [Bun](https://bun.sh/) 1.x for the package manager and dev server.
- [Node.js](https://nodejs.org/) 20+ if you need to run the production server.

## Getting set up

```bash
git clone https://github.com/TariqJandaly/Voxen.git
cd Voxen
bun install
bun run dev
```

The dev server runs on [http://localhost:3000](http://localhost:3000).

## Before you start

If the change is bigger than a small fix, open an issue first. It is easier to agree on an approach before someone writes the code than after. It also helps to skim [docs/architecture.md](./docs/architecture.md) and the decision records in [docs/adr/](./docs/adr/).

## Conventions

### Keep the core separate from the UI

`src/core/` is the engine. It must stay framework-agnostic: no React, no routing, no editor imports. Browser APIs like canvas, images, keyboard events, and `requestAnimationFrame` are fine. React and DOM structure belong in `src/editor/` and `src/routes/`.

This boundary is the whole point of the project. If a core file seems to need React, the logic probably belongs in the editor instead.

### Formatting and style

Formatting, linting, and import order are handled by [Biome](./biome.json). Do not format by hand, just run the fixer. Indentation is tabs and quotes are double.

Beyond that, keep functions small and give names that say what the thing is. Comments should explain why something is done, not restate what the next line already says. Delete commented-out code; version control remembers it.

### The frame loop is a hot path

The engine loop runs every frame, so allocation matters:

- Use object pooling (`registerPrefab`, `spawn`, `destroy`) instead of building entities during play.
- Use indexed `for` loops in per-frame code. `for...of` and array callbacks allocate an iterator or closure each frame.
- Reset per-life state in `onEnable()`. `start()` only runs once per pooled allocation, so do not rely on it for resets.

### Types

The project is strict TypeScript. No `any`, no non-null assertions on values that can legitimately be missing, and no casts that paper over a real error. Public functions get explicit return types.

## Before you call it done

Run both of these and make sure they pass:

```bash
bun run check
bunx tsc --noEmit
```

There is no automated test suite yet. Until there is:

- Verify your change by hand with `bun run dev`, and write the exact steps in the pull request.
- If your change is pure logic, a test is still welcome. `bun test` works without adding a dependency. If you want a test setup wired into the project, say so in the issue or PR.

A few more things we look for:

- No placeholder code, dead code, or leftover debug logging.
- Error paths are handled. No empty catch blocks.
- The diff stays scoped to the change.
- If behavior changed, the docs changed with it (README or `docs/`).

## Commits and branches

Use scoped, conventional commit messages:

```text
feat(input): add mouse button states
fix(scene): clear input edges after update
docs(readme): correct input quick start
```

Keep one logical change per commit, and use focused branch names like `feat/name`, `fix/name`, or `docs/name`.

## Pull requests

A good pull request includes:

1. What changed and why.
2. How you verified it. Commands and observed results, or manual steps.
3. A link to the issue, if there is one.
4. Any risks, follow-ups, or intentional behavior changes.

Keep it small enough to review in one sitting. If a change is large, it is usually a few smaller changes that got merged together.

## Reporting bugs and asking for features

Open an [issue](https://github.com/TariqJandaly/Voxen/issues) with:

- What you expected and what actually happened.
- Steps to reproduce. A snippet or a short recording helps.
- Your environment: OS, browser, and Bun and Node versions.

## License

Voxen is released under the [MIT License](./LICENSE). By contributing, you agree your contributions are licensed under the same terms.
