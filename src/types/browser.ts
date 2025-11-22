// 브라우저 관련 타입 정의

export interface Tab {
  id: string;
  title: string;
  url: string;
}

export interface NavigationState {
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  currentUrl: string;
}

export interface BrowserState {
  tabs: Tab[];
  activeTabId: string;
  url: string;
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}
