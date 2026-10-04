export class VoxenEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isRunning: boolean = false;
  private animationFrameId: number = 0;
  private xOffset: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not get 2D context");
    this.ctx = context;
  }

  public start() {
    this.isRunning = true;
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private loop = () => {
    if (!this.isRunning) return;

    this.update();
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update() {
    // Move our test square to the right
    this.xOffset += 2;
    if (this.xOffset > this.canvas.width) {
      this.xOffset = -50;
    }
  }

  private render() {
    // 1. Clear the screen (Sky blue)
    this.ctx.fillStyle = "#87CEEB";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Draw a test square (Mario Red)
    this.ctx.fillStyle = "#E52521";
    this.ctx.fillRect(this.xOffset, 100, 50, 50);
  }
}
