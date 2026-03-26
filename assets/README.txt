This directory should contain:
- icon.png  (256x256 PNG — app icon for Linux + tray)
- icon.ico  (Windows icon)
- icon.icns (macOS icon)

You can generate icons from any 512x512 PNG using electron-icon-builder:
  npx electron-icon-builder --input=icon-source.png --output=./assets

Or use any icon tool of your choice.
Until icons are added, Electron uses a default icon.
