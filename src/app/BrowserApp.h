#pragma once

#include <filesystem>
#include <memory>

#include "include/cef_app.h"
#include "browser/BrowserWindow.h"

namespace snapsurf {

class BrowserApp : public CefApp,
                   public CefBrowserProcessHandler,
                   public CefRenderProcessHandler {
 public:
  BrowserApp(std::filesystem::path state_dir, std::filesystem::path downloads_dir);

  CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override {
    return this;
  }

  CefRefPtr<CefRenderProcessHandler> GetRenderProcessHandler() override {
    return this;
  }

  void OnContextInitialized() override;
  void OnBeforeCommandLineProcessing(const CefString& process_type,
                                     CefRefPtr<CefCommandLine> command_line) override;

 private:
  std::filesystem::path state_dir_;
  std::filesystem::path downloads_dir_;
  std::unique_ptr<BrowserWindow> main_window_;

  IMPLEMENT_REFCOUNTING(BrowserApp);
};

}  // namespace snapsurf
