import { db, usersTable, vendorsTable, productsTable, categoriesTable, adminSettingsTable, couponsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, generateReferralCode } from "./auth";
import { logger } from "./logger";

export async function seedDemoData() {
  // Check if already seeded
  const existing = await db.select().from(usersTable).limit(1);
  if (existing.length > 0) {
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
    passwordHash: await hashPassword("admin123"),
    role: "admin",
    referralCode: "ADMIN001",
  }).returning();

  // Demo vendors
  const vendorUsers = await Promise.all([
    db.insert(usersTable).values({
      email: "anika@luxurybyanika.com",
      name: "Anika Osei",
      passwordHash: await hashPassword("vendor123"),
      role: "vendor",
      referralCode: generateReferralCode(),
    }).returning(),
    db.insert(usersTable).values({
      email: "zara@zarastudiong.com",
      name: "Zara Adewale",
      passwordHash: await hashPassword("vendor123"),
      role: "vendor",
      referralCode: generateReferralCode(),
    }).returning(),
    db.insert(usersTable).values({
      email: "kola@thekollection.ng",
      name: "Kola Fashola",
      passwordHash: await hashPassword("vendor123"),
      role: "vendor",
      referralCode: generateReferralCode(),
    }).returning(),
  ]);

  const vendorDetails = [
    {
      brandName: "Luxury by Anika",
      description: "Handcrafted luxury womenswear with an Afrocentric aesthetic. Every piece tells a story of cultural pride and modern elegance.",
      logoUrl: null,
    },
    {
      brandName: "Zara Studio NG",
      description: "Contemporary Nigerian fashion bridging traditional craftsmanship with contemporary silhouettes. Known for our signature Adire prints.",
      logoUrl: null,
    },
    {
      brandName: "The Kollection",
      description: "Premium menswear and streetwear for the discerning Lagos gentleman. Quality fabrics, impeccable tailoring.",
      logoUrl: null,
    },
  ];

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
    // The Kollection (vendor 2)
    { vendorId: vendors[2].id, name: "Lagos Agbada Set", description: "Three-piece agbada ensemble in imported brocade. Tailored in Lagos, respected everywhere.", price: "95000", category: "menswear", sizes: ["M","L","XL","2XL","3XL"], images: [], stock: 10, isFeatured: true },
    { vendorId: vendors[2].id, name: "Streetwear Ankara Joggers", description: "Premium Ankara-print joggers with a clean silhouette. Heritage meets street culture.", price: "32000", category: "streetwear", sizes: ["S","M","L","XL","2XL"], images: [], stock: 22, isFeatured: false },
    { vendorId: vendors[2].id, name: "Tailored Senegalese Trousers", description: "Wide-leg Senegalese cotton trousers. Breathable, elegant, and distinctly West African.", price: "55000", category: "menswear", sizes: ["S","M","L","XL","2XL"], images: [], stock: 18, isFeatured: false },
  ];

  await db.insert(productsTable).values(productData);
  logger.info({ count: productData.length }, "Products seeded");

  // Demo shopper
  const [shopper] = await db.insert(usersTable).values({
    email: "demo@shopper.com",
    name: "Demo Shopper",
    passwordHash: await hashPassword("shopper123"),
    role: "shopper",
    referralCode: generateReferralCode(),
  }).returning();

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

  logger.info("Seeding complete. Demo accounts: admin@raredistrict.com / admin123 | demo@shopper.com / shopper123 | anika@luxurybyanika.com / vendor123");
}
