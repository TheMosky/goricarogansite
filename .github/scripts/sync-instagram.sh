#!/usr/bin/env bash
# ============================================================
# Self-hosted Instagram feed sync.
# Povlači najnovije objave (Instagram API with Instagram Login),
# snima slike u assets/img/instagram/ i piše assets/instagram.json.
# Zahteva: IG_TOKEN (dugoročni token). Opciono: GH_PAT (trajno čuvanje osveženog tokena).
# ============================================================
set -uo pipefail

API="https://graph.instagram.com"
OUT_DIR="assets/img/instagram"
JSON="assets/instagram.json"
LIMIT="${IG_LIMIT:-12}"

TOKEN="${IG_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "IG_TOKEN nije postavljen — preskačem sync (galerija koristi fallback slike)."
  exit 0
fi

mkdir -p "$OUT_DIR"

# 1) Osveži token (radi samo ako je stariji od 24h; grešku ignoriši)
REFRESH=$(curl -sf "$API/refresh_access_token?grant_type=ig_refresh_token&access_token=$TOKEN" 2>/dev/null || true)
NEW=$(printf '%s' "$REFRESH" | jq -r '.access_token // empty' 2>/dev/null || true)
if [ -n "$NEW" ]; then
  TOKEN="$NEW"
  echo "Token osvežen (+60 dana)."
  if [ -n "${GH_PAT:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s' "$NEW" | GH_TOKEN="$GH_PAT" gh secret set IG_TOKEN --repo "$GITHUB_REPOSITORY" 2>/dev/null \
      && echo "Novi token sačuvan u secret IG_TOKEN." \
      || echo "Upozorenje: nisam mogao da upišem token (proveri GH_PAT dozvole)."
  else
    echo "GH_PAT nije postavljen — token neće biti trajno sačuvan (ističe za ~60 dana)."
  fi
fi

# 2) Povuci medije
MEDIA=$(curl -sf "$API/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=$LIMIT&access_token=$TOKEN" 2>/dev/null || true)
COUNT=$(printf '%s' "$MEDIA" | jq -r '.data | length' 2>/dev/null || echo 0)
if [ -z "$COUNT" ] || [ "$COUNT" = "null" ] || ! [ "$COUNT" -gt 0 ] 2>/dev/null; then
  echo "Nema medija ili token nije validan. Odgovor: $MEDIA"
  exit 1
fi
echo "Pronađeno $COUNT objava."

# 3) Napravi instagram.json (naša šema)
printf '%s' "$MEDIA" | jq '[.data[] | {
  id: .id,
  type: .media_type,
  permalink: .permalink,
  caption: ((.caption // "") | gsub("[\r]";"")),
  timestamp: .timestamp,
  image: ("assets/img/instagram/" + .id + ".jpg")
}]' > "$JSON"

# 4) Skini slike (za VIDEO thumbnail, za CAROUSEL prvo dete)
printf '%s' "$MEDIA" | jq -r '.data[] | [.id, .media_type, (.media_url // ""), (.thumbnail_url // "")] | @tsv' \
| while IFS="$(printf '\t')" read -r id type url thumb; do
    img="$url"
    [ "$type" = "VIDEO" ] && img="$thumb"
    if [ "$type" = "CAROUSEL_ALBUM" ]; then
      img=$(curl -sf "$API/$id/children?fields=media_url,thumbnail_url&access_token=$TOKEN" 2>/dev/null \
            | jq -r '.data[0].media_url // .data[0].thumbnail_url // empty' 2>/dev/null || true)
    fi
    if [ -n "$img" ]; then
      curl -sf -o "$OUT_DIR/$id.jpg" "$img" 2>/dev/null && echo "  ✓ $id" || echo "  ✗ $id (download nije uspeo)"
    fi
  done

# 5) Očisti stare slike kojih više nema u feedu
KEEP=$(printf '%s' "$MEDIA" | jq -r '.data[].id' 2>/dev/null || true)
for f in "$OUT_DIR"/*.jpg; do
  [ -e "$f" ] || continue
  base="$(basename "$f" .jpg)"
  printf '%s\n' "$KEEP" | grep -qx "$base" || { rm -f "$f"; echo "  - obrisano staro: $base"; }
done

echo "Sync gotov."
