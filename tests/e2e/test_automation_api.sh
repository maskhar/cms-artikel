#!/bin/bash
# E2E Test Suite for Artikel CMS Automation API
# Purpose: End-to-end testing of the automation API endpoint
# Usage: ./tests/e2e/test_automation_api.sh

set -e

# Configuration
API_URL="${SUPABASE_URL}/functions/v1/artikel-cms"
API_KEY="${TEST_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "Error: TEST_API_KEY environment variable not set"
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "Error: SUPABASE_URL environment variable not set"
  exit 1
fi

echo "=== E2E Test Suite: Automation API ==="
echo "API URL: $API_URL"
echo ""

# Test 1: Create new article
echo "Test 1: Create new article"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "test-001",
      "title": "E2E Test Article",
      "slug": "e2e-test-article",
      "content": "<p>This is an E2E test article</p>",
      "excerpt": "E2E test excerpt",
      "category": "Testing",
      "status": "draft"
    }
  }')

echo "$RESPONSE" | jq .
ARTICLE_ID=$(echo "$RESPONSE" | jq -r '.data.article_id')

if [ "$ARTICLE_ID" != "null" ]; then
  echo "✓ Test 1 PASSED: Article created with ID $ARTICLE_ID"
else
  echo "✗ Test 1 FAILED"
  exit 1
fi
echo ""

# Test 2: Update existing article (idempotency)
echo "Test 2: Update existing article"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "test-001",
      "title": "E2E Test Article (Updated)",
      "slug": "e2e-test-article-updated",
      "content": "<p>This is an updated E2E test article</p>",
      "excerpt": "Updated E2E test excerpt",
      "category": "Testing",
      "status": "published"
    }
  }')

echo "$RESPONSE" | jq .
CREATED=$(echo "$RESPONSE" | jq -r '.data.created')

if [ "$CREATED" == "false" ]; then
  echo "✓ Test 2 PASSED: Article updated (not created)"
else
  echo "✗ Test 2 FAILED: Expected update but got creation"
  exit 1
fi
echo ""

# Test 3: Invalid API key
echo "Test 3: Invalid API key"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: invalid-key-12345" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "test-002",
      "title": "Should Fail",
      "slug": "should-fail",
      "content": "<p>Should fail</p>",
      "category": "Testing"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "$BODY" | jq .

if [ "$HTTP_CODE" == "401" ]; then
  echo "✓ Test 3 PASSED: Invalid API key rejected"
else
  echo "✗ Test 3 FAILED: Expected 401, got $HTTP_CODE"
  exit 1
fi
echo ""

# Test 4: Missing required field
echo "Test 4: Missing required field (title)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "test-003",
      "slug": "missing-title",
      "content": "<p>Missing title</p>",
      "category": "Testing"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "$BODY" | jq .

if [ "$HTTP_CODE" == "400" ]; then
  echo "✓ Test 4 PASSED: Missing title rejected"
else
  echo "✗ Test 4 FAILED: Expected 400, got $HTTP_CODE"
  exit 1
fi
echo ""

# Test 5: Invalid slug format
echo "Test 5: Invalid slug format"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "test-004",
      "title": "Invalid Slug Test",
      "slug": "Invalid Slug With Spaces!",
      "content": "<p>Invalid slug</p>",
      "category": "Testing"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "$BODY" | jq .

if [ "$HTTP_CODE" == "400" ]; then
  echo "✓ Test 5 PASSED: Invalid slug rejected"
else
  echo "✗ Test 5 FAILED: Expected 400, got $HTTP_CODE"
  exit 1
fi
echo ""

# Test 6: Rate limiting (if enabled)
echo "Test 6: Rate limiting test"
echo "Sending 125 requests rapidly..."
SUCCESS_COUNT=0
RATE_LIMITED=0

for i in {1..125}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "x-artikel-key: $API_KEY" \
    -d "{
      \"action\": \"article.upsert\",
      \"data\": {
        \"external_id\": \"rate-test-$i\",
        \"title\": \"Rate Test $i\",
        \"slug\": \"rate-test-$i\",
        \"content\": \"<p>Rate test content $i</p>\",
        \"category\": \"Testing\"
      }
    }")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "201" ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  elif [ "$HTTP_CODE" == "429" ]; then
    RATE_LIMITED=$((RATE_LIMITED + 1))
  fi
  
  # Show progress every 25 requests
  if [ $((i % 25)) -eq 0 ]; then
    echo "  Progress: $i/125 requests sent"
  fi
done

echo "Results: $SUCCESS_COUNT successful, $RATE_LIMITED rate-limited"

if [ "$RATE_LIMITED" -gt 0 ]; then
  echo "✓ Test 6 PASSED: Rate limiting is active"
else
  echo "⚠ Test 6 WARNING: No rate limiting detected (may be disabled)"
fi
echo ""

# Test 7: Category reuse
echo "Test 7: Category reuse"
RESPONSE1=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "cat-test-1",
      "title": "Category Test 1",
      "slug": "category-test-1",
      "content": "<p>Category test 1</p>",
      "category": "E2E Category"
    }
  }')

CATEGORY_ID_1=$(echo "$RESPONSE1" | jq -r '.data.category_id')

RESPONSE2=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-artikel-key: $API_KEY" \
  -d '{
    "action": "article.upsert",
    "data": {
      "external_id": "cat-test-2",
      "title": "Category Test 2",
      "slug": "category-test-2",
      "content": "<p>Category test 2</p>",
      "category": "E2E Category"
    }
  }')

CATEGORY_ID_2=$(echo "$RESPONSE2" | jq -r '.data.category_id')

if [ "$CATEGORY_ID_1" == "$CATEGORY_ID_2" ]; then
  echo "✓ Test 7 PASSED: Category reused correctly"
else
  echo "✗ Test 7 FAILED: Different category IDs ($CATEGORY_ID_1 vs $CATEGORY_ID_2)"
  exit 1
fi
echo ""

echo "=== All E2E Tests Completed Successfully ==="
