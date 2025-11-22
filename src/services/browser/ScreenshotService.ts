// 스크린샷 서비스

export class ScreenshotService {
  async captureWebview(webviewRef: HTMLWebViewElement | null): Promise<string | null> {
    try {
      if (!webviewRef || !window.electronAPI?.captureWebviewScreenshot) {
        return null;
      }

      const webview: any = webviewRef;
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
      console.error('스크린샷 오류:', error);
      return null;
    }
  }
}
