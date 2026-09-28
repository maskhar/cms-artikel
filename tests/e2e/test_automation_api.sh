#!/bin/bash
# E2E Test Suite for Artikel CMS Automation API
# Usage: bash tests/e2e/test_automation_api.sh
#
# Ditulis ulang 28 September 2026. Versi sebelumnya menguji endpoint yang salah:
# /functions/v1/artikel-cms dengan header x-artikel-key dan body envelope
# { action, data }. Edge Function itu tidak pernah ter-deploy dan sudah dihapus.
# Endpoint yang nyata: /functions/v1/automation-api, header x-api-key, body flat.
# Akibatnya suite lama pasti gagal di Test 1 dan tidak pernah menguji apa pun.
#
# Perubahan lain terhadap versi lama:
#   * Test rate limit 125 request dihapus. Automation API belum punya rate limit
#     di produksi, jadi test itu hanya menulis 125 artikel sampah ke database.
#   * Test "invalid slug format" dihapus. API tidak memvalidasi bentuk slug;
#     test itu menegaskan perilaku yang tidak pernah ada.
#   * Ditambah test GET (verifikasi key), satu-satunya jalur yang berfungsi penuh.
#   * `set -e` diganti penanganan kegagalan eksplisit supaya semua test berjalan
#     dan ringkasan akhir tetap tercetak.
#
# ⚠️ Test ini menulis artikel sungguhan ke site milik API key yang dipakai.
# JANGAN jalankan terhadap produksi. Pakai site khusus tes.
#
# Prasyarat:
#   export SUPABASE_URL="https://supabase.example.test"
#   export TEST_API_KEY="ak_live_..."      # buat lewat CMS: Pengaturan > API Keys
#
# Butuh: curl, jq

API_URL="${SUPABASE_URL}/functions/v1/automation-api"
API_KEY="${TEST_API_KEY}"
PREFIX="e2e-$(date +%s)"

PASS=0
FAIL=0

pass() { echo "✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "✗ $1"; FAIL=$((FAIL + 1)); }

if [ -z "$TEST_API_KEY" ]; then
  echo "Error: TEST_API_KEY environment variable not set"
  echo "Key otomasi berawalan ak_live_. Buat lewat CMS: Pengaturan > API Keys."
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "Error: SUPABASE_URL environment variable not set"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq tidak terpasang"
  exit 1
fi

echo "=== E2E Test Suite: Automation API ==="
echo "API URL: $API_URL"
echo "Prefix external_id: $PREFIX"
echo ""
echo "⚠️  Test ini menulis artikel sungguhan. Pastikan ini bukan produksi."
echo ""

# ---------------------------------------------------------------------------
# Test 1: GET — verifikasi API key dan identitas site
# ---------------------------------------------------------------------------
echo "Test 1: GET verifikasi API key"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL" -H "x-api-key: $API_KEY")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ] && [ "$(echo "$BODY" | jq -r '.site.id // empty')" != "" ]; then
  pass "Test 1: key valid untuk site $(echo "$BODY" | jq -r '.site.name')"
else
  fail "Test 1: GET gagal (HTTP $HTTP_CODE)"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  echo ""
  echo "Tanpa key yang valid, sisa test tidak bermakna. Berhenti."
  exit 1
fi
echo ""

# ---------------------------------------------------------------------------
# Test 2: API key salah ditolak
# ---------------------------------------------------------------------------
echo "Test 2: API key salah ditolak"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL" -H "x-api-key: ak_live_invalid-key-12345")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
  pass "Test 2: key tidak dikenal ditolak 401"
else
  fail "Test 2: harap 401, dapat $HTTP_CODE"
fi
echo ""

# ---------------------------------------------------------------------------
# Test 3: Buat artikel baru
# ---------------------------------------------------------------------------
echo "Test 3: Buat artikel baru"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"external_id\": \"${PREFIX}-001\",
    \"title\": \"E2E Test Article\",
    \"slug\": \"${PREFIX}-article\",
    \"content\": \"<p>This is an E2E test article</p>\",
    \"excerpt\": \"E2E test excerpt\",
    \"category_name\": \"E2E Testing\",
    \"status\": \"draft\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# RPC memakai RETURNS TABLE, jadi data adalah list.
ARTICLE_ID=$(echo "$BODY" | jq -r '.data[0].article_id // .data.article_id // empty')
CREATED_NEW=$(echo "$BODY" | jq -r '.data[0].created_new // .data.created_new // empty')
CATEGORY_ID_1=$(echo "$BODY" | jq -r '.data[0].category_id // .data.category_id // empty')

if [ "$HTTP_CODE" == "200" ] && [ -n "$ARTICLE_ID" ] && [ "$CREATED_NEW" == "true" ]; then
  pass "Test 3: artikel dibuat, id $ARTICLE_ID"
else
  fail "Test 3: gagal membuat artikel (HTTP $HTTP_CODE)"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
fi
echo ""

# ---------------------------------------------------------------------------
# Test 4: Upsert idempoten lewat external_id
# ---------------------------------------------------------------------------
echo "Test 4: Upsert idempoten (external_id sama)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"external_id\": \"${PREFIX}-001\",
    \"title\": \"E2E Test Article (Updated)\",
    \"slug\": \"${PREFIX}-article-updated\",
    \"content\": \"<p>Updated E2E test article</p>\",
    \"excerpt\": \"Updated excerpt\",
    \"category_name\": \"E2E Testing\",
    \"status\": \"draft\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

UPDATED_ID=$(echo "$BODY" | jq -r '.data[0].article_id // .data.article_id // empty')
CREATED_NEW=$(echo "$BODY" | jq -r '.data[0].created_new // .data.created_new // empty')

if [ "$HTTP_CODE" == "200" ] && [ "$CREATED_NEW" == "false" ] && [ "$UPDATED_ID" == "$ARTICLE_ID" ]; then
  pass "Test 4: artikel diperbarui, bukan dibuat ulang"
else
  fail "Test 4: harap update pada artikel yang sama (HTTP $HTTP_CODE, created_new=$CREATED_NEW)"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
fi
echo ""

# ---------------------------------------------------------------------------
# Test 5: Field wajib yang hilang ditolak
# ---------------------------------------------------------------------------
# Wajib menurut supabase/functions/automation-api/index.ts:
# external_id, title, slug, content, category_name.
echo "Test 5: Field wajib hilang ditolak"
for missing in title slug content category_name; do
  PAYLOAD=$(jq -nc \
    --arg ext "${PREFIX}-missing-${missing}" \
    --arg missing "$missing" \
    '{external_id: $ext, title: "T", slug: "s-\($ext)", content: "<p>c</p>", category_name: "E2E Testing"}
     | del(.[$missing])')

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "$PAYLOAD")

  if [ "$HTTP_CODE" == "400" ]; then
    pass "Test 5: tanpa $missing ditolak 400"
  else
    fail "Test 5: tanpa $missing harap 400, dapat $HTTP_CODE"
  fi
done
echo ""

# ---------------------------------------------------------------------------
# Test 6: Status tidak dikenal ditolak
# ---------------------------------------------------------------------------
echo "Test 6: Status tidak dikenal ditolak"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"external_id\": \"${PREFIX}-bad-status\",
    \"title\": \"Bad Status\",
    \"slug\": \"${PREFIX}-bad-status\",
    \"content\": \"<p>x</p>\",
    \"category_name\": \"E2E Testing\",
    \"status\": \"tidak-ada\"
  }")

if [ "$HTTP_CODE" == "400" ]; then
  pass "Test 6: status tidak dikenal ditolak 400"
else
  fail "Test 6: harap 400, dapat $HTTP_CODE"
fi
echo ""

# ---------------------------------------------------------------------------
# Test 7: Kategori dipakai ulang
# ---------------------------------------------------------------------------
echo "Test 7: Kategori dipakai ulang"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"external_id\": \"${PREFIX}-cat-2\",
    \"title\": \"Category Test 2\",
    \"slug\": \"${PREFIX}-category-test-2\",
    \"content\": \"<p>Category test 2</p>\",
    \"category_name\": \"E2E Testing\"
  }")

CATEGORY_ID_2=$(echo "$RESPONSE" | jq -r '.data[0].category_id // .data.category_id // empty')

if [ -n "$CATEGORY_ID_1" ] && [ "$CATEGORY_ID_1" == "$CATEGORY_ID_2" ]; then
  pass "Test 7: kategori dipakai ulang"
else
  fail "Test 7: category_id berbeda ($CATEGORY_ID_1 vs $CATEGORY_ID_2)"
fi
echo ""

# ---------------------------------------------------------------------------
echo "=== Ringkasan: $PASS lulus, $FAIL gagal ==="
echo ""
echo "Artikel tes memakai prefix external_id '$PREFIX'. Bersihkan lewat CMS bila perlu."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
