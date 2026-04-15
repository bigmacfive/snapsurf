#include <filesystem>
#include <cstdlib>

#include "include/cef_app.h"
#include "include/cef_command_line.h"
#include "include/cef_sandbox_mac.h"

#include "app/BrowserApp.h"

namespace {

std::filesystem::path appSupportDirectory() {
  const char* home = std::getenv("HOME");
  if (!home) {
    return std::filesystem::temp_directory_path() / "snapsurf";
  }
  return std::filesystem::path(home) / "Library" / "Application Support" / "SnapSurf";
}

std::filesystem::path downloadsDirectory() {
  const char* home = std::getenv("HOME");
  if (!home) {
    return std::filesystem::temp_directory_path() / "snapsurf-downloads";
  }
  return std::filesystem::path(home) / "Downloads";
}

}  // namespace

int main(int argc, char* argv[]) {
  CefMainArgs main_args(argc, argv);
#if SNAPSURF_ENABLE_SANDBOX
  CefScopedSandboxContext sandbox_context;
  if (!sandbox_context.Initialize(argc, argv)) {
    return 1;
  }
#endif

  auto state_dir = appSupportDirectory();
  std::filesystem::create_directories(state_dir);
  auto download_dir = downloadsDirectory();

  CefRefPtr<snapsurf::BrowserApp> app(new snapsurf::BrowserApp(state_dir, download_dir));

  const int exit_code = CefExecuteProcess(main_args, app, nullptr);
  if (exit_code >= 0) {
    return exit_code;
  }

  CefSettings settings;
  settings.no_sandbox = SNAPSURF_ENABLE_SANDBOX ? false : true;
  settings.multi_threaded_message_loop = false;
  CefString(&settings.browser_subprocess_path) = std::filesystem::absolute(argv[0]).string();

  CefString(&settings.cache_path) = (state_dir / "include/cef_cache").string();
  CefString(&settings.log_file) = (state_dir / "cef.log").string();

  if (!CefInitialize(main_args, settings, app, nullptr)) {
    return 1;
  }

  CefRunMessageLoop();
  CefShutdown();
  return 0;
}
