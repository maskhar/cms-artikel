# Changelog

All notable changes to the Artikel CMS project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-10

### Added

#### Automation API
- **External ID support**: Added `external_id` column to articles table with unique constraint per site
- **Upsert function**: PostgreSQL function `upsert_automation_article` for atomic create/update operations
- **Edge Function**: Public API endpoint `/functions/v1/artikel-cms` for automation
- **API key authentication**: Secure authentication via `x-artikel-key` header
- **Rate limiting**: 120 requests per minute per API key
- **Automatic category management**: Auto-create and reuse categories by name
- **Revision tracking**: Automatic revision creation on every upsert
- **Slug conflict detection**: Prevents duplicate slugs within same site
- **Tenant isolation**: RLS policies ensure proper site-scoped access

#### Testing
- **Integration tests**: 5 SQL tests for database function validation
- **E2E tests**: 7 comprehensive tests covering full API flow
- **Test runners**: Both Bash and PowerShell test scripts
- **Test documentation**: Complete guide in `tests/README.md`

#### Client Examples
- **Node.js client**: Full-featured client with batch processing and retry logic
- **Python client**: Object-oriented client with threading support
- **PHP client**: cURL-based client with WordPress migration example
- **Usage examples**: RSS import, webhook integration, scheduled publishing

#### Documentation
- **Deployment guide**: 4-phase deployment plan (local → staging → UAT → production)
- **API summary**: Complete feature overview and usage examples
- **Client documentation**: Integration scenarios and best practices
- **Troubleshooting**: Common errors and solutions

### Changed
- Enhanced RLS policies to support automation API access patterns

### Security
- API key SHA-256 hashing for secure storage
- Rate limiting to prevent abuse
- Input validation (slug format, required fields)
- Author validation (must belong to site)

## [1.0.0] - 2026-09-01

### Added
- Initial CMS implementation
- Multi-tenant architecture
- Article management (CRUD)
- Category system
- User roles (admin, editor, viewer)
- Gallery management
- Audit logging
- API key management
- Supabase integration

---

[1.1.0]: https://github.com/your-org/cms-artikel/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/your-org/cms-artikel/releases/tag/v1.0.0
