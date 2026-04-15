#include "browser/BrowserClient.h"

namespace snapsurf {

BrowserClient::BrowserClient(TabManager* tab_manager,
                             CefRefPtr<DownloadService> download_service)
    : tab_manager_(tab_manager), download_service_(download_service) {}

void BrowserClient::OnAfterCreated(CefRefPtr<CefBrowser> browser) {
  if (!tab_manager_ || !browser) {
    return;
  }

  if (tab_manager_->findByBrowserIdentifier(browser->GetIdentifier())) {
    return;
  }

  const auto tab_id = tab_manager_->createTab(browser);
  tab_manager_->activateTab(tab_id);
  if (onTabCreated) {
    onTabCreated(tab_id);
  }
}

bool BrowserClient::DoClose(CefRefPtr<CefBrowser> browser) {
  (void)browser;
  return false;
}

void BrowserClient::OnBeforeClose(CefRefPtr<CefBrowser> browser) {
  if (!browser || !tab_manager_) {
    return;
  }

  auto tab = tab_manager_->findByBrowserIdentifier(browser->GetIdentifier());
  if (!tab) {
    return;
  }

  const TabId tab_id = *tab;
  tab_manager_->closeTab(tab_id);
  if (onTabClosed) {
    onTabClosed(tab_id);
  }
}

void BrowserClient::OnTitleChange(CefRefPtr<CefBrowser> browser, const CefString& title) {
  if (!browser || !tab_manager_) {
    return;
  }

  const auto raw_title = title.ToString();
  tab_manager_->updateTabTitle(browser->GetIdentifier(), raw_title);
  if (onTitleChanged) {
    onTitleChanged(browser->GetIdentifier(), raw_title);
  }
}

void BrowserClient::OnAddressChange(CefRefPtr<CefBrowser> browser,
                                    CefRefPtr<CefFrame> frame,
                                    const CefString& url) {
  if (!browser || !frame || !frame->IsMain()) {
    return;
  }

  const auto raw = url.ToString();
  tab_manager_->updateTabUrl(browser->GetIdentifier(), raw);
  if (onAddressChanged) {
    onAddressChanged(browser->GetIdentifier(), raw);
  }
}

bool BrowserClient::OnBeforePopup(CefRefPtr<CefBrowser> browser,
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
                                  bool* no_javascript_access) {
  (void)browser;
  (void)frame;
  (void)popup_id;
  (void)target_frame_name;
  (void)target_disposition;
  (void)user_gesture;
  (void)popupFeatures;
  (void)windowInfo;
  (void)settings;
  (void)extra_info;
  (void)no_javascript_access;

  // Enforce popup => same active tab (baseline policy).
  if (tab_manager_) {
    auto active = tab_manager_->getActiveTab();
    if (active && active->browser) {
      active->browser->GetMainFrame()->LoadURL(target_url);
    }
  }

  client = this;
  return true;
}

}  // namespace snapsurf
