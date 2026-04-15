#include "browser/BookmarkStore.h"

#include <algorithm>
#include <fstream>
#include <sstream>

namespace snapsurf {

BookmarkStore::BookmarkStore(std::filesystem::path storage_path)
    : storage_path_(std::move(storage_path)) {}

std::string BookmarkStore::addBookmark(const std::string& url, const std::string& title) {
  std::lock_guard<std::mutex> lock(mutex_);
  Bookmark bookmark{
      .id = newBookmarkId(),
      .title = title,
      .url = url,
  };
  bookmarks_.push_back(bookmark);
  persist();
  return bookmark.id;
}

bool BookmarkStore::removeBookmark(const std::string& id) {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto before = bookmarks_.size();
  bookmarks_.erase(std::remove_if(bookmarks_.begin(), bookmarks_.end(), [&](const Bookmark& b) {
                     return b.id == id;
                   }),
                   bookmarks_.end());

  if (bookmarks_.size() == before) {
    return false;
  }

  persist();
  return true;
}

std::vector<Bookmark> BookmarkStore::listBookmarks() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return bookmarks_;
}

bool BookmarkStore::load() {
  std::lock_guard<std::mutex> lock(mutex_);
  bookmarks_.clear();

  if (!std::filesystem::exists(storage_path_)) {
    return true;
  }

  std::ifstream in(storage_path_);
  if (!in.is_open()) {
    return false;
  }

  std::string line;
  while (std::getline(in, line)) {
    if (line.empty()) {
      continue;
    }

    auto first = line.find('\t');
    auto second = line.find('\t', first == std::string::npos ? first : first + 1);
    if (first == std::string::npos || second == std::string::npos) {
      continue;
    }

    bookmarks_.push_back(Bookmark{
        .id = unescapeJson(line.substr(0, first)),
        .title = unescapeJson(line.substr(first + 1, second - first - 1)),
        .url = unescapeJson(line.substr(second + 1)),
    });
  }

  return true;
}

bool BookmarkStore::persist() const {
  std::error_code ec;
  std::filesystem::create_directories(storage_path_.parent_path(), ec);

  std::ofstream out(storage_path_, std::ios::trunc);
  if (!out.is_open()) {
    return false;
  }

  for (const auto& b : bookmarks_) {
    out << escapeJson(b.id) << '\t' << escapeJson(b.title) << '\t' << escapeJson(b.url) << '\n';
  }

  return true;
}

std::string BookmarkStore::newBookmarkId() const {
  return "bm_" + std::to_string(bookmarks_.size() + 1);
}

std::string BookmarkStore::escapeJson(const std::string& value) {
  std::string out;
  out.reserve(value.size());
  for (char c : value) {
    if (c == '\\') {
      out += "\\\\";
    } else if (c == '\t') {
      out += "\\t";
    } else if (c == '\n') {
      out += "\\n";
    } else {
      out.push_back(c);
    }
  }
  return out;
}

std::string BookmarkStore::unescapeJson(const std::string& value) {
  std::string out;
  out.reserve(value.size());

  for (size_t i = 0; i < value.size(); ++i) {
    if (value[i] == '\\' && i + 1 < value.size()) {
      ++i;
      if (value[i] == 't') {
        out.push_back('\t');
      } else if (value[i] == 'n') {
        out.push_back('\n');
      } else {
        out.push_back(value[i]);
      }
    } else {
      out.push_back(value[i]);
    }
  }

  return out;
}

}  // namespace snapsurf
