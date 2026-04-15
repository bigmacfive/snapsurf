#include "app/BrowserApp.h"

#include "include/cef_command_line.h"
#include "browser/BrowserWindow.h"

namespace snapsurf {

BrowserApp::BrowserApp(std::filesystem::path state_dir,
                       std::filesystem::path downloads_dir)
    : state_dir_(std::move(state_dir)), downloads_dir_(std::move(downloads_dir)) {}

void BrowserApp::OnContextInitialized() {
  CefRefPtr<CefCommandLine> command_line = CefCommandLine::GetGlobalCommandLine();
  std::string start_url = "https://example.com";
  if (command_line->HasSwitch("start-url")) {
    start_url = command_line->GetSwitchValue("start-url").ToString();
  }

  main_window_ = std::make_unique<BrowserWindow>(state_dir_, downloads_dir_);
  main_window_->createMainWindow(start_url);
}

void BrowserApp::OnBeforeCommandLineProcessing(const CefString& process_type,
                                               CefRefPtr<CefCommandLine> command_line) {
  (void)process_type;

  // Compatibility-first defaults.
  command_line->AppendSwitchWithValue("disable-features", "InterestFeedContentSuggestions");
  command_line->AppendSwitch("disable-background-timer-throttling");
}

}  // namespace snapsurf
