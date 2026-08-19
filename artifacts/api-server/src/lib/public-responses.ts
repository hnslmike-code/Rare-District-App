export interface PublicVendorSource {
  id: number;
  brandName: string;
  description: string | null;
  category: string | null;
  logoUrl: string | null;
  website: string | null;
  socialLink: string | null;
  status: string;
  createdAt: Date;
}

/**
 * Public endpoints must use this projection instead of returning vendor records.
 * It intentionally excludes contact, account, payout, user, and moderation data.
 */
export function formatPublicVendor(vendor: PublicVendorSource) {
  return {
    id: vendor.id,
    brandName: vendor.brandName,
    description: vendor.description,
    category: vendor.category,
    logoUrl: vendor.logoUrl,
    website: vendor.website,
    socialLink: vendor.socialLink,
    status: vendor.status,
    createdAt: vendor.createdAt,
  };
}