#!/bin/bash
set -e
# A PosIX variable
OPTIND=1         # Reset in case getopts has been used previously in the shell.

valid_formats=( "std" "node" )
# Initialize our own variables:
format="std" # or qpm, node
show_arch=false
show_os=false

arch="$(uname -m)"
case "$OSTYPE" in
  darwin*)  os="darwin" ;;
  linux*)   os="linux" ;;
  msys*)    os="windows" ;;
  *)        echo "unknown: $OSTYPE" ; exit 1;
esac

format_node() {
  case "$arch" in
    x86_64) arch="x64";;
    i686) arch="x86";;
    *)  echo "could not parse uname -m output: $arcg" ; exit 1;
  esac
  if [[ "$os" = windows ]]; then
    os=win
	arch=x86
  fi
}
while getopts "aof:" opt; do
    case "$opt" in
    a)  show_arch=true
        ;;
    o)  show_os=true
        ;;
    f)  format=$OPTARG
        ;;
    esac
done

shift $((OPTIND-1))

[ "$1" = "--" ] && shift

case "$format" in
  std);;
  node) format_node;;
  *)  echo "illegal format vale: $format. (valid: ${valid_formats[@]}))" ; exit 1;
esac

if [[ "$os" = windows ]]; then
	arch=x86
fi

if [[ "$show_arch" = true ]]; then
echo "$arch"
fi
if [[ "$show_os" = true ]]; then
echo "$os"
fi
