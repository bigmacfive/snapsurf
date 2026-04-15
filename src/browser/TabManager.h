#pragma once

#include <functional>
#include <optional>
#include <unordered_map>
#include <vector>

#include "include/cef_browser.h"
#include "common/Types.h"

namespace snapsurf {

struct TabState {
  TabId id;
  CefRefPtr<CefBrowser> browser;
  std::string title;
  std::string current_url;
};

class TabManager {
 public:
  TabManager();

  TabId createTab(CefRefPtr<CefBrowser> browser);
  bool closeTab(TabId tab_id);
  bool activateTab(TabId tab_id);

  std::optional<TabState> getTab(TabId tab_id) const;
  std::optional<TabState> getActiveTab() const;
  std::vector<TabState> allTabs() const;

  void updateTabTitle(int browser_identifier, const std::string& title);
  void updateTabUrl(int browser_identifier, const std::string& url);
  std::optional<TabId> findByBrowserIdentifier(int browser_identifier) const;

  std::function<void(TabId)> onActiveTabChanged;

 private:
  TabId next_tab_id_;
  std::optional<TabId> active_tab_id_;
  std::unordered_map<TabId, TabState> tabs_;
  std::unordered_map<int, TabId> browser_to_tab_;
};

}  // namespace snapsurf
