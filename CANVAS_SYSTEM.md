# SnapSurf Canvas System 🎨

**Figma 스타일의 풀스크린 Canvas 기반 멀티 웹 브라우저 시스템**

---

## 🎯 개념

SnapSurf Canvas System은 **Figma의 프레임(Frame)**처럼 작동하는 독립적인 풀스크린 웹 창(Canvas) 시스템입니다.

### 기존 브라우저 vs Canvas System

| 기존 브라우저 | Canvas System |
|------------|---------------|
| 탭으로 전환 | 좌우 스와이프로 전환 |
| 한 번에 하나만 보임 | 각 Canvas가 풀스크린 |
| 고정된 크기 | 항상 전체 화면 크기 |
| 순차적 배열 | 수평 슬라이드 배치 (Figma처럼) |

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  Canvas Workspace (풀스크린 수평 슬라이더)                 │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Canvas 1   │  │  Canvas 2   │  │  Canvas 3   │     │
│  │  (Fullscreen│  │  (Fullscreen│  │  (Fullscreen│     │
│  │             │  │             │  │             │     │
│  │   🌐 Web    │  │   🌐 Web    │  │   🌐 Web    │     │
│  │   Webview   │  │   Webview   │  │   Webview   │     │
│  │             │  │             │  │             │     │
│  │   🤖 AI     │  │   🤖 AI     │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                           │
│  [←] [• • •] [→]     [썸네일1] [썸네일2] [썸네일3] [+]     │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 파일 구조

```
src/
├── types/
│   └── canvas.ts                    # Canvas 타입 정의
├── hooks/
│   └── useCanvasManager.ts          # Canvas 관리 Hook
├── components/
│   └── Canvas/
│       ├── CanvasCard.tsx           # 개별 Canvas 컴포넌트
│       ├── CanvasWorkspace.tsx      # Canvas 작업 공간
│       ├── Canvas.css               # Canvas 스타일
│       └── index.ts                 # Export
```

---

## 🔑 핵심 기능

### 1. **풀스크린 Canvas**
- 각 Canvas는 전체 화면을 차지
- 모바일 앱처럼 좌우 스와이프로 전환
- 항상 100% 화면 크기 (줌/팬 없음)

### 2. **독립적인 웹 창 (Canvas)**
- 각 Canvas는 독립된 Webview
- 풀스크린으로 웹 페이지 표시
- 수평 슬라이더로 Canvas 간 전환
- 드래그 또는 키보드로 네비게이션

### 3. **AI가 각 Canvas 제어**
```typescript
// AI가 Canvas 1에서 작업 시작
startAITask('canvas-1', 'Google에서 정보 검색 중...');

// AI가 Canvas 2에서 작업 시작
startAITask('canvas-2', 'YouTube에서 동영상 재생 중...');

// AI가 Canvas 3 생성 및 제어
const newCanvas = createCanvas('https://github.com', 'GitHub');
startAITask(newCanvas.id, 'Repository 탐색 중...');
```

### 4. **Figma 스타일 네비게이션**
| 단축키 | 기능 |
|--------|------|
| `← →` | 이전/다음 Canvas로 전환 |
| `드래그` | 좌우로 드래그하여 Canvas 전환 |
| `Cmd/Ctrl + N` | 새 Canvas 생성 |
| `Cmd/Ctrl + W` | 현재 Canvas 닫기 |
| `썸네일 클릭` | 특정 Canvas로 점프 |

---

## 💻 사용 예시

### Canvas 생성 및 관리

```typescript
import { useCanvasManager } from './hooks/useCanvasManager';
import { CanvasWorkspace } from './components/Canvas';

function App() {
  const {
    canvases,
    activeCanvas,
    activeCanvasIndex,
    createCanvas,
    deleteCanvas,
    selectCanvas,
    nextCanvas,
    previousCanvas,
    updateCanvasUrl,
    startAITask,
    stopAITask
  } = useCanvasManager();

  // 새 Canvas 생성
  const handleNewCanvas = () => {
    const canvas = createCanvas('https://www.google.com', 'Google 검색');
    console.log('New canvas created:', canvas.id);
  };

  // Canvas 선택 (특정 Canvas로 점프)
  const handleSelectCanvas = (id: string) => {
    selectCanvas(id);
  };

  // AI 작업 시작
  const handleAITask = (canvasId: string) => {
    startAITask(canvasId, 'AI가 페이지를 분석하고 있습니다...');

    // AI 작업 시뮬레이션
    setTimeout(() => {
      stopAITask(canvasId);
    }, 5000);
  };

  return (
    <CanvasWorkspace
      canvases={canvases}
      activeCanvasId={activeCanvas?.id || null}
      activeCanvasIndex={activeCanvasIndex}
      onSelectCanvas={handleSelectCanvas}
      onCloseCanvas={deleteCanvas}
      onUrlChange={updateCanvasUrl}
      onNextCanvas={nextCanvas}
      onPreviousCanvas={previousCanvas}
      onCreateCanvas={handleNewCanvas}
    />
  );
}
```

---

## 🤖 AI와 Canvas 통합

### AI가 여러 Canvas를 동시에 제어하는 시나리오

```typescript
// 시나리오 1: AI가 3개의 Canvas에서 동시 작업
async function aiMultiTasking() {
  // Canvas 1: Google 검색
  const canvas1 = createCanvas('https://www.google.com', 'Google');
  startAITask(canvas1.id, '검색 중...');
  await performSearch(canvas1.id, 'React best practices');

  // Canvas 2: YouTube 동영상 찾기
  const canvas2 = createCanvas('https://www.youtube.com', 'YouTube');
  startAITask(canvas2.id, '동영상 검색 중...');
  await searchYouTube(canvas2.id, 'React tutorial');

  // Canvas 3: GitHub 코드 탐색
  const canvas3 = createCanvas('https://github.com', 'GitHub');
  startAITask(canvas3.id, 'Repository 탐색 중...');
  await exploreRepository(canvas3.id, 'facebook/react');

  // 모든 작업 완료
  stopAITask(canvas1.id);
  stopAITask(canvas2.id);
  stopAITask(canvas3.id);
}

// 시나리오 2: AI가 Canvas 간 정보 전달
async function aiCrossCanvasTask() {
  // Canvas 1에서 정보 수집
  const canvas1 = createCanvas('https://news.ycombinator.com');
  const articles = await scrapeArticles(canvas1.id);

  // Canvas 2에서 각 기사 상세 분석
  for (const article of articles) {
    const canvas = createCanvas(article.url);
    startAITask(canvas.id, `${article.title} 분석 중...`);
    await analyzeArticle(canvas.id);
  }
}
```

---

## 🎨 Canvas 네비게이션

### 네비게이션 방법

```typescript
// 1. 키보드 화살표로 전환
// ← 키 → 이전 Canvas
// → 키 → 다음 Canvas

// 2. 드래그로 전환
// 왼쪽으로 드래그 → 다음 Canvas
// 오른쪽으로 드래그 → 이전 Canvas

// 3. 프로그래밍 방식
nextCanvas();        // 다음 Canvas로
previousCanvas();    // 이전 Canvas로
selectCanvas('id');  // 특정 Canvas로 점프

// 4. 썸네일 네비게이션
// 하단 썸네일 바에서 Canvas 클릭
```

---

## 🔄 Canvas 상태 관리

### Canvas 객체 구조 (풀스크린 버전)

```typescript
interface Canvas {
  id: string;                    // 고유 ID
  title: string;                 // Canvas 제목
  url: string;                   // 현재 URL
  createdAt: Date;               // 생성 시간
  lastAccessedAt: Date;          // 마지막 접근 시간
  thumbnail?: string;            // Canvas 썸네일 이미지
  aiTaskRunning: boolean;        // AI 작업 실행 중
  aiTaskDescription?: string;    // AI 작업 설명

  // 풀스크린 Canvas는 위치/크기 없음
  // Canvas는 항상 100% 화면을 차지
}
```

---

## 🚀 향후 확장 기능

### 1. **Canvas 템플릿**
```typescript
// 미리 정의된 Canvas 레이아웃
const template = {
  name: 'Web Development',
  canvases: [
    { url: 'https://github.com', x: 0, y: 0 },
    { url: 'https://stackoverflow.com', x: 1250, y: 0 },
    { url: 'https://docs.react.dev', x: 2500, y: 0 }
  ]
};

loadTemplate(template);
```

### 2. **Canvas 그룹**
```typescript
// Canvas들을 그룹으로 묶기
const group = createCanvasGroup(['canvas-1', 'canvas-2', 'canvas-3']);
group.moveTogether(100, 100); // 함께 이동
group.delete(); // 모두 삭제
```

### 3. **Canvas 간 연결선**
```typescript
// Canvas 간 관계 표시 (Figma의 Arrow처럼)
createConnection('canvas-1', 'canvas-2', {
  label: 'Data Flow',
  color: '#1a73e8'
});
```

### 4. **Canvas 히스토리**
```typescript
// Canvas별 이동 히스토리 추적
const history = getCanvasHistory('canvas-1');
history.goBack(); // 이전 페이지
history.goForward(); // 다음 페이지
```

---

## 📊 성능 최적화

### Viewport Culling
- 화면 밖의 Canvas는 렌더링하지 않음
- 성능 향상 및 메모리 절약

```typescript
const visibleCanvases = canvases.filter(canvas => {
  return isInViewport(canvas, viewport);
});
```

### Lazy Loading
- Canvas Webview는 뷰포트에 들어올 때만 로드

---

## 🎯 Best Practices

### DO ✅
- Canvas를 논리적으로 그룹화하여 배치
- AI 작업 상태를 명확히 표시
- 적절한 줌 레벨 유지 (50% ~ 150%)
- Canvas 개수는 10개 이하로 유지

### DON'T ❌
- 너무 많은 Canvas를 동시에 열지 않기
- Canvas를 화면 밖 멀리 배치하지 않기
- 너무 작거나 큰 Canvas 크기

---

## 🔧 트러블슈팅

### Canvas가 느려요
- Canvas 개수 줄이기
- 사용하지 않는 Canvas 닫기
- 줌 레벨을 100%로 리셋

### Canvas가 안 보여요
- 줌 리셋 (Cmd/Ctrl + 0)
- 뷰포트 리셋 버튼 클릭
- Canvas 목록에서 선택

### AI가 Canvas를 제어 못해요
- Canvas가 활성화되어 있는지 확인
- Webview가 로드되었는지 확인
- Playwright 연결 상태 확인

---

**Canvas System으로 더 자유롭고 강력한 웹 브라우징을!** 🎨✨
