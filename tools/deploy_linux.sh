#!/bin/bash

PROJECT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/../"
TARGET_APP=$1
TARGET_PATH=$(dirname "$TARGET_APP")
DEPLOY_CMD="$PROJECT_PATH/tmp/linuxdeployqt-build/linuxdeployqt/linuxdeployqt"
TMP_PATH="$PROJECT_PATH/tmp"

cat << EOF > "$TARGET_PATH/quark.desktop"
[Desktop Entry]
Type=Application
Name=Quark
Exec=AppRun %F
Icon=default
Comment=Edit this default file
Terminal=true
EOF

cp "$PROJECT_PATH/quark.svg" "$TARGET_PATH/default.svg"

PATH="$TMP_PATH:$PATH" "$DEPLOY_CMD" $TARGET_APP -qmldir=$PROJECT_PATH/src/qml -bundle-non-qt-libs -no-strip

# we need to run this two times...
PATH="$TMP_PATH:$PATH" "$DEPLOY_CMD" $TARGET_APP -appimage -qmldir=$PROJECT_PATH/src/qml -bundle-non-qt-libs -no-strip