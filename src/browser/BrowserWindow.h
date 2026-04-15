#pragma once

#include <filesystem>
#include <memory>
#include <optional>
#include <vector>

#include "browser/BookmarkStore.h"
#include "browser/BrowserClient.h"
#include "browser/DownloadService.h"
#include "browser/NavigationController.h"
#include "browser/TabManager.h"

namespace snapsurf {

class BrowserWindow {
 public:
  BrowserWindow(std::filesystem::path state_dir,
                std::filesystem::path downloads_dir);
  ~BrowserWindow();

  void createMainWindow(const std::string& initial_url);

  TabId createTab(const std::string& url = "https://example.com");
  bool closeTab(TabId tab_id);
  bool activateTab(TabId tab_id);

  bool openUrl(const std::string& url);
  bool goBack(TabId tab_id);
  bool goForward(TabId tab_id);
  bool reload(TabId tab_id);

  DownloadId startDownload(const std::string& url,
                           const std::optional<std::string>& suggested_filename);
  bool cancelDownload(DownloadId id);

  std::string addBookmark(const std::string& url, const std::string& title);
  bool removeBookmark(const std::string& id);
  std::vector<Bookmark> listBookmarks() const;

  // UI bridge methods invoked from Cocoa target/action callbacks.
  void uiNavigateToAddress(const std::string& raw_url);
  void uiNewTab();
  void uiCloseActiveTab();
  void uiBack();
  void uiForward();
  void uiReload();
  void uiAddBookmark();
  void uiSelectTabAtIndex(int index);
  void uiWindowResized();
  void uiWindowWillClose();

 private:
  struct Impl;

  void refreshUiFromModel();
  void refreshBrowserVisibility();
  void resizeBrowserViews();
  std::optional<TabId> activeTabId() const;

  std::filesystem::path state_dir_;
  TabManager tab_manager_;
  NavigationController navigation_controller_;
  BookmarkStore bookmark_store_;
  CefRefPtr<DownloadService> download_service_;
  CefRefPtr<BrowserClient> browser_client_;
  std::unique_ptr<Impl> impl_;
};

}  // namespace snapsurf
