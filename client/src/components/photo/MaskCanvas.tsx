import React, { useCallback, useState } from 'react';
import type { MaskShape, NormalizedPoint } from './useImageMask';

interface MaskCanvasProps {
  imageRef: React.RefObject<HTMLImageElement | null>;
  shapes: MaskShape[];
  maskColor: string;
  currentShapeRef: React.RefObject<MaskShape | null>;
  isDrawingRef: React.RefObject<boolean>;
  isMaskMode: boolean;
  onStartStroke: (nx: number, ny: number) => void;
  onContinueStroke: (nx: number, ny: number) => void;
  onEndStroke: () => void;
}

function ShapeSVG({ shape, color }: { shape: MaskShape; color: string }) {
  if (shape.tool === 'rect' && shape.points.length >= 2) {
    const [a, b] = [shape.points[0]!, shape.points[shape.points.length - 1]!];
    const x = Math.min(a.x, b.x) * 100;
    const y = Math.min(a.y, b.y) * 100;
    const w = Math.abs(b.x - a.x) * 100;
    const h = Math.abs(b.y - a.y) * 100;
    return <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} fill={color} />;
  }
  if (shape.points.length === 0) return null;
  const d = shape.points
    .map((p: NormalizedPoint, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`)
    .join(' ');
  return (
    <path
      d={d}
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function MaskCanvas({
  imageRef,
  shapes,
  maskColor,
  currentShapeRef,
  isDrawingRef,
  isMaskMode,
  onStartStroke,
  onContinueStroke,
  onEndStroke,
}: MaskCanvasProps) {
  // Counter to force re-render during drawing so SVG updates live
  const [, setTick] = useState(0);

  const getPointerPos = useCallback(
    (e: React.PointerEvent): [number, number] | null => {
      const img = imageRef.current;
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      return [
        Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      ];
    },
    [imageRef]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isMaskMode) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = getPointerPos(e);
      if (!pos) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onStartStroke(pos[0], pos[1]);
    },
    [isMaskMode, getPointerPos, onStartStroke]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isMaskMode || !isDrawingRef.current) return;
      e.preventDefault();
      const pos = getPointerPos(e);
      if (!pos) return;
      onContinueStroke(pos[0], pos[1]);
      setTick((t) => t + 1);
    },
    [isMaskMode, getPointerPos, onContinueStroke, isDrawingRef]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isMaskMode) return;
      e.preventDefault();
      onEndStroke();
    },
    [isMaskMode, onEndStroke]
  );

  // For live preview of in-progress shape, we force a re-render via a
  // temporary state. But since currentShapeRef is a ref (no re-render),
  // we use onPointerMove to trigger parent re-render via onContinueStroke
  // which updates the ref. We read it here on each render.
  const inProgress = isDrawingRef.current ? currentShapeRef.current : null;
  const hasContent = shapes.length > 0 || isMaskMode;

  return (
    <svg
      className={`absolute ${isMaskMode ? 'cursor-crosshair z-10' : hasContent ? 'pointer-events-none z-10' : 'hidden'}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        top: imageRef.current?.offsetTop ?? 0,
        left: imageRef.current?.offsetLeft ?? 0,
        width: imageRef.current?.clientWidth ?? '100%',
        height: imageRef.current?.clientHeight ?? '100%',
        touchAction: isMaskMode ? 'none' : 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {shapes.map((shape, i) => (
        <ShapeSVG key={i} shape={shape} color={maskColor} />
      ))}
      {inProgress && <ShapeSVG shape={inProgress} color={maskColor} />}
    </svg>
  );
}
