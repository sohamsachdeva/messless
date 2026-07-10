// ============================================================
// prisma/seed.ts
// Run with: npx prisma db seed
// Thapar Campus Commerce — seeded with real hub + shop structure
// Hubs: COS, Aahar, G Block, Jaggis
// Each vendor shop gets its own login user
// ============================================================

import {
  PrismaClient,
  Role,
  VendorCategory,
  ItemType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Thapar Campus Commerce...\n");

  // Pre-hash the default vendor password once
  const hashedPassword = await bcrypt.hash("Messless@123", 12);

  // ============================================================
  // 1. USERS
  // ============================================================

  // Admin
  await prisma.user.upsert({
    where: { email: "admin@thapar.edu" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@thapar.edu",
      role: Role.ADMIN,
      thaparId: "ADMIN001",
      password: hashedPassword,
    },
  });

  // Test student
  await prisma.user.upsert({
    where: { email: "student@thapar.edu" },
    update: {},
    create: {
      name: "Test Student",
      email: "student@thapar.edu",
      role: Role.STUDENT,
      thaparId: "102415001",
      phone: "9876543210",
      password: hashedPassword,
    },
  });

  // ── COS vendors ─────────────────────────────────────────────

  const wrapchikOwner = await prisma.user.upsert({
    where: { id: "user-cos-wrapchik" },
    update: {},
    create: {
      id: "user-cos-wrapchik",
      name: "WrapChik",
      role: Role.VENDOR,
      phone: "9876500101",
      password: hashedPassword,
    },
  });

  const dessertClubOwner = await prisma.user.upsert({
    where: { id: "user-cos-dessertclub" },
    update: {},
    create: {
      id: "user-cos-dessertclub",
      name: "Dessert Club",
      role: Role.VENDOR,
      phone: "9876500102",
      password: hashedPassword,
    },
  });

  const cosJuiceOwner = await prisma.user.upsert({
    where: { id: "user-cos-juice" },
    update: {},
    create: {
      id: "user-cos-juice",
      name: "Iqbal Juice Corner (COS)",
      role: Role.VENDOR,
      phone: "9876500103",
      password: hashedPassword,
    },
  });

  // ── Aahar vendors ────────────────────────────────────────────

  const chaapWalaOwner = await prisma.user.upsert({
    where: { id: "user-aahar-chaap" },
    update: {},
    create: {
      id: "user-aahar-chaap",
      name: "Chaap Wala",
      role: Role.VENDOR,
      phone: "9876500201",
      password: hashedPassword,
    },
  });

  const aaharPointOwner = await prisma.user.upsert({
    where: { id: "user-aahar-point" },
    update: {},
    create: {
      id: "user-aahar-point",
      name: "Aahar Food Point",
      role: Role.VENDOR,
      phone: "9876500202",
      password: hashedPassword,
    },
  });

  // ── G Block vendors ──────────────────────────────────────────

  const gblockCanteenOwner = await prisma.user.upsert({
    where: { id: "user-gblock-canteen" },
    update: {},
    create: {
      id: "user-gblock-canteen",
      name: "G Block Canteen",
      role: Role.VENDOR,
      phone: "9876500301",
      password: hashedPassword,
    },
  });

  const campusBitesOwner = await prisma.user.upsert({
    where: { id: "user-gblock-bites" },
    update: {},
    create: {
      id: "user-gblock-bites",
      name: "Campus Bites",
      role: Role.VENDOR,
      phone: "9876500302",
      password: hashedPassword,
    },
  });

  // ── Jaggis vendors ───────────────────────────────────────────

  const jaggisJuiceOwner = await prisma.user.upsert({
    where: { id: "user-jaggis-juice" },
    update: {},
    create: {
      id: "user-jaggis-juice",
      name: "Iqbal Juice Corner (Jaggis)",
      role: Role.VENDOR,
      phone: "9876500401",
      password: hashedPassword,
    },
  });

  const jaggisBitesOwner = await prisma.user.upsert({
    where: { id: "user-jaggis-bites" },
    update: {},
    create: {
      id: "user-jaggis-bites",
      name: "Jaggi Bites",
      role: Role.VENDOR,
      phone: "9876500402",
      password: hashedPassword,
    },
  });

  console.log("✅ Users created (1 per vendor shop)");

  // ============================================================
  // 2. HUBS
  // ============================================================

  const cos = await prisma.hub.upsert({
    where: { id: "hub-cos" },
    update: {},
    create: {
      id: "hub-cos",
      name: "COS",
      description: "Food stalls near the sports complex",
      imageUrl: null,
    },
  });

  const aahar = await prisma.hub.upsert({
    where: { id: "hub-aahar" },
    update: {},
    create: {
      id: "hub-aahar",
      name: "AAHAR",
      description: "Food point near main gate",
      imageUrl: null,
    },
  });

  const gblock = await prisma.hub.upsert({
    where: { id: "hub-gblock" },
    update: {},
    create: {
      id: "hub-gblock",
      name: "G BLOCK",
      description: "G Block canteen and surrounding stalls",
      imageUrl: null,
    },
  });

  const jaggis = await prisma.hub.upsert({
    where: { id: "hub-jaggis" },
    update: {},
    create: {
      id: "hub-jaggis",
      name: "JAGGIS",
      description: "Jaggi's — popular quick-bite spot on campus",
      imageUrl: null,
    },
  });

  console.log("✅ Hubs created: COS | AAHAR | G BLOCK | JAGGIS");

  // ============================================================
  // 3. VENDORS — each owned by their own user
  // ============================================================

  // ── COS (3 shops) ───────────────────────────────────────────

  const cosWrapchik = await prisma.vendor.upsert({
    where: { id: "vendor-cos-wrapchik" },
    update: {},
    create: {
      id: "vendor-cos-wrapchik",
      name: "WrapChik",
      description: "Wraps, rolls, chicken and more",
      location: "COS, Stall 1",
      category: VendorCategory.FOOD,
      hubId: cos.id,
      phone: "9876500101",
      openTime: "10:00",
      closeTime: "22:00",
      isApproved: true,
      supportsDelivery: false,
      supportsDineIn: true,
      supportsTakeaway: true,
      ownerId: wrapchikOwner.id,
    },
  });

  const cosDessertClub = await prisma.vendor.upsert({
    where: { id: "vendor-cos-dessertclub" },
    update: {},
    create: {
      id: "vendor-cos-dessertclub",
      name: "Dessert Club",
      description: "Ice creams, sundaes, waffles and more",
      location: "COS, Stall 2",
      category: VendorCategory.FOOD,
      hubId: cos.id,
      phone: "9876500102",
      openTime: "10:00",
      closeTime: "22:00",
      isApproved: true,
      supportsDelivery: false,
      supportsDineIn: true,
      supportsTakeaway: true,
      ownerId: dessertClubOwner.id,
    },
  });

  const cosJuice = await prisma.vendor.upsert({
    where: { id: "vendor-cos-juice" },
    update: {},
    create: {
      id: "vendor-cos-juice",
      name: "Iqbal Juice Corner",
      description: "Fresh fruit juices, shakes and smoothies",
      location: "COS, Stall 3",
      category: VendorCategory.BEVERAGES,
      hubId: cos.id,
      phone: "9876500103",
      openTime: "08:00",
      closeTime: "20:00",
      isApproved: true,
      supportsDelivery: false,
      supportsDineIn: false,
      supportsTakeaway: true,
      ownerId: cosJuiceOwner.id,
    },
  });

  // ── Aahar (2 shops) ─────────────────────────────────────────

  const aaharChaap = await prisma.vendor.upsert({
    where: { id: "vendor-aahar-chaap" },
    update: {},
    create: {
      id: "vendor-aahar-chaap",
      name: "Chaap Wala",
      description: "Variety of chaap dishes — grilled, fried, and more",
      location: "Aahar, Counter 1",
      category: VendorCategory.FOOD,
      hubId: aahar.id,
      phone: "9876500201",
      openTime: "10:00",
      closeTime: "24:00",
      isApproved: true,
      supportsDelivery: true,
      supportsDineIn: true,
      supportsTakeaway: true,
      ownerId: chaapWalaOwner.id,
    },
  });

  const aaharPoint = await prisma.vendor.upsert({
    where: { id: "vendor-aahar-point" },
    update: {},
    create: {
      id: "vendor-aahar-point",
      name: "Aahar food point",
      description: "Quick bites and more",
      location: "Aahar, Stall 2",
      category: VendorCategory.FOOD,
      hubId: aahar.id,
      phone: "9876500202",
      openTime: "10:00",
      closeTime: "22:00",
      isApproved: true,
      supportsDelivery: false,
      supportsDineIn: false,
      supportsTakeaway: true,
      ownerId: aaharPointOwner.id,
    },
  });

  // ── G Block (2 shops) ────────────────────────────────────────

  const gblockCanteen = await prisma.vendor.upsert({
    where: { id: "vendor-gblock-canteen" },
    update: {},
    create: {
      id: "vendor-gblock-canteen",
      name: "G Block Canteen",
      description: "Quick bites between lectures — sandwiches, rolls, chai",
      location: "G Block, Ground Floor",
      category: VendorCategory.FOOD,
      hubId: gblock.id,
      phone: "9876500301",
      openTime: "08:00",
      closeTime: "20:00",
      isApproved: true,
      supportsDelivery: false,
      supportsDineIn: true,
      supportsTakeaway: true,
      ownerId: gblockCanteenOwner.id,
    },
  });

  const gblockBites = await prisma.vendor.upsert({
    where: { id: "vendor-gblock-bites" },
    update: {},
    create: {
      id: "vendor-gblock-bites",
      name: "Campus Bites",
      description: "Quick bites and more",
      location: "G Block, Room 001",
      category: VendorCategory.FOOD,
      hubId: gblock.id,
      phone: "9876500302",
      openTime: "09:00",
      closeTime: "18:00",
      isApproved: true,
      supportsDelivery: false,
      supportsDineIn: false,
      supportsTakeaway: true,
      ownerId: campusBitesOwner.id,
    },
  });

  // ── Jaggis (2 shops) ─────────────────────────────────────────

  const jaggisJuice = await prisma.vendor.upsert({
    where: { id: "vendor-jaggis-juice" },
    update: {},
    create: {
      id: "vendor-jaggis-juice",
      name: "Iqbal Juice Corner",
      description: "Juices, shakes, and more",
      location: "Jaggis, Main Stall",
      category: VendorCategory.BEVERAGES,
      hubId: jaggis.id,
      phone: "9876500401",
      openTime: "10:00",
      closeTime: "22:00",
      isApproved: true,
      supportsDelivery: true,
      supportsDineIn: true,
      supportsTakeaway: true,
      ownerId: jaggisJuiceOwner.id,
    },
  });

  const jaggisBites = await prisma.vendor.upsert({
    where: { id: "vendor-jaggis-bites" },
    update: {},
    create: {
      id: "vendor-jaggis-bites",
      name: "Jaggi Bites",
      description: "Fast food, quick bites and more",
      location: "Jaggis, Stall 2",
      category: VendorCategory.FOOD,
      hubId: jaggis.id,
      phone: "9876500402",
      openTime: "09:00",
      closeTime: "21:00",
      isApproved: true,
      supportsDelivery: false,
      supportsDineIn: true,
      supportsTakeaway: true,
      ownerId: jaggisBitesOwner.id,
    },
  });

  console.log("✅ All vendors created (each with their own owner)");

  // ============================================================
  // 4. MENU ITEMS
  // ============================================================

  await seedItems(cosWrapchik.id, [
    { name: "Cheese Burger",    description: "Delicious cheese burger",        price: 50, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 1 },
    { name: "Chicken Burger",  description: "Grilled chicken with lettuce and sauce",      price: 60, itemType: ItemType.NON_VEG,     isPopular: false, sortOrder: 2 },
    { name: "Paneer Roll",    description: "Stuffed paneer in a paratha roll",            price: 55, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 3 },
    { name: "Egg Bhurji Roll", description: "Spiced egg bhurji in a paratha roll",    price: 45, itemType: ItemType.NON_VEG, isPopular: true,  sortOrder: 4 },
    { name: "Masala Chai",     description: "Hot spiced tea",                          price: 10, itemType: ItemType.BEVERAGE,isPopular: true,  sortOrder: 5 },
  ]);

  await seedItems(cosDessertClub.id, [
    { name: "Blueberry Waffle",   description: "Fluffy waffle with fresh blueberries",             price: 30, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 1 },
    { name: "Strawberry Waffle",    description: "Fluffy waffle with fresh strawberries",         price: 35, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 2 },
    { name: "Chocolate Ice Cream",       description: "Creamy chocolate ice cream",           price: 40, itemType: ItemType.VEG,     isPopular: false, sortOrder: 3 },
    { name: "Biscoff Waffle",       description: "Fluffy waffle with Biscoff spread",                price: 35, itemType: ItemType.VEG,     isPopular: false, sortOrder: 4 },
    { name: "Mango Sundae",  description: "Creamy mango sundae",        price: 35, itemType: ItemType.VEG, isPopular: true,  sortOrder: 5 },
  ]);

  await seedItems(cosJuice.id, [
    { name: "Fresh Orange Juice", description: "Freshly squeezed orange juice",       price: 40, itemType: ItemType.BEVERAGE, isPopular: true,  sortOrder: 1 },
    { name: "Mango Shake",        description: "Thick mango milkshake",               price: 50, itemType: ItemType.BEVERAGE, isPopular: true,  sortOrder: 2 },
    { name: "Watermelon Juice",   description: "Chilled fresh watermelon juice",      price: 30, itemType: ItemType.BEVERAGE, isPopular: false, sortOrder: 3 },
    { name: "Mixed Fruit Shake",  description: "Banana mango papaya blend",           price: 55, itemType: ItemType.BEVERAGE, isPopular: true,  sortOrder: 4 },
  ]);

  await seedItems(aaharChaap.id, [
    { name: "Full Thali",        description: "Dal, sabzi, rice, 3 roti, salad, dessert", price: 80, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 1 },
    { name: "Half Thali",        description: "Dal, sabzi, rice, 2 roti",                 price: 55, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 2 },
    { name: "Chole Bhature",     description: "Classic Punjabi chole with 2 bhature",     price: 60, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 3 },
    { name: "Rajma Chawal",      description: "Rajma curry with steamed rice",             price: 55, itemType: ItemType.VEG,     isPopular: false, sortOrder: 4 },
    { name: "Chicken Curry Rice",description: "Home-style chicken with rice",              price: 90, itemType: ItemType.NON_VEG, isPopular: true,  sortOrder: 5 },
    { name: "Egg Curry Rice",    description: "2 eggs in spiced curry with rice",          price: 70, itemType: ItemType.NON_VEG, isPopular: false, sortOrder: 6 },
  ]);

  await seedItems(aaharPoint.id, [
    { name: "Golgappe",     description: "6 crispy puri with spiced water",           price: 20, itemType: ItemType.VEG, isPopular: true,  sortOrder: 1 },
    { name: "Papdi Chaat",  description: "Crispy papdi with chutneys and curd",       price: 30, itemType: ItemType.VEG, isPopular: true,  sortOrder: 2 },
    { name: "Aloo Tikki",   description: "Fried potato patty with chaat masala",      price: 25, itemType: ItemType.VEG, isPopular: true,  sortOrder: 3 },
    { name: "Bhel Puri",    description: "Puffed rice with tamarind chutney",         price: 25, itemType: ItemType.VEG, isPopular: false, sortOrder: 4 },
    { name: "Samosa Chaat", description: "Samosa crushed with chaat toppings",        price: 35, itemType: ItemType.VEG, isPopular: false, sortOrder: 5 },
  ]);

  await seedItems(gblockCanteen.id, [
    { name: "Veg Sandwich", description: "Grilled veg sandwich with cheese",          price: 35, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 1 },
    { name: "Chicken Roll", description: "Spiced chicken in a flaky paratha",         price: 60, itemType: ItemType.NON_VEG, isPopular: true,  sortOrder: 2 },
    { name: "Paneer Roll",  description: "Paneer tikka roll with onion chutney",      price: 50, itemType: ItemType.VEG,     isPopular: false, sortOrder: 3 },
    { name: "Maggi",        description: "Classic Maggi noodles",                     price: 30, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 4 },
    { name: "Ginger Tea",   description: "Hot ginger tea",                            price: 8,  itemType: ItemType.BEVERAGE, isPopular: true, sortOrder: 5 },
    { name: "Cold Drink",   description: "Canned cold drink Coke Pepsi Sprite",       price: 30, itemType: ItemType.BEVERAGE, isPopular: false,sortOrder: 6 },
  ]);

  await seedItems(gblockBites.id, [
    { name: "A4 Notebook",         description: "200 page ruled hard-cover notebook", price: 80, itemType: ItemType.OTHER, isPopular: true,  sortOrder: 1 },
    { name: "Blue Pen Pack",       description: "Reynolds 045 pack of 5",             price: 30, itemType: ItemType.OTHER, isPopular: false, sortOrder: 2 },
    { name: "BW Print per page",   description: "A4 black and white printout",        price: 2,  itemType: ItemType.OTHER, isPopular: true,  sortOrder: 3 },
    { name: "Color Print per page",description: "A4 color printout",                  price: 10, itemType: ItemType.OTHER, isPopular: false, sortOrder: 4 },
    { name: "Highlighter Set",     description: "4 color highlighter set",            price: 60, itemType: ItemType.OTHER, isPopular: false, sortOrder: 5 },
    { name: "Spiral Notebook",     description: "A5 spiral 160 pages",               price: 50, itemType: ItemType.OTHER, isPopular: false, sortOrder: 6 },
  ]);

  await seedItems(jaggisJuice.id, [
    { name: "Veg Burger",    description: "Aloo tikki burger with lettuce and sauce", price: 60, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 1 },
    { name: "Chicken Burger",description: "Crispy chicken fillet burger",             price: 80, itemType: ItemType.NON_VEG, isPopular: true,  sortOrder: 2 },
    { name: "Paneer Wrap",   description: "Grilled paneer tikka wrap",                price: 70, itemType: ItemType.VEG,     isPopular: false, sortOrder: 3 },
    { name: "Chicken Wrap",  description: "Spiced chicken in a tortilla wrap",        price: 85, itemType: ItemType.NON_VEG, isPopular: true,  sortOrder: 4 },
    { name: "French Fries",  description: "Crispy salted fries",                      price: 40, itemType: ItemType.VEG,     isPopular: true,  sortOrder: 5 },
    { name: "Cold Drink",    description: "Canned drink of your choice",              price: 30, itemType: ItemType.BEVERAGE, isPopular: false, sortOrder: 6 },
  ]);

  await seedItems(jaggisBites.id, [
    { name: "Gulab Jamun", description: "2 soft gulab jamun in sugar syrup",          price: 30, itemType: ItemType.VEG, isPopular: true,  sortOrder: 1 },
    { name: "Jalebi",      description: "100g crispy hot jalebi",                     price: 25, itemType: ItemType.VEG, isPopular: true,  sortOrder: 2 },
    { name: "Rice Kheer",  description: "Creamy rice pudding with cardamom",          price: 35, itemType: ItemType.VEG, isPopular: false, sortOrder: 3 },
    { name: "Suji Halwa",  description: "Suji halwa with dry fruits",                 price: 30, itemType: ItemType.VEG, isPopular: false, sortOrder: 4 },
    { name: "Rasmalai",    description: "2 soft rasgulla in flavored milk",           price: 45, itemType: ItemType.VEG, isPopular: true,  sortOrder: 5 },
  ]);

  console.log("✅ All menu items created");
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║           Seeding complete! Vendor login credentials     ║
  ╠══════════════════════════════════════════════════════════╣
  ║  All vendors login with phone as username                ║
  ║  Default password: Messless@123                          ║
  ╠══════════════════════════════════════════════════════════╣
  ║  COS                                                     ║
  ║    WrapChik           → phone: 9876500101                ║
  ║    Dessert Club       → phone: 9876500102                ║
  ║    Iqbal Juice Corner → phone: 9876500103                ║
  ╠══════════════════════════════════════════════════════════╣
  ║  AAHAR                                                   ║
  ║    Chaap Wala         → phone: 9876500201                ║
  ║    Aahar Food Point   → phone: 9876500202                ║
  ╠══════════════════════════════════════════════════════════╣
  ║  G BLOCK                                                 ║
  ║    G Block Canteen    → phone: 9876500301                ║
  ║    Campus Bites       → phone: 9876500302                ║
  ╠══════════════════════════════════════════════════════════╣
  ║  JAGGIS                                                  ║
  ║    Iqbal Juice Corner → phone: 9876500401                ║
  ║    Jaggi Bites        → phone: 9876500402                ║
  ╠══════════════════════════════════════════════════════════╣
  ║  OTHER                                                   ║
  ║    Admin   → admin@thapar.edu                            ║
  ║    Student → student@thapar.edu                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
}

// ============================================================
// HELPER — seeds menu items for a vendor, auto-generates safe IDs
// ============================================================
async function seedItems(
  vendorId: string,
  items: {
    name: string;
    description: string;
    price: number;
    itemType: ItemType;
    isPopular: boolean;
    sortOrder: number;
  }[]
) {
  for (const item of items) {
    const safeId = `${vendorId}-${item.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")}`;

    await prisma.menuItem.upsert({
      where: { id: safeId },
      update: {},
      create: {
        id: safeId,
        vendorId,
        name: item.name,
        description: item.description,
        price: item.price,
        itemType: item.itemType,
        isPopular: item.isPopular,
        isAvailable: true,
        sortOrder: item.sortOrder,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });