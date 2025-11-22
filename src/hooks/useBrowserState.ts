// 브라우저 상태 관리 Hook

import { useState } from 'react';
import { normalizeURL } from '../utils/urlHelper';

export function useBrowserState(initialUrl: string = 'https://www.google.com') {
  const [url, setUrl] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = (targetUrl: string) => {
    const normalized = normalizeURL(targetUrl);
    setCurrentUrl(normalized);
    setUrl(normalized);
    setIsLoading(true);
    return normalized;
  };

  const updateNavigationState = (back: boolean, forward: boolean) => {
    setCanGoBack(back);
    setCanGoForward(forward);
  };

  return {
    url,
    currentUrl,
    canGoBack,
    canGoForward,
    isLoading,
    setUrl,
    setCurrentUrl,
    setCanGoBack,
    setCanGoForward,
    setIsLoading,
    navigate,
    updateNavigationState
  };
}
