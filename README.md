<div align="center">

# Voxen Engine

**A lightweight, component-driven 2D game engine with a pure TypeScript Canvas core and a modern React-based level editor.**

Bridging reactive web interfaces and high-framerate game loops — built for 2D side-scrollers and platformers.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-FF4154?logo=reactquery&logoColor=white)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Biome](https://img.shields.io/badge/Biome-2.4-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev/)
[![Bun](https://img.shields.io/badge/Bun-package_manager-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## Table of Contents

- [What is Voxen?](#what-is-voxen)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Status & Roadmap](#status--roadmap)
- [Contributing](#contributing)
- [License](#license)

## What is Voxen?

Voxen is a **component-driven 2D game engine** that keeps a strict architectural boundary between developer tooling and the rendering core. It pairs a continuous `requestAnimationFrame` Canvas loop with a reactive editor UI — communicating through a unified event bridge instead of shared mutable state.

The engine uses a **Unity-style Entity-Component (EC) architecture**, favoring composition over inheritance so game logic stays scalable, modular, and reusable.

> **Name check:** this is an *entity–component* design (composition), not ECS (entity–component–system). Behavior lives on components that tap directly into lifecycle hooks — there is no separate system scheduler.

## Architecture

Voxen runs on two cooperating paradigms:

### 1. The Polling Engine (TypeScript + Canvas)

A continuous loop that handles state updates, physics, and rendering. It is fully isolated from React and processes the game world through a rigid hierarchy:

| Layer | Responsibility |
| --- | --- |
| **Scene** | Root container for a level; owns and drives the engine loop across all active entities. |
| **GameObject** | Empty entity container holding a `Transform` (position) and a list of attached components. |
| **Component** | Modular script (e.g. `SpriteRenderer`, `RigidBody`, `PlayerController`) plugged into lifecycle hooks. |

Components hook into the engine through four lifecycle callbacks:

```ts
awake()   // called once when the component is created
start()   // called once before the first update frame
update(dt: number)  // called every frame for logic & physics
render(ctx: CanvasRenderingContext2D) // called every frame to draw
```

Components are queried dynamically, which keeps behavior reusable across any entity:

```ts
const body = gameObject.getComponent(RigidBody);
```

### 2. The Reactive Editor (TanStack Start + React)

A modern, event-driven interface surrounding the canvas. It provides the inspector, asset palettes, and scene hierarchy, and talks to the core engine through an event bridge rather than injecting React state into the game loop.

### The Boundary

```
┌─────────────────────────────┐        event bridge        ┌──────────────────────────────┐
│   Reactive Editor (React)   │  <───────────────────────>  │   Polling Engine (Canvas)    │
│  Scene Graph · Inspector    │   selection / mutations     │  Scene → GameObject → Comp.  │
│  Play/Edit mode toggling    │                             │  update() · render() @ 60fps │
└─────────────────────────────┘                             └──────────────────────────────┘
```

## Features

### Engine

- **Component-Driven Pipeline** — attach, detach, and query components on any `GameObject` for highly reusable game logic.
- **Tilemap Rendering** — efficiently parse 2D numerical arrays and render environments via sprite-sheet cropping (`TilemapRenderer`).
- **Modular Physics & Collision** — AABB collision detection and kinematic solvers split into discrete components (`BoxCollider2D`, `KinematicBody`) instead of monolithic player classes.
- **Dynamic Camera Tracking** — side-scrolling camera with configurable dead-zones for smooth, jitter-free tracking.
- **Decoupled Input Manager** — asynchronous key-state tracking that separates DOM keyboard events from the physics loop.

### Editor UI

- **Scene Graph Hierarchy** — React sidebar showing the current scene and all active GameObjects.
- **Component Inspector** — inspect and mutate selected component properties in real time.
- **Real-time Canvas Mutation** — click-and-drag editing on the live canvas with screen-to-world coordinate translation.
- **Instant Playtesting** — toggle between **Edit Mode** (canvas listens to editor input) and **Play Mode** (engine loop takes over).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Core Engine | Pure TypeScript, HTML5 Canvas (`CanvasRenderingContext2D`) |
| Editor Framework | [TanStack Start](https://tanstack.com/start), [React 19](https://react.dev/) |
| Routing | [TanStack Router](https://tanstack.com/router) (file-based) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Build / Toolchain | [Vite 8](https://vite.dev/), [Nitro](https://v3.nitro.build/), [Bun](https://bun.sh/) |
| Lint / Format | [Biome](https://biomejs.dev/) |
| UI State | _TBD_ (Zustand / Context for React-to-engine event delegation) |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager + runtime used by this project)

### Install & run

```bash
bun install
bun run dev
```

The dev server starts on [http://localhost:3000](http://localhost:3000).

Available scripts:

```bash
bun run dev       # start the dev server (port 3000)
bun run generate-routes  # regenerate TanStack route tree
bun run build     # production build
bun run preview   # preview the production build
bun run format    # format with Biome
bun run lint      # lint with Biome
bun run check     # format + lint + organize imports
```

### Production

This project uses Nitro as a generic server adapter, so it can run on any Node-compatible host. The build emits a self-contained Node server:

```bash
bun run build
node dist/server/index.mjs
```

Deploy the `dist/` directory to your host, or consult the [Nitro deploy presets](https://v3.nitro.build/deploy).

## Project Structure

```
voxen/
├── src/
│   ├── voxen-core/          # Pure TypeScript engine — no React imports allowed here
│   │   └── Engine.ts        # Canvas game loop (rAF) and render context
│   ├── components/
│   │   └── Viewport.tsx     # React component that mounts the canvas & boots the engine
│   ├── routes/
│   │   ├── __root.tsx       # Root layout / document shell
│   │   ├── index.tsx        # Home route — hosts the Viewport
│   │   └── routeTree.gen.ts # Auto-generated by TanStack Router (do not edit)
│   ├── router.tsx           # Router instance
│   └── styles.css           # Tailwind entry
├── biome.json               # Lint/format config
├── vite.config.ts           # Vite + TanStack Start + Nitro + Tailwind
├── tsconfig.json
└── package.json
```

The golden rule: **`src/voxen-core/` stays framework-agnostic.** No React, no DOM-framework imports — just TypeScript and the Canvas API.

## Status & Roadmap

Voxen is under **active early development**. The project is currently at **Phase 0**: the app scaffold, the pure-TypeScript `voxen-core` boundary, and the mounted Canvas viewport all exist — the engine itself is still a bootstrap placeholder that animates a test square.

- [x] **Phase 0 — Boundary:** Scaffold TanStack Start, establish pure TS `voxen-core` directory, mount the Canvas Viewport component.
- [ ] **Phase 1 — Core EC Architecture:** Implement `Scene`, `GameObject`, and `Component` base classes and the lifecycle loop.
- [ ] **Phase 2 — Rendering Components:** `SpriteLoader`, `SpriteRenderer`, and `TilemapRenderer`.
- [ ] **Phase 3 — Scripts & Input:** `InputManager` and script components such as `PlayerController`.
- [ ] **Phase 4 — Physics:** `BoxCollider2D` and `KinematicBody` with gravity and tilemap AABB collision resolution.
- [ ] **Phase 5 — The Editor:** React Scene Graph, Component Inspector, and active tile brushing.

The feature and architecture sections above describe the target MVP; roadmap items are not yet implemented.

## Contributing

Voxen is open source and contributions are welcome.

1. Fork the repository and create a feature branch (`git checkout -b feat/my-feature`).
2. Keep engine code inside `src/voxen-core/` framework-agnostic.
3. Run `bun run check` before committing so formatting and linting stay clean.
4. Open a pull request describing the change and linking any relevant issue.

Found a bug or have an idea? Open an [issue](https://github.com/TariqJandaly/Voxen/issues).

## License

Released under the [MIT License](./LICENSE).

---

<div align="center">
Scaffolded with <a href="https://tanstack.com/start">TanStack Start</a>.
</div>
