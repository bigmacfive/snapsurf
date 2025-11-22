import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyAkES1F-8NmtQrLtngBRjbcchi7KK41LIQ';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ComputerUseAction {
  action: 'goto' | 'click' | 'type' | 'scroll' | 'key' | 'wait' | 'screenshot' | 'done' | 
          'doubleClick' | 'rightClick' | 'hover' | 'select' | 'checkbox' | 'drag' | 
          'goBack' | 'goForward' | 'reload' | 'getText';
  params?: {
    url?: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    keys?: string[]; // 키 조합용
    direction?: 'up' | 'down' | 'left' | 'right' | 'to';
    timeout?: number;
    value?: string;
    checked?: boolean;
    fromX?: number;
    fromY?: number;
    toX?: number;
    toY?: number;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    pressEnter?: boolean;
    selector?: string;
    amount?: number;
  };
  message?: string;
}

// 복잡한 작업인지 판단 (Gemini 2.5 Flash Lite 사용)
export async function isComplexTask(userMessage: string): Promise<boolean> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
    });

    const prompt = `다음 사용자 요청이 복잡한 브라우저 자동화 작업인지 판단해주세요.

사용자 요청: "${userMessage}"

복잡한 작업의 예시:
- 여러 단계가 필요한 작업 (예: 검색 → 여러 페이지 탐색 → 특정 조건의 링크 찾기 → 열기)
- 조건부 검색이나 필터링이 필요한 작업
- 여러 페이지를 넘나들며 정보를 수집하는 작업
- 스크린샷을 보고 시각적으로 요소를 찾아야 하는 작업
- 게임 플레이나 인터랙티브한 작업

간단한 작업의 예시:
- 특정 URL로 이동
- 검색창에 텍스트 입력하고 검색
- 버튼 클릭
- 페이지 스크롤

응답은 반드시 JSON 형식으로만 해주세요:
{
  "isComplex": true 또는 false,
  "reason": "간단한 이유 설명"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.isComplex === true;
      } catch (e) {
        console.log('복잡도 판단 JSON 파싱 오류:', e);
      }
    }
    
    // 파싱 실패 시 폴백: 키워드 기반 판단
    const complexKeywords = [
      '몇개의 탭', '여러 페이지', '여러번', '반복', '계속',
      '찾아서', '조건', '필터', '제외', '제외하고',
      '복잡', '어려운', '자동으로', '스마트하게',
      '여러 단계', '순차적으로', '단계별로',
      '국외', '외국', '영어', 'english',
      '검색하고 찾고', '검색 후', '찾아서 열어',
      '플레이', '게임', '리스트업', '정리'
    ];
    
    const lowerMessage = userMessage.toLowerCase();
    return complexKeywords.some(keyword => lowerMessage.includes(keyword)) ||
           userMessage.split(' ').length > 10 ||
           (userMessage.includes('검색') && userMessage.includes('찾') && userMessage.includes('열'));
  } catch (error: any) {
    console.log('복잡도 판단 오류:', error.message);
    // 오류 시 폴백: 키워드 기반 판단
    const complexKeywords = [
      '몇개의 탭', '여러 페이지', '여러번', '반복', '계속',
      '찾아서', '조건', '필터', '제외', '제외하고',
      '복잡', '어려운', '자동으로', '스마트하게',
      '여러 단계', '순차적으로', '단계별로',
      '국외', '외국', '영어', 'english',
      '검색하고 찾고', '검색 후', '찾아서 열어',
      '플레이', '게임', '리스트업', '정리'
    ];
    
    const lowerMessage = userMessage.toLowerCase();
    return complexKeywords.some(keyword => lowerMessage.includes(keyword)) ||
           userMessage.split(' ').length > 10 ||
           (userMessage.includes('검색') && userMessage.includes('찾') && userMessage.includes('열'));
  }
}

export async function sendMessageToGemini(
  messages: ChatMessage[],
  currentUrl?: string,
  model: 'flash' | 'flash-lite' | 'pro' = 'flash'
): Promise<string> {
  try {
    const systemPrompt = `You are a browser automation assistant. You help users control their web browser through natural language commands.

Current browser URL: ${currentUrl || 'Unknown'}

You are a comprehensive browser automation assistant with Playwright-like capabilities.

Available actions:
1. Navigation:
   - "goto" - Navigate to URL
   - "goBack" - Go back in history
   - "goForward" - Go forward in history
   - "reload" - Reload current page

2. Element Interaction:
   - "click" - Click element (supports selector, findByText, newTab)
   - "doubleClick" - Double click element
   - "rightClick" - Right click element
   - "hover" - Hover over element
   - "fill" - Fill input field (auto-submits for search boxes)
   - "press" - Press keyboard key (Enter, Escape, Tab, Arrow keys, etc.)
   - "type" - Type text with keyboard events
   - "select" - Select option in dropdown/select element
   - "checkbox" - Check/uncheck checkbox
   - "upload" - Upload file to file input

3. Scrolling & Viewing:
   - "scroll" - Scroll page (down, up, or to selector)
   - "wait" - Wait for element to appear or condition
   - "waitForSelector" - Wait for specific selector
   - "waitForNavigation" - Wait for page navigation

4. Information Extraction:
   - "text" - Get text content from element
   - "getAttribute" - Get element attribute value
   - "getTitle" - Get page title
   - "getUrl" - Get current URL
   - "isVisible" - Check if element is visible
   - "screenshot" - Take screenshot

5. Advanced:
   - "evaluate" - Execute JavaScript in page context
   - "drag" - Drag and drop element
   - "download" - Download file from link
   - "nextPage" - Go to next page in pagination (click "Next" button or page number)
   - "findLink" - Find and click link matching criteria (text, domain, etc.)
   - "searchInResults" - Search for links in current page matching criteria

Action format:
{
  "action": "goto" | "click" | "fill" | "scroll" | "text" | "screenshot" | "wait" | "press" | "hover" | "doubleClick" | "rightClick" | "select" | "checkbox" | "type" | "getAttribute" | "isVisible" | "goBack" | "goForward" | "reload" | "getTitle" | "getUrl" | "waitForSelector" | "waitForNavigation" | "evaluate" | "drag" | "upload" | "download" | "nextPage" | "findLink" | "searchInResults",
  "params": {
    "url"?: "string",
    "selector"?: "string",
    "text"?: "string",
    "key"?: "string" (for press: Enter, Escape, Tab, ArrowUp, ArrowDown, etc.),
    "value"?: "string" (for select, checkbox, getAttribute),
    "checked"?: boolean (for checkbox),
    "timeout"?: number (for wait actions, in milliseconds),
    "submit"?: boolean,
    "direction"?: "down" | "up" | "to",
    "newTab"?: boolean,
    "findByText"?: "string",
    "code"?: "string" (for evaluate - JavaScript code),
    "fromSelector"?: "string" (for drag),
    "toSelector"?: "string" (for drag),
    "filePath"?: "string" (for upload),
    "criteria"?: "string" (for findLink/searchInResults - e.g., "국외자료", "외국", "영어", "english", specific domain),
    "maxPages"?: number (for nextPage - maximum pages to navigate),
    "mustMatch"?: "string" (for findLink - text or domain that must be in link)
  },
  "message": "human readable response"
}

IMPORTANT FOR COMPLEX TASKS:
- When user asks to search and find something across multiple pages, break it down into steps:
  1. First, perform the search (goto + fill + submit)
  2. Use "nextPage" to navigate through result pages if user says "몇개의 탭을 넘겨서라도", "여러 페이지", "next pages", etc.
  3. Use "findLink" with criteria like "국외자료", "외국", "foreign", "english" to find external/foreign links
  4. The findLink action will automatically click the found link

Example for "감바스의 역사에 대해 한국어로 구글에 검색하고 몇개의 탭을 넘겨서라도 국외자료를 찾아서 열어":
[
  {"action": "goto", "params": {"url": "https://www.google.com"}},
  {"action": "fill", "params": {"selector": "textarea[name='q']", "text": "감바스의 역사"}},
  {"action": "waitForNavigation", "params": {"timeout": 3000}},
  {"action": "nextPage", "params": {"maxPages": 3}},
  {"action": "findLink", "params": {"criteria": "국외자료", "mustMatch": ""}, "message": "국외자료 링크를 찾아서 클릭합니다"}
]

CRITICAL: 
- Always break down complex requests into multiple sequential actions
- Use "nextPage" when user mentions navigating through multiple pages/tabs
- Use "findLink" with appropriate criteria for finding specific types of links (foreign, external, etc.)
- Always include waitForNavigation after page changes
- If user says "몇개의 탭을 넘겨서라도" or "여러 페이지", use nextPage with maxPages: 3-5

IMPORTANT: When filling a search box or form input, always include the submit action or let the fill action auto-submit. For example, if user says "search for X", you should fill the search input AND submit it (either by clicking submit button or pressing Enter).

If multiple actions are needed, return an array of action objects.

CRITICAL RULES:
1. ALWAYS respond with valid JSON when user asks to perform actions
2. Break down complex requests into multiple sequential actions
3. For searches with "몇개의 탭을 넘겨서라도" or "여러 페이지", use nextPage action
4. For finding "국외자료" or "외국" links, use findLink with criteria
5. Always include waitForNavigation after page changes
6. If you cannot understand the request, respond with JSON containing action: "text" and message explaining the issue

If the user is just asking a question or having a conversation, respond naturally without the JSON format.`;

    // systemInstruction을 사용하여 프롬프트 설정
    let modelName: string;
    if (model === 'pro') {
      modelName = 'gemini-2.5-pro';
    } else if (model === 'flash-lite') {
      modelName = 'gemini-2.5-flash-lite';
    } else {
      modelName = 'gemini-2.5-flash';
    }
    
    const chatModel = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemPrompt
    });

    // 히스토리 준비: 첫 번째 메시지는 반드시 user여야 함
    const historyMessages = messages.slice(0, -1);
    const validHistory = [];
    
    // 첫 번째 메시지가 user가 아니면 제외
    let startIndex = 0;
    while (startIndex < historyMessages.length && historyMessages[startIndex].role !== 'user') {
      startIndex++;
    }
    
    // user로 시작하는 히스토리만 사용
    for (let i = startIndex; i < historyMessages.length; i++) {
      const msg = historyMessages[i];
      validHistory.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    const chat = chatModel.startChat({
      history: validHistory.length > 0 ? validHistory : undefined,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048, // 복잡한 작업을 위해 증가
      },
    });

    const userMessage = messages[messages.length - 1].content;
    const fullMessage = currentUrl 
      ? `${userMessage}\n\nCurrent page: ${currentUrl}`
      : userMessage;

    const result = await chat.sendMessage(fullMessage);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    throw new Error(`Gemini API 오류: ${error.message}`);
  }
}

export function parseGeminiResponse(response: string): any {
  try {
    // JSON 응답 파싱 시도
    const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Computer Use 모델로 작업 실행
export async function executeWithComputerUse(
  userMessage: string,
  screenshotBase64: string,
  currentUrl: string,
  actionHistory: ComputerUseAction[] = [],
  originalUserMessage: string = ''
): Promise<ComputerUseAction> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-computer-use-preview-10-2025',
      tools: [{ computerUse: {} } as any]
    });

    // 스크린샷을 base64로 변환 (이미 base64인 경우 그대로 사용)
    const imagePart = {
      inlineData: {
        data: screenshotBase64.includes('data:image') 
          ? screenshotBase64.split(',')[1] 
          : screenshotBase64,
        mimeType: 'image/png'
      }
    };

    // 작업 이력 텍스트 생성
    const historyText = actionHistory.length > 0
      ? `\n\n최근 작업 이력:\n${actionHistory.slice(-5).map((a, i) => `${i + 1}. ${a.action}${a.params ? ' ' + JSON.stringify(a.params) : ''}`).join('\n')}`
      : '';

    // 원본 사용자 메시지 사용 (전체 컨텍스트 유지)
    const fullUserMessage = originalUserMessage || userMessage;
    
    // URL 추출을 위한 메시지 저장
    const messageForUrlExtraction = fullUserMessage;

    const prompt = `User wants to: ${fullUserMessage}

Current URL: ${currentUrl}${historyText}

You are controlling a web browser using Computer Use capabilities. Look at the screenshot and decide what action to take next.

**IMPORTANT GUIDELINES:**
1. If user mentions a website name (like "부킹닷컴", "booking.com", "구글", etc.), use open_web_browser with the full URL
2. Break down complex tasks into multiple steps
3. Use coordinates (x, y) from the screenshot for precise interactions
4. Wait for page loads after navigation actions
5. Use appropriate actions for the task - don't use unnecessary actions

**ALL AVAILABLE ACTIONS (use any of these):**
- open_web_browser(url: string) - Navigate to a URL
- navigate_to_url(url: string) - Navigate to a URL
- type_text_at(text: string, x?: number, y?: number) - Type text at coordinates or focused element
- type_text(text: string, x?: number, y?: number) - Type text
- input_text(text: string) - Input text
- click_at(x: number, y: number) - Click at coordinates
- click_element(x: number, y: number) - Click element
- click(x: number, y: number) - Click
- double_click(x: number, y: number) - Double click
- double_click_at(x: number, y: number) - Double click at coordinates
- right_click(x: number, y: number) - Right click
- right_click_at(x: number, y: number) - Right click at coordinates
- context_menu(x: number, y: number) - Open context menu
- hover(x: number, y: number) - Hover at coordinates
- hover_at(x: number, y: number) - Hover at coordinates
- mouse_over(x: number, y: number) - Mouse over
- scroll(direction: "up" | "down" | "left" | "right", amount?: number) - Scroll the page
- scroll_page(direction: "up" | "down" | "left" | "right") - Scroll page
- scroll_document(direction: "up" | "down" | "left" | "right") - Scroll document
- scroll_to_element(selector: string) - Scroll to element
- scroll_to(selector: string) - Scroll to
- press_key(key: string) - Press a key (Enter, Escape, Tab, ArrowUp, ArrowDown, etc.)
- key_press(key: string) - Press key
- press_enter() - Press Enter
- press_return() - Press Return
- press_escape() - Press Escape
- press_tab() - Press Tab
- press_arrow_up() - Press Arrow Up
- press_arrow_down() - Press Arrow Down
- press_arrow_left() - Press Arrow Left
- press_arrow_right() - Press Arrow Right
- key_combination(keys: string[]) - Press key combination
- press_keys(keys: string[]) - Press multiple keys
- key_combo(keys: string[]) - Key combination
- select_option(value: string, x?: number, y?: number) - Select dropdown option
- select_dropdown(value: string) - Select from dropdown
- select(value: string) - Select option
- checkbox(checked: boolean, x?: number, y?: number) - Toggle checkbox
- toggle_checkbox(checked: boolean) - Toggle checkbox
- check(x?: number, y?: number) - Check checkbox
- uncheck(x?: number, y?: number) - Uncheck checkbox
- drag_and_drop(fromX: number, fromY: number, toX: number, toY: number) - Drag and drop
- drag_to(fromX: number, fromY: number, toX: number, toY: number) - Drag to
- drag(fromX: number, fromY: number, toX: number, toY: number) - Drag
- submit_form() - Submit form
- submit() - Submit
- go_back() - Navigate back
- navigate_back() - Navigate back
- go_forward() - Navigate forward
- navigate_forward() - Navigate forward
- reload() - Reload page
- reload_page() - Reload page
- refresh() - Refresh page
- get_text(x?: number, y?: number) - Extract text
- extract_text(x?: number, y?: number) - Extract text
- read_text(x?: number, y?: number) - Read text
- screenshot() - Take screenshot
- take_screenshot() - Take screenshot
- find_element(selector?: string) - Find element
- locate_element(selector?: string) - Locate element
- wait(timeout: number) - Wait for specified milliseconds
- wait_for(timeout: number) - Wait for
- wait_for_element(selector: string, timeout?: number) - Wait for element
- done() - Task is complete
- complete() - Complete task
- finish() - Finish task

For the user's request "${userMessage}", determine the next action based on the current screenshot.`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    
    // 디버깅: 응답 구조 확인
    console.log('Computer Use 응답:', {
      hasText: !!response.text(),
      textLength: response.text()?.length,
      candidates: response.candidates?.length,
      functionCalls: response.functionCalls?.()?.length
    });
    
    // 도구 호출 응답 확인
    try {
      const functionCalls = response.functionCalls?.();
      if (functionCalls && functionCalls.length > 0) {
        console.log('도구 호출 발견:', functionCalls);
        // Computer Use 도구 호출 처리
        const call = functionCalls[0];
        const toolName = call.name;
        const args = call.args as any;
        
        console.log('도구 이름:', toolName, '인자:', args);
        
        // Computer Use 모델의 실제 도구 이름에 따라 변환
        switch (toolName) {
          case 'open_web_browser':
          case 'navigate_to_url':
          case 'navigate':
            // URL로 이동 - App.tsx에서 goto 처리
            let url = args.url || args.uri || args.href || args.address || args.link;
            
            // args가 비어있으면 사용자 메시지에서 URL 추출
            const messageToSearch = messageForUrlExtraction || userMessage;
            if (!url && messageToSearch) {
              // 일반적인 웹사이트 URL 패턴 찾기
              const urlMatch = messageToSearch.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/);
              if (urlMatch) {
                url = urlMatch[1];
                if (!url.startsWith('http')) {
                  url = 'https://' + url;
                }
              } else {
                // 웹사이트 이름으로 URL 구성
                const siteNames: { [key: string]: string } = {
                  '부킹닷컴': 'https://www.booking.com',
                  'booking': 'https://www.booking.com',
                  'booking.com': 'https://www.booking.com',
                  '구글': 'https://www.google.com',
                  'google': 'https://www.google.com',
                  '네이버': 'https://www.naver.com',
                  'naver': 'https://www.naver.com',
                  '다음': 'https://www.daum.net',
                  'daum': 'https://www.daum.net',
                  '유튜브': 'https://www.youtube.com',
                  'youtube': 'https://www.youtube.com'
                };
                
                const lowerMessage = messageToSearch.toLowerCase();
                for (const [name, siteUrl] of Object.entries(siteNames)) {
                  if (lowerMessage.includes(name.toLowerCase())) {
                    url = siteUrl;
                    break;
                  }
                }
              }
            }
            
            if (!url) {
              url = 'https://www.google.com'; // 기본값
            }
            
            return {
              action: 'goto' as any,
              params: { url },
              message: `브라우저 이동: ${url}`
            } as ComputerUseAction;
            
          case 'type_text_at':
          case 'type_text':
          case 'input_text':
            // 텍스트 입력
            return {
              action: 'type',
              params: { 
                text: args.text || args.input || args.value,
                x: args.x,
                y: args.y,
                pressEnter: args.press_enter || args.pressEnter || false
              },
              message: `텍스트 입력: ${args.text || args.input || args.value}${args.press_enter || args.pressEnter ? ' (Enter 키 포함)' : ''}`
            } as ComputerUseAction;
            
          case 'click_at':
          case 'click_element':
          case 'click':
            // 클릭
            return {
              action: 'click',
              params: { 
                x: args.x || args.coordinate?.x,
                y: args.y || args.coordinate?.y
              },
              message: `클릭: (${args.x || args.coordinate?.x}, ${args.y || args.coordinate?.y})`
            } as ComputerUseAction;
            
          case 'scroll':
          case 'scroll_page':
          case 'scroll_document':
            // 스크롤
            return {
              action: 'scroll',
              params: { 
                direction: args.direction || 'down',
                amount: args.amount || args.pixels || 500
              },
              message: `스크롤: ${args.direction || 'down'}`
            } as ComputerUseAction;
            
          case 'press_key':
          case 'key_press':
            // 키 입력
            return {
              action: 'key',
              params: { 
                key: args.key || args.keyCode
              },
              message: `키 입력: ${args.key || args.keyCode}`
            } as ComputerUseAction;
            
          case 'wait':
          case 'wait_for':
          case 'wait_for_element':
            // 대기
            return {
              action: 'wait',
              params: { 
                timeout: args.timeout || args.duration || 1000
              },
              message: `대기: ${args.timeout || args.duration || 1000}ms`
            } as ComputerUseAction;
            
          case 'double_click':
          case 'double_click_at':
            // 더블클릭
            return {
              action: 'doubleClick',
              params: { 
                x: args.x || args.coordinate?.x,
                y: args.y || args.coordinate?.y
              },
              message: `더블클릭: (${args.x || args.coordinate?.x}, ${args.y || args.coordinate?.y})`
            } as ComputerUseAction;
            
          case 'right_click':
          case 'right_click_at':
          case 'context_menu':
            // 우클릭
            return {
              action: 'rightClick',
              params: { 
                x: args.x || args.coordinate?.x,
                y: args.y || args.coordinate?.y
              },
              message: `우클릭: (${args.x || args.coordinate?.x}, ${args.y || args.coordinate?.y})`
            } as ComputerUseAction;
            
          case 'hover':
          case 'mouse_over':
          case 'hover_at':
            // 호버
            return {
              action: 'hover',
              params: { 
                x: args.x || args.coordinate?.x,
                y: args.y || args.coordinate?.y
              },
              message: `호버: (${args.x || args.coordinate?.x}, ${args.y || args.coordinate?.y})`
            } as ComputerUseAction;
            
          case 'select_option':
          case 'select_dropdown':
          case 'select':
            // 드롭다운 선택
            return {
              action: 'select',
              params: { 
                value: args.value || args.option || args.text,
                x: args.x,
                y: args.y
              },
              message: `선택: ${args.value || args.option || args.text}`
            } as ComputerUseAction;
            
          case 'checkbox':
          case 'toggle_checkbox':
          case 'check':
          case 'uncheck':
            // 체크박스
            return {
              action: 'checkbox',
              params: { 
                checked: args.checked !== false,
                x: args.x,
                y: args.y
              },
              message: `체크박스: ${args.checked !== false ? '체크' : '해제'}`
            } as ComputerUseAction;
            
          case 'drag':
          case 'drag_and_drop':
          case 'drag_to':
            // 드래그 앤 드롭
            return {
              action: 'drag',
              params: { 
                startX: args.fromX || args.startX || args.x,
                startY: args.fromY || args.startY || args.y,
                endX: args.toX || args.endX || args.targetX,
                endY: args.toY || args.endY || args.targetY
              },
              message: `드래그: (${args.fromX || args.startX || args.x}, ${args.fromY || args.startY || args.y}) → (${args.toX || args.endX || args.targetX}, ${args.toY || args.endY || args.targetY})`
            } as ComputerUseAction;
            
          case 'submit_form':
          case 'submit':
            // 폼 제출
            return {
              action: 'key',
              params: { key: 'Enter' },
              message: '폼 제출'
            } as ComputerUseAction;
            
          case 'go_back':
          case 'navigate_back':
            // 뒤로 가기
            return {
              action: 'goBack',
              params: {},
              message: '뒤로 가기'
            } as ComputerUseAction;
            
          case 'go_forward':
          case 'navigate_forward':
            // 앞으로 가기
            return {
              action: 'goForward',
              params: {},
              message: '앞으로 가기'
            } as ComputerUseAction;
            
          case 'reload':
          case 'reload_page':
          case 'refresh':
            // 새로고침
            return {
              action: 'reload',
              params: {},
              message: '새로고침'
            } as ComputerUseAction;
            
          case 'get_text':
          case 'extract_text':
          case 'read_text':
            // 텍스트 추출 (정보 수집용)
            return {
              action: 'getText',
              params: { 
                x: args.x,
                y: args.y
              },
              message: '텍스트 추출'
            } as ComputerUseAction;
            
          case 'screenshot':
          case 'take_screenshot':
            // 스크린샷
            return {
              action: 'screenshot',
              params: {},
              message: '스크린샷 촬영'
            } as ComputerUseAction;
            
          case 'find_element':
          case 'locate_element':
            // 요소 찾기 (다음 액션을 위한 준비)
            return {
              action: 'wait',
              params: { timeout: 500 },
              message: '요소 찾기'
            } as ComputerUseAction;
            
          case 'scroll_to_element':
          case 'scroll_to':
            // 특정 요소로 스크롤
            return {
              action: 'scroll',
              params: { 
                direction: 'to',
                selector: args.selector || args.element
              },
              message: '요소로 스크롤'
            } as ComputerUseAction;
            
          case 'press_enter':
          case 'press_return':
            // Enter 키
            return {
              action: 'key',
              params: { key: 'Enter' },
              message: 'Enter 키 입력'
            } as ComputerUseAction;
            
          case 'press_escape':
            // Escape 키
            return {
              action: 'key',
              params: { key: 'Escape' },
              message: 'Escape 키 입력'
            } as ComputerUseAction;
            
          case 'press_tab':
            // Tab 키
            return {
              action: 'key',
              params: { key: 'Tab' },
              message: 'Tab 키 입력'
            } as ComputerUseAction;
            
          case 'key_combination':
          case 'press_keys':
          case 'key_combo':
            // 키 조합 (여러 키 동시 입력)
            const keys = args.keys || args.key || args.keyCode || [];
            const keyArray = Array.isArray(keys) ? keys : [keys];
            // 첫 번째 키만 사용 (순차적으로 처리)
            return {
              action: 'key',
              params: { 
                key: keyArray[0] || args.key || 'Enter',
                keys: keyArray // 전체 키 배열도 저장
              },
              message: `키 조합: ${keyArray.join(' + ')}`
            } as ComputerUseAction;
            
          case 'arrow_up':
          case 'press_arrow_up':
            return {
              action: 'key',
              params: { key: 'ArrowUp' },
              message: '위쪽 화살표 키'
            } as ComputerUseAction;
            
          case 'arrow_down':
          case 'press_arrow_down':
            return {
              action: 'key',
              params: { key: 'ArrowDown' },
              message: '아래쪽 화살표 키'
            } as ComputerUseAction;
            
          case 'arrow_left':
          case 'press_arrow_left':
            return {
              action: 'key',
              params: { key: 'ArrowLeft' },
              message: '왼쪽 화살표 키'
            } as ComputerUseAction;
            
          case 'arrow_right':
          case 'press_arrow_right':
            return {
              action: 'key',
              params: { key: 'ArrowRight' },
              message: '오른쪽 화살표 키'
            } as ComputerUseAction;
            
          case 'done':
          case 'complete':
          case 'finish':
            // 작업 완료
            return {
              action: 'done',
              params: {},
              message: args.message || '작업 완료'
            } as ComputerUseAction;
            
          default:
            // 알 수 없는 도구 - args에서 직접 추출 시도
            if (args.action) {
              return {
                action: args.action,
                params: args.params || args,
                message: args.message || `${toolName} 실행`
              } as ComputerUseAction;
            }
            
            // x, y가 있으면 클릭으로 간주
            if (args.x !== undefined || args.y !== undefined) {
              return {
                action: 'click',
                params: { x: args.x, y: args.y },
                message: `클릭: (${args.x}, ${args.y})`
              } as ComputerUseAction;
            }
            
            // text가 있으면 입력으로 간주
            if (args.text || args.input || args.value) {
              return {
                action: 'type',
                params: { text: args.text || args.input || args.value },
                message: `입력: ${args.text || args.input || args.value}`
              } as ComputerUseAction;
            }
            
            console.warn('알 수 없는 도구:', toolName, args);
            return {
              action: 'done',
              message: `알 수 없는 도구: ${toolName}`
            } as ComputerUseAction;
        }
      }
    } catch (e) {
      console.log('도구 호출 파싱 오류:', e);
    }
    
    // 텍스트 응답 처리
    const text = response.text();
    if (text) {
      console.log('텍스트 응답:', text.substring(0, 200));
      
      // JSON 파싱 시도
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.action) {
            return parsed as ComputerUseAction;
          }
        } catch (e) {
          console.log('JSON 파싱 오류:', e);
        }
      }
      
      // 텍스트에서 액션 추출 시도
      const lowerText = text.toLowerCase();
      if (lowerText.includes('click') || lowerText.includes('클릭')) {
        return {
          action: 'click',
          params: {},
          message: text.substring(0, 100)
        } as ComputerUseAction;
      } else if (lowerText.includes('type') || lowerText.includes('입력')) {
        return {
          action: 'type',
          params: {},
          message: text.substring(0, 100)
        } as ComputerUseAction;
      } else if (lowerText.includes('scroll') || lowerText.includes('스크롤')) {
        return {
          action: 'scroll',
          params: { direction: 'down' },
          message: text.substring(0, 100)
        } as ComputerUseAction;
      } else if (lowerText.includes('done') || lowerText.includes('완료')) {
        return {
          action: 'done',
          message: text.substring(0, 100)
        } as ComputerUseAction;
      }
    }
    
    // 파싱 실패 시 기본 액션 (스크롤로 시작)
    return {
      action: 'scroll',
      params: { direction: 'down' },
      message: '응답을 파싱할 수 없어 기본 액션 실행: ' + (text || '도구 호출 없음').substring(0, 50)
    };
  } catch (error: any) {
    throw new Error(`Computer Use API 오류: ${error.message}`);
  }
}

