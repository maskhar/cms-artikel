# Skrip Operasional

Jalankan dari root repository menggunakan PowerShell:

```powershell
.\scripts\deploy.ps1
.\scripts\test-edge-function.ps1
```

`deploy.ps1` memerlukan SSH dan rsync. Skrip menyinkronkan root repository dan membangun ulang container CMS production; jangan jalankan untuk validasi lokal.

`test-edge-function.ps1` memerlukan API key tenant pada placeholder `YOUR_API_KEY_HERE` dan membuat artikel draft. Jangan commit API key yang sudah diisi.

Konfigurasi Docker tetap di root. SQL migrasi tetap di `supabase/migrations`; SQL hotfix manual berada di `supabase/manual`.
