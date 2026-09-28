// JavaScript/Node.js Client for Artikel CMS Automation API
// Usage: node examples/nodejs-client.js
//
// ⚠️  STATUS: POST ke Automation API saat ini mengembalikan 500.
//     Penyebabnya bug di fungsi database artikel.upsert_automation_article,
//     bukan di client ini. Kontrak request di bawah sudah benar dan tidak
//     akan berubah setelah perbaikan. Lihat docs/API.md untuk detail.
//     GET pada endpoint yang sama berfungsi normal (lihat checkSite()).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.carubra.com';
const API_KEY = process.env.AUTOMATION_API_KEY;

if (!API_KEY) {
  console.error('Error: AUTOMATION_API_KEY environment variable not set');
  console.error('Key otomasi berawalan "ak_live_". Buat lewat CMS: Pengaturan > API Keys.');
  process.exit(1);
}

const API_ENDPOINT = `${SUPABASE_URL}/functions/v1/automation-api`;

/**
 * Verifikasi API key dan identitas site.
 * Ini satu-satunya jalur Automation API yang berfungsi penuh saat ini.
 * @returns {Promise<Object>} { success, site: { id, name, domain, slug } }
 */
async function checkSite() {
  const response = await fetch(API_ENDPOINT, {
    method: 'GET',
    headers: { 'x-api-key': API_KEY },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'API request failed');
  return data;
}

/**
 * Create or update an article (upsert by external_id)
 * @param {Object} articleData - Article data
 * @returns {Promise<Object>} { success, site, data }
 */
async function upsertArticle(articleData) {
  // Body dikirim flat, bukan envelope { action, data }.
  // Wajib: external_id, title, slug, content, category_name.
  const payload = {
    external_id: articleData.externalId,
    title: articleData.title,
    slug: articleData.slug,
    content: articleData.content,
    excerpt: articleData.excerpt || null,
    category_name: articleData.categoryName,
    status: articleData.status || 'draft',
    featured_image: articleData.featuredImage || null,
    meta_description: articleData.metaDescription || null,
    meta_keywords: articleData.metaKeywords || null,
    published_at: articleData.publishedAt || null,
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(payload),
    });

    // Error dikembalikan flat: { error: "pesan" }, bukan { error: { message } }.
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
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
          // Bentuk result.data mengikuti RETURNS TABLE milik RPC:
          // { article_id, revision_id, created_new, category_id }
          const row = Array.isArray(result.data) ? result.data[0] : result.data;
          results.success.push({
            external_id: article.externalId,
            article_id: row?.article_id,
            created_new: row?.created_new,
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

  // Example 0: verifikasi key dan site (jalur yang berfungsi)
  console.log('Example 0: Verifikasi API key dan site');
  try {
    const info = await checkSite();
    console.log('✓ Key valid untuk site:', info.site);
  } catch (error) {
    console.error('✗ Gagal:', error.message);
    return;
  }

  console.log('\n---\n');

  // Example 1: Create single article
  console.log('Example 1: Create new article');
  try {
    const result = await upsertArticle({
      externalId: 'blog-post-001',
      title: 'Getting Started with Our CMS',
      slug: 'getting-started-with-cms',
      content: '<h1>Welcome</h1><p>This is a comprehensive guide...</p>',
      excerpt: 'Learn how to get started with our CMS platform.',
      categoryName: 'Tutorials',
      status: 'published',
      featuredImage: 'sites/contoh/articles/getting-started.jpg',
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
      categoryName: 'Tutorials',
      status: 'published',
      publishedAt: new Date().toISOString(),
    });

    console.log('✓ Article updated:', result.data);
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
    categoryName: 'Batch Import',
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
  checkSite,
  upsertArticle,
  batchUpsertArticles,
};
