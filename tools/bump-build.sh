#!/bin/sh
# Run before every deploy: stamps a new build id so open apps reload once.
set -e
cd "$(dirname "$0")/.."
B=$(date +%Y%m%d-%H%M)
sed -i "s/name=\"app-build\" content=\"[^\"]*\"/name=\"app-build\" content=\"$B\"/" *.html
printf '{"build":"%s"}\n' "$B" > version.json
echo "build $B"
