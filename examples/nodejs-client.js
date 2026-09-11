// JavaScript/Node.js Client for Artikel CMS Automation API
// Usage: node examples/nodejs-client.js

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const API_KEY = process.env.ARTIKEL_API_KEY;

if (!API_KEY) {
  console.error('Error: ARTIKEL_API_KEY environment variable not set');
  process.exit(1);
}

const API_ENDPOINT = `${SUPABASE_URL}/functions/v1/artikel-cms`;

/**
 * Create or update an article
 * @param {Object} articleData - Article data
 * @returns {Promise<Object>} API response
 */
async function upsertArticle(articleData) {
  const payload = {
    action: 'article.upsert',
    data: {
      external_id: articleData.externalId,
      title: articleData.title,
      slug: articleData.slug,
      content: articleData.content,
      excerpt: articleData.excerpt || null,
      category: articleData.category,
      status: articleData.status || 'draft',
      featured_image: articleData.featuredImage || null,
      meta_description: articleData.metaDescription || null,
      meta_keywords: articleData.metaKeywords || null,
      published_at: articleData.publishedAt || null,
    },
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-artikel-key': API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}

/**
 * Batch upsert multiple articles with retry logic
 * @param {Array} articles - Array of article objects
 * @param {Object} options - Options for batch processing
 */
async function batchUpsertArticles(articles, options = {}) {
  const {
    concurrency = 5,
    retryAttempts = 3,
    retryDelay = 1000,
  } = options;

  const results = {
    success: [],
    failed: [],
  };

  // Process in batches
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);
    
    const promises = batch.map(async (article) => {
      let lastError;
      
      for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        try {
          const result = await upsertArticle(article);
          results.success.push({
            external_id: article.externalId,
            article_id: result.data.article_id,
            created: result.data.created,
          });
          return;
        } catch (error) {
          lastError = error;
          
          if (attempt < retryAttempts) {
            // Exponential backoff
            await new Promise(resolve => 
              setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1))
            );
          }
        }
      }
      
      results.failed.push({
        external_id: article.externalId,
        error: lastError.message,
      });
    });

    await Promise.all(promises);
    
    // Progress logging
    console.log(`Processed ${Math.min(i + concurrency, articles.length)}/${articles.length} articles`);
  }

  return results;
}

// Example usage
async function main() {
  console.log('=== Artikel CMS Automation API - Node.js Client ===\n');

  // Example 1: Create single article
  console.log('Example 1: Create new article');
  try {
    const result = await upsertArticle({
      externalId: 'blog-post-001',
      title: 'Getting Started with Our CMS',
      slug: 'getting-started-with-cms',
      content: '<h1>Welcome</h1><p>This is a comprehensive guide...</p>',
      excerpt: 'Learn how to get started with our CMS platform.',
      category: 'Tutorials',
      status: 'published',
      featuredImage: 'https://example.com/images/getting-started.jpg',
      metaDescription: 'Complete guide to getting started with our CMS',
      metaKeywords: ['cms', 'tutorial', 'getting started'],
      publishedAt: new Date().toISOString(),
    });

    console.log('✓ Article created:', result.data);
  } catch (error) {
    console.error('✗ Failed:', error.message);
  }

  console.log('\n---\n');

  // Example 2: Update existing article
  console.log('Example 2: Update existing article');
  try {
    const result = await upsertArticle({
      externalId: 'blog-post-001',
      title: 'Getting Started with Our CMS (Updated)',
      slug: 'getting-started-with-cms',
      content: '<h1>Welcome</h1><p>This is an updated comprehensive guide...</p>',
      excerpt: 'Learn how to get started with our CMS platform - Updated!',
      category: 'Tutorials',
      status: 'published',
      publishedAt: new Date().toISOString(),
    });

    console.log('✓ Article updated:', {
      article_id: result.data.article_id,
      created: result.data.created,
    });
  } catch (error) {
    console.error('✗ Failed:', error.message);
  }

  console.log('\n---\n');

  // Example 3: Batch import
  console.log('Example 3: Batch import 10 articles');
  const articles = Array.from({ length: 10 }, (_, i) => ({
    externalId: `batch-article-${i + 1}`,
    title: `Batch Article ${i + 1}`,
    slug: `batch-article-${i + 1}`,
    content: `<p>Content for batch article ${i + 1}</p>`,
    excerpt: `Excerpt ${i + 1}`,
    category: 'Batch Import',
    status: 'draft',
  }));

  try {
    const results = await batchUpsertArticles(articles, {
      concurrency: 3,
      retryAttempts: 2,
    });

    console.log(`✓ Batch complete: ${results.success.length} succeeded, ${results.failed.length} failed`);
    
    if (results.failed.length > 0) {
      console.log('Failed articles:', results.failed);
    }
  } catch (error) {
    console.error('✗ Batch failed:', error.message);
  }
}

// Run examples
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  upsertArticle,
  batchUpsertArticles,
};
