// ============================================================
// types/index.ts
// Shared TypeScript types across the app
// ============================================================

import { Role, OrderStatus, PaymentStatus, VendorCategory, ItemType } from "@prisma/client";

// ============================================================
// NextAuth session type extension
// Add this to a file: types/next-auth.d.ts
// ============================================================
/*
import "next-auth";
import "next-auth/jwt";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      thaparId?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: Role;
    thaparId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    thaparId?: string | null;
  }
}
*/

// ============================================================
// API Response types
// ============================================================

export type ApiResponse<T> = {
  data?: T;
  error?: string;
};

// ============================================================
// Vendor with menu item count (used in browse page)
// ============================================================

export type VendorWithCount = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  category: VendorCategory;
  imageUrl: string | null;
  openTime: string | null;
  closeTime: string | null;
  rating: number | null;
  totalOrders: number;
  _count: {
    menuItems: number;
  };
};

// ============================================================
// Menu item type
// ============================================================

export type MenuItemType = {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  itemType: ItemType;
  isAvailable: boolean;
  isPopular: boolean;
};

// ============================================================
// Cart item with nested menu item + vendor
// ============================================================

export type CartItemWithDetails = {
  id: string;
  userId: string;
  menuItemId: string;
  quantity: number;
  menuItem: MenuItemType & {
    vendor: {
      id: string;
      name: string;
    };
  };
};

// ============================================================
// Order with all details
// ============================================================

export type OrderWithDetails = {
  id: string;
  userId: string;
  vendorId: string;
  status: OrderStatus;
  totalAmount: number;
  pickupSlot: string | null;
  note: string | null;
  createdAt: string;
  vendor: {
    id: string;
    name: string;
    location: string;
  };
  orderItems: {
    id: string;
    quantity: number;
    unitPrice: number;
    menuItem: {
      id: string;
      name: string;
      imageUrl: string | null;
    };
  }[];
  payment: {
    id: string;
    status: PaymentStatus;
    amount: number;
    method: string;
    paidAt: string | null;
  } | null;
};

// ============================================================
// Vendor dashboard order (for vendor's incoming orders view)
// ============================================================

export type VendorOrder = OrderWithDetails & {
  user: {
    id: string;
    name: string;
    thaparId: string | null;
    phone: string | null;
  };
};
