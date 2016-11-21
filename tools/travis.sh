#!/bin/bash
set -e
PROJECT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.."

if [[ "$TRAVIS_OS_NAME" == "linux" ]]; then
  sudo add-apt-repository -y ppa:beineri/opt-qt57-trusty
  sudo apt-get update
  sudo apt-get -y install \
    qt57declarative qt57quickcontrols qt57quickcontrols2 qt57graphicaleffects qt57tools qt57svg \
    mesa-common-dev libglu1-mesa-dev

  source /opt/qt57/bin/qt57-env.sh
  ./tools/bootstrap.sh
  mkdir build && cd build && qmake .. && make && make clean && cd ..
  ./tools/deploy_linux.sh build/quark
  ls .
  ls build
fi

if [[ "$TRAVIS_OS_NAME" == "osx" ]]; then
  brew install qt5
  brew link --force qt5
  which qmake
  ./tools/bootstrap.sh
  mkdir build && cd build && qmake .. && make && make clean && cd ..
  ./tools/deploy_mac.sh build/quark.app
  ls .
  ls build
fi
