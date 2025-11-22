// Canvas 관리 Hook - Figma 스타일 무한 캔버스 관리
// 끝없는 2D 공간에 Canvas를 배치하고, 줌/팬으로 탐색

import { useState, useCallback } from 'react';
import { Canvas, CanvasWorkspace } from '../types/canvas';

const CANVAS_DEFAULT_WIDTH = 1600;
const CANVAS_DEFAULT_HEIGHT = 900; // 16:9 비율 (1600 * 9/16 = 900)
const CANVAS_SPACING = 150;
const CANVAS_GRID_COLS = 2; // 2열 그리드 레이아웃

export function useCanvasManager() {
  const [workspace, setWorkspace] = useState<CanvasWorkspace>({
    canvases: [],
    activeCanvasId: null,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1.0
    }
  });

  // 새 Canvas 생성 (Figma의 New Frame처럼)
  const createCanvas = useCallback((url: string = 'https://www.google.com', title: string = '새 캔버스') => {
    // 그리드 레이아웃으로 배치 (겹치지 않도록)
    const canvasIndex = workspace.canvases.length;
    const col = canvasIndex % CANVAS_GRID_COLS;
    const row = Math.floor(canvasIndex / CANVAS_GRID_COLS);

    const newCanvas: Canvas = {
      id: `canvas-${Date.now()}`,
      title,
      url,
      x: col * (CANVAS_DEFAULT_WIDTH + CANVAS_SPACING) + 100,
      y: row * (CANVAS_DEFAULT_HEIGHT + CANVAS_SPACING) + 100,
      width: CANVAS_DEFAULT_WIDTH,
      height: CANVAS_DEFAULT_HEIGHT,
      zIndex: workspace.canvases.length,
      isMinimized: false,
      isMaximized: false,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      aiTaskRunning: false
    };

    setWorkspace(prev => ({
      ...prev,
      canvases: [...prev.canvases, newCanvas],
      activeCanvasId: newCanvas.id
    }));

    return newCanvas;
  }, [workspace.canvases.length]);

  // Canvas 삭제
  const deleteCanvas = useCallback((canvasId: string) => {
    setWorkspace(prev => {
      const newCanvases = prev.canvases.filter(c => c.id !== canvasId);
      let newActiveId = prev.activeCanvasId;

      // 삭제된 캔버스가 현재 활성화된 캔버스라면
      if (canvasId === prev.activeCanvasId) {
        newActiveId = newCanvases.length > 0 ? newCanvases[newCanvases.length - 1].id : null;
      }

      return {
        ...prev,
        canvases: newCanvases,
        activeCanvasId: newActiveId
      };
    });
  }, []);

  // Canvas 선택
  const selectCanvas = useCallback((canvasId: string) => {
    setWorkspace(prev => ({
      ...prev,
      activeCanvasId: canvasId,
      canvases: prev.canvases.map(canvas =>
        canvas.id === canvasId
          ? { ...canvas, lastAccessedAt: new Date(), zIndex: Math.max(...prev.canvases.map(c => c.zIndex)) + 1 }
          : canvas
      )
    }));
  }, []);

  // Canvas 업데이트
  const updateCanvas = useCallback((canvasId: string, updates: Partial<Canvas>) => {
    setWorkspace(prev => ({
      ...prev,
      canvases: prev.canvases.map(canvas =>
        canvas.id === canvasId ? { ...canvas, ...updates } : canvas
      )
    }));
  }, []);

  // Canvas 이동 (드래그)
  const moveCanvas = useCallback((canvasId: string, x: number, y: number) => {
    updateCanvas(canvasId, { x, y });
  }, [updateCanvas]);

  // Canvas 리사이즈
  const resizeCanvas = useCallback((canvasId: string, width: number, height: number) => {
    updateCanvas(canvasId, { width, height });
  }, [updateCanvas]);

  // Canvas 최소화
  const minimizeCanvas = useCallback((canvasId: string) => {
    updateCanvas(canvasId, { isMinimized: true });
  }, [updateCanvas]);

  // Canvas 최대화
  const maximizeCanvas = useCallback((canvasId: string) => {
    updateCanvas(canvasId, { isMaximized: true });
  }, [updateCanvas]);

  // Canvas 정상 크기로 복원
  const restoreCanvas = useCallback((canvasId: string) => {
    updateCanvas(canvasId, { isMinimized: false, isMaximized: false });
  }, [updateCanvas]);

  // Viewport 이동 (Pan)
  const panViewport = useCallback((deltaX: number, deltaY: number) => {
    setWorkspace(prev => ({
      ...prev,
      viewport: {
        ...prev.viewport,
        x: prev.viewport.x + deltaX,
        y: prev.viewport.y + deltaY
      }
    }));
  }, []);

  // Viewport 줌
  const zoomViewport = useCallback((zoom: number) => {
    setWorkspace(prev => ({
      ...prev,
      viewport: {
        ...prev.viewport,
        zoom: Math.max(0.25, Math.min(2.0, zoom))
      }
    }));
  }, []);

  // Canvas URL 변경
  const updateCanvasUrl = useCallback((canvasId: string, url: string) => {
    updateCanvas(canvasId, { url });
  }, [updateCanvas]);

  // Canvas 썸네일 업데이트
  const updateCanvasThumbnail = useCallback((canvasId: string, thumbnail: string) => {
    updateCanvas(canvasId, { thumbnail });
  }, [updateCanvas]);

  // AI 작업 시작
  const startAITask = useCallback((canvasId: string, description: string) => {
    updateCanvas(canvasId, { aiTaskRunning: true, aiTaskDescription: description });
  }, [updateCanvas]);

  // AI 작업 종료
  const stopAITask = useCallback((canvasId: string) => {
    updateCanvas(canvasId, { aiTaskRunning: false, aiTaskDescription: undefined });
  }, [updateCanvas]);

  // 활성 Canvas 가져오기
  const activeCanvas = workspace.canvases.find(c => c.id === workspace.activeCanvasId);

  return {
    workspace,
    canvases: workspace.canvases,
    activeCanvas,
    viewport: workspace.viewport,
    createCanvas,
    deleteCanvas,
    selectCanvas,
    updateCanvas,
    moveCanvas,
    resizeCanvas,
    minimizeCanvas,
    maximizeCanvas,
    restoreCanvas,
    panViewport,
    zoomViewport,
    updateCanvasUrl,
    updateCanvasThumbnail,
    startAITask,
    stopAITask
  };
}
