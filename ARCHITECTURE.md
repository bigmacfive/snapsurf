# SnapSurf 아키텍처 문서

## 📁 프로젝트 구조

```
src/
├── components/           # React UI 컴포넌트
│   ├── Browser/         # 브라우저 UI
│   │   ├── TabBar.tsx           # 탭 바
│   │   ├── AddressBar.tsx       # 주소창
│   │   └── NavigationBar.tsx    # 네비게이션 버튼
│   ├── Automation/      # 자동화 UI
│   │   └── LogsViewer.tsx       # 로그 뷰어
│   └── Chat/            # 채팅 UI
│       ├── ChatMessages.tsx     # 메시지 목록
│       └── ModelSelector.tsx    # 모델 선택기
│
├── hooks/               # React Custom Hooks
│   ├── useTabManager.ts         # 탭 관리
│   ├── useBrowserState.ts       # 브라우저 상태
│   ├── useAutomationLogs.ts     # 로그 관리
│   └── useChat.ts               # 채팅 상태
│
├── services/            # 비즈니스 로직 & 서비스 레이어
│   ├── automation/
│   │   ├── AutomationExecutor.ts    # 기본 자동화 실행
│   │   └── ComputerUseExecutor.ts   # Computer Use 실행
│   ├── browser/
│   │   └── ScreenshotService.ts     # 스크린샷 캡처
│   └── ai/
│       ├── GeminiService.ts         # Gemini AI 통합
│       └── OrchestratorService.ts   # 작업 오케스트레이션
│
├── types/               # TypeScript 타입 정의
│   ├── browser.ts       # 브라우저 타입
│   ├── automation.ts    # 자동화 타입
│   ├── ai.ts            # AI 타입
│   ├── electron.ts      # Electron API 타입
│   └── index.ts         # 통합 export
│
├── utils/               # 유틸리티 함수
│   ├── webviewExecutor.ts   # Webview JavaScript 실행
│   ├── logger.ts            # 로깅
│   ├── urlHelper.ts         # URL 처리
│   └── index.ts             # 통합 export
│
├── App.tsx              # 메인 애플리케이션 (통합 레이어)
├── main.tsx             # React 엔트리포인트
└── App.css              # 스타일

electron/                # Electron 메인 프로세스
├── main.ts              # Electron 메인
├── preload.ts           # IPC 브릿지
├── playwright-browser.ts    # Playwright 엔진
└── playwright-mcp.ts    # MCP 통합
```

---

## 🏗️ 아키텍처 레이어

### 1️⃣ **Presentation Layer (UI Components)**
**위치:** `src/components/`

**역할:** 순수 UI 컴포넌트로, 사용자 인터페이스만 담당합니다.

**원칙:**
- Props로 데이터와 이벤트 핸들러를 받습니다
- 비즈니스 로직을 포함하지 않습니다
- 재사용 가능하고 독립적입니다

**예시:**
```typescript
// components/Browser/TabBar.tsx
export function TabBar({ tabs, activeTabId, onSwitchTab }) {
  return (
    <div className="tabs-bar">
      {tabs.map(tab => (
        <div onClick={() => onSwitchTab(tab.id)}>
          {tab.title}
        </div>
      ))}
    </div>
  );
}
```

---

### 2️⃣ **State Management Layer (Hooks)**
**위치:** `src/hooks/`

**역할:** 상태 관리와 컴포넌트 로직을 캡슐화합니다.

**제공 Hooks:**
- `useTabManager` - 탭 생성/삭제/전환
- `useBrowserState` - URL, 네비게이션 상태
- `useAutomationLogs` - 로그 추가/삭제
- `useChat` - 채팅 메시지 관리

**예시:**
```typescript
// hooks/useTabManager.ts
export function useTabManager() {
  const [tabs, setTabs] = useState([...]);
  const [activeTabId, setActiveTabId] = useState('1');

  const addTab = () => { /* ... */ };
  const closeTab = (id) => { /* ... */ };

  return { tabs, activeTabId, addTab, closeTab };
}
```

---

### 3️⃣ **Business Logic Layer (Services)**
**위치:** `src/services/`

**역할:** 핵심 비즈니스 로직과 외부 API 통신을 처리합니다.

**서브 레이어:**

#### **Automation Services**
- `AutomationExecutor` - 기본 브라우저 자동화 (클릭, 입력, 스크롤 등)
- `ComputerUseExecutor` - Playwright 기반 Computer Use 실행

#### **Browser Services**
- `ScreenshotService` - Webview 스크린샷 캡처

#### **AI Services**
- `GeminiService` - Google Gemini API 통합
  - 자연어 → 액션 플랜 변환
  - Computer Use 모델 연동
  - 복잡도 판단
- `OrchestratorService` - 작업 오케스트레이션
  - 계획 수립 (Planning)
  - 실행 (Execution)
  - 검증 (Verification)
  - 적응 (Adaptation)

**예시:**
```typescript
// services/automation/AutomationExecutor.ts
export class AutomationExecutor {
  async executeClick(webviewRef, selector) {
    const clicked = await executeInWebview(webviewRef, `...`);
    return { success: clicked };
  }
}
```

---

### 4️⃣ **Utility Layer (Utils)**
**위치:** `src/utils/`

**역할:** 순수 함수와 헬퍼 함수를 제공합니다.

**제공 유틸:**
- `webviewExecutor` - Webview JavaScript 실행
- `logger` - 로깅 클래스 및 기본 인스턴스
- `urlHelper` - URL 정규화, 검증, 호스트 추출

**특징:**
- 사이드 이펙트 최소화
- 재사용성 극대화
- 테스트 용이

---

### 5️⃣ **Type Definition Layer (Types)**
**위치:** `src/types/`

**역할:** TypeScript 타입 안정성을 제공합니다.

**타입 카테고리:**
- `browser.ts` - Tab, NavigationState, BrowserState
- `automation.ts` - ComputerUseAction, ActionPlan, ExecutionResult
- `ai.ts` - ChatMessage, ModelType, ChatState
- `electron.ts` - ElectronAPI, Window 인터페이스

**원칙:**
- 모든 인터페이스는 명확하게 정의
- export로 중앙 집중식 관리
- 중복 제거

---

## 🔄 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                          User Input                          │
│                    (Click, Type, Chat)                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    App.tsx (통합 레이어)                      │
│  - 모든 Hooks 사용                                            │
│  - 서비스 호출                                                │
│  - 컴포넌트 조합                                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Hooks      │ │  Services    │ │  Components  │
│              │ │              │ │              │
│ - Tab 관리   │ │ - AI 통합    │ │ - TabBar     │
│ - State 관리 │ │ - 자동화     │ │ - Chat       │
│ - Log 관리   │ │ - Screenshot │ │ - Logs       │
└──────────────┘ └──────────────┘ └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ▼
                  ┌─────────────┐
                  │   Utils     │
                  │  & Types    │
                  └─────────────┘
```

---

## 💡 모듈화 원칙

### 1. **단일 책임 원칙 (SRP)**
각 모듈은 하나의 명확한 책임만 가집니다.

**예:**
- `TabBar.tsx` → 탭 UI만 표시
- `useTabManager.ts` → 탭 상태 관리만
- `AutomationExecutor.ts` → 자동화 실행만

### 2. **의존성 역전 (DIP)**
상위 레이어가 하위 레이어에 의존합니다.

```
App.tsx (상위)
    ↓ 의존
Hooks (중간)
    ↓ 의존
Services (하위)
    ↓ 의존
Utils (최하위)
```

### 3. **관심사 분리 (SoC)**
UI, 상태, 비즈니스 로직, 유틸리티가 명확히 분리됩니다.

### 4. **재사용성**
모든 모듈은 독립적이고 재사용 가능합니다.

### 5. **테스트 용이성**
각 레이어를 독립적으로 테스트할 수 있습니다.

---

## 🚀 사용 예시

### App.tsx에서 모듈 사용

```typescript
import { useTabManager, useBrowserState, useChat } from './hooks';
import { TabBar, AddressBar, ChatMessages } from './components';
import { AutomationExecutor, GeminiService } from './services';
import { Logger } from './utils';

function App() {
  // Hooks로 상태 관리
  const { tabs, activeTabId, addTab, closeTab } = useTabManager();
  const { url, currentUrl, navigate } = useBrowserState();
  const { messages, addUserMessage } = useChat();

  // Services 인스턴스
  const logger = new Logger();
  const executor = new AutomationExecutor(logger);

  // 컴포넌트 렌더링
  return (
    <div>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onAddTab={addTab}
        onCloseTab={closeTab}
      />
      <AddressBar
        url={url}
        onNavigate={() => navigate(url)}
      />
      <ChatMessages messages={messages} />
    </div>
  );
}
```

---

## 🛠️ 확장 가능성

### 새로운 기능 추가 시

1. **새로운 UI가 필요한 경우:**
   - `src/components/` 에 컴포넌트 추가

2. **새로운 상태 관리가 필요한 경우:**
   - `src/hooks/` 에 Hook 추가

3. **새로운 비즈니스 로직이 필요한 경우:**
   - `src/services/` 에 Service 클래스 추가

4. **새로운 유틸리티가 필요한 경우:**
   - `src/utils/` 에 함수 추가

5. **새로운 타입이 필요한 경우:**
   - `src/types/` 에 인터페이스 추가

---

## 📝 모범 사례

### ✅ DO
- 각 파일은 하나의 책임만 가져야 합니다
- Hooks는 상태 로직만, Components는 UI만
- Services는 외부 API 호출과 복잡한 로직 처리
- 모든 타입을 `types/`에서 import
- 공통 로직은 utils로 분리

### ❌ DON'T
- 컴포넌트에 비즈니스 로직 포함 금지
- Hooks에서 직접 API 호출 금지
- 타입 중복 정의 금지
- 순환 의존성 생성 금지

---

## 📚 참고 자료

- **React Hooks 패턴:** [React 공식 문서](https://react.dev/reference/react)
- **Clean Architecture:** Robert C. Martin
- **레이어드 아키텍처:** Enterprise Architecture Patterns

---

**작성일:** 2025-01-22
**버전:** 1.0.0
**작성자:** Claude Code Assistant
