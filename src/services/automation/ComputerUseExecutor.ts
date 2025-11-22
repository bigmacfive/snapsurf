// Computer Use 액션 실행 서비스

import { ComputerUseAction } from '../../types/automation';
import { Logger } from '../../utils/logger';

export class ComputerUseExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(
    action: ComputerUseAction,
    webviewRef: HTMLWebViewElement | null,
    onUrlChange?: (url: string) => void
  ): Promise<boolean> {
    try {
      if (!webviewRef) return false;
      if (!window.electronAPI?.playwright) {
        this.logger.error('Playwright API를 사용할 수 없습니다.');
        return false;
      }

      // Playwright 연결 확인 (필요 시 재연결)
      const webview: any = webviewRef;
      if (webview.getWebContentsId) {
        const webContentsId = webview.getWebContentsId();
        const rect = webview.getBoundingClientRect();
        await window.electronAPI.playwright.connectWebview(webContentsId, {
          width: Math.floor(rect.width),
          height: Math.floor(rect.height)
        });
      }

      switch (action.action) {
        case 'goto':
          return await this.executeGoto(action, onUrlChange);

        case 'click':
          return await this.executeClick(action);

        case 'doubleClick':
          return await this.executeDoubleClick(action);

        case 'rightClick':
          return await this.executeRightClick(action);

        case 'drag':
          return await this.executeDrag(action);

        case 'type':
          return await this.executeType(action);

        case 'scroll':
          return await this.executeScroll(action);

        case 'goBack':
          return await this.executeGoBack();

        case 'goForward':
          return await this.executeGoForward();

        case 'reload':
          return await this.executeReload();

        case 'key':
          return await this.executeKey(action);

        case 'done':
          return true;

        default:
          this.logger.warning(`알 수 없는 액션: ${action.action}`);
          return false;
      }
    } catch (error: any) {
      this.logger.error(`액션 실행 오류: ${error.message}`);
      console.error('액션 실행 오류:', error);
      return false;
    }
  }

  private async executeGoto(action: ComputerUseAction, onUrlChange?: (url: string) => void): Promise<boolean> {
    if (!action.params?.url) return false;

    let targetUrl = action.params.url;
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    this.logger.info(`페이지 이동: ${targetUrl}`);
    if (onUrlChange) onUrlChange(targetUrl);

    await window.electronAPI!.playwright!.executeAction('goto', { url: targetUrl });
    return true;
  }

  private async executeClick(action: ComputerUseAction): Promise<boolean> {
    if (action.params?.x === undefined || action.params?.y === undefined) return false;

    this.logger.info(`클릭: (${action.params.x}, ${action.params.y})`);
    await window.electronAPI!.playwright!.executeAction('click', {
      x: action.params.x,
      y: action.params.y
    });
    return true;
  }

  private async executeDoubleClick(action: ComputerUseAction): Promise<boolean> {
    if (action.params?.x === undefined || action.params?.y === undefined) return false;

    this.logger.info(`더블클릭: (${action.params.x}, ${action.params.y})`);
    await window.electronAPI!.playwright!.executeAction('doubleClick', {
      x: action.params.x,
      y: action.params.y
    });
    return true;
  }

  private async executeRightClick(action: ComputerUseAction): Promise<boolean> {
    if (action.params?.x === undefined || action.params?.y === undefined) return false;

    this.logger.info(`우클릭: (${action.params.x}, ${action.params.y})`);
    await window.electronAPI!.playwright!.executeAction('rightClick', {
      x: action.params.x,
      y: action.params.y
    });
    return true;
  }

  private async executeDrag(action: ComputerUseAction): Promise<boolean> {
    const { startX, startY, endX, endY } = action.params || {};
    if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
      return false;
    }

    this.logger.info(`드래그: (${startX}, ${startY}) -> (${endX}, ${endY})`);
    await window.electronAPI!.playwright!.executeAction('drag', {
      startX,
      startY,
      endX,
      endY
    });
    return true;
  }

  private async executeType(action: ComputerUseAction): Promise<boolean> {
    if (!action.params?.text) return false;

    // 좌표가 있으면 먼저 클릭
    if (action.params.x !== undefined && action.params.y !== undefined) {
      await window.electronAPI!.playwright!.executeAction('click', {
        x: action.params.x,
        y: action.params.y
      });
      await new Promise(resolve => setTimeout(resolve, 500)); // 포커스 대기
    }

    this.logger.info(`입력: "${action.params.text}"${action.params.pressEnter ? ' (Enter)' : ''}`);
    await window.electronAPI!.playwright!.executeAction('type', {
      text: action.params.text,
      pressEnter: action.params.pressEnter
    });
    return true;
  }

  private async executeScroll(action: ComputerUseAction): Promise<boolean> {
    this.logger.info(`스크롤: ${action.params?.direction || 'down'}`);
    await window.electronAPI!.playwright!.executeAction('scroll', {
      direction: action.params?.direction || 'down',
      amount: action.params?.amount,
      selector: action.params?.selector
    });
    return true;
  }

  private async executeGoBack(): Promise<boolean> {
    this.logger.info('뒤로 가기');
    await window.electronAPI!.playwright!.executeAction('goBack', {});
    return true;
  }

  private async executeGoForward(): Promise<boolean> {
    this.logger.info('앞으로 가기');
    await window.electronAPI!.playwright!.executeAction('goForward', {});
    return true;
  }

  private async executeReload(): Promise<boolean> {
    this.logger.info('새로고침');
    await window.electronAPI!.playwright!.executeAction('reload', {});
    return true;
  }

  private async executeKey(action: ComputerUseAction): Promise<boolean> {
    if (!action.params?.key && !action.params?.keys) return false;

    const keys = action.params.keys || [action.params.key!];
    for (const key of keys) {
      this.logger.info(`키 입력: ${key}`);
      await window.electronAPI!.playwright!.executeAction('press', { key });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return true;
  }
}
