#pragma once

#include <filesystem>
#include <mutex>
#include <optional>
#include <unordered_map>

#include "include/cef_download_handler.h"
#include "common/Types.h"

namespace snapsurf {

struct DownloadState {
  DownloadId id;
  int cef_download_id;
  std::string url;
  std::string suggested_filename;
  std::filesystem::path target_path;
  bool completed;
  bool canceled;
};

class DownloadService : public CefDownloadHandler {
 public:
  explicit DownloadService(std::filesystem::path download_directory);

  DownloadId startDownload(CefRefPtr<CefBrowser> browser,
                           const std::string& url,
                           const std::optional<std::string>& suggested_filename);
  bool cancelDownload(DownloadId id);

  std::unordered_map<DownloadId, DownloadState> listDownloads() const;

  bool OnBeforeDownload(CefRefPtr<CefBrowser> browser,
                        CefRefPtr<CefDownloadItem> download_item,
                        const CefString& suggested_name,
                        CefRefPtr<CefBeforeDownloadCallback> callback) override;

  void OnDownloadUpdated(CefRefPtr<CefBrowser> browser,
                         CefRefPtr<CefDownloadItem> download_item,
                         CefRefPtr<CefDownloadItemCallback> callback) override;

 private:
  DownloadId next_id_;
  std::filesystem::path download_directory_;
  mutable std::mutex mutex_;
  std::unordered_map<DownloadId, DownloadState> downloads_;
  std::unordered_map<int, DownloadId> cef_to_local_;
  std::unordered_map<DownloadId, CefRefPtr<CefDownloadItemCallback>> callbacks_;

  IMPLEMENT_REFCOUNTING(DownloadService);
};

}  // namespace snapsurf
