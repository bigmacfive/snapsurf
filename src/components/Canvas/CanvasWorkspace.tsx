// CanvasWorkspace - Figma처럼 무한 캔버스 공간
// 끝없는 2D 공간에서 줌/팬으로 탐색

import { useRef, useEffect } from 'react';
import { Canvas } from '../../types/canvas';
import { CanvasCard } from './CanvasCard';

interface CanvasWorkspaceProps {
  canvases: Canvas[];
  activeCanvasId: string | null;
  zoom: number;
  viewportX: number;
  viewportY: number;
  onSelectCanvas: (id: string) => void;
  onCloseCanvas: (id: string) => void;
  onMoveCanvas: (id: string, x: number, y: number) => void;
  onResizeCanvas: (id: string, width: number, height: number) => void;
  onUrlChange: (id: string, url: string) => void;
  onPanViewport: (deltaX: number, deltaY: number) => void;
  onZoomViewport: (zoom: number) => void;
}

export function CanvasWorkspace({
  canvases,
  activeCanvasId,
  zoom,
  viewportX,
  viewportY,
  onSelectCanvas,
  onCloseCanvas,
  onMoveCanvas,
  onResizeCanvas,
  onUrlChange,
  onPanViewport,
  onZoomViewport
}: CanvasWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // 마우스 휠로 줌 (Ctrl/Cmd + Wheel)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        onZoomViewport(zoom + delta);
      }
    };

    const workspace = workspaceRef.current;
    if (workspace) {
      workspace.addEventListener('wheel', handleWheel, { passive: false });
      return () => workspace.removeEventListener('wheel', handleWheel);
    }
  }, [zoom, onZoomViewport]);

  // 스페이스바 + 드래그로 팬
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isPanning.current) {
        e.preventDefault();
        document.body.style.cursor = 'grab';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        document.body.style.cursor = 'default';
        isPanning.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.target as HTMLElement).classList.contains('canvas-workspace'))) {
      // 마우스 휠 버튼 또는 빈 공간 클릭
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      onPanViewport(-deltaX, -deltaY);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    if (isPanning.current) {
      isPanning.current = false;
      document.body.style.cursor = 'default';
    }
  };

  return (
    <div
      ref={workspaceRef}
      className="canvas-workspace"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 무한 캔버스 배경 그리드 (Figma처럼) */}
      <div
        className="canvas-grid"
        style={{
          transform: `translate(${-viewportX * zoom}px, ${-viewportY * zoom}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      />

      {/* Canvas Container */}
      <div
        className="canvas-container"
        style={{
          transform: `translate(${-viewportX * zoom}px, ${-viewportY * zoom}px)`,
          transformOrigin: '0 0'
        }}
      >
        {canvases.map(canvas => (
          <CanvasCard
            key={canvas.id}
            canvas={canvas}
            isActive={canvas.id === activeCanvasId}
            onSelect={onSelectCanvas}
            onClose={onCloseCanvas}
            onMove={onMoveCanvas}
            onResize={onResizeCanvas}
            onUrlChange={onUrlChange}
            zoom={zoom}
          />
        ))}
      </div>

      {/* Zoom Controls */}
      <div className="canvas-zoom-controls">
        <button onClick={() => onZoomViewport(zoom - 0.1)}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => onZoomViewport(zoom + 0.1)}>+</button>
        <button onClick={() => onZoomViewport(1.0)}>Reset</button>
      </div>
    </div>
  );
}
