<?php
/**
 * PHP Client for Artikel CMS Automation API
 * Usage: php examples/php-client.php
 */

class ArtikelAPIClient
{
    private string $apiKey;
    private string $endpoint;
    
    public function __construct(string $apiKey, string $baseUrl)
    {
        $this->apiKey = $apiKey;
        $this->endpoint = rtrim($baseUrl, '/') . '/functions/v1/artikel-cms';
    }
    
    /**
     * Create or update an article
     *
     * @param array $articleData Article data
     * @return array API response
     * @throws Exception If API request fails
     */
    public function upsertArticle(array $articleData): array
    {
        $payload = [
            'action' => 'article.upsert',
            'data' => [
                'external_id' => $articleData['external_id'],
                'title' => $articleData['title'],
                'slug' => $articleData['slug'],
                'content' => $articleData['content'],
                'excerpt' => $articleData['excerpt'] ?? null,
                'category' => $articleData['category'],
                'status' => $articleData['status'] ?? 'draft',
                'featured_image' => $articleData['featured_image'] ?? null,
                'meta_description' => $articleData['meta_description'] ?? null,
                'meta_keywords' => $articleData['meta_keywords'] ?? null,
                'published_at' => $articleData['published_at'] ?? null,
            ]
        ];
        
        $ch = curl_init($this->endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-artikel-key: ' . $this->apiKey,
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            throw new Exception("cURL Error: $error");
        }
        
        $data = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $message = $data['error']['message'] ?? 'Unknown error';
            throw new Exception("API Error ($httpCode): $message");
        }
        
        return $data;
    }
    
    /**
     * Batch upsert multiple articles
     *
     * @param array $articles Array of article data
     * @param int $retryAttempts Number of retry attempts
     * @return array ['success' => [], 'failed' => []]
     */
    public function batchUpsertArticles(array $articles, int $retryAttempts = 3): array
    {
        $results = [
            'success' => [],
            'failed' => [],
        ];
        
        foreach ($articles as $i => $article) {
            $lastError = null;
            
            for ($attempt = 1; $attempt <= $retryAttempts; $attempt++) {
                try {
                    $result = $this->upsertArticle($article);
                    $results['success'][] = [
                        'external_id' => $article['external_id'],
                        'article_id' => $result['data']['article_id'],
                        'created' => $result['data']['created'],
                    ];
                    break;
                } catch (Exception $e) {
                    $lastError = $e->getMessage();
                    
                    if ($attempt < $retryAttempts) {
                        // Exponential backoff
                        $delay = 1000000 * pow(2, $attempt - 1); // microseconds
                        usleep($delay);
                    }
                }
            }
            
            if ($lastError) {
                $results['failed'][] = [
                    'external_id' => $article['external_id'],
                    'error' => $lastError,
                ];
            }
            
            // Progress logging
            if (($i + 1) % 10 === 0 || $i + 1 === count($articles)) {
                echo "Processed " . ($i + 1) . "/" . count($articles) . " articles\n";
            }
        }
        
        return $results;
    }
}

// Example usage
function main()
{
    $apiKey = getenv('ARTIKEL_API_KEY');
    $supabaseUrl = getenv('SUPABASE_URL') ?: 'https://your-project.supabase.co';
    
    if (!$apiKey) {
        die("Error: ARTIKEL_API_KEY environment variable not set\n");
    }
    
    $client = new ArtikelAPIClient($apiKey, $supabaseUrl);
    
    echo "=== Artikel CMS Automation API - PHP Client ===\n\n";
    
    // Example 1: Create single article
    echo "Example 1: Create new article\n";
    try {
        $result = $client->upsertArticle([
            'external_id' => 'php-blog-001',
            'title' => 'PHP 8.3 Features You Should Know',
            'slug' => 'php-83-features-you-should-know',
            'content' => '<h1>PHP 8.3 Features</h1><p>Discover the latest features...</p>',
            'excerpt' => 'Explore the new features in PHP 8.3',
            'category' => 'PHP',
            'status' => 'published',
            'featured_image' => 'https://example.com/images/php83.jpg',
            'meta_description' => 'Complete guide to PHP 8.3 features',
            'meta_keywords' => ['php', 'php 8.3', 'features'],
            'published_at' => date('c'),
        ]);
        
        echo "✓ Article created: " . json_encode($result['data']) . "\n";
    } catch (Exception $e) {
        echo "✗ Failed: " . $e->getMessage() . "\n";
    }
    
    echo "\n---\n\n";
    
    // Example 2: Update existing article
    echo "Example 2: Update existing article\n";
    try {
        $result = $client->upsertArticle([
            'external_id' => 'php-blog-001',
            'title' => 'PHP 8.3 Features You Should Know (Updated)',
            'slug' => 'php-83-features-you-should-know',
            'content' => '<h1>PHP 8.3 Features - Updated</h1><p>Updated content...</p>',
            'excerpt' => 'Updated: Explore the new features in PHP 8.3',
            'category' => 'PHP',
            'status' => 'published',
        ]);
        
        echo "✓ Article updated: article_id={$result['data']['article_id']}, " .
             "created=" . ($result['data']['created'] ? 'true' : 'false') . "\n";
    } catch (Exception $e) {
        echo "✗ Failed: " . $e->getMessage() . "\n";
    }
    
    echo "\n---\n\n";
    
    // Example 3: Batch import
    echo "Example 3: Batch import 15 articles\n";
    $articles = [];
    for ($i = 1; $i <= 15; $i++) {
        $articles[] = [
            'external_id' => "batch-php-{$i}",
            'title' => "Batch Article {$i}",
            'slug' => "batch-article-{$i}",
            'content' => "<p>Content for batch article {$i}</p>",
            'excerpt' => "Excerpt {$i}",
            'category' => 'Batch Import',
            'status' => 'draft',
        ];
    }
    
    try {
        $results = $client->batchUpsertArticles($articles, 2);
        
        echo "✓ Batch complete: " . count($results['success']) . " succeeded, " .
             count($results['failed']) . " failed\n";
        
        if (!empty($results['failed'])) {
            echo "Failed articles: " . json_encode($results['failed']) . "\n";
        }
    } catch (Exception $e) {
        echo "✗ Batch failed: " . $e->getMessage() . "\n";
    }
    
    echo "\n---\n\n";
    
    // Example 4: WordPress import simulation
    echo "Example 4: WordPress import simulation\n";
    
    // Simulate WordPress posts data
    $wpPosts = [
        [
            'ID' => 101,
            'post_title' => 'My WordPress Post 1',
            'post_name' => 'my-wordpress-post-1',
            'post_content' => '<p>WordPress content 1</p>',
            'post_excerpt' => 'WordPress excerpt 1',
            'post_status' => 'publish',
            'post_date' => '2026-09-01 10:00:00',
        ],
        [
            'ID' => 102,
            'post_title' => 'My WordPress Post 2',
            'post_name' => 'my-wordpress-post-2',
            'post_content' => '<p>WordPress content 2</p>',
            'post_excerpt' => 'WordPress excerpt 2',
            'post_status' => 'publish',
            'post_date' => '2026-09-05 15:30:00',
        ],
    ];
    
    $importArticles = [];
    foreach ($wpPosts as $post) {
        $importArticles[] = [
            'external_id' => 'wp-' . $post['ID'],
            'title' => $post['post_title'],
            'slug' => $post['post_name'],
            'content' => $post['post_content'],
            'excerpt' => $post['post_excerpt'],
            'category' => 'WordPress Import',
            'status' => $post['post_status'] === 'publish' ? 'published' : 'draft',
            'published_at' => date('c', strtotime($post['post_date'])),
        ];
    }
    
    try {
        $results = $client->batchUpsertArticles($importArticles);
        echo "✓ WordPress import complete: " . count($results['success']) . " posts imported\n";
    } catch (Exception $e) {
        echo "✗ WordPress import failed: " . $e->getMessage() . "\n";
    }
    
    echo "\n=== Examples completed ===\n";
}

// Run examples
if (php_sapi_name() === 'cli') {
    main();
}
