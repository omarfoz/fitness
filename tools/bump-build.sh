#!/bin/sh
# Run before every deploy: rebuilds the CSS bundles and stamps a new build id
# so open apps reload once and phones fetch the new CSS.
set -e
cd "$(dirname "$0")/.."
B=$(date +%Y%m%d-%H%M)
python3 tools/build-css.py "$B" >/dev/null
sed -i "s/name=\"app-build\" content=\"[^\"]*\"/name=\"app-build\" content=\"$B\"/" *.html
printf '{"build":"%s"}\n' "$B" > version.json
echo "build $B"
