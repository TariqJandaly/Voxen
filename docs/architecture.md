# Architecture

Voxen is two layers that share one object. The core is plain TypeScript and owns the game loop and rendering. The editor is React and owns the DOM. This document covers how they connect, what runs each frame, and where to add code.

## The two layers

```
+----------------------------+      a Scene instance      +-------------------------------+
|  Editor (React and DOM)    |  ----------------------->  |  Engine core (Canvas 2D)      |
|  GameViewport, routes      |    components, bindings    |  Scene -> GameObject -> Comp  |
|  Play/Edit UI (planned)    |  <-----------------------  |  update and draw on each rAF  |
+----------------------------+      reads scene state     +-------------------------------+
```

- **`src/core/`** is the engine. No React, no routing, no editor imports. It can use browser APIs like `CanvasRenderingContext2D`, `HTMLImageElement`, `KeyboardEvent`, and `requestAnimationFrame`, but it never assumes a React tree exists.
- **`src/editor/` and `src/routes/`** are the UI. React builds the DOM, and the engine draws into the canvas. They meet in one place: a React effect creates a `Scene` and passes it the canvas.

The editor does not keep game state in React state. React state drives the editor UI; the `Scene` drives the game. That separation is what keeps the frame loop out of React's render cycle.

## Directory map

| Path | Responsibility |
| --- | --- |
| `src/core/Component.ts` | Base behavior class and lifecycle hooks. |
| `src/core/GameObject.ts` | Entity: transform, component list, scene link. |
| `src/core/Scene.ts` | Game loop, prefab registry, object pool, `InputManager` owner. |
| `src/core/components/SpriteRenderer.ts` | Draws an image or a fallback rectangle. |
| `src/core/components/PlayerController.ts` | Sample script that moves an object from input actions. |
| `src/core/inputs/InputManager.ts` | Keyboard state tracking and action bindings. |
| `src/editor/components/GameViewport.tsx` | Mounts the canvas, boots the engine, wires resize and input. |
| `src/routes/` | TanStack Router file-based routes. |

## The frame loop

`Scene.startLoop()` starts a `requestAnimationFrame` chain. Each tick runs in this order:

```text
tick(time):
  deltaTime = (time - lastTime) / 1000
  lastTime = time

  clear the canvas

  for each object in allObjects (by index):
    if object.isActive:
      object.update(deltaTime)   # components update and draw here

  input.endFrame()               # clear one-frame press and release edges

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
3. `spawn` sets the position and calls `object.enable()`.
4. `object.destroy()` deactivates the object and leaves it in the pool for the next `spawn`.

Because pooled objects get recycled, `start()` must not run again on reuse. `GameObject.enable()` calls the internal `__internal_start()`, which runs `start()` once per allocation and then fires `onEnable()` on every reactivation.

## Component lifecycle

| Hook | When it runs |
| --- | --- |
| `start()` | Once per allocation, on first enable. Set up state and load assets here. |
| `update(deltaTime)` | Every frame while the object and component are active. Read input, move, and draw. |
| `onEnable()` | Every time the host object is enabled, whether on first spawn or pooled reuse. |
| `onDisable()` | Every time the host object is destroyed or returned to the pool. Release or reset. |

Components get `this.gameObject` and `this.scene` injected when you add them with `GameObject.addComponent()`. Assigning `gameObject.scene` propagates the scene reference to every attached component, including ones added later.

There is no separate `render()` hook right now. Rendering components draw inside `update()`. If a dedicated render pass arrives with a future WebGPU backend, that is where it would go. For now, keep drawing at the end of `update()`.

## Rendering

`SpriteRenderer` is the reference for how drawing works:

- It loads the image in `start()` and tracks an `isLoaded` flag.
- Until the image arrives, it draws a solid fallback rectangle, so an entity is never invisible.
- In `update()` it wraps drawing in `ctx.save()` and `ctx.restore()`, and applies the object transform with `translate`, `rotate`, and `scale`.
- It draws centered on the object's origin at `-width / 2` and `-height / 2`.

The viewport handles device pixel ratio. `canvas.width` and `canvas.height` are the CSS size multiplied by `devicePixelRatio`, and the context is scaled to match, so code can keep drawing in CSS pixels.

## Input

`InputManager` is owned by the `Scene` as `scene.input` and shared by every component. It bridges DOM keyboard events into the polling loop.

- `GameViewport` binds actions to `KeyboardEvent.code` values and calls `scene.input.attach(canvas)`.
- DOM `keydown` and `keyup` events change held-key state; `update()` reads it.
- `Scene` calls `input.endFrame()` once per tick, after every component has run, to clear the press and release edges.
- `blur` clears held keys, so a key held while the user tabs away does not stay stuck.

The full API is in [input.md](./input.md).

## Server-side rendering

The app runs under TanStack Start, which renders routes on the server. The engine is client-only:

- `InputManager` and `Scene` do not touch `window` at module scope, so importing them during SSR is safe.
- All engine setup happens inside `useEffect` in `GameViewport`, which only runs in the browser.

Keep it that way. Avoid top-level `window` or `document` access in `src/core/`.

## Extending the engine

Adding a component:

1. Create `src/core/components/MyComponent.ts` extending `Component`.
2. Override the hooks you need.
3. Attach it in a prefab factory with `obj.addComponent(MyComponent)`.

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
- **Pooling means reuse.** `start()` does not run on every spawn. Reset per-life state in `onEnable()`.
- **Canvas input needs focus.** Keyboard listeners are on the canvas, so it has to be focused. The viewport focuses it on mount and on click.
- **Set `ctx` before the loop.** The editor assigns `scene.ctx` before calling `startLoop()`.
