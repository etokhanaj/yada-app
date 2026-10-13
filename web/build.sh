#!/bin/sh
# Packages web/src as the zip Episode's "import zipped website" accepts (episode-api
# src/services/designImport): static pages at the root and as <slug>/index.html, assets
# beside them. The single top folder is stripped on import (zipArchive.ts stripCommonRoot).
set -eu

cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist/yada-site
cp -R src/. dist/yada-site/
find dist/yada-site -name '.DS_Store' -delete
(cd dist && zip -q -r -X yada-site.zip yada-site)
rm -rf dist/yada-site
unzip -l dist/yada-site.zip
