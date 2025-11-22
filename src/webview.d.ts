declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.WebViewHTMLAttributes<HTMLWebViewElement> & {
        src?: string;
        allowpopups?: string;
        webpreferences?: string;
      },
      HTMLWebViewElement
    >;
  }
}

interface HTMLWebViewElement extends HTMLElement {
  src: string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  executeJavaScript(code: string): Promise<any>;
  getURL(): string;
  getWebContentsId?(): number;
  addEventListener(
    type: 'did-navigate' | 'did-navigate-in-page' | 'did-start-loading' | 'did-stop-loading' | 'did-fail-load',
    listener: (event?: any) => void
  ): void;
  removeEventListener(
    type: 'did-navigate' | 'did-navigate-in-page' | 'did-start-loading' | 'did-stop-loading' | 'did-fail-load',
    listener: (event?: any) => void
  ): void;
}

