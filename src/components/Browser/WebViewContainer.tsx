import React, { useEffect, useRef, forwardRef } from 'react';

interface WebViewContainerProps {
  currentUrl: string;
  onUrlChange: (url: string) => void;
  onNavigationStateChange: (canGoBack: boolean, canGoForward: boolean) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onPlaywrightConnect?: () => void;
  addLog?: (message: string) => void;
}

export const WebViewContainer = forwardRef<HTMLWebViewElement, WebViewContainerProps>(
  (
    {
      currentUrl,
      onUrlChange,
      onNavigationStateChange,
      onLoadingChange,
      onPlaywrightConnect,
      addLog
    },
    ref
  ) => {
    const internalRef = useRef<HTMLWebViewElement>(null);
    const webviewRef = (ref as React.RefObject<HTMLWebViewElement>) || internalRef;

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview) return;

      // Playwright 연결
      const connectPlaywright = async () => {
        try {
          const webviewAny: any = webview;
          if (webviewAny.getWebContentsId && window.electronAPI?.playwright) {
            const webContentsId = webviewAny.getWebContentsId();
            if (webContentsId) {
              const result = await window.electronAPI.playwright.connectWebview(webContentsId);
              if (result.success) {
                addLog?.('Playwright가 webview에 연결되었습니다');
                onPlaywrightConnect?.();
              } else {
                addLog?.(`Playwright 연결 실패: ${result.error}`);
              }
            }
          }
        } catch (error: any) {
          console.error('Playwright 연결 오류:', error);
          addLog?.(`Playwright 연결 오류: ${error.message}`);
        }
      };

      // webview가 준비되면 Playwright 연결
      const handleDidAttach = () => {
        connectPlaywright();
      };

      const handleDidNavigate = () => {
        const webviewAny: any = webview;
        const newUrl = webviewAny.src || webviewAny.getURL?.() || '';
        onUrlChange(newUrl);
        onNavigationStateChange(
          webviewAny.canGoBack?.() || false,
          webviewAny.canGoForward?.() || false
        );
        onLoadingChange(false);
      };

      const handleDidStartLoading = () => {
        onLoadingChange(true);
      };

      const handleDidStopLoading = () => {
        onLoadingChange(false);
      };

      // ERR_ABORTED 오류는 페이지 전환 시 정상적인 동작이므로 무시
      const handleDidFailLoad = (event: any) => {
        // ERR_ABORTED (-3)는 페이지 전환이나 리디렉션 시 발생하는 정상적인 오류
        if (event.errorCode !== -3) {
          console.warn('Webview 로딩 실패:', event.errorDescription);
        }
      };

      // 이벤트 리스너 등록
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

      // 클린업
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
    }, [webviewRef, onUrlChange, onNavigationStateChange, onLoadingChange, onPlaywrightConnect, addLog]);

    return (
      <webview
        ref={webviewRef}
        src={currentUrl}
        className="webview"
        allowpopups="true"
        webpreferences="contextIsolation=yes"
      />
    );
  }
);

WebViewContainer.displayName = 'WebViewContainer';
