export function mediaStoragePath(folder: string, fileName: string) {
  const originalName = fileName.replace(/[\\/\u0000-\u001f]/g, "_").trim() || "file";
  return `${folder}/${crypto.randomUUID()}/${originalName}`;
}
