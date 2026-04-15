cmake_minimum_required(VERSION 3.24)
project(SnapSurf LANGUAGES CXX OBJCXX Swift)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(SNAPSURF_USE_SANDBOX "Enable CEF sandbox if available" OFF)
set(SNAPSURF_CEF_ROOT "" CACHE PATH "Path to extracted CEF binary distribution")

if(NOT APPLE)
  message(FATAL_ERROR "SnapSurf currently targets macOS only.")
endif()
if(NOT SNAPSURF_CEF_ROOT)
  message(FATAL_ERROR "Set SNAPSURF_CEF_ROOT to your extracted CEF binary distribution.")
endif()

set(CEF_ROOT "${SNAPSURF_CEF_ROOT}")
list(APPEND CMAKE_MODULE_PATH "${CEF_ROOT}/cmake")
find_package(CEF REQUIRED)
add_subdirectory(${CEF_LIBCEF_DLL_WRAPPER_PATH} ${CMAKE_BINARY_DIR}/libcef_dll_wrapper)

set(SNAPSURF_SOURCES
  src/swift/AppMain.swift
  src/swift/ContentView.swift
  src/platform/mac/CEFCoreBridge.mm
  src/browser/BrowserClient.cc
  src/browser/TabManager.cc
  src/browser/NavigationController.cc
  src/browser/DownloadService.cc
  src/browser/BookmarkStore.cc
)

add_executable(SnapSurf MACOSX_BUNDLE ${SNAPSURF_SOURCES})
SET_EXECUTABLE_TARGET_PROPERTIES(SnapSurf)

set_target_properties(SnapSurf PROPERTIES
  MACOSX_BUNDLE_INFO_PLIST ${CMAKE_CURRENT_SOURCE_DIR}/resources/Info.plist.in
  SWIFT_OBJC_BRIDGING_HEADER ${CMAKE_CURRENT_SOURCE_DIR}/src/swift/BridgingHeader.h
  XCODE_ATTRIBUTE_SWIFT_OBJC_BRIDGING_HEADER ${CMAKE_CURRENT_SOURCE_DIR}/src/swift/BridgingHeader.h
  XCODE_ATTRIBUTE_SWIFT_VERSION 5.0
  XCODE_ATTRIBUTE_PRODUCT_BUNDLE_IDENTIFIER "com.snapsurf.browser"
  XCODE_ATTRIBUTE_CLANG_ENABLE_OBJC_ARC YES
)

target_include_directories(SnapSurf PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src
  ${SNAPSURF_CEF_ROOT}
  ${CEF_INCLUDE_PATH}
)

target_compile_definitions(SnapSurf PRIVATE
  SNAPSURF_ENABLE_SANDBOX=0
  SNAPSURF_PRODUCT_NAME="SnapSurf"
)

target_link_libraries(SnapSurf PRIVATE
  libcef_dll_wrapper
  ${CEF_STANDARD_LIBS}
  "-framework AppKit"
  "-framework Cocoa"
  "-framework Foundation"
  "-framework IOSurface"
)

target_link_options(SnapSurf PRIVATE
  "-F${SNAPSURF_CEF_ROOT}/Release"
  "-framework"
  "Chromium Embedded Framework"
)

set(CEF_FRAMEWORK_DIR "${SNAPSURF_CEF_ROOT}/Release/Chromium Embedded Framework.framework")
add_custom_command(TARGET SnapSurf POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E echo "Copying CEF Framework into app bundle"
  COMMAND ${CMAKE_COMMAND} -E copy_directory
          "${CEF_FRAMEWORK_DIR}"
          "$<TARGET_BUNDLE_CONTENT_DIR:SnapSurf>/Frameworks/Chromium Embedded Framework.framework"
)

message(STATUS "SnapSurf configured with CEF root: ${SNAPSURF_CEF_ROOT}")
