# SnapSurf Smoke Checklist

## Functional

- Launch app and load a start URL successfully.
- Open 10+ tabs through popup/navigation flows and switch active tab.
- Trigger a file download and verify completion in `~/Downloads`.
- Cancel an in-flight download and verify canceled state.
- Add/remove bookmarks and verify persistence across relaunch.

## Regression

- Force-close app and relaunch; bookmark data remains.
- Popup/new-window requests stay within tab policy.

## Compatibility

- Login-heavy site
- SPA route-heavy site
- Video playback site
