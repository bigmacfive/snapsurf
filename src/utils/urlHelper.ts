// URL 처리 유틸리티

export function normalizeURL(url: string): string {
  let targetUrl = url.trim();

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  return targetUrl;
}

export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const u1 = new URL(url1);
    const u2 = new URL(url2);
    return u1.origin === u2.origin;
  } catch (e) {
    return false;
  }
}
