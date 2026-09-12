export async function registerMedia(storagePath: string, file: File) {
  const response = await fetch("/api/cms/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storagePath,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      altText: file.name.replace(/\.[^.]+$/, ""),
    }),
  }).catch(() => null);
  if (!response) return "Koneksi gagal saat mencatat media. Coba unggah ulang.";
  if (response.ok) return null;
  const body = await response.json().catch(() => null);
  return body?.error ?? "Metadata media gagal disimpan.";
}
