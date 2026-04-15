#include "browser/DownloadService.h"

#include <chrono>

namespace snapsurf {

DownloadService::DownloadService(std::filesystem::path download_directory)
    : next_id_(1), download_directory_(std::move(download_directory)) {
  std::error_code ec;
  std::filesystem::create_directories(download_directory_, ec);
}

DownloadId DownloadService::startDownload(
    CefRefPtr<CefBrowser> browser,
    const std::string& url,
    const std::optional<std::string>& suggested_filename) {
  if (!browser) {
    return 0;
  }

  DownloadId id = 0;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    id = next_id_++;
    downloads_.emplace(id,
                       DownloadState{.id = id,
                                     .cef_download_id = -1,
                                     .url = url,
                                     .suggested_filename = suggested_filename.value_or(""),
                                     .target_path = {},
                                     .completed = false,
                                     .canceled = false});
  }

  browser->GetHost()->StartDownload(url);
  return id;
}

bool DownloadService::cancelDownload(DownloadId id) {
  std::lock_guard<std::mutex> lock(mutex_);
  auto callback_it = callbacks_.find(id);
  if (callback_it == callbacks_.end()) {
    return false;
  }

  if (callback_it->second) {
    callback_it->second->Cancel();
  }
  downloads_[id].canceled = true;
  return true;
}

std::unordered_map<DownloadId, DownloadState> DownloadService::listDownloads() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return downloads_;
}

bool DownloadService::OnBeforeDownload(CefRefPtr<CefBrowser> browser,
                                       CefRefPtr<CefDownloadItem> download_item,
                                       const CefString& suggested_name,
                                       CefRefPtr<CefBeforeDownloadCallback> callback) {
  (void)browser;

  if (!download_item || !callback) {
    return false;
  }

  DownloadId matched = 0;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& [id, state] : downloads_) {
      if (state.cef_download_id == -1 && state.url == download_item->GetURL().ToString()) {
        matched = id;
        state.cef_download_id = download_item->GetId();
        cef_to_local_[download_item->GetId()] = id;
        break;
      }
    }

    if (matched == 0) {
      matched = next_id_++;
      downloads_.emplace(matched,
                         DownloadState{.id = matched,
                                       .cef_download_id = static_cast<int>(download_item->GetId()),
                                       .url = download_item->GetURL(),
                                       .suggested_filename = suggested_name,
                                       .target_path = {},
                                       .completed = false,
                                       .canceled = false});
      cef_to_local_[download_item->GetId()] = matched;
    }

    auto& state = downloads_[matched];
    std::string filename = state.suggested_filename.empty() ? suggested_name.ToString()
                                                            : state.suggested_filename;
    if (filename.empty()) {
      filename = "download.bin";
    }
    state.target_path = download_directory_ / filename;
    callback->Continue(state.target_path.string(), true);
  }
  return true;
}

void DownloadService::OnDownloadUpdated(CefRefPtr<CefBrowser> browser,
                                        CefRefPtr<CefDownloadItem> download_item,
                                        CefRefPtr<CefDownloadItemCallback> callback) {
  (void)browser;
  if (!download_item) {
    return;
  }

  std::lock_guard<std::mutex> lock(mutex_);
  auto it = cef_to_local_.find(download_item->GetId());
  if (it == cef_to_local_.end()) {
    return;
  }

  const DownloadId id = it->second;
  callbacks_[id] = callback;

  auto state_it = downloads_.find(id);
  if (state_it == downloads_.end()) {
    return;
  }

  state_it->second.completed = download_item->IsComplete();
  state_it->second.canceled = download_item->IsCanceled();

  if (state_it->second.completed || state_it->second.canceled) {
    callbacks_.erase(id);
  }
}

}  // namespace snapsurf
