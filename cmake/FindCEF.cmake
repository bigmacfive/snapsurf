if(NOT SNAPSURF_CEF_ROOT)
  message(FATAL_ERROR "Set SNAPSURF_CEF_ROOT to your CEF binary distribution path.")
endif()

find_path(CEF_INCLUDE_DIR
  NAMES cef_app.h
  PATHS
    "${SNAPSURF_CEF_ROOT}/include"
  REQUIRED
)

set(CEF_FRAMEWORK_DIR "${SNAPSURF_CEF_ROOT}/Release/Chromium Embedded Framework.framework")
if(NOT EXISTS "${CEF_FRAMEWORK_DIR}")
  message(FATAL_ERROR "Could not locate Chromium Embedded Framework at ${CEF_FRAMEWORK_DIR}")
endif()

set(CEF_LIBCEF "${CEF_FRAMEWORK_DIR}/Chromium Embedded Framework")
if(NOT EXISTS "${CEF_LIBCEF}")
  message(FATAL_ERROR "Could not locate framework binary at ${CEF_LIBCEF}")
endif()

find_library(CEF_SANDBOX_LIB
  NAMES cef_sandbox
  PATHS
    "${SNAPSURF_CEF_ROOT}/Release"
)

set(CEF_WRAPPER_LIB "")
