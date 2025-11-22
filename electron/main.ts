import { app, BrowserWindow, ipcMain, webContents } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { connectPlaywrightToWebview, executePlaywrightAction, getCurrentUrl, closePlaywrightBrowser } from './playwright-browser';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    frame: false
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // webview 관련 ERR_ABORTED 오류 필터링 (페이지 전환 시 정상적인 동작)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // ERR_ABORTED (-3)는 페이지 전환이나 리디렉션 시 발생하는 정상적인 오류이므로 무시
    if (errorCode !== -3) {
      console.warn('페이지 로딩 실패:', errorDescription, validatedURL);
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 핸들러 설정
function setupIpcHandlers() {
  // Playwright 브라우저 IPC 핸들러
  ipcMain.handle('playwright-connect-webview', async (_event, webContentsId: number) => {
    try {
      await connectPlaywrightToWebview(webContentsId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('playwright-execute-action', async (_event, action: string, params: any) => {
    try {
      const result = await executePlaywrightAction(action, params);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('playwright-get-url', async () => {
    try {
      const url = await getCurrentUrl();
      return { success: true, url };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('playwright-close', async () => {
    try {
      await closePlaywrightBrowser();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // webview 스크린샷 캡처 (webContentsId로 찾기)
  ipcMain.handle('capture-webview-screenshot', async (_event, webviewId?: number) => {
    try {
      let targetWebContents = null;
      
      if (webviewId) {
        targetWebContents = webContents.fromId(webviewId);
      } else {
        // webviewId가 없으면 첫 번째 webview 찾기 (메인 윈도우 제외)
        const allWebContents = webContents.getAllWebContents();
        targetWebContents = allWebContents.find(wc => {
          const url = wc.getURL();
          return url && !url.startsWith('file://') && !url.includes('localhost:3000');
        });
      }
      
      if (targetWebContents) {
        const image = await targetWebContents.capturePage();
        const pngBuffer = image.toPNG();
        const base64 = pngBuffer.toString('base64');
        
        // 파일도 저장 (기존 기능 유지)
        const screenshotPath = path.join(os.homedir(), 'Desktop', `screenshot-${Date.now()}.png`);
        fs.writeFileSync(screenshotPath, pngBuffer);
        
        return { success: true, path: screenshotPath, base64: base64 };
      }
      return { success: false, error: 'Webview not found' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

