import { useState, useRef, useEffect } from 'react';
import './App.css';
import { sendMessageToGemini, parseGeminiResponse, ChatMessage, isComplexTask, executeWithComputerUse, ComputerUseAction } from './gemini';
import { connectPlaywrightToWebview, executePlaywrightAction, getPlaywrightUrl } from './playwright-mcp';
import { TaskOrchestrator } from './orchestrator';

declare global {
  interface Window {
    electronAPI?: {
      openUrl: (url: string) => Promise<void>;
      goBack: () => Promise<void>;
      goForward: () => Promise<void>;
      reload: () => Promise<void>;
      onUrlChange: (callback: (url: string) => void) => void;
      captureWebviewScreenshot?: (webviewId?: number) => Promise<{ success: boolean; path?: string; base64?: string; error?: string }>;
      playwright?: {
        connectWebview: (webContentsId: number) => Promise<{ success: boolean; error?: string }>;
        executeAction: (action: string, params: any) => Promise<{ success: boolean; result?: any; error?: string }>;
        getUrl: () => Promise<{ success: boolean; url?: string; error?: string }>;
        close: () => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

interface Tab {
  id: string;
  title: string;
  url: string;
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', title: '새 탭', url: 'https://www.google.com' }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [url, setUrl] = useState('https://www.google.com');
  const [currentUrl, setCurrentUrl] = useState('https://www.google.com');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationCommand, setAutomationCommand] = useState('');
  const [automationLogs, setAutomationLogs] = useState<string[]>([]);
  const [isAutomationRunning, setIsAutomationRunning] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 브라우저 자동화를 도와드리겠습니다. 무엇을 도와드릴까요?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'auto' | 'flash' | 'pro'>('auto');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<HTMLWebViewElement>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const handleNavigate = () => {
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    setCurrentUrl(targetUrl);
    setIsLoading(true);
    
    // 활성 탭 URL 업데이트
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, url: targetUrl, title: new URL(targetUrl).hostname }
        : tab
    ));
  };

  const handleAddTab = () => {
    const newTabId = Date.now().toString();
    const newTab: Tab = {
      id: newTabId,
      title: '새 탭',
      url: 'https://www.google.com'
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTabId);
    setUrl('https://www.google.com');
    setCurrentUrl('https://www.google.com');
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // 마지막 탭은 닫을 수 없음
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    if (tabId === activeTabId) {
      const newActiveTab = newTabs[newTabs.length - 1];
      setActiveTabId(newActiveTab.id);
      setUrl(newActiveTab.url);
      setCurrentUrl(newActiveTab.url);
    }
  };

  const handleSwitchTab = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setUrl(tab.url);
      setCurrentUrl(tab.url);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const handleGoBack = () => {
    if (webviewRef.current && canGoBack) {
      webviewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (webviewRef.current && canGoForward) {
      webviewRef.current.goForward();
    }
  };

  const handleReload = () => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  const addLog = (message: string) => {
    setAutomationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // webview에서 JavaScript 실행
  const executeInWebview = async (code: string): Promise<any> => {
    if (!webviewRef.current) {
      throw new Error('Webview가 로드되지 않았습니다');
    }
    try {
      const webview: any = webviewRef.current;
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
  };

  const handleAutomationCommand = async () => {
    if (!automationCommand.trim() || isAutomationRunning || !webviewRef.current) return;

    setIsAutomationRunning(true);
    addLog(`명령 실행: ${automationCommand}`);

    try {
      const cmd = automationCommand.toLowerCase();
      const results: any[] = [];

      // URL 이동
      if (cmd.includes('이동') || cmd.includes('goto') || cmd.includes('go to')) {
        const urlMatch = automationCommand.match(/https?:\/\/[^\s]+|www\.[^\s]+|[가-힣a-zA-Z0-9.-]+\.[가-힣a-zA-Z]{2,}/);
        if (urlMatch) {
          let url = urlMatch[0];
          if (!url.startsWith('http')) url = 'https://' + url;
          setCurrentUrl(url);
          results.push({ action: 'goto', url });
        }
      }

      // 클릭
      if (cmd.includes('클릭') || cmd.includes('click')) {
        const selectorMatch = automationCommand.match(/['"]([^'"]+)['"]|클릭\s+([^\s]+)/);
        if (selectorMatch) {
          const selector = selectorMatch[1] || selectorMatch[2];
          const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          const clicked = await executeInWebview(`
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
          results.push({ action: 'click', selector, success: clicked });
        }
      }

      // 입력
      if (cmd.includes('입력') || cmd.includes('입력해') || cmd.includes('type') || cmd.includes('fill')) {
        const parts = automationCommand.match(/['"]([^'"]+)['"]/g);
        if (parts && parts.length >= 2) {
          const selector = parts[0].replace(/['"]/g, '');
          const text = parts[1].replace(/['"]/g, '');
          const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
          const filled = await executeInWebview(`
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
          results.push({ action: 'fill', selector, text, success: filled });
        }
      }

      // 스크린샷 (webview는 직접 스크린샷 불가, 대신 현재 URL 반환)
      if (cmd.includes('스크린샷') || cmd.includes('screenshot') || cmd.includes('캡처')) {
        const url = webviewRef.current.getURL();
        results.push({ action: 'screenshot', url, message: '스크린샷은 별도 기능으로 구현 필요' });
      }

      // 텍스트 추출
      if (cmd.includes('텍스트') || cmd.includes('text') || cmd.includes('가져와')) {
        const selectorMatch = automationCommand.match(/['"]([^'"]+)['"]/);
        if (selectorMatch) {
          const selector = selectorMatch[1];
          const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          const text = await executeInWebview(`
            (() => {
              try {
                const el = document.querySelector('${escapedSelector}');
                return el ? (el.textContent || el.innerText || '') : null;
              } catch (e) {
                return null;
              }
            })()
          `);
          results.push({ action: 'text', selector, text });
        }
      }

      addLog(`성공: ${JSON.stringify(results.length > 0 ? results : '명령 처리됨')}`);
    } catch (error: any) {
      addLog(`오류: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsAutomationRunning(false);
    }
  };

  const handleAutomationAction = async (action: string, ...args: any[]) => {
    if (isAutomationRunning || !webviewRef.current) return;

    setIsAutomationRunning(true);
    addLog(`${action} 실행 중...`);

    try {
      let result: any;
      switch (action) {
        case 'goto':
          if (args[0]) {
            let url = args[0];
            if (!url.startsWith('http')) url = 'https://' + url;
            setCurrentUrl(url);
            result = { success: true, url };
          }
          break;
        case 'click':
          if (args[0]) {
            const escapedSelector = String(args[0]).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const clicked = await executeInWebview(`
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
            result = { success: clicked, selector: args[0] };
          }
          break;
        case 'fill':
          if (args[0] && args[1]) {
            const escapedSelector = String(args[0]).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const escapedText = String(args[1]).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
            const filled = await executeInWebview(`
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
            result = { success: filled, selector: args[0], text: args[1] };
          }
          break;
        case 'screenshot':
          const url = webviewRef.current.getURL();
          result = { success: true, url, message: '현재 페이지 URL' };
          break;
        case 'getUrl':
          const currentUrl = webviewRef.current.getURL();
          result = { success: true, url: currentUrl };
          break;
        default:
          return;
      }

      if (result && result.success) {
        addLog(`성공: ${JSON.stringify(result)}`);
      } else {
        addLog(`실패: ${result?.error || '요소를 찾을 수 없습니다'}`);
      }
    } catch (error: any) {
      addLog(`오류: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsAutomationRunning(false);
    }
  };

  // Computer Use 액션 실행 (Playwright 기반)
  const executeComputerUseAction = async (action: ComputerUseAction): Promise<boolean> => {
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
  };

  // Computer Use 액션 실행

  // 스크린샷을 base64로 가져오기
  const getScreenshotBase64 = async (): Promise<string | null> => {
    try {
      if (!webviewRef.current || !window.electronAPI?.captureWebviewScreenshot) return null;
      
      const webview: any = webviewRef.current;
      const webContentsId = webview.getWebContentsId?.();
      
      if (webContentsId) {
        const result = await window.electronAPI.captureWebviewScreenshot(webContentsId);
        if (result.success && result.base64) {
          return `data:image/png;base64,${result.base64}`;
        }
      }
      
      // webContentsId가 없으면 기본 호출
      const result = await window.electronAPI.captureWebviewScreenshot();
      if (result.success && result.base64) {
        return `data:image/png;base64,${result.base64}`;
      }
      
      return null;
    } catch (error: any) {
      addLog(`스크린샷 오류: ${error.message}`);
      return null;
    }
  };

  const executeGeminiAction = async (action: any) => {
    try {
      if (!action || !action.action) return;

      switch (action.action) {
        case 'goto':
          if (action.params?.url) {
            let targetUrl = action.params.url;
            if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
            
            // Playwright MCP 사용 시도
            try {
              // Playwright MCP 도구 이름 확인 후 호출
              const tools = await listPlaywrightTools();
              console.log('사용 가능한 Playwright MCP 도구:', tools);
              
              // 일반적인 도구 이름 시도
              const toolNames = ['navigate', 'goto', 'playwright_navigate', 'browser_navigate'];
              let success = false;
              
              for (const toolName of toolNames) {
                if (tools.includes(toolName)) {
                  try {
                    const result = await callPlaywrightTool(toolName, { url: targetUrl });
                    addLog(`Playwright MCP로 페이지 이동: ${targetUrl}`);
                    setCurrentUrl(targetUrl);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    success = true;
                    break;
                  } catch (e) {
                    console.log(`도구 ${toolName} 실패:`, e);
                  }
                }
              }
              
              if (success) return;
            } catch (e) {
              console.log('Playwright MCP 실패, webview 방식 사용:', e);
            }
            
            // Fallback: webview 방식
            setCurrentUrl(targetUrl);
            addLog(`페이지 이동: ${targetUrl}`);
            // 페이지 로딩 대기 - DOM이 준비될 때까지 기다림
            if (webviewRef.current) {
              await new Promise(resolve => {
                const webview: any = webviewRef.current;
                if (!webview) {
                  setTimeout(() => resolve(undefined), 2000);
                  return;
                }
                let resolved = false;
                const timeout = setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    resolve(undefined);
                  }
                }, 5000); // 최대 5초 대기
                
                const checkLoaded = async () => {
                  try {
                    const isReady = await executeInWebview(`
                      (() => {
                        return document.readyState === 'complete' || document.readyState === 'interactive';
                      })()
                    `);
                    
                    const currentUrl = webview.getURL();
                    const targetHost = new URL(targetUrl).hostname;
                    
                    if (isReady && currentUrl && currentUrl.includes(targetHost)) {
                      if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(undefined);
                      }
                    } else {
                      setTimeout(checkLoaded, 200);
                    }
                  } catch (e) {
                    setTimeout(checkLoaded, 200);
                  }
                };
                
                setTimeout(checkLoaded, 500); // 0.5초 후부터 체크 시작
              });
            }
          }
          break;
        case 'click':
          if (action.params?.selector || action.params?.findByText) {
            const selector = action.params?.selector ? String(action.params.selector) : '';
            const findByText = action.params?.findByText;
            const newTab = action.params?.newTab === true;
            const selectors = selector ? selector.split(',').map(s => s.trim()).filter(s => s) : [];
            
            // 요소를 찾을 때까지 재시도
            let clicked = false;
            const maxRetries = 15;
            const retryDelay = 200;
            
            for (let retry = 0; retry < maxRetries; retry++) {
              const result = await executeInWebview(`
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
                        // 새 탭으로 열기 - webview에서는 window.open이 제한될 수 있으므로
                        // href를 반환하여 상위에서 처리
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
                  setTabs(prev => [...prev, newTab]);
                  setActiveTabId(newTabId);
                  setUrl(result.href);
                  setCurrentUrl(result.href);
                  addLog(`새 탭으로 열기: ${result.href}`);
                  break;
                }
                
                addLog(`클릭: ${selector || findByText}${result.href ? ' -> ' + result.href : ''}`);
                
                // 링크 클릭인 경우 페이지 전환 대기
                if (result.href && result.href.startsWith('http')) {
                  await new Promise(resolve => {
                    const webview: any = webviewRef.current;
                    if (!webview) {
                      setTimeout(() => resolve(undefined), 2000);
                      return;
                    }
                    
                    let resolved = false;
                    const timeout = setTimeout(() => {
                      if (!resolved) {
                        resolved = true;
                        resolve(undefined);
                      }
                    }, 5000);
                    
                    const checkNavigated = async () => {
                      try {
                        const currentUrl = webview.getURL();
                        if (currentUrl && currentUrl !== result.href && 
                            (currentUrl.includes(new URL(result.href).hostname) || 
                             !currentUrl.includes('google.com'))) {
                          // 페이지가 전환되었거나 구글이 아닌 다른 페이지로 이동
                          const isReady = await executeInWebview(`
                            (() => document.readyState === 'complete' || document.readyState === 'interactive')()
                          `);
                          if (isReady && !resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            resolve(undefined);
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
                break;
              }
              
              if (retry < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }
            }
            
            if (!clicked) {
              const searchText = action.params?.findByText || selector;
              addLog(`클릭 실패: ${searchText} - 요소를 찾을 수 없습니다 (${maxRetries}회 시도)`);
            }
          }
          break;
        case 'scroll':
          if (action.params?.direction || action.params?.selector) {
            const direction = action.params?.direction || 'down';
            const selector = action.params?.selector;
            
            await executeInWebview(`
              (() => {
                try {
                  if (${JSON.stringify(selector)}) {
                    // 특정 요소로 스크롤
                    const el = document.querySelector(${JSON.stringify(selector)});
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      return { success: true, action: 'scroll to element' };
                    }
                  } else if (${JSON.stringify(direction)} === 'down') {
                    // 아래로 스크롤
                    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
                    return { success: true, action: 'scroll down' };
                  } else if (${JSON.stringify(direction)} === 'up') {
                    // 위로 스크롤
                    window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
                    return { success: true, action: 'scroll up' };
                  }
                  return { success: false };
                } catch (e) {
                  return { success: false, error: e.message };
                }
              })()
            `);
            addLog(`스크롤: ${direction}${selector ? ' to ' + selector : ''}`);
            // 스크롤 후 콘텐츠 로딩 대기 (더 길게)
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          break;
        case 'fill':
          if (action.params?.selector && action.params?.text) {
            const selector = String(action.params.selector);
            const escapedText = String(action.params.text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
            const shouldSubmit = action.params?.submit !== false;
            
            // selector에 쉼표가 있으면 여러 selector를 시도
            const selectors = selector.split(',').map(s => s.trim()).filter(s => s);
            
            // 요소를 찾을 때까지 재시도 (최대 3초)
            let result: any = null;
            const maxRetries = 15;
            const retryDelay = 200;
            
            for (let retry = 0; retry < maxRetries; retry++) {
              result = await executeInWebview(`
                (() => {
                  try {
                    const selectors = ${JSON.stringify(selectors)};
                    let el = null;
                    
                    // 여러 selector를 순차적으로 시도
                    for (const sel of selectors) {
                      try {
                        el = document.querySelector(sel);
                        if (el && el.offsetParent !== null) { // visible check
                          break;
                        }
                      } catch (e) {
                        continue;
                      }
                    }
                    
                    if (!el) {
                      // selector를 찾지 못한 경우, 일반적인 검색 input 찾기
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
                      
                      // 검색창이나 form 내부 input인 경우 자동 제출
                      if (${shouldSubmit}) {
                        setTimeout(() => {
                          const form = el.closest('form');
                          if (form) {
                            // form 제출 시도
                            const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type]), [type="button"]');
                            if (submitBtn && ((submitBtn.textContent || submitBtn.value || '').toLowerCase().includes('search') || 
                                (submitBtn.textContent || submitBtn.value || '').includes('검색'))) {
                              submitBtn.click();
                            } else {
                              // 엔터키 이벤트 발생
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
                            // 검색창인 경우 엔터키 이벤트
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
                break; // 성공하면 재시도 중단
              }
              
              // 마지막 시도가 아니면 대기
              if (retry < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }
            }
            
            if (result && result.success) {
              addLog(`입력: ${result.selector || selector} = ${action.params.text}${shouldSubmit ? ' (제출됨)' : ''}`);
            } else {
              addLog(`입력 실패: ${selector} - 요소를 찾을 수 없습니다 (${maxRetries}회 시도)`);
            }
          }
          break;
        case 'text':
          if (action.params?.selector) {
            const escapedSelector = String(action.params.selector).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const text = await executeInWebview(`
              (() => {
                try {
                  const el = document.querySelector('${escapedSelector}');
                  return el ? (el.textContent || el.innerText || '') : null;
                } catch (e) {
                  return null;
                }
              })()
            `);
            addLog(`텍스트 추출: ${text}`);
          }
          break;
        case 'screenshot':
          if (webviewRef.current) {
            try {
              const url = webviewRef.current.getURL();
              
              // IPC를 통해 메인 프로세스에서 스크린샷 캡처
              if (window.electronAPI?.captureWebviewScreenshot) {
                const result = await window.electronAPI.captureWebviewScreenshot(url);
                if (result.success && result.path) {
                  addLog(`✅ 스크린샷 저장 완료: ${result.path}`);
                } else {
                  addLog(`❌ 스크린샷 저장 실패: ${result.error || '알 수 없는 오류'}`);
                  addLog(`💾 저장 위치: ~/Desktop/screenshot-{timestamp}.png`);
                }
              } else {
                addLog(`스크린샷: IPC를 통한 저장이 불가능합니다.`);
                addLog(`💾 저장 위치: ~/Desktop/screenshot-{timestamp}.png`);
              }
            } catch (error: any) {
              const url = webviewRef.current?.getURL();
              addLog(`스크린샷 실패: ${error.message || '알 수 없는 오류'} (URL: ${url})`);
              addLog(`💾 저장 위치: ~/Desktop/screenshot-{timestamp}.png`);
            }
          } else {
            addLog(`스크린샷: webview가 로드되지 않았습니다.`);
            addLog(`💾 저장 위치: ~/Desktop/screenshot-{timestamp}.png`);
          }
          break;
        case 'wait':
        case 'waitForSelector':
          if (action.params?.selector) {
            const selector = String(action.params.selector);
            const timeout = action.params?.timeout || 5000;
            const maxRetries = Math.ceil(timeout / 200);
            
            for (let retry = 0; retry < maxRetries; retry++) {
              const found = await executeInWebview(`
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
                addLog(`요소 대기 완료: ${selector}`);
                break;
              }
              
              if (retry < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
          }
          break;
        case 'waitForNavigation':
          await new Promise(resolve => setTimeout(resolve, action.params?.timeout || 3000));
          addLog('네비게이션 대기 완료');
          break;
        case 'press':
          if (action.params?.key && action.params?.selector) {
            const selector = String(action.params.selector);
            const key = String(action.params.key);
            await executeInWebview(`
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
            addLog(`키 입력: ${key}`);
          }
          break;
        case 'type':
          if (action.params?.selector && action.params?.text) {
            const selector = String(action.params.selector);
            const text = String(action.params.text);
            await executeInWebview(`
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
            addLog(`타이핑: ${text}`);
          }
          break;
        case 'hover':
          if (action.params?.selector) {
            const selector = String(action.params.selector);
            await executeInWebview(`
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
            addLog(`호버: ${selector}`);
          }
          break;
        case 'doubleClick':
          if (action.params?.selector) {
            const selector = String(action.params.selector);
            await executeInWebview(`
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
            addLog(`더블클릭: ${selector}`);
          }
          break;
        case 'rightClick':
          if (action.params?.selector) {
            const selector = String(action.params.selector);
            await executeInWebview(`
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
            addLog(`우클릭: ${selector}`);
          }
          break;
        case 'select':
          if (action.params?.selector && action.params?.value) {
            const selector = String(action.params.selector);
            const value = String(action.params.value);
            await executeInWebview(`
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
            addLog(`선택: ${selector} = ${value}`);
          }
          break;
        case 'checkbox':
          if (action.params?.selector) {
            const selector = String(action.params.selector);
            const checked = action.params?.checked !== false;
            await executeInWebview(`
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
            addLog(`체크박스: ${selector} = ${checked}`);
          }
          break;
        case 'getAttribute':
          if (action.params?.selector && action.params?.value) {
            const selector = String(action.params.selector);
            const attrName = String(action.params.value);
            const value = await executeInWebview(`
              (() => {
                try {
                  const el = document.querySelector(${JSON.stringify(selector)});
                  return el ? el.getAttribute(${JSON.stringify(attrName)}) : null;
                } catch (e) {
                  return null;
                }
              })()
            `);
            addLog(`속성: ${selector}.${attrName} = ${value}`);
          }
          break;
        case 'isVisible':
          if (action.params?.selector) {
            const selector = String(action.params.selector);
            const visible = await executeInWebview(`
              (() => {
                try {
                  const el = document.querySelector(${JSON.stringify(selector)});
                  return el && el.offsetParent !== null;
                } catch (e) {
                  return false;
                }
              })()
            `);
            addLog(`가시성: ${selector} = ${visible}`);
          }
          break;
        case 'goBack':
          if (webviewRef.current && canGoBack) {
            webviewRef.current.goBack();
            addLog('뒤로 가기');
          }
          break;
        case 'goForward':
          if (webviewRef.current && canGoForward) {
            webviewRef.current.goForward();
            addLog('앞으로 가기');
          }
          break;
        case 'reload':
          if (webviewRef.current) {
            webviewRef.current.reload();
            addLog('새로고침');
          }
          break;
        case 'getTitle':
          const title = await executeInWebview(`(() => document.title)()`);
          addLog(`페이지 제목: ${title}`);
          break;
        case 'getUrl':
          const currentUrl2 = webviewRef.current?.getURL();
          addLog(`현재 URL: ${currentUrl2}`);
          break;
        case 'evaluate':
          if (action.params?.code) {
            const code = String(action.params.code);
            const result = await executeInWebview(code);
            addLog(`JavaScript 실행 결과: ${JSON.stringify(result)}`);
          }
          break;
        case 'drag':
          if (action.params?.fromSelector && action.params?.toSelector) {
            const fromSelector = String(action.params.fromSelector);
            const toSelector = String(action.params.toSelector);
            await executeInWebview(`
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
            addLog(`드래그: ${fromSelector} -> ${toSelector}`);
          }
          break;
        case 'upload':
          if (action.params?.selector && action.params?.filePath) {
            addLog(`파일 업로드: ${action.params.filePath} (웹뷰에서는 제한적 지원)`);
            // 웹뷰에서는 파일 업로드가 제한적이므로 로그만 남김
          }
          break;
        case 'download':
          if (action.params?.selector) {
            const selector = String(action.params.selector);
            const href = await executeInWebview(`
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
              addLog(`다운로드 링크: ${href}`);
              // 새 탭으로 열어서 다운로드 트리거
              const newTabId = Date.now().toString();
              const newTab: Tab = {
                id: newTabId,
                title: '다운로드',
                url: href
              };
              setTabs(prev => [...prev, newTab]);
            }
          }
          break;
        case 'nextPage':
          // 다음 페이지로 이동 (페이지네이션)
          const maxPages = action.params?.maxPages || 5;
          let pageNavigated = false;
          
          for (let page = 0; page < maxPages; page++) {
            const result = await executeInWebview(`
              (() => {
                try {
                  // 다음 페이지 버튼 찾기
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
                  
                  // 페이지 번호 찾기 (현재 페이지 다음)
                  if (!nextBtn) {
                    const pageLinks = Array.from(document.querySelectorAll('a[href*="start="], a[href*="page="], a[href*="p="]'));
                    const currentUrl = window.location.href;
                    for (const link of pageLinks) {
                      const href = link.getAttribute('href');
                      if (href && href !== currentUrl) {
                        nextBtn = link;
                        break;
                      }
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
              addLog(`다음 페이지로 이동: ${result.page}페이지`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // 페이지 로딩 대기
              break;
            }
          }
          
          if (!pageNavigated) {
            addLog(`다음 페이지를 찾을 수 없습니다 (최대 ${maxPages}페이지 시도)`);
          }
          break;
        case 'findLink':
        case 'searchInResults':
          // 조건에 맞는 링크 찾기
          const criteria = action.params?.criteria || '';
          const mustMatch = action.params?.mustMatch || '';
          
          const foundLink = await executeInWebview(`
            (() => {
              try {
                const criteria = ${JSON.stringify(criteria)};
                const mustMatch = ${JSON.stringify(mustMatch)};
                const allLinks = Array.from(document.querySelectorAll('a[href]'));
                
                for (const link of allLinks) {
                  const text = (link.textContent || link.innerText || '').toLowerCase();
                  const href = link.href || '';
                  const title = link.getAttribute('title') || '';
                  
                  // criteria 체크 (국외자료, 외국, english 등)
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
                  
                  // mustMatch 체크 (도메인, 특정 텍스트)
                  let matchesMust = true;
                  if (mustMatch) {
                    const mustLower = mustMatch.toLowerCase();
                    matchesMust = 
                      href.includes(mustLower) ||
                      text.includes(mustLower) ||
                      title.toLowerCase().includes(mustLower);
                  }
                  
                  // 국외자료 판단 (한국 도메인이 아닌 경우)
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
            addLog(`링크 찾음: ${foundLink.text || foundLink.href}`);
            // 찾은 링크 클릭
            const escapedHref = String(foundLink.href).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const clicked = await executeInWebview(`
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
                // 새 탭으로 열기
                const newTabId = Date.now().toString();
                const newTab: Tab = {
                  id: newTabId,
                  title: '새 탭',
                  url: foundLink.href
                };
                setTabs(prev => [...prev, newTab]);
                setActiveTabId(newTabId);
                setUrl(foundLink.href);
                setCurrentUrl(foundLink.href);
                addLog(`새 탭으로 열기: ${foundLink.href}`);
              } else {
                addLog(`링크 클릭: ${foundLink.href}`);
                // 페이지 전환 대기
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } else {
            addLog(`조건에 맞는 링크를 찾을 수 없습니다: ${criteria}${mustMatch ? ' + ' + mustMatch : ''}`);
          }
          break;
      }
    } catch (error: any) {
      addLog(`실행 오류: ${error.message}`);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);

    try {
      // 모델 선택에 따른 처리
      // 'pro' 모드는 바로 Computer Use 사용
      if (selectedModel === 'pro') {
        const modelName = selectedModel === 'pro' ? 'Computer Use (Pro)' : 'Computer Use (Auto)';
        addLog(`${modelName} 모델 사용`);
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `${modelName} 모델로 작업을 처리합니다...` 
        }]);

        const actionHistory: ComputerUseAction[] = [];
        let maxIterations = 20; // 최대 반복 횟수
        let iteration = 0;

        while (iteration < maxIterations) {
          iteration++;
          addLog(`[Computer Use] 반복 ${iteration}/${maxIterations}`);

          // 스크린샷 촬영
          const screenshot = await getScreenshotBase64();
          if (!screenshot) {
            addLog('스크린샷을 가져올 수 없습니다. 일반 모델로 전환합니다.');
            break;
          }

          // Computer Use 모델에 요청
          const computerAction = await executeWithComputerUse(
            userMessage,
            screenshot,
            currentUrl,
            actionHistory,
            userMessage // 원본 메시지 전달
          );

          actionHistory.push(computerAction);
          addLog(`Computer Use 응답: ${computerAction.action} - ${computerAction.message || ''}`);

          // 액션 실행
          const shouldContinue = await executeComputerUseAction(computerAction);
          
          if (!shouldContinue || computerAction.action === 'done') {
            addLog('Computer Use 작업 완료');
            setChatMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `작업 완료: ${computerAction.message || '성공적으로 완료되었습니다'}` 
            }]);
            break;
          }

          // 페이지 변경 대기
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if (iteration >= maxIterations) {
          addLog('최대 반복 횟수에 도달했습니다.');
          setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: '작업이 완료되지 않았습니다. 최대 반복 횟수에 도달했습니다.' 
          }]);
        }

        setIsChatLoading(false);
        return;
      }

      // Flash/Playwright (Orchestrator)로 먼저 시도
      addLog('Flash/Playwright로 작업 시도 중...');
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Flash/Playwright로 작업을 계획하고 실행합니다...' 
      }]);

      const orchestrator = new TaskOrchestrator(addLog);
      const orchestrationResult = await orchestrator.orchestrate(
        userMessage, 
        currentUrl,
        (url: string) => {
          setCurrentUrl(url);
          setUrl(url);
        }
      );

      if (orchestrationResult.success) {
        addLog('오케스트레이션 완료');
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `작업 완료: ${orchestrationResult.message}\n\n실행된 단계: ${orchestrationResult.results.length}개` 
        }]);
        setIsChatLoading(false);
        return;
      }

      // Orchestrator 실패 시 Computer Use로 전환 (auto 모드일 때만)
      if (selectedModel === 'auto') {
        addLog(`Flash/Playwright 실패. Computer Use 모델로 전환: ${orchestrationResult.message}`);
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Flash/Playwright로 해결하지 못했습니다. Computer Use 모델로 전환합니다...` 
        }]);

        // Computer Use 모델로 재시도
        const actionHistory: ComputerUseAction[] = [];
        let maxIterations = 20;
        let iteration = 0;

        while (iteration < maxIterations) {
          iteration++;
          addLog(`[Computer Use] 반복 ${iteration}/${maxIterations}`);

          // 스크린샷 촬영
          const screenshot = await getScreenshotBase64();
          if (!screenshot) {
            addLog('스크린샷을 가져올 수 없습니다.');
            break;
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
            setChatMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `작업 완료: ${computerAction.message || '성공적으로 완료되었습니다'}` 
            }]);
            break;
          }

          // 페이지 변경 대기
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if (iteration >= maxIterations) {
          addLog('최대 반복 횟수에 도달했습니다.');
          setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: '작업이 완료되지 않았습니다. 최대 반복 횟수에 도달했습니다.' 
          }]);
        }
      } else {
        // flash 모드일 때는 실패 메시지만 표시
        addLog(`오케스트레이션 실패: ${orchestrationResult.message}`);
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `작업 실패: ${orchestrationResult.message}\n\n실행된 단계: ${orchestrationResult.results.length}개\n\nPro 모드를 선택하면 Computer Use 모델을 사용할 수 있습니다.` 
        }]);
      }

      setIsChatLoading(false);
      return;
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `오류가 발생했습니다: ${error.message}`
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    // Playwright를 webview에 연결
    const connectPlaywright = async () => {
      try {
        const webviewAny: any = webview;
        if (webviewAny.getWebContentsId && window.electronAPI?.playwright) {
          const webContentsId = webviewAny.getWebContentsId();
          if (webContentsId) {
            const result = await window.electronAPI.playwright.connectWebview(webContentsId);
            if (result.success) {
              addLog('Playwright가 webview에 연결되었습니다');
            } else {
              addLog(`Playwright 연결 실패: ${result.error}`);
            }
          }
        }
      } catch (error: any) {
        console.error('Playwright 연결 오류:', error);
        addLog(`Playwright 연결 오류: ${error.message}`);
      }
    };

    // webview가 준비되면 Playwright 연결
    const handleDidAttach = () => {
      connectPlaywright();
    };

    const handleDidNavigate = () => {
      const newUrl = webview.src;
      setCurrentUrl(newUrl);
      setUrl(newUrl);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      setIsLoading(false);
      
      // 탭 제목 업데이트
      try {
        const hostname = new URL(newUrl).hostname;
        setTabs(prevTabs => prevTabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, url: newUrl, title: hostname }
            : tab
        ));
      } catch (e) {
        // URL 파싱 실패 시 무시
      }
    };

    const handleDidStartLoading = () => {
      setIsLoading(true);
    };

    const handleDidStopLoading = () => {
      setIsLoading(false);
    };

    // ERR_ABORTED 오류는 페이지 전환 시 정상적인 동작이므로 무시
    const handleDidFailLoad = (event: any) => {
      // ERR_ABORTED (-3)는 페이지 전환이나 리디렉션 시 발생하는 정상적인 오류
      if (event.errorCode !== -3) {
        console.warn('Webview 로딩 실패:', event.errorDescription);
      }
    };

    // webview가 attach되면 Playwright 연결
    if ((webview as any).addEventListener) {
      (webview as any).addEventListener('did-attach', handleDidAttach);
    } else {
      // did-attach 이벤트가 없으면 직접 연결 시도
      setTimeout(connectPlaywright, 1000);
    }

    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);
    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('did-fail-load', handleDidFailLoad);

    return () => {
      if ((webview as any).removeEventListener) {
        (webview as any).removeEventListener('did-attach', handleDidAttach);
      }
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
    };
  }, [activeTabId]);

  return (
    <div className="browser-container">
      <div className="main-content">
      <div className="tabs-bar">
        <div className="tabs-container">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => handleSwitchTab(tab.id)}
            >
              <span className="tab-title">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="탭 닫기"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="new-tab-btn" onClick={handleAddTab} title="새 탭">
          +
        </button>
      </div>

      <div className="toolbar">
        <div className="nav-buttons">
          <button 
            onClick={handleGoBack} 
            disabled={!canGoBack}
            className="nav-btn"
            title="뒤로"
          >
            ←
          </button>
          <button 
            onClick={handleGoForward} 
            disabled={!canGoForward}
            className="nav-btn"
            title="앞으로"
          >
            →
          </button>
          <button 
            onClick={handleReload} 
            className="nav-btn"
            title="새로고침"
          >
            ⟳
          </button>
          <button 
            onClick={() => setShowAutomation(!showAutomation)}
            className={`nav-btn ${showAutomation ? 'active' : ''}`}
            title="자동화 패널"
          >
            ⚙
          </button>
        </div>
        
        <div className="address-bar-container">
          <input
            type="text"
            className="address-bar"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="주소를 입력하세요"
          />
          {isLoading && <div className="loading-spinner" />}
        </div>
      </div>

      {showAutomation && (
        <div className="automation-panel">
          <div className="automation-header">
            <h3>자동화 제어</h3>
            <button 
              className="close-panel-btn"
              onClick={() => setShowAutomation(false)}
            >
              ×
            </button>
          </div>
          
          <div className="automation-commands">
            <div className="command-input-group">
              <input
                type="text"
                className="automation-command-input"
                value={automationCommand}
                onChange={(e) => setAutomationCommand(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAutomationCommand()}
                placeholder="자연어 명령 입력 (예: 구글.com으로 이동하고 스크린샷 찍어줘)"
                disabled={isAutomationRunning}
              />
              <button
                className="automation-btn"
                onClick={handleAutomationCommand}
                disabled={isAutomationRunning || !automationCommand.trim()}
              >
                {isAutomationRunning ? '실행 중...' : '실행'}
              </button>
            </div>

            <div className="quick-actions">
              <h4>빠른 작업</h4>
              <div className="quick-buttons">
                <button
                  className="quick-btn"
                  onClick={() => handleAutomationAction('goto', 'https://www.google.com')}
                  disabled={isAutomationRunning}
                >
                  구글로 이동
                </button>
                <button
                  className="quick-btn"
                  onClick={() => handleAutomationAction('screenshot')}
                  disabled={isAutomationRunning}
                >
                  스크린샷
                </button>
                <button
                  className="quick-btn"
                  onClick={() => handleAutomationAction('getUrl')}
                  disabled={isAutomationRunning}
                >
                  현재 URL
                </button>
              </div>
            </div>

            <div className="automation-logs">
              <h4>실행 로그</h4>
              <div className="logs-container">
                {automationLogs.length === 0 ? (
                  <div className="log-empty">로그가 없습니다</div>
                ) : (
                  automationLogs.map((log, idx) => (
                    <div key={idx} className="log-entry">{log}</div>
                  ))
                )}
              </div>
              {automationLogs.length > 0 && (
                <button
                  className="clear-logs-btn"
                  onClick={() => setAutomationLogs([])}
                >
                  로그 지우기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

        <webview
          ref={webviewRef}
          src={currentUrl}
          className="webview"
          allowpopups="true"
          webpreferences="contextIsolation=yes"
        />
      </div>

      <div className="chat-sidebar">
        <div className="chat-header">
          <h3>Gemini AI</h3>
          <select
            className="model-selector"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'auto' | 'flash' | 'pro')}
            disabled={isChatLoading}
          >
            <option value="auto">Auto</option>
            <option value="flash">Flash</option>
            <option value="pro">Pro (Computer Use)</option>
          </select>
        </div>
        <div className="chat-messages">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
          {isChatLoading && (
            <div className="chat-message assistant">
              <div className="message-content">생각 중...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleChatSend()}
            placeholder="메시지를 입력하세요..."
            disabled={isChatLoading}
          />
          <button
            className="chat-send-btn"
            onClick={handleChatSend}
            disabled={isChatLoading || !chatInput.trim()}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

