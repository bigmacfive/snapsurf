#pragma once

#ifdef __cplusplus
extern "C" {
#endif

int SSCEFInitialize(const char* state_dir, const char* downloads_dir);
void SSCEFShutdown(void);
void SSCEFDoMessageLoopWork(void);

void SSCEFCreateBrowserInView(void* ns_view, const char* initial_url);
void SSCEFNotifyHostViewResized(void* ns_view);
void SSCEFOpenURL(const char* url);
void SSCEFGoBack(void);
void SSCEFGoForward(void);
void SSCEFReload(void);
void SSCEFNewTab(const char* url);
void SSCEFCloseActiveTab(void);
void SSCEFAddBookmark(void);

#ifdef __cplusplus
}
#endif
