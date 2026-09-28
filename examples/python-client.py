"""
Python Client for Artikel CMS Automation API
Usage: python examples/python-client.py

STATUS: POST ke Automation API saat ini mengembalikan 500. Penyebabnya bug di
fungsi database artikel.upsert_automation_article, bukan di client ini. Kontrak
request di bawah sudah benar dan tidak akan berubah setelah perbaikan.
Lihat docs/API.md. GET pada endpoint yang sama berfungsi normal (check_site()).
"""

import os
import time
from typing import List, Dict, Tuple
from datetime import datetime
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://supabase.carubra.com')
API_KEY = os.getenv('AUTOMATION_API_KEY')

if not API_KEY:
    raise ValueError(
        'AUTOMATION_API_KEY environment variable not set. '
        'Key otomasi berawalan "ak_live_"; buat lewat CMS: Pengaturan > API Keys.'
    )

API_ENDPOINT = f'{SUPABASE_URL}/functions/v1/automation-api'


class ArtikelAPIClient:
    """Client for Artikel CMS Automation API"""

    def __init__(self, api_key: str, base_url: str = SUPABASE_URL):
        self.api_key = api_key
        self.endpoint = f'{base_url}/functions/v1/automation-api'
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'x-api-key': api_key,
        })

    def check_site(self) -> Dict:
        """
        Verifikasi API key dan identitas site.

        Ini satu-satunya jalur Automation API yang berfungsi penuh saat ini.

        Returns:
            {'success': True, 'site': {'id', 'name', 'domain', 'slug'}}
        """
        response = self.session.get(self.endpoint)
        response.raise_for_status()
        return response.json()

    def upsert_article(self, article_data: Dict) -> Dict:
        """
        Create or update an article (upsert by external_id)

        Args:
            article_data: Dictionary containing article fields

        Returns:
            {'success': True, 'site': {...}, 'data': [{'article_id', ...}]}

        Raises:
            requests.HTTPError: If API request fails
        """
        # Body dikirim flat, bukan envelope {'action', 'data'}.
        # Wajib: external_id, title, slug, content, category_name.
        payload = {
            'external_id': article_data['external_id'],
            'title': article_data['title'],
            'slug': article_data['slug'],
            'content': article_data['content'],
            'excerpt': article_data.get('excerpt'),
            'category_name': article_data['category_name'],
            'status': article_data.get('status', 'draft'),
            'featured_image': article_data.get('featured_image'),
            'meta_description': article_data.get('meta_description'),
            'meta_keywords': article_data.get('meta_keywords'),
            'published_at': article_data.get('published_at'),
        }

        response = self.session.post(self.endpoint, json=payload)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def first_row(result: Dict) -> Dict:
        """
        Ambil baris pertama dari result['data'].

        RPC memakai RETURNS TABLE sehingga data berupa list of dict dengan
        kolom: article_id, revision_id, created_new, category_id.
        """
        data = result.get('data')
        if isinstance(data, list):
            return data[0] if data else {}
        return data or {}

    def batch_upsert_articles(
        self,
        articles: List[Dict],
        max_workers: int = 5,
        retry_attempts: int = 3,
        retry_delay: float = 1.0
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Batch upsert multiple articles with concurrency and retry logic
        
        Args:
            articles: List of article dictionaries
            max_workers: Number of concurrent requests
            retry_attempts: Number of retry attempts per article
            retry_delay: Initial delay between retries (seconds)
            
        Returns:
            Tuple of (success_list, failed_list)
        """
        success = []
        failed = []

        def process_article(article: Dict) -> Tuple[bool, Dict]:
            """Process single article with retry logic"""
            last_error = None
            
            for attempt in range(1, retry_attempts + 1):
                try:
                    result = self.upsert_article(article)
                    row = self.first_row(result)
                    return True, {
                        'external_id': article['external_id'],
                        'article_id': row.get('article_id'),
                        'created_new': row.get('created_new'),
                    }
                except requests.HTTPError as e:
                    last_error = e
                    
                    if attempt < retry_attempts:
                        # Exponential backoff
                        delay = retry_delay * (2 ** (attempt - 1))
                        time.sleep(delay)
                except Exception as e:
                    last_error = e
                    break
            
            return False, {
                'external_id': article['external_id'],
                'error': str(last_error),
            }

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(process_article, article): article
                for article in articles
            }

            for i, future in enumerate(as_completed(futures), 1):
                is_success, result = future.result()
                
                if is_success:
                    success.append(result)
                else:
                    failed.append(result)
                
                # Progress logging
                if i % 10 == 0 or i == len(articles):
                    print(f'Processed {i}/{len(articles)} articles')

        return success, failed


def example_create_article():
    """Example 1: Create a single article"""
    print('Example 1: Create new article')
    
    client = ArtikelAPIClient(API_KEY)
    
    article_data = {
        'external_id': 'python-blog-001',
        'title': 'Python Best Practices 2026',
        'slug': 'python-best-practices-2026',
        'content': '<h1>Python Best Practices</h1><p>Here are the top practices...</p>',
        'excerpt': 'Learn the best practices for Python development in 2026.',
        'category_name': 'Programming',
        'status': 'published',
        'featured_image': 'sites/contoh/articles/python.jpg',
        'meta_description': 'Complete guide to Python best practices',
        'meta_keywords': ['python', 'best practices', 'programming'],
        'published_at': datetime.utcnow().isoformat() + 'Z',
    }
    
    try:
        result = client.upsert_article(article_data)
        print(f'✓ Article created: {result["data"]}')
    except requests.HTTPError as e:
        print(f'✗ Failed: {e.response.text}')


def example_update_article():
    """Example 2: Update existing article"""
    print('\nExample 2: Update existing article')
    
    client = ArtikelAPIClient(API_KEY)
    
    article_data = {
        'external_id': 'python-blog-001',
        'title': 'Python Best Practices 2026 (Updated)',
        'slug': 'python-best-practices-2026',
        'content': '<h1>Python Best Practices Updated</h1><p>Updated content...</p>',
        'excerpt': 'Updated guide to Python best practices.',
        'category_name': 'Programming',
        'status': 'published',
    }
    
    try:
        result = client.upsert_article(article_data)
        row = client.first_row(result)
        print(f'✓ Article updated: article_id={row.get("article_id")}, '
              f'created_new={row.get("created_new")}')
    except requests.HTTPError as e:
        print(f'✗ Failed: {e.response.text}')


def example_batch_import():
    """Example 3: Batch import articles"""
    print('\nExample 3: Batch import 20 articles')
    
    client = ArtikelAPIClient(API_KEY)
    
    articles = [
        {
            'external_id': f'batch-python-{i}',
            'title': f'Batch Article {i}',
            'slug': f'batch-article-{i}',
            'content': f'<p>Content for batch article {i}</p>',
            'excerpt': f'Excerpt for article {i}',
            'category_name': 'Batch Import',
            'status': 'draft',
        }
        for i in range(1, 21)
    ]
    
    try:
        success, failed = client.batch_upsert_articles(
            articles,
            max_workers=5,
            retry_attempts=2
        )
        
        print(f'✓ Batch complete: {len(success)} succeeded, {len(failed)} failed')
        
        if failed:
            print(f'Failed articles: {failed}')
    except Exception as e:
        print(f'✗ Batch failed: {e}')


def example_rss_import():
    """Example 4: Import from RSS feed"""
    print('\nExample 4: Import from RSS feed')
    
    # Note: Requires feedparser: pip install feedparser
    try:
        import feedparser
    except ImportError:
        print('⚠ Skipped: feedparser not installed (pip install feedparser)')
        return
    
    client = ArtikelAPIClient(API_KEY)
    
    # Example RSS feed URL
    feed_url = 'https://example.com/rss'
    
    try:
        feed = feedparser.parse(feed_url)
        
        articles = []
        for entry in feed.entries[:5]:  # Limit to 5 for demo
            articles.append({
                'external_id': f'rss-{entry.id}',
                'title': entry.title,
                'slug': entry.title.lower().replace(' ', '-')[:50],
                'content': entry.content[0].value if hasattr(entry, 'content') else entry.summary,
                'excerpt': entry.summary[:200],
                'category_name': 'RSS Import',
                'status': 'draft',
                'published_at': datetime(*entry.published_parsed[:6]).isoformat() + 'Z',
            })
        
        success, failed = client.batch_upsert_articles(articles)
        print(f'✓ RSS import complete: {len(success)} articles imported')
        
    except Exception as e:
        print(f'✗ RSS import failed: {e}')


def main():
    """Run all examples"""
    print('=== Artikel CMS Automation API - Python Client ===\n')

    # Verifikasi key dan site lebih dulu (jalur yang berfungsi).
    print('Example 0: Verifikasi API key dan site')
    try:
        info = ArtikelAPIClient(API_KEY).check_site()
        print(f'✓ Key valid untuk site: {info.get("site")}\n')
    except requests.HTTPError as e:
        print(f'✗ Gagal: {e.response.text}')
        return

    example_create_article()
    example_update_article()
    example_batch_import()
    example_rss_import()
    
    print('\n=== Examples completed ===')


if __name__ == '__main__':
    main()
