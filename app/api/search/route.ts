import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(apiRateLimit, req);
  if (rl) return rl;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ vendors: [], hubs: [] });
  }

  // Search vendors by name/description/location and menu item names
  const vendors = await prisma.vendor.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        {
          menuItems: {
            some: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    },
    include: {
      hub: { select: { id: true, name: true } },
      menuItems: {
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true },
        take: 3,
      },
      _count: { select: { menuItems: true } },
    },
    take: 20,
  });

  // Also search hubs directly (for hub name matches)
  const hubs = await prisma.hub.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, description: true },
    take: 5,
  });

  const result = { vendors, hubs };

  return NextResponse.json(result);
}