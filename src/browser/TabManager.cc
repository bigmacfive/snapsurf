#include "browser/TabManager.h"

#include <algorithm>

namespace snapsurf {

TabManager::TabManager() : next_tab_id_(1) {}

TabId TabManager::createTab(CefRefPtr<CefBrowser> browser) {
  const TabId id = next_tab_id_++;
  TabState state{
      .id = id,
      .browser = browser,
      .title = "New Tab",
      .current_url = browser ? browser->GetMainFrame()->GetURL().ToString() : "",
  };

  if (browser) {
    browser_to_tab_[browser->GetIdentifier()] = id;
  }

  tabs_[id] = state;
  active_tab_id_ = id;
  if (onActiveTabChanged) {
    onActiveTabChanged(id);
  }

  return id;
}

bool TabManager::closeTab(TabId tab_id) {
  auto it = tabs_.find(tab_id);
  if (it == tabs_.end()) {
    return false;
  }

  if (it->second.browser) {
    browser_to_tab_.erase(it->second.browser->GetIdentifier());
  }

  tabs_.erase(it);

  if (active_tab_id_ && *active_tab_id_ == tab_id) {
    if (tabs_.empty()) {
      active_tab_id_ = std::nullopt;
    } else {
      active_tab_id_ = tabs_.begin()->first;
      if (onActiveTabChanged) {
        onActiveTabChanged(*active_tab_id_);
      }
    }
  }

  return true;
}

bool TabManager::activateTab(TabId tab_id) {
  if (tabs_.find(tab_id) == tabs_.end()) {
    return false;
  }

  active_tab_id_ = tab_id;
  if (onActiveTabChanged) {
    onActiveTabChanged(tab_id);
  }
  return true;
}

std::optional<TabState> TabManager::getTab(TabId tab_id) const {
  auto it = tabs_.find(tab_id);
  if (it == tabs_.end()) {
    return std::nullopt;
  }
  return it->second;
}

std::optional<TabState> TabManager::getActiveTab() const {
  if (!active_tab_id_) {
    return std::nullopt;
  }
  return getTab(*active_tab_id_);
}

std::vector<TabState> TabManager::allTabs() const {
  std::vector<TabState> result;
  result.reserve(tabs_.size());
  for (const auto& [id, tab] : tabs_) {
    (void)id;
    result.push_back(tab);
  }

  std::sort(result.begin(), result.end(), [](const TabState& a, const TabState& b) {
    return a.id < b.id;
  });

  return result;
}

void TabManager::updateTabTitle(int browser_identifier, const std::string& title) {
  auto it = browser_to_tab_.find(browser_identifier);
  if (it == browser_to_tab_.end()) {
    return;
  }

  auto tab_it = tabs_.find(it->second);
  if (tab_it != tabs_.end()) {
    tab_it->second.title = title;
  }
}

void TabManager::updateTabUrl(int browser_identifier, const std::string& url) {
  auto it = browser_to_tab_.find(browser_identifier);
  if (it == browser_to_tab_.end()) {
    return;
  }

  auto tab_it = tabs_.find(it->second);
  if (tab_it != tabs_.end()) {
    tab_it->second.current_url = url;
  }
}

std::optional<TabId> TabManager::findByBrowserIdentifier(int browser_identifier) const {
  auto it = browser_to_tab_.find(browser_identifier);
  if (it == browser_to_tab_.end()) {
    return std::nullopt;
  }
  return it->second;
}

}  // namespace snapsurf
