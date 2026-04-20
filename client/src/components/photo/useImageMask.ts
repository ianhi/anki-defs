import { useState, useCallback, useRef } from 'react';

/** A point in normalized coordinates (0-1 relative to image dimensions). */
export interface NormalizedPoint {
  x: number;
  y: number;
}

export type MaskTool = 'brush' | 'rect';

/** A mask shape: either a freehand stroke or a filled rectangle (2-point array). */
export interface MaskShape {
  tool: MaskTool;
  points: NormalizedPoint[];
}

/**
 * Sample the most frequent color from an image (downscaled for speed).
 * Groups colors into buckets to smooth noise, returns CSS hex string.
 */
export function sampleBackgroundColor(img: HTMLImageElement): string {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#ffffff';
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Bucket colors (quantize to 5-bit per channel for grouping)
  const buckets = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    const r = (data[i]! >> 3) & 0x1f;
    const g = (data[i + 1]! >> 3) & 0x1f;
    const b = (data[i + 2]! >> 3) & 0x1f;
    const key = (r << 10) | (g << 5) | b;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  let maxCount = 0;
  let maxKey = 0;
  for (const [key, count] of buckets) {
    if (count > maxCount) {
      maxCount = count;
      maxKey = key;
    }
  }

  const r = ((maxKey >> 10) & 0x1f) << 3;
  const g = ((maxKey >> 5) & 0x1f) << 3;
  const b = (maxKey & 0x1f) << 3;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: MaskShape | null,
  w: number,
  h: number,
  brushWidth: number
) {
  if (!shape) return;
  const first = shape.points[0];
  if (!first) return;

  if (shape.tool === 'rect' && shape.points.length >= 2) {
    const second = shape.points[shape.points.length - 1]!;
    const x = Math.min(first.x, second.x) * w;
    const y = Math.min(first.y, second.y) * h;
    const rw = Math.abs(second.x - first.x) * w;
    const rh = Math.abs(second.y - first.y) * h;
    ctx.fillRect(x, y, rw, rh);
  } else {
    // Freehand brush
    ctx.lineWidth = brushWidth;
    ctx.beginPath();
    ctx.moveTo(first.x * w, first.y * h);
    for (let i = 1; i < shape.points.length; i++) {
      const pt = shape.points[i]!;
      ctx.lineTo(pt.x * w, pt.y * h);
    }
    ctx.stroke();
    if (shape.points.length === 1) {
      const rad = brushWidth / 2;
      ctx.beginPath();
      ctx.arc(first.x * w, first.y * h, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function useImageMask() {
  const [shapes, setShapes] = useState<MaskShape[]>([]);
  const [isMaskMode, setIsMaskMode] = useState(false);
  const [maskColor, setMaskColor] = useState('#ffffff');
  const [activeTool, setActiveTool] = useState<MaskTool>('rect');
  const currentShape = useRef<MaskShape | null>(null);
  const isDrawing = useRef(false);

  const startStroke = useCallback(
    (nx: number, ny: number) => {
      isDrawing.current = true;
      currentShape.current = { tool: activeTool, points: [{ x: nx, y: ny }] };
    },
    [activeTool]
  );

  const continueStroke = useCallback((nx: number, ny: number) => {
    if (!isDrawing.current || !currentShape.current) return;
    if (currentShape.current.tool === 'rect') {
      // Rectangle: keep only start + current endpoint
      currentShape.current.points = [currentShape.current.points[0]!, { x: nx, y: ny }];
    } else {
      currentShape.current.points.push({ x: nx, y: ny });
    }
  }, []);

  const endStroke = useCallback(() => {
    if (!isDrawing.current || !currentShape.current) return;
    isDrawing.current = false;
    if (currentShape.current.points.length > 0) {
      setShapes((prev) => [...prev, currentShape.current!]);
    }
    currentShape.current = null;
  }, []);

  const undo = useCallback(() => {
    setShapes((prev) => prev.slice(0, -1));
  }, []);

  const clearMask = useCallback(() => {
    setShapes([]);
  }, []);

  const toggleMaskMode = useCallback(() => {
    setIsMaskMode((prev) => !prev);
  }, []);

  const hasStrokes = shapes.length > 0;

  /** Bake mask shapes onto a canvas. Mutates the canvas context. */
  const bakeMask = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (shapes.length === 0) return;
      ctx.save();
      ctx.strokeStyle = maskColor;
      ctx.fillStyle = maskColor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const brushWidth = Math.max(8, Math.min(width, height) * 0.03);

      for (const shape of shapes) {
        drawShape(ctx, shape, width, height, brushWidth);
      }
      ctx.restore();
    },
    [shapes, maskColor]
  );

  return {
    shapes,
    isMaskMode,
    hasStrokes,
    maskColor,
    activeTool,
    setActiveTool,
    setMaskColor,
    currentShapeRef: currentShape,
    isDrawingRef: isDrawing,
    startStroke,
    continueStroke,
    endStroke,
    undo,
    clearMask,
    toggleMaskMode,
    bakeMask,
  };
}
