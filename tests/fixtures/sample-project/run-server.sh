#!/bin/bash -x

SCRIPT_DIR=$(cd $(dirname $0); pwd)
cd $SCRIPT_DIR
cd "_build"

npx http-server --cors -c-1
