import { notificationsTable, type Vendor } from "@workspace/db";

type AlertType = "order" | "return" | "inventory" | "payout" | "system";
type NotificationExecutor = {
  insert: typeof import("@workspace/db").db.insert;
};

const preferenceForType: Record<AlertType, string | undefined> = {
  order: "orderAlerts",
  return: "returnAlerts",
  inventory: "lowStockAlerts",
  payout: "payoutAlerts",
  system: undefined,
};

/**
 * Persists a vendor-facing alert. In-app alerts are deliberately the only
 * delivery channel until a WhatsApp provider is configured elsewhere.
 */
export async function createVendorAlert(
  tx: NotificationExecutor,
  vendor: Vendor,
  alert: { type: AlertType; title: string; body: string; href?: string },
) {
  const preference = preferenceForType[alert.type];
  if (preference && vendor.notificationPreferences?.[preference] === false) return undefined;

  const [notification] = await tx.insert(notificationsTable).values({
    userId: vendor.userId,
    type: alert.type,
    title: alert.title.slice(0, 160),
    body: alert.body.slice(0, 1000),
    href: alert.href?.slice(0, 500),
  }).returning();

  return notification;
}