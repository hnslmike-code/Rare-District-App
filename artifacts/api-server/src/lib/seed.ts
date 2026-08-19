import { db, usersTable, vendorsTable, productsTable, categoriesTable, adminSettingsTable, couponsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { hashPassword, generateReferralCode } from "./auth";
import { logger } from "./logger";
import { ANIKA_STREETWEAR, ZARA_STREETWEAR, buildStreetwearProducts } from "./streetwear";

// TEST-ONLY credential. Change every seeded password before a real launch.
const TEST_PASSWORD = "RareDistrict2026!";

const TEST_ACCOUNTS = [
  { email: "admin@raredistrict.com", name: "Rare District Admin", role: "admin" as const },
  { email: "anika@luxurybyanika.com", name: "Anika Osei", role: "vendor" as const },
  { email: "zara@zarastudiong.com", name: "Zara Adewale", role: "vendor" as const },
  { email: "demo@shopper.com", name: "Demo Shopper", role: "shopper" as const },
  { email: "shopper@raredistrict.com", name: "Rare District Shopper", role: "shopper" as const },
];

const VENDOR_DETAILS = [
  {
    email: "anika@luxurybyanika.com",
    brandName: "Luxury by Anika",
    description: "Handcrafted luxury womenswear with an Afrocentric aesthetic. Every piece tells a story of cultural pride and modern elegance.",
  },
  {
    email: "zara@zarastudiong.com",
    brandName: "Zara Studio NG",
    description: "Contemporary Nigerian fashion bridging traditional craftsmanship with contemporary silhouettes. Known for our signature Adire prints.",
  },
];

const VENDOR_PRODUCTS = [
  [
    { name: "Aso-Oke Wrap Gown", description: "Floor-length wrap gown in hand-woven aso-oke. Available in ivory, burnt orange, and deep teal. Perfect for owambe and formal events.", price: "85000", category: "occasion-wear", sizes: ["XS", "S", "M", "L", "XL"], stock: 12, isFeatured: true },
    { name: "Adire Silk Blouse", description: "Tie-dyed silk blouse in our signature indigo pattern. Effortlessly transitions from day to evening.", price: "45000", category: "womenswear", sizes: ["XS", "S", "M", "L"], stock: 20, isFeatured: true },
    { name: "Gold Embroidered Kaftan", description: "Luxe kaftan in ivory silk with hand-stitched gold embroidery at the neckline and hem. A statement piece.", price: "120000", category: "womenswear", sizes: ["S", "M", "L", "XL", "2XL"], stock: 8, isFeatured: false },
  ],
  [
    { name: "Ankara Power Suit", description: "Bold Ankara print blazer and trousers set. Structured, powerful, unapologetically African.", price: "72000", category: "womenswear", sizes: ["XS", "S", "M", "L", "XL"], stock: 15, isFeatured: true },
    { name: "Batik Slip Dress", description: "Minimal silhouette in hand-drawn batik cotton. The kind of dress you reach for repeatedly.", price: "38000", category: "womenswear", sizes: ["XS", "S", "M", "L"], stock: 25, isFeatured: false },
    { name: "Adire Midi Skirt", description: "A-line midi skirt in our house adire pattern. Pairs with anything, goes everywhere.", price: "28000", category: "womenswear", sizes: ["XS", "S", "M", "L", "XL"], stock: 30, isFeatured: false },
  ],
] as const;

async function ensureTestAccounts() {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const users = new Map<string, typeof usersTable.$inferSelect>();

  for (const account of TEST_ACCOUNTS) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, account.email)).limit(1);
    const [user] = existing
      ? await db.update(usersTable).set({
          name: account.name,
          role: account.role,
          passwordHash,
        }).where(eq(usersTable.id, existing.id)).returning()
      : await db.insert(usersTable).values({
          email: account.email,
          name: account.name,
          passwordHash,
          role: account.role,
          referralCode: account.role === "admin" ? "ADMIN001" : generateReferralCode(),
        }).returning();
    users.set(account.email, user);
  }

  for (const [index, details] of VENDOR_DETAILS.entries()) {
    const user = users.get(details.email);
    if (!user) continue;

    let [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, user.id)).limit(1);
    if (!vendor) {
      [vendor] = await db.insert(vendorsTable).values({
        userId: user.id,
        brandName: details.brandName,
        description: details.description,
        status: "approved",
        bankName: "First Bank Nigeria",
        accountNumber: `301234567${index}`,
        accountName: user.name ?? user.email,
      }).returning();
    } else if (vendor.status !== "approved") {
      [vendor] = await db.update(vendorsTable).set({ status: "approved" }).where(eq(vendorsTable.id, vendor.id)).returning();
    }

    const streetwear = buildStreetwearProducts(index === 0 ? ANIKA_STREETWEAR : ZARA_STREETWEAR);
    const existingProducts = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.vendorId, vendor.id));
    const existingNames = new Set(existingProducts.map((product) => product.name));
    const missingProducts = streetwear
      .filter((product) => !existingNames.has(product.name))
      .map((product) => ({ ...product, vendorId: vendor.id }));
    if (missingProducts.length > 0) {
      await db.insert(productsTable).values(missingProducts);
    }
  }

  logger.info({
    accounts: TEST_ACCOUNTS.map(({ email, role }) => ({ email, role })),
    password: TEST_PASSWORD,
  }, "Rare District test accounts ready (test-only credential)");
}

export async function seedDemoData() {
  // Check if already seeded
  const existing = await db.select().from(usersTable).limit(1);
  if (existing.length > 0) {
    await ensureTestAccounts();
    logger.info("Demo data already seeded, skipping.");
    return;
  }

  logger.info("Seeding demo data...");

  // Admin settings (default commission 5%)
  await db.insert(adminSettingsTable).values({}).onConflictDoNothing();

  // Categories
  const categoryData = [
    { name: "Womenswear", slug: "womenswear", imageUrl: null },
    { name: "Menswear", slug: "menswear", imageUrl: null },
    { name: "Accessories", slug: "accessories", imageUrl: null },
    { name: "Footwear", slug: "footwear", imageUrl: null },
    { name: "Streetwear", slug: "streetwear", imageUrl: null },
    { name: "Occasion Wear", slug: "occasion-wear", imageUrl: null },
  ];
  const insertedCats = await db.insert(categoriesTable).values(categoryData).returning();
  logger.info({ count: insertedCats.length }, "Categories seeded");

  // Admin user
  const [adminUser] = await db.insert(usersTable).values({
    email: "admin@raredistrict.com",
    name: "Rare District Admin",
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: "admin",
    referralCode: "ADMIN001",
  }).returning();

  // Demo vendors
  const vendorUsers = await Promise.all([
    db.insert(usersTable).values({
      email: "anika@luxurybyanika.com",
      name: "Anika Osei",
      passwordHash: await hashPassword(TEST_PASSWORD),
      role: "vendor",
      referralCode: generateReferralCode(),
    }).returning(),
    db.insert(usersTable).values({
      email: "zara@zarastudiong.com",
      name: "Zara Adewale",
      passwordHash: await hashPassword(TEST_PASSWORD),
      role: "vendor",
      referralCode: generateReferralCode(),
    }).returning(),
  ]);

  const vendorDetails = VENDOR_DETAILS.map((details) => ({ ...details, logoUrl: null }));

  const vendors = await Promise.all(vendorUsers.map(async ([user], i) => {
    const [vendor] = await db.insert(vendorsTable).values({
      userId: user.id,
      brandName: vendorDetails[i].brandName,
      description: vendorDetails[i].description,
      logoUrl: vendorDetails[i].logoUrl,
      status: "approved",
      bankName: "First Bank Nigeria",
      accountNumber: `301234567${i}`,
      accountName: user.name ?? user.email,
    }).returning();
    return vendor;
  }));

  // Demo products per vendor
  const productData = [
    // Luxury by Anika (vendor 0)
    { vendorId: vendors[0].id, name: "Aso-Oke Wrap Gown", description: "Floor-length wrap gown in hand-woven aso-oke. Available in ivory, burnt orange, and deep teal. Perfect for owambe and formal events.", price: "85000", category: "occasion-wear", sizes: ["XS","S","M","L","XL"], images: [], stock: 12, isFeatured: true },
    { vendorId: vendors[0].id, name: "Adire Silk Blouse", description: "Tie-dyed silk blouse in our signature indigo pattern. Effortlessly transitions from day to evening.", price: "45000", category: "womenswear", sizes: ["XS","S","M","L"], images: [], stock: 20, isFeatured: true },
    { vendorId: vendors[0].id, name: "Gold Embroidered Kaftan", description: "Luxe kaftan in ivory silk with hand-stitched gold embroidery at the neckline and hem. A statement piece.", price: "120000", category: "womenswear", sizes: ["S","M","L","XL","2XL"], images: [], stock: 8, isFeatured: false },
    // Zara Studio NG (vendor 1)
    { vendorId: vendors[1].id, name: "Ankara Power Suit", description: "Bold Ankara print blazer and trousers set. Structured, powerful, unapologetically African.", price: "72000", category: "womenswear", sizes: ["XS","S","M","L","XL"], images: [], stock: 15, isFeatured: true },
    { vendorId: vendors[1].id, name: "Batik Slip Dress", description: "Minimal silhouette in hand-drawn batik cotton. The kind of dress you reach for repeatedly.", price: "38000", category: "womenswear", sizes: ["XS","S","M","L"], images: [], stock: 25, isFeatured: false },
    { vendorId: vendors[1].id, name: "Adire Midi Skirt", description: "A-line midi skirt in our house adire pattern. Pairs with anything, goes everywhere.", price: "28000", category: "womenswear", sizes: ["XS","S","M","L","XL"], images: [], stock: 30, isFeatured: false },
  ];

  await db.insert(productsTable).values(productData);
  logger.info({ count: productData.length }, "Products seeded");

  // Demo shopper
  const [shopper] = await db.insert(usersTable).values({
    email: "demo@shopper.com",
    name: "Demo Shopper",
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: "shopper",
    referralCode: generateReferralCode(),
  }).returning();

  await db.insert(usersTable).values({
    email: "shopper@raredistrict.com",
    name: "Rare District Shopper",
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: "shopper",
    referralCode: generateReferralCode(),
  });

  // Welcome coupon
  await db.insert(couponsTable).values({
    code: "WELCOME10",
    type: "percentage",
    value: "10",
    minOrderAmount: "10000",
    maxUses: 100,
    isActive: true,
    isReferral: false,
  });

  // VIP coupon
  await db.insert(couponsTable).values({
    code: "VIP5000",
    type: "fixed",
    value: "5000",
    minOrderAmount: "50000",
    maxUses: 50,
    isActive: true,
    isReferral: false,
  });

  logger.info("Seeding complete. Initial accounts created — change passwords before going live.");
  logger.info({
    accounts: TEST_ACCOUNTS.map(({ email, role }) => ({ email, role })),
    password: TEST_PASSWORD,
  }, "Rare District test accounts ready (test-only credential)");
}
