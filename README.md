<div align="center">

<img src="./public/logo.svg" width="96" height="96" alt="Voxen logo" />

# Voxen Engine

**A small 2D game engine: a pure TypeScript Canvas core with a React editor on top.**

Built for side-scrollers and platformers that want a real game loop and a level editor in one project, without dragging in a full engine.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-FF4154?logo=reactquery&logoColor=white)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Biome](https://img.shields.io/badge/Biome-2.4-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev/)
[![Bun](https://img.shields.io/badge/Bun-package_manager-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## What is Voxen?

Voxen is a 2D game engine that keeps two things apart on purpose. The core is plain TypeScript and the Canvas 2D API. The editor is React. The core never imports React, and the game loop never runs inside React's render cycle. The editor creates a `Scene`, hands it a canvas, and from then on the scene owns the frame loop.

It is meant for small teams and solo developers who want control over their game loop but do not want to rebuild scene management, object pooling, and input from scratch every time.

One naming note before anything else: this is an **entity-component** design (composition), not ECS. Behavior lives on components that hook straight into lifecycle callbacks. There is no separate system scheduler. See [ADR 0001](./docs/adr/0001-entity-component-architecture.md) for why.

## Status

Voxen is in early development. The engine boots, renders sprites, pools objects, and tracks keyboard input, and the editor lists and edits those objects in docked panels. There is **no automated test suite yet**, and nothing here is a stable public API. Right now, correctness is checked with the type checker, the linter, and running the dev server (see [Getting Started](#getting-started)).

## What works today

Engine side:

- Entity-component style: attach, query, and detach components on any `GameObject`.
- Auto-detected extension points: drop a `Component` subclass in `core/components/` and it appears in the inspector's add search; drop a `GameObject` subclass in `core/objects/` and it appears in the hierarchy's create menu. No registration list to update.
- A `Transform` on every object: `position`, `rotation`, and `scale` as vectors, composed through the parent hierarchy.
- Rendering behind a `Renderer` interface with a Canvas 2D backend, so a WebGL or WebGPU backend can be added later without touching components.
- A dedicated render pass with a `render(renderer)` component hook, separate from `update()`.
- A `Camera` GameObject (pan, zoom, rotation) the scene renders through; a scene with no camera shows a black "No camera active" screen.
- Parent-child hierarchy: objects form a tree, and children inherit their parent's transform (position, rotation, and scale compose down the tree).
- Per-object active (enabled) and visible (hidden) flags, each inherited down the tree.
- Object pooling. Register a prefab once, and spawned instances get recycled instead of allocated every frame.
- Indexed `for` loops in the update path, so the per-frame hot path does not allocate.
- Canvas 2D rendering with a `SpriteRenderer` that supports translation, rotation, and scale, and draws a fallback rectangle while a texture loads.
- Keyboard input through a per-scene `InputManager`, with action bindings and per-frame edge detection.
- DPI-aware viewport that scales the canvas backing store to `devicePixelRatio`, so it stays sharp on high-density screens.

Editor side:

- A projects page (`/projects`) to create, rename, delete, and open projects. Each project stores its scene, game objects, and component values, saved in IndexedDB via `idb`.
- A top menu bar (File, Edit, View, Settings, Help) with move/rotate/scale gizmo tools and play/pause/stop transport controls on the right.
- Edit and play modes: edit runs nothing and draws the scene through its own scene-view camera with a grid; play runs the game through the scene's camera; stop restores the document as it was before play. Play changes are never autosaved.
- A scene view with middle-drag pan, cursor-anchored wheel zoom, and click-to-select picking that highlights the selection; gameplay scripts do not run while editing.
- Move, rotate, and scale gizmos (W/E/R) for the selected object, with constant-size handles, plus a camera icon and a frustum outline showing what each camera sees.
- A docked layout (`flexlayout-react`): hierarchy and scene across the top, a files explorer beneath them, and the inspector full height on the right.
- A hierarchy panel that labels the current scene (`Main`) and shows its objects as a tree: expand and collapse children, drag an object onto another to parent it, and rename or create objects. Each row has an enable checkbox and a visibility (eye) toggle. The + button and "Add Child" build their menu from every GameObject under `core/objects/`, so a new type appears on its own. Right-click an object for a context menu (rename, add child, unparent, duplicate, delete).
- An inspector panel built with Tweakpane that edits the selected object's own fields (such as a camera's zoom), its transform, and each component's fields. It auto-detects the view from the value (number, string, boolean, point, or color as a preview swatch, a native color picker, and four R, G, B, A inputs), formats the field names, and has a search box at the bottom to add a component by pressing Enter or clicking it. Right-click a component title to reset or remove it, the Transform title to reset the transform, or any value to copy or reset it. The editor suppresses the browser's own context menu.
- A `DataTypes` test component, attached to the player, that holds one field of every type the inspector can render.
- A files panel, currently a placeholder for the project's assets.
- One `Scene` owned by the editor and shared with every panel through React context; panels re-render when the engine changes its object list.
- A viewport component that renders the game at a fixed 1920x1080 (16:9) internal resolution, scaled to fit a black dock so the camera view is the same at any window size, boots the loop, and keeps input scoped to the canvas.

## Tech stack

| Layer | Technology |
| --- | --- |
| Core engine | TypeScript, HTML5 Canvas 2D (`CanvasRenderingContext2D`) |
| Editor | [React 19](https://react.dev/), [TanStack Start](https://tanstack.com/start) |
| Editor layout | [flexlayout-react](https://github.com/caplin/FlexLayout) |
| Inspector | [Tweakpane](https://tweakpane.github.io/docs/) |
| Routing | [TanStack Router](https://tanstack.com/router) (file-based) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Build and tooling | [Vite 8](https://vite.dev/), [Nitro](https://v3.nitro.build/), [Bun](https://bun.sh/) |
| Lint and format | [Biome](https://biomejs.dev/) |

## Getting started

### Requirements

- [Bun](https://bun.sh/) 1.x. It is the package manager, dev server, and task runner. Verified on 1.4.
- [Node.js](https://nodejs.org/) 20+ if you want to run the production server. Verified on Node 22.

### Install and run

```bash
bun install
bun run dev
```

The dev server comes up on [http://localhost:3000](http://localhost:3000). The landing page is at `/`, projects are at `/projects`, and the editor runs at `/engine/:id`.

### Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the Vite dev server on port 3000. |
| `bun run build` | Production build into `.output/`. |
| `bun run preview` | Preview the built app. |
| `bun run generate-routes` | Regenerate `src/routeTree.gen.ts`. |
| `bun run check` | Check formatting, lint, and import order. Does not write. |
| `bun run lint` | Run the Biome linter only. |
| `bun run format` | Check formatting. Does not write. |
| `bunx biome check --write .` | Apply formatting, lint fixes, and import order. |
| `bunx tsc --noEmit` | Type-check the whole project. |

Run these two before opening a pull request:

```bash
bun run check
bunx tsc --noEmit
```

### Production

The build emits a self-contained Nitro server:

```bash
bun run build
node .output/server/index.mjs
```

It listens on `PORT`, which defaults to `3000`. Deploy the `.output/` directory to any Node-compatible host, or look at the [Nitro deploy presets](https://v3.nitro.build/deploy). `.output/` is git-ignored.

### Site metadata

Favicons, the web manifest, and the 1200x630 social card live in `public/`. Page metadata is defined in `src/seo.ts` and applied in `src/routes/__root.tsx`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_SITE_URL` | `http://localhost:3000` | Public origin used for canonical and Open Graph URLs. Set it for production, for example `VITE_SITE_URL=https://voxen.example bun run build`. |

## Core concepts

The one rule worth remembering: **`src/core/` stays framework-agnostic.** No React, no framework imports. Browser APIs are fine. More detail is in [docs/architecture.md](./docs/architecture.md).

- **`Scene`** owns the game loop, the prefab registry, the object pool, and the `InputManager`. Set `scene.renderer` before you start the loop, and add a `Camera` object so the scene has something to render through.
- **`GameObject`** is an entity. It owns a `Transform` (`position`, `rotation`, and `scale` as vectors) and a list of components. Assigning `gameObject.scene` pushes the scene reference into every attached component. The `isActive` and `isVisible` flags control whether it updates and draws.
- **`Component`** is a behavior. Subclass it and override `start()`, `update(deltaTime)`, `render(renderer)`, `onEnable()`, or `onDisable()`. Components reach the engine through `this.gameObject` and `this.scene`.
- **Prefabs.** Register a factory with `scene.registerPrefab(name, factory)`, then create instances with `scene.spawn(name, x, y)`. `spawn` reuses an inactive pooled object when one is available.
- **Input.** Bind actions to `KeyboardEvent.code` values, call `scene.input.attach(canvas)`, and read `this.scene.input.isDown("jump")` inside `update()`. The scene calls `input.endFrame()` each tick to clear the one-frame edges.
- **Editor bridge.** The editor owns one `Scene`. Panels read `scene.allObjects` and re-render when `scene.onHierarchyChanged` fires, so the engine stays framework-agnostic and React never polls.

More detail: [docs/architecture.md](./docs/architecture.md) and [docs/input.md](./docs/input.md).

## Quick start

This is the shape of the code in [GameViewport.tsx](./src/editor/components/GameViewport.tsx).

```ts
import { Camera } from "#/core/objects/Camera";
import { Component } from "#/core/Component";
import { PlayerController } from "#/core/components/PlayerController";
import { SpriteRenderer } from "#/core/components/SpriteRenderer";
import { GameObject } from "#/core/GameObject";
import { CanvasRenderer } from "#/core/rendering/CanvasRenderer";
import { Scene } from "#/core/Scene";

const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Canvas not found");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not get a 2D context");

const scene = new Scene();
scene.renderer = new CanvasRenderer(ctx);
scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);

// A scene needs an active camera to render.
scene.add(new Camera("Main Camera"));

// Bind named actions to physical keys.
scene.input.setBindings({
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
});
scene.input.attach(canvas);

// Describe how to build the player.
scene.registerPrefab("Player", () => {
  const player = new GameObject("Player");

  const sprite = player.addComponent(SpriteRenderer);
  sprite.imageUrl = "/assets/player.png";

  player.addComponent(PlayerController);

  return player;
});

// Spawn it and start the loop.
scene.spawn("Player", 400, 300);
scene.startLoop();
```

A custom component can read input and move its object:

```ts
import { Component } from "#/core/Component";

class Dash extends Component {
  private speed = 600;

  public update(deltaTime: number): void {
    // Needs a "dash" binding, for example: scene.input.setBindings({ dash: "Space" }).
    if (this.scene.input.wasPressed("dash")) {
      this.gameObject.transform.position.x += this.speed * deltaTime;
    }
  }
}
```

## Documentation

- [Architecture](./docs/architecture.md): the layers, the frame loop, object pooling, and the core/UI boundary.
- [Input](./docs/input.md): the `InputManager` API, bindings, edge semantics, and focus behavior.
- [ADR 0001: Entity-component over ECS](./docs/adr/0001-entity-component-architecture.md).
- [Contributing](./CONTRIBUTING.md): setup, conventions, and the pull request checklist.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, conventions, and what a pull request needs. The short version:

1. Fork the repo and make a feature branch (`git checkout -b feat/my-feature`).
2. Keep engine code inside `src/core/` framework-agnostic.
3. Run `bun run check` and `bunx tsc --noEmit` before committing.
4. Open a pull request that says what changed, why, and how you verified it.

Found a bug or have an idea? Open an [issue](https://github.com/TariqJandaly/Voxen/issues).

## License

Released under the [MIT License](./LICENSE).

---

<div align="center">
Scaffolded with <a href="https://tanstack.com/start">TanStack Start</a>.
</div>
