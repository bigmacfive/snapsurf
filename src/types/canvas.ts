// Canvas(캔버스) 관련 타입 정의 - Figma 스타일
// 각 Canvas는 독립적인 전체 웹 페이지 (Figma의 Frame처럼)

export interface Canvas {
  id: string;
  title: string;
  url: string;
  x: number; // 무한 캔버스 공간에서의 X 위치
  y: number; // 무한 캔버스 공간에서의 Y 위치
  width: number; // Canvas 너비
  height: number; // Canvas 높이
  zIndex: number; // 레이어 순서
  isMinimized: boolean; // 최소화 상태
  isMaximized: boolean; // 최대화 상태
  createdAt: Date;
  lastAccessedAt: Date;
  thumbnail?: string; // Canvas 미리보기 이미지
  aiTaskRunning: boolean; // AI가 현재 이 캔버스에서 작업 중인지
  aiTaskDescription?: string; // AI가 수행 중인 작업 설명
}

export interface CanvasViewport {
  x: number; // 전체 캔버스 공간에서의 뷰포트 위치
  y: number;
  zoom: number; // 줌 레벨 (1.0 = 100%)
}

export interface CanvasWorkspace {
  canvases: Canvas[];
  activeCanvasId: string | null;
  viewport: CanvasViewport;
}

export interface CanvasAction {
  type: 'create' | 'delete' | 'select' | 'move' | 'resize' | 'minimize' | 'maximize';
  canvasId: string;
  payload?: any;
}
