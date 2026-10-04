import { useEffect, useRef } from "react";
import { VoxenEngine } from "../voxen-core/Engine";

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VoxenEngine | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the engine and pass it the canvas
    const engine = new VoxenEngine(canvasRef.current);
    engineRef.current = engine;

    // Start the game loop
    engine.start();

    // Cleanup function: stop the loop when the component unmounts
    return () => {
      engine.stop();
    };
  }, []);

  return (
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="bg-black border-2 border-gray-700 rounded-md shadow-inner"
      />
  );
}
