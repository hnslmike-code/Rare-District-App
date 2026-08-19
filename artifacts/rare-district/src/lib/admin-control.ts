export async function adminJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "The admin request could not be completed.");
  }
  return response.json() as Promise<T>;
}

export async function downloadAdminExport(resource: "products" | "orders" | "customers" | "transactions") {
  const token = localStorage.getItem("token");
  const response = await fetch(`/api/admin/exports/${resource}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error("Export could not be prepared.");
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `rare-district-${resource}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}