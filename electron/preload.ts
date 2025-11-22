import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  reload: () => ipcRenderer.invoke('reload'),
  onUrlChange: (callback: (url: string) => void) => {
    ipcRenderer.on('url-change', (_event, url) => callback(url));
  },
  captureWebviewScreenshot: (webviewId?: number) => ipcRenderer.invoke('capture-webview-screenshot', webviewId),
  playwright: {
    connectWebview: (webContentsId: number) => ipcRenderer.invoke('playwright-connect-webview', webContentsId),
    executeAction: (action: string, params: any) => ipcRenderer.invoke('playwright-execute-action', action, params),
    getUrl: () => ipcRenderer.invoke('playwright-get-url'),
    close: () => ipcRenderer.invoke('playwright-close')
  }
});

