// Webview JavaScript 실행 유틸리티

export async function executeInWebview(
  webviewRef: HTMLWebViewElement | null,
  code: string
): Promise<any> {
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

export function getWebviewURL(webviewRef: HTMLWebViewElement | null): string {
  if (!webviewRef) {
    throw new Error('Webview가 로드되지 않았습니다');
  }
  return webviewRef.getURL();
}

export function getWebContentsId(webviewRef: HTMLWebViewElement | null): number | null {
  if (!webviewRef) return null;

  const webview: any = webviewRef;
  if (webview.getWebContentsId) {
    return webview.getWebContentsId();
  }
  return null;
}
