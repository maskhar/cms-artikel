# API Client Examples

Example implementations for integrating with the Artikel CMS Automation API.

## Available Clients

### Node.js / JavaScript

**File:** `nodejs-client.js`

**Features:**
- Single article upsert
- Batch upsert with concurrency control
- Retry logic with exponential backoff
- Progress tracking

**Installation:**
```bash
npm install node-fetch  # If using Node.js < 18
```

**Usage:**
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export ARTIKEL_API_KEY="your-api-key"
node examples/nodejs-client.js
```

### Python

**File:** `python-client.py`

**Features:**
- Object-oriented client class
- Thread-based concurrency
- RSS feed import example
- Comprehensive error handling

**Installation:**
```bash
pip install requests feedparser
```

**Usage:**
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export ARTIKEL_API_KEY="your-api-key"
python examples/python-client.py
```

### PHP

**File:** `php-client.php`

**Features:**
- cURL-based HTTP client
- WordPress import simulation
- Retry logic
- Batch processing

**Usage:**
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export ARTIKEL_API_KEY="your-api-key"
php examples/php-client.php
```

## Common Patterns

### Basic Article Creation

```javascript
// JavaScript
const result = await upsertArticle({
  externalId: 'unique-id-001',
  title: 'My Article',
  slug: 'my-article',
  content: '<p>Article content</p>',
  category: 'News',
  status: 'published'
});
```

```python
# Python
result = client.upsert_article({
    'external_id': 'unique-id-001',
    'title': 'My Article',
    'slug': 'my-article',
    'content': '<p>Article content</p>',
    'category': 'News',
    'status': 'published'
})
```

```php
// PHP
$result = $client->upsertArticle([
    'external_id' => 'unique-id-001',
    'title' => 'My Article',
    'slug' => 'my-article',
    'content' => '<p>Article content</p>',
    'category' => 'News',
    'status' => 'published'
]);
```

### Batch Processing

All clients support batch processing with automatic retry:

- **Node.js:** `batchUpsertArticles(articles, { concurrency: 5, retryAttempts: 3 })`
- **Python:** `client.batch_upsert_articles(articles, max_workers=5, retry_attempts=3)`
- **PHP:** `$client->batchUpsertArticles($articles, 3)`

### Error Handling

```javascript
// JavaScript
try {
  const result = await upsertArticle(data);
  console.log('Success:', result.data.article_id);
} catch (error) {
  if (error.message.includes('Slug already exists')) {
    // Handle slug conflict
  } else if (error.message.includes('Invalid API key')) {
    // Handle auth error
  }
}
```

## Integration Scenarios

### 1. WordPress Migration

Use the PHP client to migrate posts from WordPress:

```php
global $wpdb;
$posts = $wpdb->get_results("SELECT * FROM wp_posts WHERE post_type = 'post' AND post_status = 'publish'");

$articles = array_map(function($post) {
    return [
        'external_id' => 'wp-' . $post->ID,
        'title' => $post->post_title,
        'slug' => $post->post_name,
        'content' => $post->post_content,
        'category' => 'Migrated',
        'status' => 'published',
        'published_at' => date('c', strtotime($post->post_date))
    ];
}, $posts);

$results = $client->batchUpsertArticles($articles);
```

### 2. RSS Feed Aggregation

Use the Python client to import from RSS feeds:

```python
import feedparser

feed = feedparser.parse('https://example.com/rss')
articles = []

for entry in feed.entries:
    articles.append({
        'external_id': f'rss-{entry.id}',
        'title': entry.title,
        'slug': slugify(entry.title),
        'content': entry.content[0].value,
        'category': 'RSS Import',
        'published_at': datetime(*entry.published_parsed[:6]).isoformat() + 'Z'
    })

success, failed = client.batch_upsert_articles(articles)
```

### 3. Scheduled Content Publishing

Use Node.js with cron to publish scheduled content:

```javascript
// scheduled-publisher.js
const schedule = require('node-schedule');

// Run every day at 9 AM
schedule.scheduleJob('0 9 * * *', async () => {
  const articles = await getScheduledArticles();
  
  for (const article of articles) {
    await upsertArticle({
      ...article,
      status: 'published',
      published_at: new Date().toISOString()
    });
  }
});
```

### 4. Webhook Integration

Receive webhooks and create articles:

```javascript
// Express.js webhook endpoint
app.post('/webhooks/content', async (req, res) => {
  const { title, content, external_id } = req.body;
  
  try {
    const result = await upsertArticle({
      externalId: external_id,
      title,
      slug: slugify(title),
      content,
      category: 'Webhook',
      status: 'draft'
    });
    
    res.json({ success: true, article_id: result.data.article_id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Best Practices

### 1. Use External IDs Consistently

Always use a consistent external_id format for your source system:

- WordPress: `wp-{post_id}`
- RSS: `rss-{feed_url_hash}-{entry_id}`
- CMS: `cms-{source}-{id}`

### 2. Handle Rate Limits

Implement exponential backoff when hitting rate limits:

```javascript
async function upsertWithRateLimit(article) {
  let delay = 1000;
  
  while (true) {
    try {
      return await upsertArticle(article);
    } catch (error) {
      if (error.message.includes('Rate limit')) {
        await sleep(delay);
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}
```

### 3. Validate Before Sending

Pre-validate data to avoid unnecessary API calls:

```python
def validate_article(article):
    required = ['external_id', 'title', 'slug', 'content', 'category']
    for field in required:
        if field not in article or not article[field]:
            raise ValueError(f'Missing required field: {field}')
    
    if not re.match(r'^[a-z0-9-]+$', article['slug']):
        raise ValueError('Invalid slug format')
    
    return True
```

### 4. Batch Processing for Performance

For large imports, use batching with concurrency:

```javascript
// Process 1000 articles in batches of 50, 5 concurrent requests
const articles = getLargeDataset(); // 1000 articles

for (let i = 0; i < articles.length; i += 50) {
  const batch = articles.slice(i, i + 50);
  await batchUpsertArticles(batch, { concurrency: 5 });
  
  // Optional: delay between batches
  await sleep(1000);
}
```

### 5. Log and Monitor

Always log API interactions for debugging:

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    result = client.upsert_article(article)
    logger.info(f'Article upserted: {result["data"]["article_id"]}')
except Exception as e:
    logger.error(f'Failed to upsert article {article["external_id"]}: {e}')
```

## Troubleshooting

### Common Errors

**"Invalid or expired API key"**
- Check that `ARTIKEL_API_KEY` environment variable is set
- Verify API key is active in database
- Check API key hasn't expired

**"Slug already exists for another article"**
- Use different slug or update existing article using same external_id
- Check for duplicate slugs in your source data

**"Rate limit exceeded"**
- Reduce concurrency
- Implement delays between batches
- Contact support for rate limit increase

**"Missing required field"**
- Validate all required fields: external_id, title, slug, content, category
- Check field data types match API specification

### Debug Mode

Enable verbose logging in clients:

```javascript
// Node.js
const DEBUG = true;
if (DEBUG) console.log('Request payload:', JSON.stringify(payload));
```

```python
# Python
import http.client as http_client
http_client.HTTPConnection.debuglevel = 1
```

```php
// PHP
curl_setopt($ch, CURLOPT_VERBOSE, true);
```

---

**Last Updated:** 2026-09-11  
**Maintained By:** maskhar
