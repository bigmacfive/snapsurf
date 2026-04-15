#pragma once

#include <optional>
#include <string>

#include "browser/TabManager.h"

namespace snapsurf {

class NavigationController {
 public:
  explicit NavigationController(TabManager* tab_manager);

  bool openUrl(const std::string& url, std::optional<TabId> tab_id = std::nullopt);
  bool goBack(TabId tab_id);
  bool goForward(TabId tab_id);
  bool reload(TabId tab_id);

 private:
  static std::string normalizeUrl(const std::string& raw_url);
  TabManager* tab_manager_;
};

}  // namespace snapsurf
