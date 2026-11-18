#!/usr/bin/env bash
# Выпуск новой версии.
#   scripts/release.sh 0.2.0 "Короткое описание изменений"
# Обновляет номер версии в коде, превращает раздел «Не выпущено» в CHANGELOG.md
# в раздел новой версии и делает коммит. Потом: git push origin main —
# GitHub сам создаст тег vX.Y.Z, Release и опубликует сайт.
set -euo pipefail

NEW="${1:-}"
NOTE="${2:-}"
if [[ ! "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Использование: scripts/release.sh X.Y.Z \"что изменилось\"" >&2
  exit 1
fi
cd "$(dirname "$0")/.."

if grep -q "^## \[$NEW\]" CHANGELOG.md; then
  echo "Версия $NEW уже есть в CHANGELOG.md" >&2
  exit 1
fi

sed -i.bak -E "s/VERSION = '[0-9]+\.[0-9]+\.[0-9]+'/VERSION = '$NEW'/" js/version.js sw.js
rm -f js/version.js.bak sw.js.bak

DATE="$(date +%Y-%m-%d)"
if grep -q '^## \[Не выпущено\]' CHANGELOG.md; then
  sed -i.bak "s/^## \[Не выпущено\]/## [Не выпущено]\n\n## [$NEW] — $DATE/" CHANGELOG.md
  rm -f CHANGELOG.md.bak
else
  printf '\n## [%s] — %s\n\n- %s\n' "$NEW" "$DATE" "$NOTE" >> CHANGELOG.md
fi

git add -A
git commit -m "release: v$NEW${NOTE:+ — $NOTE}"
echo "Готово: v$NEW. Отправить: git push origin main"
