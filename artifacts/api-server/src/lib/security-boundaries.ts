export type VendorStatus = "pending" | "approved" | "rejected";
export type OrderStatus = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";
export interface OrderActor {
  userId: number;
  role: string;
}

export interface OrderOwner {
  userId: number;
}

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function hasActiveAccount(isSuspended: boolean): boolean {
  return !isSuspended;
}

export function hasApprovedVendorAccess(vendorStatus: VendorStatus | null | undefined): boolean {
  return vendorStatus === "approved";
}

export function canAccessVendorWorkspace(
  vendorStatus: VendorStatus | null | undefined,
  isSuspended: boolean,
): boolean {
  return hasActiveAccount(isSuspended) && hasApprovedVendorAccess(vendorStatus);
}

export function canAccessCustomerOrder(order: OrderOwner | undefined, actor: OrderActor): boolean {
  if (!order) return false;
  return actor.role === "admin" || order.userId === actor.userId;
}

export function vendorItemsForOrder<T extends { vendorId: number }>(items: readonly T[], vendorId: number): T[] {
  return items.filter(item => item.vendorId === vendorId);
}

export function isMixedVendorOrder<T extends { vendorId: number }>(items: readonly T[]): boolean {
  return new Set(items.map(item => item.vendorId)).size > 1;
}

export function canRequestOrderStatusUpdate({
  actor,
  vendorOwnsOrderItem,
  mixedVendorOrder,
  order,
  nextStatus,
}: {
  actor: OrderActor;
  vendorOwnsOrderItem: boolean;
  mixedVendorOrder: boolean;
  order: OrderOwner;
  nextStatus: OrderStatus;
}): boolean {
  return actor.role === "admin" ||
    (actor.role === "vendor" && vendorOwnsOrderItem && !mixedVendorOrder) ||
    (order.userId === actor.userId && nextStatus === "cancelled");
}

export function canSetOrderStatus(actor: OrderActor, nextStatus: OrderStatus): boolean {
  return actor.role === "admin" || nextStatus !== "delivered";
}

export function isAllowedOrderTransition(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}