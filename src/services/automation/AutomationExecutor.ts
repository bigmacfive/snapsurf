// 자동화 실행 서비스

import { executeInWebview } from '../../utils/webviewExecutor';
import { Logger } from '../../utils/logger';

export class AutomationExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async executeGoto(webviewRef: HTMLWebViewElement | null, url: string, onUrlChange?: (url: string) => void): Promise<any> {
    let targetUrl = url;
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    if (onUrlChange) {
      onUrlChange(targetUrl);
    }

    return { success: true, url: targetUrl };
  }

  async executeClick(webviewRef: HTMLWebViewElement | null, selector: string): Promise<any> {
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const clicked = await executeInWebview(webviewRef, `
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

    return { success: clicked, selector };
  }

  async executeFill(webviewRef: HTMLWebViewElement | null, selector: string, text: string): Promise<any> {
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

    const filled = await executeInWebview(webviewRef, `
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

    return { success: filled, selector, text };
  }

  async executeGetText(webviewRef: HTMLWebViewElement | null, selector: string): Promise<any> {
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const text = await executeInWebview(webviewRef, `
      (() => {
        try {
          const el = document.querySelector('${escapedSelector}');
          return el ? (el.textContent || el.innerText || '') : null;
        } catch (e) {
          return null;
        }
      })()
    `);

    return { success: !!text, selector, text };
  }

  async executeScroll(webviewRef: HTMLWebViewElement | null, direction: 'up' | 'down'): Promise<any> {
    const amount = direction === 'down' ? 500 : -500;

    await executeInWebview(webviewRef, `
      window.scrollBy(0, ${amount});
    `);

    return { success: true, direction };
  }

  async executeGetUrl(webviewRef: HTMLWebViewElement | null): Promise<any> {
    if (!webviewRef) {
      throw new Error('Webview가 로드되지 않았습니다');
    }

    const url = webviewRef.getURL();
    return { success: true, url };
  }
}
