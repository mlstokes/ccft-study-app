#!/bin/bash
# Check accessibility of all study material URLs
# Outputs: status_code url title

cat scripts/content-inventory.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for m in data:
    print(m['url'])
" | while read -r url; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 10 "$url" 2>/dev/null)
  echo "$status $url"
done
