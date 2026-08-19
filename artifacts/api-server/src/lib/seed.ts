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

const ADDITIONAL_VENDOR_DETAILS = [
  {
    email: "studio@aakosestudio.com",
    name: "Aako Osei",
    brandName: "Aako Studio",
    description: "Sculptural occasion pieces shaped by clean lines, saturated color, and Lagos energy.",
    products: [
      { name: "Sculpted Taffeta Dress", description: "A softly structured taffeta dress with a sculptural waist and luminous finish.", price: "98000", category: "occasion-wear", sizes: ["S", "M", "L"], stock: 10 },
      { name: "Palm Silk Column Skirt", description: "A fluid silk column skirt cut for movement and quiet drama.", price: "54000", category: "womenswear", sizes: ["XS", "S", "M", "L"], stock: 14 },
    ],
  },
  {
    email: "hello@commonthreadlagos.com",
    name: "Maya Bello",
    brandName: "Common Thread",
    description: "Everyday Nigerian design with thoughtful tailoring, natural textures, and a warm point of view.",
    products: [
      { name: "Linen Market Shirt", description: "An easy oversized linen shirt with a softly curved hem.", price: "36000", category: "womenswear", sizes: ["XS", "S", "M", "L", "XL"], stock: 22 },
      { name: "Everyday Pleat Trouser", description: "High-waisted cotton trousers with a generous pleat and relaxed leg.", price: "42000", category: "womenswear", sizes: ["S", "M", "L", "XL"], stock: 18 },
    ],
  },
  {
    email: "studio@noiratelier.ng",
    name: "Tobi Ajayi",
    brandName: "Noir Atelier",
    description: "A dark, precise wardrobe of modern tailoring and understated Nigerian luxury.",
    products: [
      { name: "Noir Double-Breasted Blazer", description: "A precise wool-blend blazer with a relaxed shoulder and deep black finish.", price: "115000", category: "menswear", sizes: ["S", "M", "L", "XL"], stock: 9 },
      { name: "Studio Taper Trouser", description: "A sharply tapered trouser designed to anchor a modern wardrobe.", price: "58000", category: "menswear", sizes: ["30", "32", "34", "36"], stock: 16 },
    ],
  },
  {
    email: "hello@oraworld.ng",
    name: "Ora Nwosu",
    brandName: "Ora World",
    description: "Joyful, graphic womenswear that moves between the gallery, the street, and the night.",
    products: [
      { name: "Sunroom Printed Set", description: "A matching top and wide-leg trouser set in a hand-drawn sun print.", price: "68000", category: "womenswear", sizes: ["XS", "S", "M", "L"], stock: 13 },
      { name: "Painted Cotton Mini", description: "A bold cotton mini dress finished with contrast binding and pockets.", price: "47000", category: "womenswear", sizes: ["XS", "S", "M", "L"], stock: 19 },
    ],
  },
  {
    email: "hello@halcyonhouse.ng",
    name: "Kemi Adebayo",
    brandName: "Halcyon House",
    description: "Soft, considered resort dressing inspired by coastal light and slow afternoons.",
    products: [
      { name: "Saltwater Slip Dress", description: "A bias-cut slip dress in washed satin with adjustable straps.", price: "62000", category: "womenswear", sizes: ["XS", "S", "M", "L"], stock: 15 },
      { name: "Coastline Wrap", description: "A lightweight woven wrap for layering from city mornings to beach evenings.", price: "29000", category: "accessories", sizes: ["OS"], stock: 28 },
    ],
  },
  {
    email: "studio@theloomroom.ng",
    name: "Femi Okafor",
    brandName: "The Loom Room",
    description: "Handwoven textiles translated into collectible, contemporary wardrobe pieces.",
    products: [
      { name: "Handloom Short Jacket", description: "A cropped jacket made from handwoven strips with a clean collarless finish.", price: "88000", category: "menswear", sizes: ["S", "M", "L", "XL"], stock: 8 },
      { name: "Loom Panel Tote", description: "A structured tote built from handloom panels and vegetable-tanned leather.", price: "39000", category: "accessories", sizes: ["OS"], stock: 24 },
    ],
  },
  {
    email: "hello@elevengrey.ng",
    name: "Nneka Eze",
    brandName: "Eleven Grey",
    description: "Quietly experimental essentials for people who dress with intention.",
    products: [
      { name: "Grey Study Knit", description: "A fine-gauge knit with an architectural neckline and soft handfeel.", price: "51000", category: "womenswear", sizes: ["S", "M", "L"], stock: 17 },
      { name: "Contour Cargo", description: "A refined cargo trouser with curved seams and considered utility pockets.", price: "56000", category: "streetwear", sizes: ["S", "M", "L", "XL"], stock: 20 },
    ],
  },
  {
    email: "studio@adannacollective.ng",
    name: "Ada Nnamani",
    brandName: "Adanna Collective",
    description: "A bright collective of makers creating expressive accessories and modern heirlooms.",
    products: [
      { name: "Beaded Orbit Bag", description: "A compact evening bag finished with hand-beaded concentric circles.", price: "44000", category: "accessories", sizes: ["OS"], stock: 12 },
      { name: "Sculptural Raffia Hat", description: "A wide-brim raffia hat shaped and finished by hand.", price: "32000", category: "accessories", sizes: ["OS"], stock: 21 },
    ],
  },
  {
    email: "hello@onwustudio.com",
    name: "Onwu Chike",
    brandName: "Onwu Studio",
    description: "A contemporary menswear studio balancing Nigerian craft with international polish.",
    products: [
      { name: "Ecru Utility Overshirt", description: "A workwear-inspired overshirt in heavyweight ecru cotton.", price: "49000", category: "menswear", sizes: ["S", "M", "L", "XL"], stock: 23 },
      { name: "Indigo Camp Collar", description: "A relaxed camp-collar shirt in hand-dyed indigo cotton.", price: "37000", category: "menswear", sizes: ["S", "M", "L", "XL"], stock: 26 },
    ],
  },
  {
    email: "studio@mahoganyform.ng",
    name: "Yemi Akin",
    brandName: "Mahogany Form",
    description: "Grounded silhouettes, rich earth tones, and ceremonial details for the modern wardrobe.",
    products: [
      { name: "Mahogany Pleat Dress", description: "A deep-toned pleated dress with a clean neckline and generous movement.", price: "73000", category: "occasion-wear", sizes: ["XS", "S", "M", "L"], stock: 11 },
      { name: "Bronze Knot Belt", description: "A sculptural leather belt finished with a brushed bronze knot buckle.", price: "26000", category: "accessories", sizes: ["S", "M", "L"], stock: 30 },
    ],
  },
] as const;

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

  for (const [index, details] of ADDITIONAL_VENDOR_DETAILS.entries()) {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, details.email)).limit(1);
    if (!user) {
      [user] = await db.insert(usersTable).values({
        email: details.email,
        name: details.name,
        passwordHash,
        role: "vendor",
        referralCode: generateReferralCode(),
      }).returning();
    }

    let [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, user.id)).limit(1);
    if (!vendor) {
      [vendor] = await db.insert(vendorsTable).values({
        userId: user.id,
        brandName: details.brandName,
        description: details.description,
        status: "approved",
        bankName: "First Bank Nigeria",
        accountNumber: `401234567${index}`,
        accountName: user.name ?? user.email,
      }).returning();
    } else if (vendor.status !== "approved") {
      [vendor] = await db.update(vendorsTable).set({ status: "approved" }).where(eq(vendorsTable.id, vendor.id)).returning();
    }

    const existingProducts = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.vendorId, vendor.id));
    const existingNames = new Set(existingProducts.map((product) => product.name));
    const missingProducts = details.products
      .filter((product) => !existingNames.has(product.name))
      .map((product) => ({ ...product, vendorId: vendor.id, images: [], isFeatured: false }));
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

  await ensureTestAccounts();

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
