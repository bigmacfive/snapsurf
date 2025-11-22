/**
 * Gemini 액션 실행 서비스
 * AI가 생성한 브라우저 자동화 액션을 실행하는 서비스
 */

import { WebviewExecutor } from '../webview/WebviewExecutor';

export interface Tab {
  id: string;
  title: string;
  url: string;
}

export interface GeminiActionContext {
  webviewRef: React.RefObject<HTMLWebViewElement>;
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  setCurrentUrl: (url: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
  setUrl: (url: string) => void;
  addLog: (message: string) => void;
}

export class GeminiActionExecutor {
  private context: GeminiActionContext;

  constructor(context: GeminiActionContext) {
    this.context = context;
  }

  /**
   * Gemini 액션 실행 메인 함수
   */
  async execute(action: any): Promise<void> {
    try {
      if (!action || !action.action) return;

      switch (action.action) {
        case 'goto':
          await this.handleGoto(action);
          break;
        case 'click':
          await this.handleClick(action);
          break;
        case 'scroll':
          await this.handleScroll(action);
          break;
        case 'fill':
          await this.handleFill(action);
          break;
        case 'text':
          await this.handleGetText(action);
          break;
        case 'screenshot':
          await this.handleScreenshot();
          break;
        case 'wait':
        case 'waitForSelector':
          await this.handleWait(action);
          break;
        case 'waitForNavigation':
          await this.handleWaitForNavigation(action);
          break;
        case 'press':
          await this.handlePress(action);
          break;
        case 'type':
          await this.handleType(action);
          break;
        case 'hover':
          await this.handleHover(action);
          break;
        case 'doubleClick':
          await this.handleDoubleClick(action);
          break;
        case 'rightClick':
          await this.handleRightClick(action);
          break;
        case 'select':
          await this.handleSelect(action);
          break;
        case 'checkbox':
          await this.handleCheckbox(action);
          break;
        case 'getAttribute':
          await this.handleGetAttribute(action);
          break;
        case 'isVisible':
          await this.handleIsVisible(action);
          break;
        case 'goBack':
          await this.handleGoBack();
          break;
        case 'goForward':
          await this.handleGoForward();
          break;
        case 'reload':
          await this.handleReload();
          break;
        case 'getTitle':
          await this.handleGetTitle();
          break;
        case 'getUrl':
          await this.handleGetUrl();
          break;
        case 'evaluate':
          await this.handleEvaluate(action);
          break;
        case 'drag':
          await this.handleDrag(action);
          break;
        case 'upload':
          await this.handleUpload(action);
          break;
        case 'download':
          await this.handleDownload(action);
          break;
        case 'nextPage':
          await this.handleNextPage(action);
          break;
        case 'findLink':
        case 'searchInResults':
          await this.handleFindLink(action);
          break;
      }
    } catch (error: any) {
      this.context.addLog(`실행 오류: ${error.message}`);
    }
  }

  private async handleGoto(action: any): Promise<void> {
    if (!action.params?.url) return;

    let targetUrl = action.params.url;
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    this.context.setCurrentUrl(targetUrl);
    this.context.addLog(`페이지 이동: ${targetUrl}`);

    // 페이지 로딩 대기
    await WebviewExecutor.waitForPageLoad(this.context.webviewRef.current, targetUrl);
  }

  private async handleClick(action: any): Promise<void> {
    if (!action.params?.selector && !action.params?.findByText) return;

    const selector = action.params?.selector ? String(action.params.selector) : '';
    const findByText = action.params?.findByText;
    const newTab = action.params?.newTab === true;
    const selectors = selector ? selector.split(',').map(s => s.trim()).filter(s => s) : [];

    let clicked = false;
    const maxRetries = 15;
    const retryDelay = 200;

    for (let retry = 0; retry < maxRetries; retry++) {
      const result = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
        (() => {
          try {
            const selectors = ${JSON.stringify(selectors)};
            const findByText = ${JSON.stringify(findByText || '')};
            const newTab = ${newTab};
            let el = null;

            // 텍스트로 찾기
            if (findByText) {
              const allLinks = Array.from(document.querySelectorAll('a, button, [onclick], [role="button"]'));
              for (const link of allLinks) {
                const text = (link.textContent || link.innerText || '').trim();
                if (text.includes(findByText) || link.getAttribute('aria-label')?.includes(findByText)) {
                  el = link;
                  break;
                }
              }
            }

            // selector로 찾기
            if (!el && selectors.length > 0) {
              for (const sel of selectors) {
                try {
                  el = document.querySelector(sel);
                  if (el && el.offsetParent !== null) {
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
            }

            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });

              if (newTab && el.href) {
                return { success: true, href: el.href, newTab: true, needsNewTab: true };
              } else {
                el.click();
                return { success: true, href: el.href || '' };
              }
            }
            return { success: false, retry: ${retry} };
          } catch (e) {
            return { success: false, error: e.message, retry: ${retry} };
          }
        })()
      `);

      if (result && result.success) {
        clicked = true;

        // 새 탭으로 열기
        if (result.needsNewTab && result.href) {
          const newTabId = Date.now().toString();
          const newTab: Tab = {
            id: newTabId,
            title: '새 탭',
            url: result.href
          };
          this.context.setTabs(prev => [...prev, newTab]);
          this.context.setActiveTabId(newTabId);
          this.context.setUrl(result.href);
          this.context.setCurrentUrl(result.href);
          this.context.addLog(`새 탭으로 열기: ${result.href}`);
          break;
        }

        this.context.addLog(`클릭: ${selector || findByText}${result.href ? ' -> ' + result.href : ''}`);

        // 링크 클릭인 경우 페이지 전환 대기
        if (result.href && result.href.startsWith('http')) {
          await this.waitForNavigation(result.href);
        }
        break;
      }

      if (retry < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!clicked) {
      const searchText = action.params?.findByText || selector;
      this.context.addLog(`클릭 실패: ${searchText} - 요소를 찾을 수 없습니다 (${maxRetries}회 시도)`);
    }
  }

  private async handleScroll(action: any): Promise<void> {
    if (!action.params?.direction && !action.params?.selector) return;

    const direction = action.params?.direction || 'down';
    const selector = action.params?.selector;

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          if (${JSON.stringify(selector)}) {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return { success: true, action: 'scroll to element' };
            }
          } else if (${JSON.stringify(direction)} === 'down') {
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
            return { success: true, action: 'scroll down' };
          } else if (${JSON.stringify(direction)} === 'up') {
            window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
            return { success: true, action: 'scroll up' };
          }
          return { success: false };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `);

    this.context.addLog(`스크롤: ${direction}${selector ? ' to ' + selector : ''}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async handleFill(action: any): Promise<void> {
    if (!action.params?.selector || !action.params?.text) return;

    const selector = String(action.params.selector);
    const escapedText = String(action.params.text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const shouldSubmit = action.params?.submit !== false;
    const selectors = selector.split(',').map(s => s.trim()).filter(s => s);

    let result: any = null;
    const maxRetries = 15;
    const retryDelay = 200;

    for (let retry = 0; retry < maxRetries; retry++) {
      result = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
        (() => {
          try {
            const selectors = ${JSON.stringify(selectors)};
            let el = null;

            for (const sel of selectors) {
              try {
                el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                  break;
                }
              } catch (e) {
                continue;
              }
            }

            if (!el) {
              const fallbackSelectors = [
                'input[type="search"]',
                'input[name*="search"]',
                'input[name*="q"]',
                'input[name*="query"]',
                'input[placeholder*="search" i]',
                'input[placeholder*="검색" i]',
                'input[title*="검색" i]'
              ];
              for (const sel of fallbackSelectors) {
                try {
                  el = document.querySelector(sel);
                  if (el && el.offsetParent !== null) {
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
            }

            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.focus();
              el.value = '${escapedText}';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));

              if (${shouldSubmit}) {
                setTimeout(() => {
                  const form = el.closest('form');
                  if (form) {
                    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type]), [type="button"]');
                    if (submitBtn && ((submitBtn.textContent || submitBtn.value || '').toLowerCase().includes('search') ||
                        (submitBtn.textContent || submitBtn.value || '').includes('검색'))) {
                      submitBtn.click();
                    } else {
                      const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                      });
                      el.dispatchEvent(enterEvent);
                    }
                  } else if (el.type === 'search' || el.getAttribute('role') === 'searchbox' ||
                             (el.placeholder && (el.placeholder.toLowerCase().includes('search') || el.placeholder.includes('검색')))) {
                    const enterEvent = new KeyboardEvent('keydown', {
                      key: 'Enter',
                      code: 'Enter',
                      keyCode: 13,
                      which: 13,
                      bubbles: true,
                      cancelable: true
                    });
                    el.dispatchEvent(enterEvent);
                  }
                }, 100);
              }
              return { success: true, selector: el.tagName + (el.name ? '[name="' + el.name + '"]' : '') + (el.id ? '#' + el.id : '') };
            }
            return { success: false, error: 'Element not found', retry: ${retry} };
          } catch (e) {
            return { success: false, error: e.message, retry: ${retry} };
          }
        })()
      `);

      if (result && result.success) {
        break;
      }

      if (retry < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (result && result.success) {
      this.context.addLog(`입력: ${result.selector || selector} = ${action.params.text}${shouldSubmit ? ' (제출됨)' : ''}`);
    } else {
      this.context.addLog(`입력 실패: ${selector} - 요소를 찾을 수 없습니다 (${maxRetries}회 시도)`);
    }
  }

  private async handleGetText(action: any): Promise<void> {
    if (!action.params?.selector) return;

    const text = await WebviewExecutor.getElementText(this.context.webviewRef.current, action.params.selector);
    this.context.addLog(`텍스트 추출: ${text}`);
  }

  private async handleScreenshot(): Promise<void> {
    if (!this.context.webviewRef.current) return;

    try {
      const url = (this.context.webviewRef.current as any).getURL();

      if (window.electronAPI?.captureWebviewScreenshot) {
        const result = await window.electronAPI.captureWebviewScreenshot(url);
        if (result.success && result.path) {
          this.context.addLog(`✅ 스크린샷 저장 완료: ${result.path}`);
        } else {
          this.context.addLog(`❌ 스크린샷 저장 실패: ${result.error || '알 수 없는 오류'}`);
        }
      } else {
        this.context.addLog(`스크린샷: IPC를 통한 저장이 불가능합니다.`);
      }
    } catch (error: any) {
      this.context.addLog(`스크린샷 실패: ${error.message || '알 수 없는 오류'}`);
    }
  }

  private async handleWait(action: any): Promise<void> {
    if (!action.params?.selector) return;

    const selector = String(action.params.selector);
    const timeout = action.params?.timeout || 5000;
    const maxRetries = Math.ceil(timeout / 200);

    for (let retry = 0; retry < maxRetries; retry++) {
      const found = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
        (() => {
          try {
            const el = document.querySelector(${JSON.stringify(selector)});
            return el && el.offsetParent !== null;
          } catch (e) {
            return false;
          }
        })()
      `);

      if (found) {
        this.context.addLog(`요소 대기 완료: ${selector}`);
        break;
      }

      if (retry < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  private async handleWaitForNavigation(action: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, action.params?.timeout || 3000));
    this.context.addLog('네비게이션 대기 완료');
  }

  private async handlePress(action: any): Promise<void> {
    if (!action.params?.key || !action.params?.selector) return;

    const selector = String(action.params.selector);
    const key = String(action.params.key);

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            el.focus();
            const keyEvent = new KeyboardEvent('keydown', {
              key: ${JSON.stringify(key)},
              code: ${JSON.stringify(key)},
              bubbles: true,
              cancelable: true
            });
            el.dispatchEvent(keyEvent);
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`키 입력: ${key}`);
  }

  private async handleType(action: any): Promise<void> {
    if (!action.params?.selector || !action.params?.text) return;

    const selector = String(action.params.selector);
    const text = String(action.params.text);

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            el.focus();
            for (const char of ${JSON.stringify(text)}) {
              const keyEvent = new KeyboardEvent('keydown', { key: char, bubbles: true });
              el.dispatchEvent(keyEvent);
              el.value += char;
              const inputEvent = new Event('input', { bubbles: true });
              el.dispatchEvent(inputEvent);
            }
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`타이핑: ${text}`);
  }

  private async handleHover(action: any): Promise<void> {
    if (!action.params?.selector) return;

    const selector = String(action.params.selector);

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const mouseEvent = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
            el.dispatchEvent(mouseEvent);
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`호버: ${selector}`);
  }

  private async handleDoubleClick(action: any): Promise<void> {
    if (!action.params?.selector) return;

    const selector = String(action.params.selector);

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const dblClick = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
            el.dispatchEvent(dblClick);
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`더블클릭: ${selector}`);
  }

  private async handleRightClick(action: any): Promise<void> {
    if (!action.params?.selector) return;

    const selector = String(action.params.selector);

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
            el.dispatchEvent(contextMenu);
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`우클릭: ${selector}`);
  }

  private async handleSelect(action: any): Promise<void> {
    if (!action.params?.selector || !action.params?.value) return;

    const selector = String(action.params.selector);
    const value = String(action.params.value);

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)}) as HTMLSelectElement;
          if (el && el.tagName === 'SELECT') {
            el.value = ${JSON.stringify(value)};
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`선택: ${selector} = ${value}`);
  }

  private async handleCheckbox(action: any): Promise<void> {
    if (!action.params?.selector) return;

    const selector = String(action.params.selector);
    const checked = action.params?.checked !== false;

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)}) as HTMLInputElement;
          if (el && el.type === 'checkbox') {
            el.checked = ${checked};
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`체크박스: ${selector} = ${checked}`);
  }

  private async handleGetAttribute(action: any): Promise<void> {
    if (!action.params?.selector || !action.params?.value) return;

    const selector = String(action.params.selector);
    const attrName = String(action.params.value);

    const value = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)});
          return el ? el.getAttribute(${JSON.stringify(attrName)}) : null;
        } catch (e) {
          return null;
        }
      })()
    `);

    this.context.addLog(`속성: ${selector}.${attrName} = ${value}`);
  }

  private async handleIsVisible(action: any): Promise<void> {
    if (!action.params?.selector) return;

    const selector = String(action.params.selector);

    const visible = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)});
          return el && el.offsetParent !== null;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`가시성: ${selector} = ${visible}`);
  }

  private async handleGoBack(): Promise<void> {
    if (this.context.webviewRef.current && this.context.canGoBack) {
      (this.context.webviewRef.current as any).goBack();
      this.context.addLog('뒤로 가기');
    }
  }

  private async handleGoForward(): Promise<void> {
    if (this.context.webviewRef.current && this.context.canGoForward) {
      (this.context.webviewRef.current as any).goForward();
      this.context.addLog('앞으로 가기');
    }
  }

  private async handleReload(): Promise<void> {
    if (this.context.webviewRef.current) {
      (this.context.webviewRef.current as any).reload();
      this.context.addLog('새로고침');
    }
  }

  private async handleGetTitle(): Promise<void> {
    const title = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `(() => document.title)()`);
    this.context.addLog(`페이지 제목: ${title}`);
  }

  private async handleGetUrl(): Promise<void> {
    const currentUrl = (this.context.webviewRef.current as any)?.getURL();
    this.context.addLog(`현재 URL: ${currentUrl}`);
  }

  private async handleEvaluate(action: any): Promise<void> {
    if (!action.params?.code) return;

    const code = String(action.params.code);
    const result = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, code);
    this.context.addLog(`JavaScript 실행 결과: ${JSON.stringify(result)}`);
  }

  private async handleDrag(action: any): Promise<void> {
    if (!action.params?.fromSelector || !action.params?.toSelector) return;

    const fromSelector = String(action.params.fromSelector);
    const toSelector = String(action.params.toSelector);

    await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const from = document.querySelector(${JSON.stringify(fromSelector)});
          const to = document.querySelector(${JSON.stringify(toSelector)});
          if (from && to) {
            const dragStart = new DragEvent('dragstart', { bubbles: true, cancelable: true });
            from.dispatchEvent(dragStart);
            const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true });
            to.dispatchEvent(dragOver);
            const drop = new DragEvent('drop', { bubbles: true, cancelable: true });
            to.dispatchEvent(drop);
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);

    this.context.addLog(`드래그: ${fromSelector} -> ${toSelector}`);
  }

  private async handleUpload(action: any): Promise<void> {
    if (!action.params?.selector || !action.params?.filePath) return;
    this.context.addLog(`파일 업로드: ${action.params.filePath} (웹뷰에서는 제한적 지원)`);
  }

  private async handleDownload(action: any): Promise<void> {
    if (!action.params?.selector) return;

    const selector = String(action.params.selector);

    const href = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const el = document.querySelector(${JSON.stringify(selector)}) as HTMLAnchorElement;
          return el && el.href ? el.href : null;
        } catch (e) {
          return null;
        }
      })()
    `);

    if (href) {
      this.context.addLog(`다운로드 링크: ${href}`);
      const newTabId = Date.now().toString();
      const newTab: Tab = {
        id: newTabId,
        title: '다운로드',
        url: href
      };
      this.context.setTabs(prev => [...prev, newTab]);
    }
  }

  private async handleNextPage(action: any): Promise<void> {
    const maxPages = action.params?.maxPages || 5;
    let pageNavigated = false;

    for (let page = 0; page < maxPages; page++) {
      const result = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
        (() => {
          try {
            const nextSelectors = [
              'a[aria-label*="Next"]',
              'a[aria-label*="다음"]',
              'a:contains("Next")',
              'a:contains("다음")',
              '[role="button"][aria-label*="Next"]',
              'a[id*="next"]',
              'a[class*="next"]',
              'button:contains("Next")',
              'a[href*="start="]',
              'a[href*="page="]'
            ];

            let nextBtn = null;
            for (const sel of nextSelectors) {
              try {
                const els = Array.from(document.querySelectorAll('a, button'));
                for (const el of els) {
                  const text = (el.textContent || el.innerText || '').toLowerCase();
                  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                  if ((text.includes('next') || text.includes('다음') || ariaLabel.includes('next') || ariaLabel.includes('다음')) &&
                      !text.includes('prev') && !text.includes('이전')) {
                    nextBtn = el;
                    break;
                  }
                }
                if (nextBtn) break;
              } catch (e) {
                continue;
              }
            }

            if (nextBtn) {
              nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              nextBtn.click();
              return { success: true, page: ${page + 1} };
            }
            return { success: false, error: 'Next page button not found' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })()
      `);

      if (result && result.success) {
        pageNavigated = true;
        this.context.addLog(`다음 페이지로 이동: ${result.page}페이지`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }
    }

    if (!pageNavigated) {
      this.context.addLog(`다음 페이지를 찾을 수 없습니다 (최대 ${maxPages}페이지 시도)`);
    }
  }

  private async handleFindLink(action: any): Promise<void> {
    const criteria = action.params?.criteria || '';
    const mustMatch = action.params?.mustMatch || '';

    const foundLink = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
      (() => {
        try {
          const criteria = ${JSON.stringify(criteria)};
          const mustMatch = ${JSON.stringify(mustMatch)};
          const allLinks = Array.from(document.querySelectorAll('a[href]'));

          for (const link of allLinks) {
            const text = (link.textContent || link.innerText || '').toLowerCase();
            const href = link.href || '';
            const title = link.getAttribute('title') || '';

            let matchesCriteria = false;
            if (criteria) {
              const criteriaLower = criteria.toLowerCase();
              matchesCriteria =
                text.includes(criteriaLower) ||
                title.toLowerCase().includes(criteriaLower) ||
                href.includes(criteriaLower);
            } else {
              matchesCriteria = true;
            }

            let matchesMust = true;
            if (mustMatch) {
              const mustLower = mustMatch.toLowerCase();
              matchesMust =
                href.includes(mustLower) ||
                text.includes(mustLower) ||
                title.toLowerCase().includes(mustLower);
            }

            const isForeign = !href.includes('.kr') &&
                              !href.includes('.co.kr') &&
                              !href.includes('naver.com') &&
                              !href.includes('daum.net');

            if (matchesCriteria && matchesMust && (criteria.includes('국외') || criteria.includes('외국') || isForeign)) {
              return {
                success: true,
                href: href,
                text: text,
                selector: 'a[href="' + href + '"]'
              };
            }
          }

          return { success: false, error: 'No matching link found' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `);

    if (foundLink && foundLink.success) {
      this.context.addLog(`링크 찾음: ${foundLink.text || foundLink.href}`);

      const escapedHref = String(foundLink.href).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const clicked = await WebviewExecutor.executeInWebview(this.context.webviewRef.current, `
        (() => {
          try {
            const link = document.querySelector('a[href="${escapedHref}"]');
            if (link) {
              link.scrollIntoView({ behavior: 'smooth', block: 'center' });
              ${action.params?.newTab ? 'window.open(link.href, "_blank"); return { success: true, newTab: true };' : 'link.click(); return { success: true };'}
            }
            return { success: false };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })()
      `);

      if (clicked && clicked.success) {
        if (clicked.newTab) {
          const newTabId = Date.now().toString();
          const newTab: Tab = {
            id: newTabId,
            title: '새 탭',
            url: foundLink.href
          };
          this.context.setTabs(prev => [...prev, newTab]);
          this.context.setActiveTabId(newTabId);
          this.context.setUrl(foundLink.href);
          this.context.setCurrentUrl(foundLink.href);
          this.context.addLog(`새 탭으로 열기: ${foundLink.href}`);
        } else {
          this.context.addLog(`링크 클릭: ${foundLink.href}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else {
      this.context.addLog(`조건에 맞는 링크를 찾을 수 없습니다: ${criteria}${mustMatch ? ' + ' + mustMatch : ''}`);
    }
  }

  private async waitForNavigation(targetHref: string): Promise<void> {
    if (!this.context.webviewRef.current) return;

    const webview: any = this.context.webviewRef.current;
    let resolved = false;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 5000);

      const checkNavigated = async () => {
        try {
          const currentUrl = webview.getURL();
          if (currentUrl && currentUrl !== targetHref &&
            (currentUrl.includes(new URL(targetHref).hostname) ||
              !currentUrl.includes('google.com'))) {
            const isReady = await WebviewExecutor.isPageReady(this.context.webviewRef.current);
            if (isReady && !resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(checkNavigated, 200);
            }
          } else {
            setTimeout(checkNavigated, 200);
          }
        } catch (e) {
          setTimeout(checkNavigated, 200);
        }
      };

      setTimeout(checkNavigated, 500);
    });
  }
}
