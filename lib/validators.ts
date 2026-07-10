// ============================================================
// lib/validators.ts
// Zod schemas — validate all API request bodies
// Import these in both API routes AND client-side forms
// ============================================================

import { z } from "zod";

// ============================================================
// AUTH
// ============================================================

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .email("Invalid email")
    .endsWith("@thapar.edu", "Only @thapar.edu emails are allowed"),
  thaparId: z
    .string()
    .regex(/^\d{10}$/, "Thapar ID must be 10 digits")
    .optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number")
    .optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// ============================================================
// VENDOR
// ============================================================

export const createVendorSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  location: z.string().min(2).max(200),
  category: z.enum(["FOOD", "BEVERAGES", "OTHER"]),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional(),
  openTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM format")
    .optional(),
  closeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM format")
    .optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

// ============================================================
// MENU ITEM
// ============================================================

export const createMenuItemSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional(),
  price: z
    .number()
    .positive("Price must be greater than 0")
    .max(10000, "Price seems too high"),
  itemType: z.enum(["VEG", "NON_VEG", "BEVERAGE", "SNACK", "OTHER"]),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

// ============================================================
// CART
// ============================================================

export const addToCartSchema = z.object({
  menuItemId: z.string().uuid("Invalid menu item ID"),
  quantity: z.number().int().min(1).max(20),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(20), // 0 = remove from cart
});

// ============================================================
// ORDER
// ============================================================

export const placeOrderSchema = z.object({
  vendorId: z.string().uuid(),
  note: z.string().max(200).optional(),
  pickupSlot: z.string().optional(), // e.g. "12:30 PM"
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PREPARING", "READY", "PICKED_UP", "CANCELLED"]),
});

// ============================================================
// PAYMENT
// ============================================================

export const razorpayWebhookSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

// ============================================================
// REVIEW
// ============================================================

export const createReviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
