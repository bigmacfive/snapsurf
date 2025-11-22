import { chromium, Browser, BrowserContext, Page, CDPSession } from 'playwright';
import { webContents } from 'electron';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let connectedWebContentsId: number | null = null;
let cdpSession: CDPSession | null = null;

// Playwright 브라우저를 webview에 연결 (CDP 사용)
export async function connectPlaywrightToWebview(webContentsId: number): Promise<void> {
  try {
    // 기존 연결이 있으면 정리
    if (browser) {
      await browser.close();
    }

    const targetWebContents = webContents.fromId(webContentsId);
    if (!targetWebContents) {
      throw new Error('Webview를 찾을 수 없습니다');
    }

    // webview의 webContents에 CDP 디버거 연결
    const debuggerUrl = `http://localhost:${9222 + webContentsId}`;
    
    // Electron webContents의 CDP 엔드포인트에 연결
    // Playwright의 connectOverCDP를 사용하여 기존 브라우저에 연결
    try {
      // webContents의 debugger를 활성화
      await targetWebContents.debugger.attach('1.3');
      
      // CDP를 통해 Playwright 연결
      // 실제로는 webContents의 CDP 엔드포인트를 찾아야 함
      // Electron은 기본적으로 CDP를 제공하지 않으므로, 
      // Playwright를 직접 실행하되 webview와 동기화하는 방식 사용
      
      // Playwright를 headless 모드로 실행하되 실제 브라우저처럼 보이도록 설정
      browser = await chromium.launch({
        headless: true, // headless 모드로 실행하여 별도 창 없음
        channel: 'chromium',
        args: [
          '--disable-blink-features=AutomationControlled', // 자동화 감지 비활성화
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });

      // 실제 브라우저처럼 보이도록 컨텍스트 설정
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        permissions: ['geolocation'],
        geolocation: { latitude: 37.5665, longitude: 126.9780 }, // 서울 좌표
        colorScheme: 'light',
        // 실제 브라우저 속성 추가
        extraHTTPHeaders: {
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      // 자동화 감지 방지를 위한 스크립트 추가
      await context.addInitScript(`
        // webdriver 속성 제거
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Chrome 객체 추가
        window.chrome = {
          runtime: {},
        };
        
        // Permissions API 모킹
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // Plugins 추가
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        // Languages 추가
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        });
      `);

      page = await context.newPage();
      
      connectedWebContentsId = webContentsId;
      console.log('Playwright가 webview에 연결되었습니다 (headless 모드)');
      
      // webview의 URL을 Playwright 페이지에 동기화
      const currentUrl = targetWebContents.getURL();
      if (currentUrl && currentUrl !== 'about:blank') {
        await page.goto(currentUrl);
      }
    } catch (cdpError: any) {
      console.warn('CDP 직접 연결 실패, headless 모드로 전환:', cdpError.message);
      
      // 폴백: Playwright 브라우저를 headless 모드로 실행 (동일한 설정 적용)
      browser = await chromium.launch({
        headless: true,
        channel: 'chromium',
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });
      
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        permissions: ['geolocation'],
        geolocation: { latitude: 37.5665, longitude: 126.9780 },
        colorScheme: 'light',
        extraHTTPHeaders: {
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      await context.addInitScript(`
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        });
      `);
      
      page = await context.newPage();
      
      connectedWebContentsId = webContentsId;
      
      // webview URL 동기화
      const currentUrl = targetWebContents.getURL();
      if (currentUrl && currentUrl !== 'about:blank') {
        await page.goto(currentUrl);
      }
    }
  } catch (error: any) {
    console.error('Playwright webview 연결 오류:', error);
    throw error;
  }
}

// webview와 동기화 (Playwright 액션 후 webview에도 반영)
async function syncToWebview(action: string, params: any, result: any) {
  if (!connectedWebContentsId) return;
  
  try {
    const targetWebContents = webContents.fromId(connectedWebContentsId);
    if (!targetWebContents) return;

    // URL 변경 시 webview에 반영
    if (page) {
      const playwrightUrl = page.url();
      const webviewUrl = targetWebContents.getURL();
      
      // URL이 다르면 webview를 업데이트
      if (playwrightUrl !== webviewUrl && playwrightUrl !== 'about:blank') {
        targetWebContents.loadURL(playwrightUrl);
        // URL 변경 후 페이지 로딩 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 액션별 webview 동기화
    if (action === 'scroll' && page) {
      // Playwright에서 스크롤 위치 가져와서 webview에 적용
      const scrollY = await page.evaluate('window.scrollY');
      const scrollX = await page.evaluate('window.scrollX');
      await targetWebContents.executeJavaScript(`
        window.scrollTo(${scrollX}, ${scrollY});
      `);
    } else if (action === 'click' && page) {
      if (params.selector) {
        // 클릭한 요소의 위치를 webview에서도 클릭
        try {
          const element = await page.locator(params.selector).first();
          const box = await element.boundingBox();
          if (box) {
            await targetWebContents.executeJavaScript(`
              const element = document.querySelector(${JSON.stringify(params.selector)});
              if (element) {
                const rect = element.getBoundingClientRect();
                const event = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                });
                element.dispatchEvent(event);
              }
            `);
          }
        } catch (e) {
          // 클릭 동기화 실패 시 무시
        }
      } else if (params.x !== undefined && params.y !== undefined) {
        // 좌표 클릭 동기화 (강화된 버전)
        await targetWebContents.executeJavaScript(`
          (() => {
            try {
              const x = ${params.x};
              const y = ${params.y};
              
              // 1. 요소 찾기
              let el = document.elementFromPoint(x, y);
              if (!el) {
                // 요소를 찾지 못한 경우, 좌표 주변에서 찾기 시도
                for (let offset = 0; offset < 10; offset++) {
                  el = document.elementFromPoint(x + offset, y + offset) ||
                       document.elementFromPoint(x - offset, y - offset) ||
                       document.elementFromPoint(x + offset, y - offset) ||
                       document.elementFromPoint(x - offset, y + offset);
                  if (el) break;
                }
              }
              
              if (!el) {
                console.error('요소를 찾을 수 없습니다:', x, y);
                return { success: false, error: '요소를 찾을 수 없습니다' };
              }
              
              // 2. 클릭 가능한 요소 찾기 (button, a, input 등)
              let clickableEl = el;
              while (clickableEl && clickableEl !== document.body) {
                const tagName = clickableEl.tagName.toLowerCase();
                const role = clickableEl.getAttribute('role');
                const onClick = clickableEl.onclick;
                const hasClickHandler = clickableEl.addEventListener || onClick;
                
                if (tagName === 'button' || tagName === 'a' || tagName === 'input' || 
                    role === 'button' || hasClickHandler || 
                    clickableEl.style.cursor === 'pointer') {
                  break;
                }
                clickableEl = clickableEl.parentElement;
              }
              
              // 3. 요소를 뷰포트로 스크롤
              clickableEl.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
              
              // 스크롤 후 위치 재계산
              const rect = clickableEl.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              
              // 4. 강력한 클릭 이벤트 발생 (mousedown -> mouseup -> click)
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1,
                button: 0,
                buttons: 1,
                clientX: centerX,
                clientY: centerY,
                screenX: centerX,
                screenY: centerY
              });
              
              const mouseUpEvent = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1,
                button: 0,
                buttons: 0,
                clientX: centerX,
                clientY: centerY,
                screenX: centerX,
                screenY: centerY
              });
              
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1,
                button: 0,
                buttons: 0,
                clientX: centerX,
                clientY: centerY,
                screenX: centerX,
                screenY: centerY
              });
              
              // 5. 이벤트 순차 발생
              clickableEl.dispatchEvent(mouseDownEvent);
              
              // 약간의 지연 (동기적 대기)
              const start = Date.now();
              while (Date.now() - start < 10) {
                // 10ms 대기
              }
              
              clickableEl.dispatchEvent(mouseUpEvent);
              clickableEl.dispatchEvent(clickEvent);
              
              // 6. 네이티브 click 메서드도 호출 (더 확실하게)
              if (typeof clickableEl.click === 'function') {
                clickableEl.click();
              }
              
              return { 
                success: true, 
                element: clickableEl.tagName,
                text: clickableEl.textContent?.substring(0, 50) || ''
              };
            } catch (error) {
              console.error('클릭 동기화 오류:', error);
              return { success: false, error: error.message };
            }
          })()
        `);
      }
    } else if (action === 'fill' && params.selector && params.text && page) {
      // 입력 필드에 텍스트 입력 동기화
      await targetWebContents.executeJavaScript(`
        const element = document.querySelector(${JSON.stringify(params.selector)});
        if (element) {
          element.value = ${JSON.stringify(params.text)};
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      `);
    } else if (action === 'press' && params.key && page) {
      // 키 입력 동기화
      await targetWebContents.executeJavaScript(`
        const event = new KeyboardEvent('keydown', {
          key: ${JSON.stringify(params.key)},
          code: ${JSON.stringify(params.key)},
          bubbles: true,
          cancelable: true
        });
        document.activeElement?.dispatchEvent(event);
        const keyupEvent = new KeyboardEvent('keyup', {
          key: ${JSON.stringify(params.key)},
          code: ${JSON.stringify(params.key)},
          bubbles: true,
          cancelable: true
        });
        document.activeElement?.dispatchEvent(keyupEvent);
      `);
    }
  } catch (error: any) {
    console.warn('Webview 동기화 오류:', error.message);
  }
}

// 페이지가 닫혔는지 확인하고 재연결
async function ensurePageConnected(): Promise<void> {
  if (!page) {
    if (connectedWebContentsId) {
      console.log('Playwright 페이지가 없습니다. 재연결 시도...');
      await connectPlaywrightToWebview(connectedWebContentsId);
    } else {
      throw new Error('Playwright 페이지가 없고 재연결할 수 없습니다');
    }
  } else {
    // 페이지가 닫혔는지 확인 (간단한 테스트)
    try {
      await page.evaluate('true');
    } catch (error: any) {
      // 페이지가 닫혔거나 연결이 끊어짐
      if (connectedWebContentsId) {
        console.log('Playwright 페이지 연결이 끊어졌습니다. 재연결 시도...');
        page = null;
        await connectPlaywrightToWebview(connectedWebContentsId);
      } else {
        throw new Error('Playwright 페이지 연결이 끊어졌고 재연결할 수 없습니다');
      }
    }
  }
}

// Playwright를 통한 액션 실행
export async function executePlaywrightAction(
  action: string,
  params: any
): Promise<any> {
  try {
    // 페이지 연결 확인 및 재연결
    await ensurePageConnected();
    
    if (!page) {
      throw new Error('Playwright 페이지가 초기화되지 않았습니다');
    }

    switch (action) {
      case 'goto':
        if (params.url) {
          try {
            await page.goto(params.url, { 
              waitUntil: 'networkidle',
              timeout: 30000 
            });
            const result = { success: true, url: page.url() };
            // webview와 동기화
            await syncToWebview(action, params, result);
            return result;
          } catch (error: any) {
            // 타임아웃이나 오류 발생 시 재시도
            if (error.message.includes('timeout') || error.message.includes('ERR_ABORTED')) {
              console.log('goto 재시도 중...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              await page.goto(params.url, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
              });
              const result = { success: true, url: page.url() };
              await syncToWebview(action, params, result);
              return result;
            }
            throw error;
          }
        }
        break;

      case 'click':
        if (params.selector) {
          try {
            await page.click(params.selector, { timeout: 10000 });
            await syncToWebview(action, params, { success: true });
            return { success: true };
          } catch (error: any) {
            // 타임아웃 시 재시도
            if (error.message.includes('timeout') || error.message.includes('closed')) {
              await ensurePageConnected();
              if (page) {
                await page.waitForSelector(params.selector, { timeout: 5000 });
                await page.click(params.selector, { timeout: 10000 });
                await syncToWebview(action, params, { success: true });
                return { success: true };
              }
            }
            throw error;
          }
        } else if (params.findByText) {
          try {
            await page.click(`text=${params.findByText}`, { timeout: 10000 });
            await syncToWebview(action, params, { success: true });
            return { success: true };
          } catch (error: any) {
            if (error.message.includes('timeout') || error.message.includes('closed')) {
              await ensurePageConnected();
              if (page) {
                await page.click(`text=${params.findByText}`, { timeout: 10000 });
                await syncToWebview(action, params, { success: true });
                return { success: true };
              }
            }
            throw error;
          }
        } else if (params.x !== undefined && params.y !== undefined) {
          try {
            // webview와 URL 동기화 확인
            if (connectedWebContentsId) {
              const targetWebContents = webContents.fromId(connectedWebContentsId);
              if (targetWebContents) {
                const webviewUrl = targetWebContents.getURL();
                const playwrightUrl = page.url();
                
                // URL이 다르면 webview의 URL로 이동
                if (webviewUrl && webviewUrl !== 'about:blank' && 
                    webviewUrl !== playwrightUrl && !playwrightUrl.includes(webviewUrl.replace(/^https?:\/\//, '').split('/')[0])) {
                  await page.goto(webviewUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                  await new Promise(resolve => setTimeout(resolve, 500)); // 페이지 로딩 대기
                }
              }
            }
            
            await page.mouse.click(params.x, params.y);
            await syncToWebview(action, params, { success: true });
            return { success: true };
          } catch (error: any) {
             if (error.message.includes('closed')) {
              await ensurePageConnected();
              if (page) {
                // 재연결 후 URL 동기화
                if (connectedWebContentsId) {
                  const targetWebContents = webContents.fromId(connectedWebContentsId);
                  if (targetWebContents) {
                    const webviewUrl = targetWebContents.getURL();
                    if (webviewUrl && webviewUrl !== 'about:blank') {
                      await page.goto(webviewUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                      await new Promise(resolve => setTimeout(resolve, 500));
                    }
                  }
                }
                await page.mouse.click(params.x, params.y);
                await syncToWebview(action, params, { success: true });
                return { success: true };
              }
             }
             throw error;
          }
        }
        break;

      case 'doubleClick':
        if (params.selector) {
          await page.dblclick(params.selector);
        } else if (params.x !== undefined && params.y !== undefined) {
          await page.mouse.dblclick(params.x, params.y);
        }
        await syncToWebview(action, params, { success: true });
        return { success: true };

      case 'rightClick':
        if (params.selector) {
          await page.click(params.selector, { button: 'right' });
        } else if (params.x !== undefined && params.y !== undefined) {
          await page.mouse.click(params.x, params.y, { button: 'right' });
        }
        await syncToWebview(action, params, { success: true });
        return { success: true };

      case 'fill':
        if (params.selector && params.text) {
          try {
            await page.waitForSelector(params.selector, { timeout: 10000 });
            await page.fill(params.selector, params.text);
            // 자동 제출 (검색창인 경우)
            if (params.submit !== false) {
              await page.press(params.selector, 'Enter');
            }
            await syncToWebview(action, params, { success: true });
            return { success: true };
          } catch (error: any) {
            // 타임아웃 시 재시도
            if (error.message.includes('timeout') || error.message.includes('closed')) {
              await ensurePageConnected();
              if (page) {
                await page.waitForSelector(params.selector, { timeout: 10000 });
                await page.fill(params.selector, params.text);
                if (params.submit !== false) {
                  await page.press(params.selector, 'Enter');
                }
                await syncToWebview(action, params, { success: true });
                return { success: true };
              }
            }
            throw error;
          }
        }
        break;

      case 'scroll':
        if (params.direction === 'down') {
          await page.evaluate('window.scrollBy(0, 500)');
          await syncToWebview(action, params, { success: true });
        } else if (params.direction === 'up') {
          await page.evaluate('window.scrollBy(0, -500)');
          await syncToWebview(action, params, { success: true });
        } else if (params.direction === 'to' && params.selector) {
          await page.locator(params.selector).scrollIntoViewIfNeeded();
          await syncToWebview(action, params, { success: true });
        } else {
          // 기본 스크롤
          await page.evaluate('window.scrollBy(0, 500)');
          await syncToWebview(action, params, { success: true });
        }
        return { success: true };

      case 'drag':
        if (params.selector && params.toX !== undefined && params.toY !== undefined) {
          const element = await page.locator(params.selector).first();
          const box = await element.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(params.toX, params.toY);
            await page.mouse.up();
          }
        } else if (params.startX !== undefined && params.startY !== undefined && params.endX !== undefined && params.endY !== undefined) {
          await page.mouse.move(params.startX, params.startY);
          await page.mouse.down();
          await page.mouse.move(params.endX, params.endY);
          await page.mouse.up();
        }
        await syncToWebview(action, params, { success: true });
        return { success: true };

      case 'type':
        if (params.text) {
          await page.keyboard.type(params.text);
          if (params.pressEnter) {
            await page.keyboard.press('Enter');
          }
          await syncToWebview(action, params, { success: true });
          return { success: true };
        }
        break;

      case 'wait':
      case 'waitForSelector':
        await ensurePageConnected();
        if (params.selector) {
          try {
            await page.waitForSelector(params.selector, { timeout: params.timeout || 10000 });
          } catch (error: any) {
            if (error.message.includes('closed')) {
              await ensurePageConnected();
              if (page) {
                await page.waitForSelector(params.selector, { timeout: params.timeout || 10000 });
              }
            } else {
              throw error;
            }
          }
        } else {
          await page.waitForTimeout(params.timeout || 1000);
        }
        return { success: true };

      case 'waitForNavigation':
        // 네비게이션 완료 대기
        await ensurePageConnected();
        try {
          if (params.timeout) {
            await page.waitForLoadState('networkidle', { timeout: params.timeout });
          } else {
            await page.waitForLoadState('networkidle', { timeout: 30000 });
          }
        } catch (error: any) {
          if (error.message.includes('closed')) {
            await ensurePageConnected();
            if (page) {
              await page.waitForLoadState('domcontentloaded', { timeout: params.timeout || 30000 });
            }
          } else {
            // networkidle 타임아웃은 무시하고 domcontentloaded로 폴백
            try {
              await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            } catch (e) {
              // 무시
            }
          }
        }
        return { success: true };

      case 'screenshot':
        const screenshot = await page.screenshot({ fullPage: true });
        return { success: true, image: screenshot.toString('base64') };

      case 'getText':
      case 'text': // text 액션도 getText로 처리
        if (params.selector) {
          const text = await page.textContent(params.selector);
          return { success: true, text };
        }
        break;

      case 'getUrl':
        // 현재 URL 가져오기
        const currentUrl = page.url();
        return { success: true, url: currentUrl };

      case 'evaluate':
        if (params.code) {
          const result = await page.evaluate(params.code);
          return { success: true, result };
        }
        break;

      case 'select':
        if (params.selector && params.value) {
          await page.selectOption(params.selector, params.value);
          await syncToWebview(action, params, { success: true });
          return { success: true };
        }
        break;

      case 'checkbox':
        if (params.selector) {
          if (params.checked !== false) {
            await page.check(params.selector);
          } else {
            await page.uncheck(params.selector);
          }
          await syncToWebview(action, params, { success: true });
          return { success: true };
        }
        break;

      case 'hover':
        if (params.selector) {
          await page.hover(params.selector);
          await syncToWebview(action, params, { success: true });
          return { success: true };
        }
        break;

      case 'press':
        if (params.key) {
          await page.keyboard.press(params.key);
          await syncToWebview(action, params, { success: true });
          return { success: true };
        }
        break;

      case 'goBack':
        await page.goBack();
        const backResult = { success: true, url: page.url() };
        await syncToWebview(action, params, backResult);
        return backResult;

      case 'goForward':
        await page.goForward();
        const forwardResult = { success: true, url: page.url() };
        await syncToWebview(action, params, forwardResult);
        return forwardResult;

      case 'reload':
        await page.reload();
        const reloadResult = { success: true, url: page.url() };
        await syncToWebview(action, params, reloadResult);
        return reloadResult;
    }

    throw new Error(`지원하지 않는 액션: ${action}`);
  } catch (error: any) {
    console.error(`Playwright 액션 실행 오류 (${action}):`, error);
    throw error;
  }
}

// 현재 URL 가져오기
export async function getCurrentUrl(): Promise<string | null> {
  if (page) {
    return page.url();
  }
  return null;
}

// 브라우저 종료
export async function closePlaywrightBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    page = null;
    connectedWebContentsId = null;
  }
}

