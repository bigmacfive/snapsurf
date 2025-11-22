import { useState, useCallback } from 'react';
import { executeWithComputerUse, ComputerUseAction } from '../gemini';

interface UseComputerUseProps {
  webviewRef: React.RefObject<HTMLWebViewElement>;
  currentUrl: string;
  setCurrentUrl: (url: string) => void;
  addLog: (message: string) => void;
  getScreenshotBase64: () => Promise<string | null>;
}

interface ExecuteComputerUseResult {
  success: boolean;
  message: string;
  iterations: number;
}

export function useComputerUse({
  webviewRef,
  currentUrl,
  setCurrentUrl,
  addLog,
  getScreenshotBase64
}: UseComputerUseProps) {
  const [isRunning, setIsRunning] = useState(false);

  /**
   * Computer Use 액션 실행 (Playwright 기반)
   */
  const executeComputerUseAction = useCallback(async (action: ComputerUseAction): Promise<boolean> => {
    try {
      if (!webviewRef.current) return false;
      if (!window.electronAPI?.playwright) {
        addLog('Playwright API를 사용할 수 없습니다.');
        return false;
      }

      // Playwright 연결 확인
      await window.electronAPI.playwright.connectWebview(webviewRef.current.getWebContentsId());

      switch (action.action) {
        case 'goto':
          if (action.params?.url) {
            let targetUrl = action.params.url;
            if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
            setCurrentUrl(targetUrl);
            addLog(`페이지 이동: ${targetUrl}`);
            await window.electronAPI.playwright.executeAction('goto', { url: targetUrl });
            return true;
          }
          break;

        case 'click':
          if (action.params?.x !== undefined && action.params?.y !== undefined) {
            addLog(`클릭: (${action.params.x}, ${action.params.y})`);
            await window.electronAPI.playwright.executeAction('click', { x: action.params.x, y: action.params.y });
            return true;
          }
          break;

        case 'doubleClick':
          if (action.params?.x !== undefined && action.params?.y !== undefined) {
            addLog(`더블클릭: (${action.params.x}, ${action.params.y})`);
            await window.electronAPI.playwright.executeAction('doubleClick', { x: action.params.x, y: action.params.y });
            return true;
          }
          break;

        case 'rightClick':
          if (action.params?.x !== undefined && action.params?.y !== undefined) {
            addLog(`우클릭: (${action.params.x}, ${action.params.y})`);
            await window.electronAPI.playwright.executeAction('rightClick', { x: action.params.x, y: action.params.y });
            return true;
          }
          break;

        case 'drag':
          if (action.params?.startX !== undefined && action.params?.startY !== undefined &&
            action.params?.endX !== undefined && action.params?.endY !== undefined) {
            addLog(`드래그: (${action.params.startX}, ${action.params.startY}) -> (${action.params.endX}, ${action.params.endY})`);
            await window.electronAPI.playwright.executeAction('drag', {
              startX: action.params.startX,
              startY: action.params.startY,
              endX: action.params.endX,
              endY: action.params.endY
            });
            return true;
          }
          break;

        case 'type':
          if (action.params?.text) {
            // 좌표가 있으면 먼저 클릭
            if (action.params.x !== undefined && action.params.y !== undefined) {
              await window.electronAPI.playwright.executeAction('click', { x: action.params.x, y: action.params.y });
              await new Promise(resolve => setTimeout(resolve, 500)); // 포커스 대기
            }

            addLog(`입력: "${action.params.text}"${action.params.pressEnter ? ' (Enter)' : ''}`);
            await window.electronAPI.playwright.executeAction('type', {
              text: action.params.text,
              pressEnter: action.params.pressEnter
            });
            return true;
          }
          break;

        case 'scroll':
          addLog(`스크롤: ${action.params?.direction || 'down'}`);
          await window.electronAPI.playwright.executeAction('scroll', {
            direction: action.params?.direction || 'down',
            amount: action.params?.amount,
            selector: action.params?.selector
          });
          return true;

        case 'goBack':
          addLog('뒤로 가기');
          await window.electronAPI.playwright.executeAction('goBack', {});
          return true;

        case 'goForward':
          addLog('앞으로 가기');
          await window.electronAPI.playwright.executeAction('goForward', {});
          return true;

        case 'reload':
          addLog('새로고침');
          await window.electronAPI.playwright.executeAction('reload', {});
          return true;

        case 'key':
          if (action.params?.key || action.params?.keys) {
            const keys = action.params.keys || [action.params.key];
            for (const key of keys) {
              addLog(`키 입력: ${key}`);
              await window.electronAPI.playwright.executeAction('press', { key });
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            return true;
          }
          break;

        case 'done':
          return true;

        default:
          addLog(`알 수 없는 액션: ${action.action}`);
          return false;
      }

      return false;
    } catch (error: any) {
      addLog(`액션 실행 오류: ${error.message}`);
      console.error('액션 실행 오류:', error);
      return false;
    }
  }, [webviewRef, setCurrentUrl, addLog]);

  /**
   * Computer Use 모델로 작업 실행
   */
  const executeWithComputerUseModel = useCallback(async (
    userMessage: string,
    maxIterations: number = 20
  ): Promise<ExecuteComputerUseResult> => {
    setIsRunning(true);
    const actionHistory: ComputerUseAction[] = [];
    let iteration = 0;

    try {
      addLog('Computer Use 모델로 작업을 처리합니다...');

      while (iteration < maxIterations) {
        iteration++;
        addLog(`[Computer Use] 반복 ${iteration}/${maxIterations}`);

        // 스크린샷 촬영
        const screenshot = await getScreenshotBase64();
        if (!screenshot) {
          addLog('스크린샷을 가져올 수 없습니다.');
          return {
            success: false,
            message: '스크린샷을 가져올 수 없습니다.',
            iterations: iteration
          };
        }

        // Computer Use 모델에 요청
        const computerAction = await executeWithComputerUse(
          userMessage,
          screenshot,
          currentUrl,
          actionHistory,
          userMessage
        );

        actionHistory.push(computerAction);
        addLog(`Computer Use 응답: ${computerAction.action} - ${computerAction.message || ''}`);

        // 액션 실행
        const shouldContinue = await executeComputerUseAction(computerAction);

        if (!shouldContinue || computerAction.action === 'done') {
          addLog('Computer Use 작업 완료');
          return {
            success: true,
            message: computerAction.message || '성공적으로 완료되었습니다',
            iterations: iteration
          };
        }

        // 페이지 변경 대기
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      addLog('최대 반복 횟수에 도달했습니다.');
      return {
        success: false,
        message: '최대 반복 횟수에 도달했습니다.',
        iterations: maxIterations
      };
    } catch (error: any) {
      addLog(`Computer Use 오류: ${error.message}`);
      return {
        success: false,
        message: error.message,
        iterations: iteration
      };
    } finally {
      setIsRunning(false);
    }
  }, [currentUrl, addLog, executeComputerUseAction, getScreenshotBase64]);

  return {
    isRunning,
    executeComputerUseAction,
    executeWithComputerUseModel
  };
}
