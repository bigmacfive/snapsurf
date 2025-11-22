// CanvasCard - Figma Frame처럼 독립적인 웹 창
// 무한 캔버스 공간에서 드래그/리사이즈 가능

import { Canvas } from '../../types/canvas';

interface CanvasCardProps {
  canvas: Canvas;
  isActive: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onUrlChange: (id: string, url: string) => void;
  zoom: number;
}

export function CanvasCard({
  canvas,
  isActive,
  onSelect,
  onClose,
  onMove,
  onResize,
  onUrlChange,
  zoom
}: CanvasCardProps) {
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('canvas-drag-handle')) {
      const startX = e.clientX;
      const startY = e.clientY;
      const initialX = canvas.x;
      const initialY = canvas.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = (moveEvent.clientX - startX) / zoom;
        const deltaY = (moveEvent.clientY - startY) / zoom;
        onMove(canvas.id, initialX + deltaX, initialY + deltaY);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = canvas.width;
    const initialHeight = canvas.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;
      const newWidth = Math.max(400, initialWidth + deltaX);
      const newHeight = Math.max(300, initialHeight + deltaY);
      onResize(canvas.id, newWidth, newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const style = {
    transform: `translate(${canvas.x * zoom}px, ${canvas.y * zoom}px) scale(${zoom})`,
    width: `${canvas.width}px`,
    height: `${canvas.height}px`,
    zIndex: canvas.zIndex,
    transformOrigin: '0 0'
  };

  return (
    <div
      className={`canvas-card ${isActive ? 'active' : ''} ${canvas.isMinimized ? 'minimized' : ''}`}
      style={style}
      onClick={() => onSelect(canvas.id)}
    >
      {/* Canvas Header - 드래그 가능 */}
      <div
        className="canvas-header canvas-drag-handle"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="canvas-title">{canvas.title}</div>
        <div className="canvas-url-display">{canvas.url}</div>
        {canvas.aiTaskRunning && (
          <div className="canvas-ai-badge">
            <span className="ai-icon">🤖</span>
            <span className="ai-task">{canvas.aiTaskDescription}</span>
          </div>
        )}
        <button
          className="canvas-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClose(canvas.id);
          }}
        >
          ×
        </button>
      </div>

      {/* Canvas Content - Webview */}
      {!canvas.isMinimized && (
        <div className="canvas-content">
          <webview
            id={`webview-${canvas.id}`}
            src={canvas.url}
            className="canvas-webview"
          />
        </div>
      )}

      {/* Canvas Resize Handle */}
      <div className="canvas-resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
}
