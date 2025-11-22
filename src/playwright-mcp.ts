// Renderer 프로세스용 Playwright 래퍼 (IPC를 통해 main 프로세스와 통신)

export async function connectPlaywrightToWebview(webContentsId: number): Promise<void> {
  if (!window.electronAPI?.playwright) {
    throw new Error('Playwright API가 사용할 수 없습니다');
  }
  const result = await window.electronAPI.playwright.connectWebview(webContentsId);
  if (!result.success) {
    throw new Error(result.error || 'Playwright webview 연결 실패');
  }
}

export async function executePlaywrightAction(
  action: string,
  params: any
): Promise<any> {
  if (!window.electronAPI?.playwright) {
    throw new Error('Playwright API가 사용할 수 없습니다');
  }
  const result = await window.electronAPI.playwright.executeAction(action, params);
  if (!result.success) {
    throw new Error(result.error || `Playwright 액션 실행 실패: ${action}`);
  }
  return result.result;
}

export async function getPlaywrightUrl(): Promise<string | null> {
  if (!window.electronAPI?.playwright) {
    return null;
  }
  const result = await window.electronAPI.playwright.getUrl();
  if (result.success && result.url) {
    return result.url;
  }
  return null;
}

export async function closePlaywright(): Promise<void> {
  if (!window.electronAPI?.playwright) {
    return;
  }
  await window.electronAPI.playwright.close();
}

