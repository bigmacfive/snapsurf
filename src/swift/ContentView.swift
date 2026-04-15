import SwiftUI
import AppKit

struct BrowserHostView: NSViewRepresentable {
    let initialURL: String = "https://example.com"

    final class Coordinator {
        var created = false
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        DispatchQueue.main.async {
            let b = view.bounds
            if !context.coordinator.created && b.width > 2 && b.height > 2 {
                context.coordinator.created = true
                initialURL.withCString { cstr in
                    SSCEFCreateBrowserInView(Unmanaged.passUnretained(view).toOpaque(), cstr)
                }
            }
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        let b = nsView.bounds
        if !context.coordinator.created && b.width > 2 && b.height > 2 {
            context.coordinator.created = true
            initialURL.withCString { cstr in
                SSCEFCreateBrowserInView(Unmanaged.passUnretained(nsView).toOpaque(), cstr)
            }
        }
        SSCEFNotifyHostViewResized(Unmanaged.passUnretained(nsView).toOpaque())
    }
}

struct ContentView: View {
    @State private var address: String = "https://example.com"

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Button("<") { SSCEFGoBack() }
                    .frame(width: 32)
                Button(">") { SSCEFGoForward() }
                    .frame(width: 32)
                Button("Reload") { SSCEFReload() }
                Button("+") {
                    address.withCString { cstr in
                        SSCEFNewTab(cstr)
                    }
                }
                Button("-") { SSCEFCloseActiveTab() }
                TextField("Search or enter address", text: $address)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        address.withCString { cstr in
                            SSCEFOpenURL(cstr)
                        }
                    }
                Button("Go") {
                    address.withCString { cstr in
                        SSCEFOpenURL(cstr)
                    }
                }
                Button("Bookmark") { SSCEFAddBookmark() }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)

            Divider()

            BrowserHostView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
