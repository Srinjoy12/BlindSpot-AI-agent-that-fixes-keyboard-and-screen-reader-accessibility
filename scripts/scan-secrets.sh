#!/usr/bin/env bash
# scripts/scan-secrets.sh — Pre-submission secret scanner for BlindSpot.
# Ensures zero secrets or API keys are present in code or git history.

set -euo pipefail

echo "================================================================="
echo "BlindSpot — Pre-Submission Secret & Credential Scanner"
echo "================================================================="

FAILED=0

# 1. Verify .env is in .gitignore
if ! grep -q "^\.env$" .gitignore; then
  echo "❌ ERROR: .env is missing from .gitignore!"
  FAILED=1
else
  echo "✅ .env is properly ignored in .gitignore"
fi

if ! grep -q "^data/" .gitignore && ! grep -q "data" .gitignore; then
  echo "⚠️ WARNING: data/ should be in .gitignore"
fi

# 2. Check working tree for high-entropy secret patterns (excluding .env, node_modules, dist, .git)
echo "Scanning working tree for secret patterns..."
PATTERNS=(
  "nvapi-[A-Za-z0-9_-]{20,}"
  "tvly-[A-Za-z0-9_-]{20,}"
  "eyJhbGciOi"
  "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
  "TF_API_KEY=[a-zA-Z0-9_-]{10,}"
  "TAVILY_API_KEY=[a-zA-Z0-9_-]{10,}"
)

for PATTERN in "${PATTERNS[@]}"; do
  MATCHES=$(grep -rnE -e "$PATTERN" . \
    --exclude-dir={.git,node_modules,dist,data,.gemini} \
    --exclude={.env,package-lock.json,scan-secrets.sh} || true)

  if [ -n "$MATCHES" ]; then
    echo "❌ ERROR: Potential secret match found for pattern '$PATTERN':"
    echo "$MATCHES"
    FAILED=1
  fi
done

# 3. Check git history for committed secrets if git is available
if command -v git &> /dev/null && [ -d .git ]; then
  echo "Scanning git commit history for secret patterns..."
  for PATTERN in "${PATTERNS[@]}"; do
    COMMITS=$(git log -p --all -G"$PATTERN" -- . ":(exclude).env" ":(exclude)scripts/scan-secrets.sh" 2>/dev/null || true)
    if [ -n "$COMMITS" ]; then
      echo "❌ ERROR: Secret pattern '$PATTERN' detected in git commit history!"
      FAILED=1
    fi
  done
fi

if [ $FAILED -eq 0 ]; then
  echo "================================================================="
  echo "✅ SCAN PASSED: Zero credentials or API keys found in repository."
  echo "================================================================="
  exit 0
else
  echo "================================================================="
  echo "❌ SCAN FAILED: Potential secrets detected! Clean before pushing."
  echo "================================================================="
  exit 1
fi
