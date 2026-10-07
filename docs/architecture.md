# Architecture

Voxen is two layers that share one object. The core is plain TypeScript and owns the game loop and rendering. The editor is React and owns the DOM. This document covers how they connect, what runs each frame, and where to add code.

## The two layers

```
+----------------------------+      a Scene instance      +-------------------------------+
|  Editor (React and DOM)    |  ----------------------->  |  Engine core (Canvas 2D)      |
|  Hierarchy, Inspector      |    components, bindings    |  Scene -> GameObject -> Comp  |
|  GameViewport, routes      |  <-----------------------  |  update and draw on each rAF  |
+----------------------------+   object list + selection  +-------------------------------+
```

- **`src/core/`** is the engine. No React, no routing, no editor imports. It can use browser APIs like `CanvasRenderingContext2D`, `HTMLImageElement`, `KeyboardEvent`, and `requestAnimationFrame`, but it never assumes a React tree exists.
- **`src/editor/` and `src/routes/`** are the UI. React builds the DOM, and the engine draws into the canvas. They meet in one place: the editor provider creates a `Scene`, the viewport gives it the canvas, and the hierarchy reads the same object list.

The editor does not keep game state in React state. React state drives the editor UI; the `Scene` drives the game. That separation is what keeps the frame loop out of React's render cycle.

## Directory map

| Path | Responsibility |
| --- | --- |
| `src/core/Component.ts` | Base behavior class and lifecycle hooks. |
| `src/core/GameObject.ts` | Entity: transform, component list, scene link, active and visible flags. |
| `src/core/objects/` | GameObject subclasses (for example `Camera`); every file here is auto-detected and offered in the create menu. |
| `src/core/Scene.ts` | Game loop, prefab registry, object pool, input, active camera, and the editor bridge. |
| `src/core/components/SpriteRenderer.ts` | Draws an image or a fallback rectangle. |
| `src/core/components/PlayerController.ts` | Sample script that moves an object from input actions. |
| `src/core/components/DataTypes.ts` | Test component with one field of every inspector type. |
| `src/core/components/Transform.ts` | Position, rotation, and scale; every object owns one. |
| `src/core/rendering/` | The `Renderer` interface and the Canvas 2D backend. |
| `src/core/math/` | `Vector2`, `Vector3`, `Vector4`, `Color`, and `Matrix2D` transform helpers. |
| `src/core/inputs/InputManager.ts` | Keyboard state tracking and action bindings. |
| `src/core/serialization/` | Scene snapshots: read and write objects, transforms, and component fields. |
| `src/editor/context/EditorContext.tsx` | Owns the shared `Scene` and the current selection. |
| `src/editor/components/MenuBar.tsx` | Top menu bar; placeholder items for now. |
| `src/editor/components/GameViewport.tsx` | Mounts the canvas and drives the shared scene. |
| `src/editor/components/HierarchyPanel.tsx` | Names the scene and lists, selects, renames, and deletes objects. |
| `src/editor/components/InspectorPanel.tsx` | Tweakpane inspector bound to the selected object. |
| `src/editor/components/componentRegistry.ts` | Auto-detects every Component under `core/components/` for the inspector's add search and for loading. |
| `src/editor/components/objectRegistry.ts` | Auto-detects every GameObject under `core/objects/` for the hierarchy's create menu and for loading. |
| `src/editor/components/ContextMenu.tsx` | Reusable right-click menu. |
| `src/editor/componentFields.ts` | Field reflection and value copying for components. |
| `src/editor/components/FilesPanel.tsx` | Placeholder files explorer docked below the hierarchy and scene. |
| `src/editor/components/LayoutModel.ts` | The default dock layout for the panels. |
| `src/routes/index.tsx` | Landing page. |
| `src/routes/projects.tsx` | Project list: create, rename, delete, and open. |
| `src/routes/engine.$id.tsx` | Editor for one project; builds the dock layout. |
| `src/routes/engine.index.tsx` | Redirects `/engine` to `/projects`. |
| `src/projects/projectStore.ts` | Project persistence in IndexedDB (idb). |

## The frame loop

`Scene.startLoop()` starts a `requestAnimationFrame` chain. Each tick runs in this order:

```text
tick(time):
  deltaTime = (time - lastTime) / 1000
  lastTime = time

  clear the canvas

  for each object in allObjects (by index):
    if object.isActiveInHierarchy():
      object.update(deltaTime)      # components read input and move here

  input.endFrame()                  # clear one-frame press and release edges

  renderFrame():
    camera = getActiveCamera()
    if no camera:
      draw black background + "No camera active"
    else:
      save, apply camera.getViewMatrix()
      for each object:
        if object.isActiveInHierarchy() and object.isVisibleInHierarchy():
          object.render(renderer)   # components draw here
      restore

  drawDebugOverlay()
  requestAnimationFrame(tick)
```

`deltaTime` is in seconds, so movement written as `speed * deltaTime` does not depend on frame rate.

## Object lifecycle and pooling

Allocating during play causes GC pauses, so Voxen reuses objects through pools keyed by prefab name.

1. `scene.registerPrefab(name, factory)` stores the factory and creates an empty pool for that name.
2. `scene.spawn(name, x, y)` looks for an inactive object already in the pool.
   - If it finds one, it reuses that object. No allocation.
   - If not, it calls the factory, sets `object.scene = scene`, and adds the object to the pool.
3. `spawn` sets the position, then registers and enables the object's whole subtree, so a prefab can return a parent with children.
4. `scene.destroy(object)` detaches the object from its parent and deactivates it and its descendants, keeping the subtree intact so the next `spawn` can re-enable it.

Because pooled objects get recycled, `start()` must not run again on reuse. `GameObject.enable()` calls the internal `__internal_start()`, which runs `start()` once per allocation and then fires `onEnable()` on every reactivation.

## Hierarchy

Objects form a tree. `GameObject.parent` points up and `getChildren()` reads down. Each object's `Transform` is relative to its parent: `position`, `rotation`, and `scale` are vectors, and 2D rendering uses `position.xy`, `rotation.z`, and `scale.xy`.

Two independent flags control an object:

- `isActive` (the hierarchy checkbox): a disabled object and its descendants are skipped by `update` and `render`. `GameObject.setActive(active)` flips it in place; `isActiveInHierarchy()` reports whether the object and every ancestor is active.
- `isVisible` (the hierarchy eye): a hidden object still updates but does not draw. `isVisibleInHierarchy()` mirrors the active check.

`scene.destroy(object)` deactivates a subtree and keeps it for pooling. `scene.remove(object)` takes it out of the scene for good, which is what the editor's delete uses.

- `setParent(parent, keepWorld)` reparents an object. With `keepWorld` (the default) it recomputes the local transform so the object stays where it is on screen. It refuses to parent an object under one of its own descendants, which would create a cycle.
- `Transform.getWorldMatrix()` composes the transform with every ancestor. `SpriteRenderer` draws through that matrix, so moving or rotating a parent moves its children.
- `scene.destroy(object)` detaches the object from its parent and deactivates it and its descendants, so the whole subtree leaves the scene until it is spawned again.

A prefab factory can return a parent with children; `spawn` registers and enables the subtree.

## Serialization

`serializeScene(scene)` turns the objects into plain data: each object's class name, name, active and visible flags, transform, own fields, component list, and children, with every public field copied out. Colors and vectors come back as plain `{ r, g, b, a }` and `{ x, y }` data, so the result is JSON-friendly.

`deserializeScene(scene, data, types, objectTypes)` rebuilds the tree. It needs a map of component class names to classes (`COMPONENT_TYPES`) and a map of GameObject class names to classes (`OBJECT_TYPES`, which includes `Camera`) to recreate the right types, then writes the saved fields onto fresh instances and restores each object's active and visible state. Object fields are mutated in place, so a restored `Color` stays a `Color`.

The format is versioned. Version 1 kept the transform flat on the object; the loader migrates it to the version 2 `transform` shape, so older projects still open.

The editor loads a project's scene when it opens and autosaves it back to IndexedDB every couple of seconds and once more on the way out.

## Component lifecycle

| Hook | When it runs |
| --- | --- |
| `start()` | Once per allocation, on first enable. Set up state and load assets here. |
| `update(deltaTime)` | Every frame while the object and component are active. Read input and move. |
| `render(renderer)` | Every frame while the object is active and visible, inside the camera transform. Draw here. |
| `onEnable()` | Every time the host object is enabled, whether on first spawn or pooled reuse. |
| `onDisable()` | Every time the host object is destroyed or returned to the pool. Release or reset. |

Components get `this.gameObject` and `this.scene` injected when you add them with `GameObject.addComponent()`. Assigning `gameObject.scene` propagates the scene reference to every attached component, including ones added later.

Every `GameObject` also owns a `Transform` (`position`, `rotation`, and `scale` as `Vector3`). It is created with the object and is not a normal component, so it cannot be removed by mistake.

## Rendering

Drawing happens in a dedicated render pass, not in `update()`. The scene finds the first active `Camera` and renders every visible, active object through its view matrix:

- `Scene.getActiveCamera()` scans `allObjects` for the first active `Camera`.
- With a camera, the scene saves the renderer, applies `camera.getViewMatrix()`, calls `object.render(renderer)` for each visible object, then restores.
- With no camera, it fills the viewport black and draws `No camera active` in the centre, so an empty scene is never a silent blank canvas.

`SpriteRenderer` is the reference for how drawing works:

- It loads the image in `start()` and tracks an `isLoaded` flag.
- Until the image arrives, it draws a solid fallback rectangle, so an entity is never invisible.
- In `render(renderer)` it draws through the renderer it was handed: save, apply the object's world matrix, draw, restore. Pixels are centered on the object's origin at `-width / 2` and `-height / 2`.

Drawing goes through the `Renderer` interface (`src/core/rendering/Renderer.ts`) rather than a raw canvas context, so a WebGL or WebGPU backend can be added later without touching components. `CanvasRenderer` is the current 2D backend and owns the device-pixel-ratio sizing.

`Camera` is a `GameObject` subclass, so it is created, parented, and inspected like any other object. Its world `position` is the centre of the view, `rotation.z` rotates the view, and `zoom` scales it. `getViewMatrix()` builds the world-to-screen matrix, `worldToScreen`/`screenToWorld` convert points, and `getVisibleBounds()` returns the world rectangle the camera can see. The scene keeps every camera's viewport size in sync on resize. If a scene has more than one active camera, the first in `allObjects` wins.

The viewport watches the canvas container with a `ResizeObserver` and reports the CSS size to `scene.resize`, which sizes the backing buffer and applies the device-pixel-ratio scale. A dock splitter changes the container without firing a window resize, so the report is queued and applied at the start of the next frame, avoiding a one-frame flash.

## Input

`InputManager` is owned by the `Scene` as `scene.input` and shared by every component. It bridges DOM keyboard events into the polling loop.

- `GameViewport` binds actions to `KeyboardEvent.code` values and calls `scene.input.attach(canvas)`.
- DOM `keydown` and `keyup` events change held-key state; `update()` reads it.
- `Scene` calls `input.endFrame()` once per tick, after every component has run, to clear the press and release edges.
- `blur` clears held keys, so a key held while the user tabs away does not stay stuck.

The full API is in [input.md](./input.md).

## Editor

The editor is a React layer that owns exactly one `Scene` and never keeps a parallel copy of game state.

- `EditorProvider` creates the `Scene` for the open project, loads its saved objects, holds the selection, and autosaves. `useEditor()` exposes the scene and selection to the panels.
- `Scene.name` labels the single scene (`Main`), and the hierarchy shows it at the top.
- `MenuBar` is a top bar placeholder for the usual File, Edit, View, Settings, and Help menus; it has no actions yet.
- Panels read `scene.allObjects` for the hierarchy. `scene.onHierarchyChanged` fires when the object list changes, and the provider bumps a version counter so React re-renders. React never polls the scene.
- `GameViewport` consumes the shared scene from context. It assigns `scene.renderer`, attaches input to the canvas, and starts the loop. It does not create its own scene.
- `routes/engine.$id.tsx` (the `/engine/:id` route) loads the project from IndexedDB, names the scene after it, then builds a `flexlayout-react` model from `LayoutModel.ts` and maps each tab's component name (`hierarchy`, `scene`, `files`, `inspector`) to a panel. An unknown id falls back to `/projects`, and `/engine` redirects there too. The `/` route is the landing page and `/projects` lists projects.
- The hierarchy renders the object tree with expand and collapse. Each row carries an enable checkbox (active) and an eye toggle (visible); both live on the object and refresh through `onHierarchyChanged`. The + button and the right-click "Add Child" open a menu built from `OBJECT_REGISTRY`, which auto-detects every GameObject under `core/objects/` (plus a plain Empty Object), so new types appear without registration. Select, rename, and delete objects; drag an object onto another to reparent it (using `setParent` with keep-world). Deleting goes through `scene.remove(object)`, so the object and its children leave the scene. Right-clicking an object also offers rename, add child, unparent, and duplicate (copying its class, own fields, transform, and component values).
- Right-clicking a component title in the inspector opens a context menu to reset (remove and re-add a fresh instance) or remove it. `GameObject.removeComponent` deactivates the component and drops it from the list. The Transform title has a reset action, and any value (including color channels) can be copied or reset to its default. The editor route suppresses the browser's own context menu so only these menus appear.
- `InspectorPanel` builds a Tweakpane pane for the selected object. It shows the object's own reflectable fields first (for example a camera's zoom), then the Transform and every component, auto-detects the view from the value (number, string, boolean, point, and color as a preview swatch, a native color picker, and R, G, B, A inputs), and formats the field names. A search input at the bottom filters `componentRegistry.ts` and adds the chosen component on Enter or click. Edits mutate the live engine objects so they show in the canvas immediately. `DataTypes` is a test component that holds one field of each type. Tweakpane is imported lazily so it never loads during SSR.

## Server-side rendering

The app runs under TanStack Start, which renders routes on the server. The engine is client-only:

- `InputManager` and `Scene` do not touch `window` at module scope, so importing them during SSR is safe. `EditorProvider` creates the `Scene` during render for the same reason.
- Canvas and input setup happen inside `useEffect` in `GameViewport`, which only runs in the browser, so the loop never starts on the server.

Keep it that way. Avoid top-level `window` or `document` access in `src/core/`.

## Extending the engine

Adding a component:

1. Create `src/core/components/MyComponent.ts` extending `Component`. The editor scans this folder, so the component shows up in the inspector's add search and can be saved and reloaded with no extra registration.
2. Override the hooks you need.
3. Attach it in a prefab factory with `obj.addComponent(MyComponent)`.

Adding a GameObject type:

1. Create `src/core/objects/MyObject.ts` extending `GameObject`. The editor scans this folder, so the type shows up in the hierarchy's create menu and can be saved and reloaded with no extra registration. `Camera` is the reference.

Both registries read the folders with Vite's `import.meta.glob`, so a new file is picked up as soon as it exists. `Transform` is the one component left out of the add search, since every object owns one.

Adding a prefab:

```ts
scene.registerPrefab("Enemy", () => {
  const enemy = new GameObject("Enemy");
  enemy.addComponent(SpriteRenderer).imageUrl = "/assets/enemy.png";
  enemy.addComponent(MyComponent);
  return enemy;
});

scene.spawn("Enemy", 640, 300);
```

Adding an input action:

```ts
scene.input.setBindings({ ...existing, jump: ["Space", "KeyW"] });

// Inside a component:
if (this.scene.input.wasPressed("jump")) {
  // ...
}
```

## Gotchas

- **No React in `src/core/`.** If a core file needs React, the logic belongs in `src/editor/`.
- **The scene is the single source of truth.** Mutate the `Scene` and let `onHierarchyChanged` refresh the UI; do not mirror objects into React state.
- **Pooling means reuse.** `start()` does not run on every spawn. Reset per-life state in `onEnable()`.
- **Canvas input needs focus.** Keyboard listeners are on the canvas, so it has to be focused. The viewport focuses it on mount and on click.
- **Set `renderer` before the loop.** The editor assigns `scene.renderer` before calling `startLoop()`.
- **Every scene needs a camera to draw.** Without an active `Camera` object the viewport shows the black no-camera screen. Create one from the hierarchy's + menu.
