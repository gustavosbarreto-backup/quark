#!/bin/bash

PROJECT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.."

VERSION="v0.10.0"
ARCH="$($PROJECT_PATH/tools/arch.sh -f qpm -a)"
OS="$($PROJECT_PATH/tools/arch.sh -f qpm -o)"
BASE_URL="https://www.qpm.io/download/$VERSION"
BASE_PATH="$PROJECT_PATH/tmp/qpm-$VERSION-$OS-$ARCH"

pushd . > /dev/null
mkdir -p "$BASE_PATH"

URL="$BASE_URL/$OS""_$ARCH/qpm"
CMD="$BASE_PATH/qpm"

case "$OS" in
  darwin) URL="$BASE_URL/darwin_386/qpm";;
  linux) URL="$BASE_URL/linux_386/qpm";;
  windows) URL="$BASE_URL/windows_386/qpm.exe" CMD="$BASE_PATH/qpm.exe" ;;
  *)  echo "could not parse uname -m output: $arcg" ; exit 1;
esac

if [ -f "$CMD" ]; then
  echo "$CMD"
  exit
fi

cd "$BASE_PATH"
curl -O "$URL"
chmod +x "$CMD"

popd > /dev/null

echo "$CMD"
