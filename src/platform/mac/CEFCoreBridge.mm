#include "platform/mac/CEFBridge.h"

#import <AppKit/AppKit.h>

#include <filesystem>
#include <memory>
#include <mutex>
#include <optional>
#include <string>

#include "include/cef_app.h"
#include "include/cef_browser.h"
#include "include/cef_command_line.h"

#include "browser/BookmarkStore.h"
#include "browser/BrowserClient.h"
#include "browser/DownloadService.h"
#include "browser/NavigationController.h"
#include "browser/TabManager.h"

namespace snapsurf {

namespace {

class SnapSurfCefApp : public CefApp, public CefBrowserProcessHandler {
 public:
  CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override {
    return this;
  }

  void OnBeforeCommandLineProcessing(const CefString& process_type,
                                     CefRefPtr<CefCommandLine> command_line) override {
    (void)process_type;
    command_line->AppendSwitchWithValue("disable-features", "InterestFeedContentSuggestions");
    command_line->AppendSwitch("disable-background-timer-throttling");
  }

 private:
  IMPLEMENT_REFCOUNTING(SnapSurfCefApp);
};

class CEFCore {
 public:
  CEFCore()
      : navigation_controller_(&tab_manager_),
        bookmark_store_(std::make_unique<BookmarkStore>(
            std::filesystem::temp_directory_path() / "snapsurf" / "bookmarks.tsv")),
        download_service_(new DownloadService(std::filesystem::temp_directory_path())),
        browser_client_(new BrowserClient(&tab_manager_, download_service_)) {
    browser_client_->onTabCreated = [this](TabId tab_id) {
      tab_manager_.activateTab(tab_id);
      refreshVisibility();
      resizeAll();
    };

    browser_client_->onTabClosed = [this](TabId) {
      refreshVisibility();
    };
  }

  bool initialize(const std::filesystem::path& state_dir, const std::filesystem::path& downloads_dir) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (initialized_) {
      return true;
    }

    state_dir_ = state_dir;
    downloads_dir_ = downloads_dir;
    std::error_code ec;
    std::filesystem::create_directories(state_dir_, ec);
    std::filesystem::create_directories(downloads_dir_, ec);

    bookmark_store_ = std::make_unique<BookmarkStore>(state_dir_ / "bookmarks.tsv");
    bookmark_store_->load();
    download_service_ = new DownloadService(downloads_dir_);
    browser_client_ = new BrowserClient(&tab_manager_, download_service_);
    browser_client_->onTabCreated = [this](TabId tab_id) {
      tab_manager_.activateTab(tab_id);
      refreshVisibility();
      resizeAll();
    };
    browser_client_->onTabClosed = [this](TabId) {
      refreshVisibility();
    };

    app_ = new SnapSurfCefApp();

    const char* argv0 = "SnapSurf";
    char* argv[] = {const_cast<char*>(argv0), nullptr};
    CefMainArgs main_args(1, argv);

    const int exit_code = CefExecuteProcess(main_args, app_, nullptr);
    if (exit_code >= 0) {
      return false;
    }

    CefSettings settings;
    settings.no_sandbox = true;
    settings.external_message_pump = false;

    const auto exe = [[[NSBundle mainBundle] executablePath] UTF8String];
    if (exe) {
      CefString(&settings.browser_subprocess_path) = std::string(exe);
    }
    CefString(&settings.cache_path) = (state_dir_ / "cef_cache").string();
    CefString(&settings.log_file) = (state_dir_ / "cef.log").string();

    if (!CefInitialize(main_args, settings, app_, nullptr)) {
      return false;
    }

    initialized_ = true;
    return true;
  }

  void shutdown() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!initialized_) {
      return;
    }
    initialized_ = false;
    CefShutdown();
  }

  void doMessageLoopWork() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!initialized_) {
      return;
    }
    CefDoMessageLoopWork();
  }

  void createBrowserInView(void* view_ptr, const std::string& initial_url) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!initialized_ || !view_ptr) {
      return;
    }

    host_view_ = (__bridge NSView*)view_ptr;
    if (!host_view_) {
      return;
    }

    CefWindowInfo window_info;
    NSRect r = [host_view_ bounds];
    if (r.size.width < 2 || r.size.height < 2) {
      return;
    }
    window_info.SetAsChild((__bridge CefWindowHandle)host_view_, CefRect(0, 0, (int)r.size.width, (int)r.size.height));

    CefBrowserSettings browser_settings;
    CefRefPtr<CefBrowser> browser = CefBrowserHost::CreateBrowserSync(
        window_info,
        browser_client_,
        initial_url.empty() ? "https://example.com" : initial_url,
        browser_settings,
        nullptr,
        nullptr);

    if (browser && !tab_manager_.findByBrowserIdentifier(browser->GetIdentifier())) {
      const TabId tab_id = tab_manager_.createTab(browser);
      tab_manager_.activateTab(tab_id);
      refreshVisibility();
      resizeAll();
    }
  }

  void openUrl(const std::string& url) {
    navigation_controller_.openUrl(url);
  }

  void notifyHostResized(void* view_ptr) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!initialized_ || !view_ptr) {
      return;
    }
    host_view_ = (__bridge NSView*)view_ptr;
    resizeAll();
    refreshVisibility();
  }

  void goBack() {
    auto active = tab_manager_.getActiveTab();
    if (active) {
      navigation_controller_.goBack(active->id);
    }
  }

  void goForward() {
    auto active = tab_manager_.getActiveTab();
    if (active) {
      navigation_controller_.goForward(active->id);
    }
  }

  void reload() {
    auto active = tab_manager_.getActiveTab();
    if (active) {
      navigation_controller_.reload(active->id);
    }
  }

  void newTab(const std::string& url) {
    if (!host_view_) {
      return;
    }
    createBrowserInView((__bridge void*)host_view_, url.empty() ? "https://example.com" : url);
  }

  void closeActiveTab() {
    auto active = tab_manager_.getActiveTab();
    if (active && active->browser) {
      active->browser->GetHost()->CloseBrowser(false);
    }
  }

  void addBookmark() {
    auto active = tab_manager_.getActiveTab();
    if (!active) {
      return;
    }
    const std::string title = active->title.empty() ? "New Tab" : active->title;
    bookmark_store_->addBookmark(active->current_url, title);
  }

 private:
  void refreshVisibility() {
    auto active = tab_manager_.getActiveTab();
    const TabId active_id = active ? active->id : 0;

    for (const auto& tab : tab_manager_.allTabs()) {
      if (!tab.browser) {
        continue;
      }
      NSView* view = (__bridge NSView*)tab.browser->GetHost()->GetWindowHandle();
      if (!view) {
        continue;
      }
      [view setHidden:(tab.id != active_id)];
      if (tab.id == active_id && host_view_) {
        [view setFrame:[host_view_ bounds]];
        tab.browser->GetHost()->SetFocus(true);
      }
    }
  }

  void resizeAll() {
    if (!host_view_) {
      return;
    }

    NSRect r = [host_view_ bounds];
    for (const auto& tab : tab_manager_.allTabs()) {
      if (!tab.browser) {
        continue;
      }
      NSView* view = (__bridge NSView*)tab.browser->GetHost()->GetWindowHandle();
      if (!view) {
        continue;
      }
      [view setFrame:r];
      tab.browser->GetHost()->WasResized();
    }
  }

  std::mutex mutex_;
  bool initialized_ = false;
  std::filesystem::path state_dir_;
  std::filesystem::path downloads_dir_;

  NSView* host_view_ = nil;

  TabManager tab_manager_;
  NavigationController navigation_controller_;
  std::unique_ptr<BookmarkStore> bookmark_store_;
  CefRefPtr<DownloadService> download_service_;
  CefRefPtr<BrowserClient> browser_client_;
  CefRefPtr<SnapSurfCefApp> app_;
};

CEFCore& Core() {
  static CEFCore core;
  return core;
}

std::string CStr(const char* s, const std::string& fallback = "") {
  if (!s) {
    return fallback;
  }
  return std::string(s);
}

}  // namespace

}  // namespace snapsurf

extern "C" {

int SSCEFInitialize(const char* state_dir, const char* downloads_dir) {
  return snapsurf::Core().initialize(snapsurf::CStr(state_dir, std::filesystem::temp_directory_path().string()),
                                     snapsurf::CStr(downloads_dir, std::filesystem::temp_directory_path().string()))
             ? 1
             : 0;
}

void SSCEFShutdown(void) {
  snapsurf::Core().shutdown();
}

void SSCEFDoMessageLoopWork(void) {
  snapsurf::Core().doMessageLoopWork();
}

void SSCEFCreateBrowserInView(void* ns_view, const char* initial_url) {
  snapsurf::Core().createBrowserInView(ns_view, snapsurf::CStr(initial_url, "https://example.com"));
}

void SSCEFNotifyHostViewResized(void* ns_view) {
  snapsurf::Core().notifyHostResized(ns_view);
}

void SSCEFOpenURL(const char* url) {
  snapsurf::Core().openUrl(snapsurf::CStr(url));
}

void SSCEFGoBack(void) {
  snapsurf::Core().goBack();
}

void SSCEFGoForward(void) {
  snapsurf::Core().goForward();
}

void SSCEFReload(void) {
  snapsurf::Core().reload();
}

void SSCEFNewTab(const char* url) {
  snapsurf::Core().newTab(snapsurf::CStr(url, "https://example.com"));
}

void SSCEFCloseActiveTab(void) {
  snapsurf::Core().closeActiveTab();
}

void SSCEFAddBookmark(void) {
  snapsurf::Core().addBookmark();
}

}  // extern "C"
