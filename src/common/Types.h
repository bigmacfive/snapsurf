#pragma once

#include <cstdint>
#include <string>

namespace snapsurf {

using TabId = std::uint64_t;
using DownloadId = std::uint64_t;

struct Bookmark {
  std::string id;
  std::string title;
  std::string url;
};

}  // namespace snapsurf
