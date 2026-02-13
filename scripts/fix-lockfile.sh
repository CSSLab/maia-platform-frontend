#!/bin/bash
# Regenerate package-lock.json to sync with package.json
rm -f package-lock.json
npm install --legacy-peer-deps
