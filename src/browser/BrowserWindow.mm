#include "browser/BrowserWindow.h"

#import <Cocoa/Cocoa.h>

#include <filesystem>

#include "include/cef_app.h"
#include "include/cef_browser.h"

namespace {
constexpr CGFloat kTopBarHeight = 46.0;
constexpr CGFloat kButtonHeight = 28.0;
constexpr CGFloat kButtonY = 9.0;

std::string sanitizeTitle(const std::string& raw) {
  if (raw.empty()) {
    return "New Tab";
  }
  return raw;
}

}  // namespace

@interface SnapSurfUiController : NSObject
@property(nonatomic, assign) snapsurf::BrowserWindow* owner;
- (void)go:(id)sender;
- (void)newTab:(id)sender;
- (void)closeTab:(id)sender;
- (void)back:(id)sender;
- (void)forward:(id)sender;
- (void)reload:(id)sender;
- (void)addBookmark:(id)sender;
- (void)tabChanged:(id)sender;
@end

@interface SnapSurfWindowDelegate : NSObject <NSWindowDelegate>
@property(nonatomic, assign) snapsurf::BrowserWindow* owner;
@end

@implementation SnapSurfUiController
- (void)go:(id)sender {
  (void)sender;
  if (self.owner) self.owner->uiNavigateToAddress("");
}
- (void)newTab:(id)sender {
  (void)sender;
  if (self.owner) self.owner->uiNewTab();
}
- (void)closeTab:(id)sender {
  (void)sender;
  if (self.owner) self.owner->uiCloseActiveTab();
}
- (void)back:(id)sender {
  (void)sender;
  if (self.owner) self.owner->uiBack();
}
- (void)forward:(id)sender {
  (void)sender;
  if (self.owner) self.owner->uiForward();
}
- (void)reload:(id)sender {
  (void)sender;
  if (self.owner) self.owner->uiReload();
}
- (void)addBookmark:(id)sender {
  (void)sender;
  if (self.owner) self.owner->uiAddBookmark();
}
- (void)tabChanged:(id)sender {
  if (!self.owner) return;
  NSPopUpButton* picker = (NSPopUpButton*)sender;
  self.owner->uiSelectTabAtIndex((int)[picker indexOfSelectedItem]);
}
@end

@implementation SnapSurfWindowDelegate
- (void)windowDidResize:(NSNotification*)notification {
  (void)notification;
  if (self.owner) self.owner->uiWindowResized();
}
- (void)windowWillClose:(NSNotification*)notification {
  (void)notification;
  if (self.owner) self.owner->uiWindowWillClose();
}
@end

namespace snapsurf {

struct BrowserWindow::Impl {
  NSWindow* window = nil;
  NSView* web_container = nil;
  NSTextField* address_field = nil;
  NSPopUpButton* tab_picker = nil;
  SnapSurfUiController* ui_controller = nil;
  SnapSurfWindowDelegate* window_delegate = nil;
  bool suppress_tab_signal = false;
  std::vector<TabId> tab_order;
};

BrowserWindow::BrowserWindow(std::filesystem::path state_dir,
                             std::filesystem::path downloads_dir)
    : state_dir_(std::move(state_dir)),
      navigation_controller_(&tab_manager_),
      bookmark_store_(state_dir_ / "bookmarks.tsv"),
      download_service_(new DownloadService(std::move(downloads_dir))),
      browser_client_(new BrowserClient(&tab_manager_, download_service_)),
      impl_(std::make_unique<Impl>()) {
  std::error_code ec;
  std::filesystem::create_directories(state_dir_, ec);
  bookmark_store_.load();

  browser_client_->onTabCreated = [this](TabId) {
    refreshUiFromModel();
    refreshBrowserVisibility();
    resizeBrowserViews();
  };
  browser_client_->onTabClosed = [this](TabId) {
    refreshUiFromModel();
    refreshBrowserVisibility();
    if (tab_manager_.allTabs().empty()) {
      CefQuitMessageLoop();
    }
  };
  browser_client_->onAddressChanged = [this](int browser_id, const std::string& url) {
    auto active = tab_manager_.getActiveTab();
    if (active && active->browser && active->browser->GetIdentifier() == browser_id &&
        impl_->address_field) {
      NSString* value = [NSString stringWithUTF8String:url.c_str()];
      [impl_->address_field setStringValue:value ?: @""];
    }
    refreshUiFromModel();
  };
  browser_client_->onTitleChanged = [this](int, const std::string&) {
    refreshUiFromModel();
  };
}

BrowserWindow::~BrowserWindow() = default;

void BrowserWindow::createMainWindow(const std::string& initial_url) {
  [NSApplication sharedApplication];
  [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];

  NSRect frame = NSMakeRect(120, 120, 1280, 840);
  NSWindowStyleMask style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                            NSWindowStyleMaskResizable | NSWindowStyleMaskMiniaturizable;

  impl_->window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
  [impl_->window setTitle:@"SnapSurf"];

  impl_->window_delegate = [[SnapSurfWindowDelegate alloc] init];
  impl_->window_delegate.owner = this;
  [impl_->window setDelegate:impl_->window_delegate];

  NSView* content = [impl_->window contentView];
  NSRect bounds = [content bounds];

  NSView* topbar = [[NSView alloc] initWithFrame:NSMakeRect(0, bounds.size.height - kTopBarHeight,
                                                            bounds.size.width, kTopBarHeight)];
  [topbar setAutoresizingMask:NSViewWidthSizable | NSViewMinYMargin];

  impl_->tab_picker = [[NSPopUpButton alloc] initWithFrame:NSMakeRect(10, kButtonY, 210, kButtonHeight)
                                                 pullsDown:NO];

  NSButton* back = [[NSButton alloc] initWithFrame:NSMakeRect(230, kButtonY, 42, kButtonHeight)];
  [back setTitle:@"<"];

  NSButton* fwd = [[NSButton alloc] initWithFrame:NSMakeRect(276, kButtonY, 42, kButtonHeight)];
  [fwd setTitle:@">"];

  NSButton* reload = [[NSButton alloc] initWithFrame:NSMakeRect(322, kButtonY, 62, kButtonHeight)];
  [reload setTitle:@"Reload"];

  NSButton* new_tab = [[NSButton alloc] initWithFrame:NSMakeRect(388, kButtonY, 52, kButtonHeight)];
  [new_tab setTitle:@"+"];

  NSButton* close_tab = [[NSButton alloc] initWithFrame:NSMakeRect(444, kButtonY, 52, kButtonHeight)];
  [close_tab setTitle:@"-"];

  impl_->address_field =
      [[NSTextField alloc] initWithFrame:NSMakeRect(500, kButtonY, bounds.size.width - 640, kButtonHeight)];
  [impl_->address_field setPlaceholderString:@"Search or enter address"];
  [impl_->address_field setAutoresizingMask:NSViewWidthSizable];

  NSButton* bookmark =
      [[NSButton alloc] initWithFrame:NSMakeRect(bounds.size.width - 130, kButtonY, 120, kButtonHeight)];
  [bookmark setTitle:@"Bookmark"];
  [bookmark setAutoresizingMask:NSViewMinXMargin];

  impl_->ui_controller = [[SnapSurfUiController alloc] init];
  impl_->ui_controller.owner = this;

  [impl_->tab_picker setTarget:impl_->ui_controller];
  [impl_->tab_picker setAction:@selector(tabChanged:)];

  [back setTarget:impl_->ui_controller];
  [back setAction:@selector(back:)];
  [fwd setTarget:impl_->ui_controller];
  [fwd setAction:@selector(forward:)];
  [reload setTarget:impl_->ui_controller];
  [reload setAction:@selector(reload:)];
  [new_tab setTarget:impl_->ui_controller];
  [new_tab setAction:@selector(newTab:)];
  [close_tab setTarget:impl_->ui_controller];
  [close_tab setAction:@selector(closeTab:)];
  [bookmark setTarget:impl_->ui_controller];
  [bookmark setAction:@selector(addBookmark:)];
  [impl_->address_field setTarget:impl_->ui_controller];
  [impl_->address_field setAction:@selector(go:)];

  [topbar addSubview:impl_->tab_picker];
  [topbar addSubview:back];
  [topbar addSubview:fwd];
  [topbar addSubview:reload];
  [topbar addSubview:new_tab];
  [topbar addSubview:close_tab];
  [topbar addSubview:impl_->address_field];
  [topbar addSubview:bookmark];

  impl_->web_container = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, bounds.size.width,
                                                                  bounds.size.height - kTopBarHeight)];
  [impl_->web_container setAutoresizingMask:NSViewWidthSizable | NSViewHeightSizable];

  [content addSubview:impl_->web_container];
  [content addSubview:topbar];

  [impl_->window makeKeyAndOrderFront:nil];
  [NSApp activateIgnoringOtherApps:YES];

  createTab(initial_url);
}

TabId BrowserWindow::createTab(const std::string& url) {
  if (!impl_->web_container) {
    return 0;
  }

  NSRect r = [impl_->web_container bounds];
  CefWindowInfo window_info;
  window_info.SetAsChild((CefWindowHandle)impl_->web_container,
                         CefRect(0, 0, (int)r.size.width, (int)r.size.height));

  CefBrowserSettings browser_settings;
  CefBrowserHost::CreateBrowser(window_info,
                                browser_client_,
                                url.empty() ? "https://example.com" : url,
                                browser_settings,
                                nullptr,
                                nullptr);
  return 0;
}

bool BrowserWindow::closeTab(TabId tab_id) {
  auto tab = tab_manager_.getTab(tab_id);
  if (!tab || !tab->browser) {
    return false;
  }

  tab->browser->GetHost()->CloseBrowser(false);
  return true;
}

bool BrowserWindow::activateTab(TabId tab_id) {
  const bool ok = tab_manager_.activateTab(tab_id);
  if (!ok) {
    return false;
  }

  refreshUiFromModel();
  refreshBrowserVisibility();
  return true;
}

bool BrowserWindow::openUrl(const std::string& url) {
  const bool ok = navigation_controller_.openUrl(url);
  if (ok && impl_->address_field) {
    NSString* v = [NSString stringWithUTF8String:url.c_str()];
    [impl_->address_field setStringValue:v ?: @""];
  }
  return ok;
}

bool BrowserWindow::goBack(TabId tab_id) {
  return navigation_controller_.goBack(tab_id);
}

bool BrowserWindow::goForward(TabId tab_id) {
  return navigation_controller_.goForward(tab_id);
}

bool BrowserWindow::reload(TabId tab_id) {
  return navigation_controller_.reload(tab_id);
}

DownloadId BrowserWindow::startDownload(
    const std::string& url,
    const std::optional<std::string>& suggested_filename) {
  auto active = tab_manager_.getActiveTab();
  if (!active || !active->browser) {
    return 0;
  }

  return download_service_->startDownload(active->browser, url, suggested_filename);
}

bool BrowserWindow::cancelDownload(DownloadId id) {
  return download_service_->cancelDownload(id);
}

std::string BrowserWindow::addBookmark(const std::string& url, const std::string& title) {
  return bookmark_store_.addBookmark(url, title);
}

bool BrowserWindow::removeBookmark(const std::string& id) {
  return bookmark_store_.removeBookmark(id);
}

std::vector<Bookmark> BrowserWindow::listBookmarks() const {
  return bookmark_store_.listBookmarks();
}

void BrowserWindow::uiNavigateToAddress(const std::string& raw_url) {
  std::string url = raw_url;
  if (url.empty() && impl_->address_field) {
    NSString* text = [impl_->address_field stringValue];
    url = text ? std::string([text UTF8String]) : "";
  }
  if (!url.empty()) {
    openUrl(url);
  }
}

void BrowserWindow::uiNewTab() {
  createTab("https://example.com");
}

void BrowserWindow::uiCloseActiveTab() {
  auto active = activeTabId();
  if (active) {
    closeTab(*active);
  }
}

void BrowserWindow::uiBack() {
  auto active = activeTabId();
  if (active) {
    goBack(*active);
  }
}

void BrowserWindow::uiForward() {
  auto active = activeTabId();
  if (active) {
    goForward(*active);
  }
}

void BrowserWindow::uiReload() {
  auto active = activeTabId();
  if (active) {
    reload(*active);
  }
}

void BrowserWindow::uiAddBookmark() {
  auto active = tab_manager_.getActiveTab();
  if (!active) {
    return;
  }
  addBookmark(active->current_url, sanitizeTitle(active->title));
}

void BrowserWindow::uiSelectTabAtIndex(int index) {
  if (!impl_ || impl_->suppress_tab_signal) {
    return;
  }
  if (index < 0 || index >= (int)impl_->tab_order.size()) {
    return;
  }
  activateTab(impl_->tab_order[(size_t)index]);
}

void BrowserWindow::uiWindowResized() {
  resizeBrowserViews();
}

void BrowserWindow::uiWindowWillClose() {
  CefQuitMessageLoop();
}

void BrowserWindow::refreshUiFromModel() {
  if (!impl_ || !impl_->tab_picker) {
    return;
  }

  auto tabs = tab_manager_.allTabs();
  auto active = tab_manager_.getActiveTab();
  std::optional<TabId> active_id = active ? std::optional<TabId>(active->id) : std::nullopt;

  impl_->suppress_tab_signal = true;
  [impl_->tab_picker removeAllItems];
  impl_->tab_order.clear();

  int active_index = -1;
  for (size_t i = 0; i < tabs.size(); ++i) {
    const auto& tab = tabs[i];
    std::string title = sanitizeTitle(tab.title);
    NSString* item = [NSString stringWithUTF8String:title.c_str()];
    [impl_->tab_picker addItemWithTitle:item ?: @"New Tab"];
    impl_->tab_order.push_back(tab.id);
    if (active_id && *active_id == tab.id) {
      active_index = (int)i;
    }
  }

  if (active_index >= 0) {
    [impl_->tab_picker selectItemAtIndex:active_index];
  }

  if (active && impl_->address_field) {
    NSString* value = [NSString stringWithUTF8String:active->current_url.c_str()];
    [impl_->address_field setStringValue:value ?: @""];

    std::string title = sanitizeTitle(active->title);
    NSString* ns_title = [NSString stringWithUTF8String:title.c_str()];
    [impl_->window setTitle:ns_title ?: @"SnapSurf"];
  }

  impl_->suppress_tab_signal = false;
}

void BrowserWindow::refreshBrowserVisibility() {
  auto active = tab_manager_.getActiveTab();
  const TabId active_id = active ? active->id : 0;

  for (const auto& tab : tab_manager_.allTabs()) {
    if (!tab.browser) {
      continue;
    }

    NSView* view = (NSView*)tab.browser->GetHost()->GetWindowHandle();
    if (!view) {
      continue;
    }

    [view setHidden:(tab.id != active_id)];
    if (tab.id == active_id) {
      [view setFrame:[impl_->web_container bounds]];
      tab.browser->GetHost()->SetFocus(true);
    }
  }
}

void BrowserWindow::resizeBrowserViews() {
  if (!impl_ || !impl_->web_container) {
    return;
  }

  NSRect b = [impl_->web_container bounds];
  for (const auto& tab : tab_manager_.allTabs()) {
    if (!tab.browser) {
      continue;
    }

    NSView* view = (NSView*)tab.browser->GetHost()->GetWindowHandle();
    if (view) {
      [view setFrame:b];
    }
    tab.browser->GetHost()->WasResized();
    tab.browser->GetHost()->NotifyMoveOrResizeStarted();
  }
}

std::optional<TabId> BrowserWindow::activeTabId() const {
  auto active = tab_manager_.getActiveTab();
  if (!active) {
    return std::nullopt;
  }
  return active->id;
}

}  // namespace snapsurf
