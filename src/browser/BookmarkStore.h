#pragma once

#include <filesystem>
#include <mutex>
#include <string>
#include <vector>

#include "common/Types.h"

namespace snapsurf {

class BookmarkStore {
 public:
  explicit BookmarkStore(std::filesystem::path storage_path);

  std::string addBookmark(const std::string& url, const std::string& title);
  bool removeBookmark(const std::string& id);
  std::vector<Bookmark> listBookmarks() const;

  bool load();
  bool persist() const;

 private:
  std::string newBookmarkId() const;
  static std::string escapeJson(const std::string& value);
  static std::string unescapeJson(const std::string& value);

  std::filesystem::path storage_path_;
  mutable std::mutex mutex_;
  std::vector<Bookmark> bookmarks_;
};

}  // namespace snapsurf
