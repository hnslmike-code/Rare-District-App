export function mediaUrl(value?: string | null) {
  if (!value) return undefined;
  if (value.startsWith("/objects/")) return `/api/storage${value}`;
  if (value.startsWith("http") || value.startsWith("/api/") || value.startsWith("data:") || value.startsWith("blob:")) return value;
  return `/api/storage/objects/${value.replace(/^\/+/, "")}`;
}