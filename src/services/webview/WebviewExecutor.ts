/**
 * Webview JavaScript 실행 서비스
 * webview에서 JavaScript 코드를 실행하는 헬퍼 함수들
 */

export class WebviewExecutor {
  /**
   * webview에서 JavaScript 실행
   */
  static async executeInWebview(webviewRef: HTMLWebViewElement | null, code: string): Promise<any> {
    if (!webviewRef) {
      throw new Error('Webview가 로드되지 않았습니다');
    }

    try {
      const webview: any = webviewRef;

      // Electron webview 태그의 executeJavaScript 메서드 사용
      if (webview.executeJavaScript) {
        return await webview.executeJavaScript(code);
      } else {
        // 대체 방법: webview의 webContents에 접근
        const webContents = (webview as any).getWebContents?.();
        if (webContents) {
          return await webContents.executeJavaScript(code);
        }
        throw new Error('Webview 실행 메서드를 찾을 수 없습니다');
      }
    } catch (error: any) {
      throw new Error(`실행 실패: ${error.message}`);
    }
  }

  /**
   * 선택자로 요소 클릭
   */
  static async clickElement(webviewRef: HTMLWebViewElement | null, selector: string): Promise<boolean> {
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return await this.executeInWebview(webviewRef, `
      (() => {
        try {
          const el = document.querySelector('${escapedSelector}');
          if (el) {
            el.click();
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);
  }

  /**
   * 선택자로 요소에 텍스트 입력
   */
  static async fillElement(
    webviewRef: HTMLWebViewElement | null,
    selector: string,
    text: string
  ): Promise<boolean> {
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

    return await this.executeInWebview(webviewRef, `
      (() => {
        try {
          const el = document.querySelector('${escapedSelector}');
          if (el) {
            el.value = '${escapedText}';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      })()
    `);
  }

  /**
   * 선택자로 요소의 텍스트 가져오기
   */
  static async getElementText(webviewRef: HTMLWebViewElement | null, selector: string): Promise<string | null> {
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return await this.executeInWebview(webviewRef, `
      (() => {
        try {
          const el = document.querySelector('${escapedSelector}');
          return el ? (el.textContent || el.innerText || '') : null;
        } catch (e) {
          return null;
        }
      })()
    `);
  }

  /**
   * 현재 페이지가 로드되었는지 확인
   */
  static async isPageReady(webviewRef: HTMLWebViewElement | null): Promise<boolean> {
    try {
      return await this.executeInWebview(webviewRef, `
        (() => {
          return document.readyState === 'complete' || document.readyState === 'interactive';
        })()
      `);
    } catch {
      return false;
    }
  }

  /**
   * 페이지 로딩 대기
   */
  static async waitForPageLoad(
    webviewRef: HTMLWebViewElement | null,
    targetUrl: string,
    timeout: number = 5000
  ): Promise<void> {
    if (!webviewRef) return;

    const webview: any = webviewRef;
    let resolved = false;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, timeout);

      const checkLoaded = async () => {
        try {
          const isReady = await this.isPageReady(webviewRef);
          const currentUrl = webview.getURL();
          const targetHost = new URL(targetUrl).hostname;

          if (isReady && currentUrl && currentUrl.includes(targetHost)) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              resolve();
            }
          } else {
            setTimeout(checkLoaded, 200);
          }
        } catch (e) {
          setTimeout(checkLoaded, 200);
        }
      };

      setTimeout(checkLoaded, 500);
    });
  }
}
