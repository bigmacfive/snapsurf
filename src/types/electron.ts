// Electron API 타입 정의

export interface ElectronAPI {
  openUrl: (url: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  reload: () => Promise<void>;
  onUrlChange: (callback: (url: string) => void) => void;
  captureWebviewScreenshot?: (webviewId?: number) => Promise<{
    success: boolean;
    path?: string;
    base64?: string;
    error?: string;
  }>;
  playwright?: {
    connectWebview: (webContentsId: number, options?: { width: number; height: number }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    executeAction: (action: string, params: any) => Promise<{
      success: boolean;
      result?: any;
      error?: string;
    }>;
    getUrl: () => Promise<{
      success: boolean;
      url?: string;
      error?: string;
    }>;
    close: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    setViewport?: (width: number, height: number) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
