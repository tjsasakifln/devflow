#!/usr/bin/env bash
# Devflow layer boundary check.
# Kernel must not import from intelligence/ or adapters/.
# Intelligence may import from kernel/ and adapters/.
# Adapters must not import from kernel/ or intelligence/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VIOLATIONS=0

echo "=== Layer Boundary Check ==="

# Kernel → Intelligence (BLOCKED)
if grep -rn "from.*intelligence" "$ROOT/src/kernel/" --include="*.ts" -q; then
  echo "❌ VIOLATION: kernel/ imports from intelligence/"
  grep -rn "from.*intelligence" "$ROOT/src/kernel/" --include="*.ts"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "✅ Kernel → Intelligence: CLEAN"
fi

# Kernel → Adapters (BLOCKED)
if grep -rn "from.*adapters" "$ROOT/src/kernel/" --include="*.ts" -q; then
  echo "❌ VIOLATION: kernel/ imports from adapters/"
  grep -rn "from.*adapters" "$ROOT/src/kernel/" --include="*.ts"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "✅ Kernel → Adapters: CLEAN"
fi

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "❌ $VIOLATIONS layer violation(s) found."
  exit 1
else
  echo "✅ All layer boundaries clean."
fi
