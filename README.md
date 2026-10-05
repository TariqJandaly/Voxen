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

Voxen is in early development. The engine boots, renders sprites, pools objects, and tracks keyboard input end to end. There is **no automated test suite yet**, and nothing here is a stable public API. Right now, correctness is checked with the type checker, the linter, and running the dev server (see [Getting Started](#getting-started)).

## What works today

Engine side:

- Entity-component style: attach, query, and detach components on any `GameObject`.
- Object pooling. Register a prefab once, and spawned instances get recycled instead of allocated every frame.
- Indexed `for` loops in the update path, so the per-frame hot path does not allocate.
- Canvas 2D rendering with a `SpriteRenderer` that supports translation, rotation, and scale, and draws a fallback rectangle while a texture loads.
- Keyboard input through a per-scene `InputManager`, with action bindings and per-frame edge detection.
- DPI-aware viewport that scales the canvas backing store to `devicePixelRatio`, so it stays sharp on high-density screens.

Editor side:

- A React component that mounts the canvas, boots the engine, and handles window resize.
- Keyboard listeners attach to the canvas, so typing in editor panels (once those exist) will not drive the game.

## Tech stack

| Layer | Technology |
| --- | --- |
| Core engine | TypeScript, HTML5 Canvas 2D (`CanvasRenderingContext2D`) |
| Editor | [React 19](https://react.dev/), [TanStack Start](https://tanstack.com/start) |
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

The dev server comes up on [http://localhost:3000](http://localhost:3000).

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

## Project layout

```text
public/                     Favicons, web manifest, and the social card
src/
  core/                     The engine. No React in here.
    Component.ts            Base class and lifecycle hooks
    GameObject.ts           Entity: transform, components, scene link
    Scene.ts                Game loop, prefab registry, object pool, input
    components/
      PlayerController.ts
      SpriteRenderer.ts
    inputs/
      InputManager.ts
  editor/
    components/
      GameViewport.tsx      Mounts the canvas and boots the engine
  routes/
    __root.tsx              Document shell and page metadata
    index.tsx               Home route
  router.tsx
  routeTree.gen.ts          Generated. Do not edit.
  seo.ts                    Site title, description, and social URLs
  styles.css
```

The one rule worth remembering: **`src/core/` stays framework-agnostic.** No React, no framework imports. Browser APIs are fine. More detail is in [docs/architecture.md](./docs/architecture.md).

## Core concepts

- **`Scene`** owns the game loop, the prefab registry, the object pool, and the `InputManager`. Set `scene.ctx` before you start the loop.
- **`GameObject`** is an entity. It holds a transform (`x`, `y`, `rotation`, `scaleX`, `scaleY`) and a list of components. Assigning `gameObject.scene` pushes the scene reference into every attached component.
- **`Component`** is a behavior. Subclass it and override `start()`, `update(deltaTime)`, `onEnable()`, or `onDisable()`. Components reach the engine through `this.gameObject` and `this.scene`.
- **Prefabs.** Register a factory with `scene.registerPrefab(name, factory)`, then create instances with `scene.spawn(name, x, y)`. `spawn` reuses an inactive pooled object when one is available.
- **Input.** Bind actions to `KeyboardEvent.code` values, call `scene.input.attach(canvas)`, and read `this.scene.input.isDown("jump")` inside `update()`. The scene calls `input.endFrame()` each tick to clear the one-frame edges.

More detail: [docs/architecture.md](./docs/architecture.md) and [docs/input.md](./docs/input.md).

## Quick start

This is the shape of the code in [GameViewport.tsx](./src/editor/components/GameViewport.tsx).

```ts
import { Component } from "#/core/Component";
import { PlayerController } from "#/core/components/PlayerController";
import { SpriteRenderer } from "#/core/components/SpriteRenderer";
import { GameObject } from "#/core/GameObject";
import { Scene } from "#/core/Scene";

const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Canvas not found");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not get a 2D context");

const scene = new Scene();
scene.ctx = ctx;

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
      this.gameObject.x += this.speed * deltaTime;
    }
  }
}
```

## Documentation

- [Architecture](./docs/architecture.md): the layers, the frame loop, object pooling, and the core/UI boundary.
- [Input](./docs/input.md): the `InputManager` API, bindings, edge semantics, and focus behavior.
- [ADR 0001: Entity-component over ECS](./docs/adr/0001-entity-component-architecture.md).
- [Contributing](./CONTRIBUTING.md): setup, conventions, and the pull request checklist.

## Roadmap

Anything past the completed phases is a direction, not a promise. It is not built yet.

### Phase 0: Boundary (done)

- [x] Scaffold TanStack Start and the framework-agnostic `src/core/` directory.
- [x] Mount the canvas viewport with automatic DPI scaling.

### Phase 1: Core entity-component architecture (done)

- [x] `Scene`, `GameObject`, and `Component` with a lifecycle.
- [x] Prefab registry and object pooling (`registerPrefab` and `spawn`).
- [x] GC-friendly indexed loops in the update path.

### Phase 2: Rendering (partly done)

- [x] `SpriteRenderer` with asynchronous loading and fallback rendering.
- [ ] `TilemapRenderer` for sprite-sheet cropping and tile-based levels.

### Phase 3: Scripts and input (partly done)

- [x] `InputManager` with action bindings and per-frame edge detection.
- [x] A sample `PlayerController`.
- [ ] Mouse input and screen-to-world coordinate translation.

### Phase 4: Math and physics (next)

- [ ] `Vector2` math utilities.
- [ ] AABB collision detection (`BoxCollider2D`).
- [ ] Kinematic bodies with velocity, gravity, and drag.
- [ ] Tilemap collision resolution.

### Phase 5: The editor

- [ ] Scene hierarchy panel.
- [ ] Component inspector with live property editing.
- [ ] Play, pause, and step controls for the loop.
- [ ] Scene serialization (save and load to JSON).

### Phase 6: Graphics and audio

- [ ] Sprite-sheet animation component (`Animator`).
- [ ] Camera with panning and zoom.
- [ ] Audio manager for sound effects and music.
- [ ] Particle system.

### Phase 7: WebGPU

- [ ] Abstract the rendering backend.
- [ ] A WebGPU renderer behind the same component API.
- [ ] Custom shader materials.

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
