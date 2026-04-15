import SwiftUI
import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var timer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        _ = notification
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser
        let stateDir = home.appendingPathComponent("Library/Application Support/SnapSurf", isDirectory: true)
        let downloadsDir = home.appendingPathComponent("Downloads", isDirectory: true)

        stateDir.path.withCString { stateC in
            downloadsDir.path.withCString { downC in
                _ = SSCEFInitialize(stateC, downC)
            }
        }

        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 120.0, repeats: true) { _ in
            SSCEFDoMessageLoopWork()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        _ = sender
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        _ = notification
        timer?.invalidate()
        timer = nil
        SSCEFShutdown()
    }
}

@main
struct SnapSurfApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 1024, minHeight: 700)
        }
        .windowStyle(.titleBar)
    }
}
