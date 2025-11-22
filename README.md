# SnapSurf Browser

Electron + TypeScript + React 기반 웹 브라우저 with 자동화 기능

## 주요 기능

- 🌐 웹 브라우저 (탭, 네비게이션, 주소창)
- 🤖 브라우저 자동화 (webview 직접 제어)
- 💬 자연어 명령으로 자동화 제어
- 🖱️ 요소 클릭, 텍스트 입력, 페이지 이동 등 자동화 작업

## 설치

```bash
npm install
```

## 개발 모드 실행

```bash
npm run dev
```

## 빌드

```bash
npm run build
npm run build:electron
npm start
```

## 자동화 사용법

1. 툴바의 ⚙ 버튼을 클릭하여 자동화 패널 열기
2. 자연어 명령 입력 (예: "구글.com으로 이동" 또는 "클릭 'button'")
3. 또는 빠른 작업 버튼 사용

### 지원하는 자연어 명령

- "구글.com으로 이동" / "goto google.com" - 페이지 이동
- "클릭 'button'" / "click 'selector'" - 요소 클릭
- "입력 'input' '텍스트'" / "fill 'selector' 'text'" - 텍스트 입력
- "텍스트 'selector' 가져와" - 요소 텍스트 추출
- "스크린샷" / "screenshot" - 현재 URL 확인

**참고:** 자동화는 현재 브라우저 창의 webview에서 직접 실행됩니다. 별도 창이 열리지 않습니다.

