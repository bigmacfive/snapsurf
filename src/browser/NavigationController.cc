#include "browser/NavigationController.h"

#include <algorithm>
#include <cctype>
#include <string_view>

namespace snapsurf {

NavigationController::NavigationController(TabManager* tab_manager)
    : tab_manager_(tab_manager) {}

bool NavigationController::openUrl(const std::string& url, std::optional<TabId> tab_id) {
  if (!tab_manager_) {
    return false;
  }

  std::optional<TabState> tab;
  if (tab_id) {
    tab = tab_manager_->getTab(*tab_id);
  } else {
    tab = tab_manager_->getActiveTab();
  }

  if (!tab || !tab->browser) {
    return false;
  }

  tab->browser->GetMainFrame()->LoadURL(normalizeUrl(url));
  return true;
}

bool NavigationController::goBack(TabId tab_id) {
  auto tab = tab_manager_->getTab(tab_id);
  if (!tab || !tab->browser || !tab->browser->CanGoBack()) {
    return false;
  }

  tab->browser->GoBack();
  return true;
}

bool NavigationController::goForward(TabId tab_id) {
  auto tab = tab_manager_->getTab(tab_id);
  if (!tab || !tab->browser || !tab->browser->CanGoForward()) {
    return false;
  }

  tab->browser->GoForward();
  return true;
}

bool NavigationController::reload(TabId tab_id) {
  auto tab = tab_manager_->getTab(tab_id);
  if (!tab || !tab->browser) {
    return false;
  }

  tab->browser->Reload();
  return true;
}

std::string NavigationController::normalizeUrl(const std::string& raw_url) {
  std::string url = raw_url;
  url.erase(url.begin(), std::find_if(url.begin(), url.end(), [](unsigned char c) {
    return !std::isspace(c);
  }));
  url.erase(std::find_if(url.rbegin(), url.rend(), [](unsigned char c) {
              return !std::isspace(c);
            }).base(),
            url.end());

  if (url.empty()) {
    return "https://example.com";
  }

  const bool has_scheme = (url.rfind("http://", 0) == 0 || url.rfind("https://", 0) == 0);
  const bool has_space = (url.find(' ') != std::string::npos);
  const bool looks_like_host = (url.find('.') != std::string::npos && url.find(' ') == std::string::npos);

  if (!has_scheme && (has_space || !looks_like_host)) {
    std::string encoded;
    encoded.reserve(url.size() + 16);
    for (unsigned char c : url) {
      if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
        encoded.push_back(static_cast<char>(c));
      } else if (c == ' ') {
        encoded.push_back('+');
      } else {
        static const char* kHex = "0123456789ABCDEF";
        encoded.push_back('%');
        encoded.push_back(kHex[(c >> 4) & 0xF]);
        encoded.push_back(kHex[c & 0xF]);
      }
    }
    return "https://www.google.com/search?q=" + encoded;
  }

  if (url.rfind("http://", 0) != 0 && url.rfind("https://", 0) != 0) {
    url = "https://" + url;
  }

  return url;
}

}  // namespace snapsurf
