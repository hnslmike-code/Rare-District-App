export async function vendorJson<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    const body = await response.json().catch(() => null) as { error?: string; details?: string[] } | null;
    throw new Error(body?.details?.join(" ") || body?.error || "The vendor request could not be completed.");
  }

  return response.json() as Promise<T>;
}

export async function downloadInventoryExport(productId: number) {
  const token = localStorage.getItem("token");
  const response = await fetch(`/api/vendors/inventory/variants/export?productId=${productId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Inventory export could not be prepared.");

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = "rare-district-variant-inventory.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}