#pragma once

#include <functional>

#include "include/cef_client.h"
#include "browser/DownloadService.h"
#include "browser/TabManager.h"

namespace snapsurf {

class BrowserClient : public CefClient,
                      public CefLifeSpanHandler,
                      public CefDisplayHandler,
                      public CefLoadHandler,
                      public CefRequestHandler {
 public:
  BrowserClient(TabManager* tab_manager, CefRefPtr<DownloadService> download_service);

  CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
  CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
  CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
  CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }
  CefRefPtr<CefDownloadHandler> GetDownloadHandler() override {
    return download_service_;
  }

  void OnAfterCreated(CefRefPtr<CefBrowser> browser) override;
  bool DoClose(CefRefPtr<CefBrowser> browser) override;
  void OnBeforeClose(CefRefPtr<CefBrowser> browser) override;

  void OnTitleChange(CefRefPtr<CefBrowser> browser, const CefString& title) override;
  void OnAddressChange(CefRefPtr<CefBrowser> browser,
                       CefRefPtr<CefFrame> frame,
                       const CefString& url) override;

  bool OnBeforePopup(CefRefPtr<CefBrowser> browser,
                     CefRefPtr<CefFrame> frame,
                     int popup_id,
                     const CefString& target_url,
                     const CefString& target_frame_name,
                     WindowOpenDisposition target_disposition,
                     bool user_gesture,
                     const CefPopupFeatures& popupFeatures,
                     CefWindowInfo& windowInfo,
                     CefRefPtr<CefClient>& client,
                     CefBrowserSettings& settings,
                     CefRefPtr<CefDictionaryValue>& extra_info,
                     bool* no_javascript_access) override;

  std::function<void(TabId)> onTabCreated;
  std::function<void(TabId)> onTabClosed;
  std::function<void(int, const std::string&)> onAddressChanged;
  std::function<void(int, const std::string&)> onTitleChanged;

 private:
  TabManager* tab_manager_;
  CefRefPtr<DownloadService> download_service_;

  IMPLEMENT_REFCOUNTING(BrowserClient);
};

}  // namespace snapsurf
