"use client";

import { useSidebar } from "@/components/sidebar-context";
import { AppSidebar } from "@/components/app-sidebar";
import { BookOpenText, Code2, Container, ShieldCheck, Zap } from "lucide-react";

const publicEndpoints = [
  [
    "Daftar artikel",
    "GET /api/v1/articles?category=teknologi&page=1&limit=10",
    "Wajib category. page mulai 1, limit maksimum 50.",
  ],
  [
    "Detail artikel",
    "GET /api/v1/articles/{slug}",
    "Mengembalikan content, SEO, kategori, tag, dan metadata publikasi.",
  ],
] as const;

const automationEndpoint = [
  [
    "Upsert artikel",
    "POST /functions/v1/automation-api",
    "Create atau update artikel dari sistem eksternal. Wajib: external_id, title, content.",
  ],
] as const;

const examples = {
  publicNext: `const response = await fetch(\n  \`\${process.env.ARTIKEL_API_URL}/api/v1/articles?category=teknologi&page=1&limit=10\`,\n  {\n    headers: { "x-artikel-key": process.env.ARTIKEL_API_KEY! },\n    next: { revalidate: 60 },\n  },\n);\nconst { data, meta } = await response.json();`,
  automationNext: `const response = await fetch(\n  'https://supabase.maskhar.net/functions/v1/automation-api',\n  {\n    method: 'POST',\n    headers: {\n      'x-api-key': process.env.AUTOMATION_API_KEY!,\n      'Content-Type': 'application/json',\n    },\n    body: JSON.stringify({\n      external_id: 'wp-12345',\n      title: 'Judul Artikel',\n      content: '<p>Konten artikel</p>',\n      excerpt: 'Ringkasan',\n      tags: ['tech', 'news'],\n      status: 'draft',\n    }),\n  }\n);\nconst result = await response.json();`,
  vite: `// Browser hanya memanggil backend milik aplikasi.\n// Simpan ARTIKEL_API_KEY pada backend/serverless function.\nconst response = await fetch("/api/articles?category=teknologi");\nconst { data } = await response.json();`,
  laravel: `$response = Http::withHeaders([\n    'x-artikel-key' => config('services.artikel.key'),\n])->get(config('services.artikel.url') . '/api/v1/articles', [\n    'category' => 'teknologi', 'page' => 1, 'limit' => 10,\n]);\n$articles = $response->throw()->json('data');`,
  php: `$ch = curl_init('https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10');\ncurl_setopt_array($ch, [\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_HTTPHEADER => ['x-artikel-key: ' . getenv('ARTIKEL_API_KEY')],\n]);\n$body = json_decode(curl_exec($ch), true);`,
  wordpress: `$response = wp_remote_get(ARTIKEL_API_URL . '/api/v1/articles?category=teknologi&page=1&limit=10', [\n    'headers' => ['x-artikel-key' => ARTIKEL_API_KEY],\n    'timeout' => 10,\n]);\n$articles = is_wp_error($response) ? [] :\n    (json_decode(wp_remote_retrieve_body($response), true)['data'] ?? []);`,
  wordpressAutomation: `function push_to_artikel_cms($post_id) {\n    $post = get_post($post_id);\n    \n    $payload = [\n        'external_id' => 'wp-' . $post_id,\n        'title' => $post->post_title,\n        'content' => $post->post_content,\n        'excerpt' => $post->post_excerpt,\n        'status' => $post->post_status === 'publish' ? 'published' : 'draft',\n        'tags' => wp_get_post_tags($post_id, ['fields' => 'names']),\n    ];\n    \n    $response = wp_remote_post(\n        'https://supabase.maskhar.net/functions/v1/automation-api',\n        [\n            'headers' => [\n                'x-api-key' => ARTIKEL_AUTOMATION_KEY,\n                'Content-Type' => 'application/json',\n            ],\n            'body' => json_encode($payload),\n            'timeout' => 30,\n        ]\n    );\n    \n    return !is_wp_error($response);\n}\n\nadd_action('save_post', 'push_to_artikel_cms');`,
  python: `import requests\nimport os\n\ndef push_to_artikel_cms(article):\n    payload = {\n        'external_id': article['external_id'],\n        'title': article['title'],\n        'content': article['content'],\n        'tags': article.get('tags', []),\n        'status': 'draft',\n    }\n    \n    response = requests.post(\n        'https://supabase.maskhar.net/functions/v1/automation-api',\n        headers={\n            'x-api-key': os.getenv('AUTOMATION_API_KEY'),\n            'Content-Type': 'application/json',\n        },\n        json=payload,\n        timeout=30\n    )\n    \n    response.raise_for_status()\n    return response.json()`,
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocsPage() {
  const { collapsed } = useSidebar();
  return (
    <main className="min-h-screen bg-[#f5f7fb] p-3 text-slate-900 sm:p-5 lg:p-7">
      <div
        className={`mx-auto grid max-w-[1800px] gap-5 ${collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}
      >
        <AppSidebar />
        <section className="min-w-0">
          <header className="rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8">
            <div className="flex items-start gap-4">
              <span className="rounded-2xl bg-[#CE181E] p-3">
                <BookOpenText size={24} />
              </span>
              <div>
                <p className="text-sm font-semibold text-red-200">
                  Developer documentation
                </p>
                <h1 className="mt-1 text-3xl font-bold">API Artikel</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Public Read API untuk konsumsi artikel, dan Automation API untuk
                  push artikel dari sistem eksternal. Deployment, autentikasi,
                  endpoint, error, dan contoh integrasi.
                </p>
              </div>
            </div>
          </header>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              {/* Public Read API */}
              <section className="rounded-3xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-blue-600 p-2 text-white">
                    <BookOpenText size={20} />
                  </span>
                  <h2 className="text-xl font-bold">Public Read API</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Untuk membaca artikel yang sudah published dari website Anda.
                  Base URL{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-1">
                    https://cms.carubra.com
                  </code>
                  . Header{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-1">
                    x-artikel-key
                  </code>
                  .
                </p>
                <CodeBlock>{`curl "https://cms.carubra.com/api/v1/articles?category=teknologi&page=1&limit=10" \\\n  -H "x-artikel-key: art_live_xxxxxxxxx"`}</CodeBlock>
                <div className="mt-4 space-y-3">
                  {publicEndpoints.map(([title, endpoint, note]) => (
                    <article
                      key={title}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <p className="font-semibold">{title}</p>
                      <code className="mt-2 block overflow-x-auto text-sm text-blue-600">
                        {endpoint}
                      </code>
                      <p className="mt-2 text-sm text-slate-500">{note}</p>
                    </article>
                  ))}
                </div>
              </section>

              {/* Automation API */}
              <section className="rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-amber-600 p-2 text-white">
                    <Zap size={20} />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold">Automation API</h2>
                    <span className="text-xs font-semibold text-amber-700">
                      NEW
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Push artikel dari sistem eksternal (WordPress, custom CMS, dll).
                  Mendukung create dan update dengan single endpoint (upsert). Base
                  URL{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-1">
                    https://supabase.maskhar.net/functions/v1
                  </code>
                  . Header{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-1">
                    x-api-key
                  </code>
                  .
                </p>
                <CodeBlock>{`curl -X POST "https://supabase.maskhar.net/functions/v1/automation-api" \\\n  -H "x-api-key: your_automation_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "external_id": "wp-12345",\n    "title": "Judul Artikel",\n    "content": "<p>Konten artikel</p>",\n    "excerpt": "Ringkasan",\n    "tags": ["tech", "news"],\n    "status": "draft"\n  }'`}</CodeBlock>
                <div className="mt-4 space-y-3">
                  {automationEndpoint.map(([title, endpoint, note]) => (
                    <article
                      key={title}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <p className="font-semibold">{title}</p>
                      <code className="mt-2 block overflow-x-auto text-sm text-amber-600">
                        {endpoint}
                      </code>
                      <p className="mt-2 text-sm text-slate-500">{note}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Request Body Fields
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    <li>
                      <strong>Required:</strong> external_id, title, content
                    </li>
                    <li>
                      <strong>Optional:</strong> slug, excerpt, category_name,
                      category_id, tags, featured_image_url, status, seo_title,
                      meta_description, canonical_url, robots, og_image_url,
                      published_at
                    </li>
                  </ul>
                </div>
              </section>

              {/* Integration Examples */}
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-xl font-bold">Next.js - Public Read API</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Fetch dari Server Component atau Route Handler. Jangan gunakan
                  prefix <code>NEXT_PUBLIC_</code> untuk key.
                </p>
                <CodeBlock>{examples.publicNext}</CodeBlock>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-xl font-bold">Next.js - Automation API</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Push artikel dari Next.js app ke CMS Artikel.
                </p>
                <CodeBlock>{examples.automationNext}</CodeBlock>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-xl font-bold">WordPress - Read API</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Simpan URL dan key pada <code>wp-config.php</code>. Fetch dari
                  theme/plugin menggunakan HTTP API WordPress.
                </p>
                <CodeBlock>{examples.wordpress}</CodeBlock>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-xl font-bold">
                  WordPress - Automation API (Push)
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Plugin untuk push artikel WordPress ke CMS Artikel secara
                  otomatis saat save post.
                </p>
                <CodeBlock>{examples.wordpressAutomation}</CodeBlock>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-xl font-bold">Python - Automation API</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Push artikel dari Python app, script, atau CMS berbasis Python.
                </p>
                <CodeBlock>{examples.python}</CodeBlock>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-xl font-bold">Vite dan SPA</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Gunakan backend/serverless proxy. Variable <code>VITE_*</code>{" "}
                  masuk bundle browser dan tidak aman untuk API key.
                </p>
                <CodeBlock>{examples.vite}</CodeBlock>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-xl font-bold">Laravel dan PHP</h2>
                <CodeBlock>{examples.laravel}</CodeBlock>
                <CodeBlock>{examples.php}</CodeBlock>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-red-100 bg-red-50 p-5">
                <div className="flex items-center gap-2 font-bold text-red-900">
                  <ShieldCheck size={18} /> Keamanan
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>Key hanya server-side.</li>
                  <li>Key terpisah per environment.</li>
                  <li>
                    API berbeda: <code>x-artikel-key</code> (read) vs{" "}
                    <code>x-api-key</code> (automation).
                  </li>
                  <li>Gunakan HTTPS.</li>
                  <li>Rotasi sebelum revoke key lama.</li>
                  <li>Monitor via Audit Logs.</li>
                </ul>
              </section>

              <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <Zap size={18} /> Automation API Features
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>
                    <strong>Upsert:</strong> Create atau update dengan
                    external_id
                  </li>
                  <li>
                    <strong>Auto Category:</strong> Buat kategori jika belum ada
                  </li>
                  <li>
                    <strong>Tag Sync:</strong> Tags otomatis di-sync
                  </li>
                  <li>
                    <strong>Status Control:</strong> Draft hingga published
                  </li>
                </ul>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 font-bold">
                  <Container size={18} /> Deployment
                </div>
                <CodeBlock>{`ssh maskhar@supabase-server\ncd ~/apps/cms-artikel\ngit pull\ndocker compose up -d --build\ndocker logs cms-artikel --tail 100`}</CodeBlock>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 font-bold">
                  <Code2 size={18} /> Rate limit
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Default 120 request per 60 detik. Baca header{" "}
                  <code>X-RateLimit-Remaining</code> dan hormati{" "}
                  <code>Retry-After</code> saat status 429.
                </p>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  📚 Docs
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <a
                    href="/docs/API-DEPLOYMENT.md"
                    className="block text-blue-600 hover:underline"
                  >
                    → Full Deployment Guide
                  </a>
                  <a
                    href="/docs/AUTOMATION-API-USAGE.md"
                    className="block text-blue-600 hover:underline"
                  >
                    → Automation API Usage
                  </a>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
