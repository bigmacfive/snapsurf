# SnapSurf (CEF Desktop Browser Bootstrap)

SnapSurf is a macOS-first CEF browser starter focused on maximum Chromium compatibility.

## What is implemented now

- CEF browser process + renderer process wiring (`BrowserApp`)
- Desktop app bundle build via CMake (`SnapSurf.app`)
- Browser shell orchestration (`BrowserWindow`)
- Core modules
  - `TabManager`
  - `NavigationController`
  - `DownloadService`
  - `BookmarkStore` (persistent local storage)
- Public contracts implemented in code
  - `openUrl(url)`, `goBack(tabId)`, `goForward(tabId)`, `reload(tabId)`
  - `createTab(url?)`, `closeTab(tabId)`, `activateTab(tabId)`
  - `startDownload(url, suggestedFilename?)`, `cancelDownload(downloadId)`
  - `addBookmark(url, title)`, `removeBookmark(id)`, `listBookmarks()`

## Prerequisites

1. macOS 12+
2. CMake 3.24+
3. Xcode command line tools
4. CEF binary distribution extracted locally

## Configure and build

```bash
cmake -S . -B build -G Xcode -DSNAPSURF_CEF_ROOT=/absolute/path/to/cef_binary_XXX_macosx64
cmake --build build --config Release
```

The app bundle is produced under:

```bash
build/Release/SnapSurf.app
```

## Run

```bash
open build/Release/SnapSurf.app
```

Optional start URL:

```bash
build/Release/SnapSurf.app/Contents/MacOS/SnapSurf --start-url=https://www.chromium.org
```

## State paths

- Browser state and logs: `~/Library/Application Support/SnapSurf`
- Downloads target dir: `~/Downloads`
- Bookmarks file: `~/Library/Application Support/SnapSurf/bookmarks.tsv`

## Notes

- Sandbox is enabled when `cef_sandbox` is available; otherwise no-sandbox is used.
- User-Agent stays Chromium default for compatibility.
- Popup requests are handled with a tab-policy baseline in `BrowserClient`.
- UI shell is intentionally minimal in this bootstrap; service APIs are ready for attaching tab/address toolbar UI next.
