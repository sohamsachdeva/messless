// ============================================================
// middleware.ts
// Route protection for MessLess
//
// /vendor/dashboard|menu|orders → VENDOR or ADMIN
// /admin/*                      → ADMIN only
// /browse|/cart|/checkout|/orders|/hub → any authenticated user
// ============================================================

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // /admin/* — only ADMIN
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Vendor routes — only VENDOR or ADMIN
    // NOTE: /vendor/[id] is the STUDENT-facing menu page, not blocked here
    if (
      (pathname === "/vendor" ||
        pathname.startsWith("/vendor/dashboard") ||
        pathname.startsWith("/vendor/menu") ||
        pathname.startsWith("/vendor/orders")) &&
      token?.role !== "VENDOR" &&
      token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/browse/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/orders/:path*",
    "/vendor",
    "/vendor/dashboard/:path*",
    "/vendor/menu/:path*",
    "/vendor/orders/:path*",
    "/admin/:path*",
    "/hub/:path*",
    "/demo-payment/:path*",
  ],
};
