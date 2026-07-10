"use client";

import { useEffect, useState, memo, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    ArrowLeft,
    MapPin,
    Clock,
    Star,
    Utensils,
    Coffee,
    ShoppingBag,
    Home,
    Package,
    ChevronRight,
} from "lucide-react";

type Vendor = {
    id: string;
    name: string;
    description: string | null;
    location: string;
    category: string;
    imageUrl: string | null;
    openTime: string | null;
    closeTime: string | null;
    rating: number | null;
    supportsDelivery: boolean;
    supportsDineIn: boolean;
    supportsTakeaway: boolean;
    _count: { menuItems: number };
};

type Hub = {
    id: string;
    name: string;
    description: string | null;
    vendors: Vendor[];
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: ReactNode }> = {
    FOOD: {
        bg: "from-emerald-50 to-emerald-100",
        text: "#1BA672",
        icon: <Utensils className="h-5 w-5" />,
    },
    BEVERAGES: {
        bg: "from-sky-50 to-sky-100",
        text: "#3D7FED",
        icon: <Coffee className="h-5 w-5" />,
    },
    STATIONERY: {
        bg: "from-amber-50 to-amber-100",
        text: "#E37400",
        icon: <ShoppingBag className="h-5 w-5" />,
    },
    PHARMACY: {
        bg: "from-rose-50 to-rose-100",
        text: "#E23744",
        icon: <Package className="h-5 w-5" />,
    },
    OTHER: {
        bg: "from-gray-100 to-gray-200",
        text: "#686B78",
        icon: <Home className="h-5 w-5" />,
    },
};

const ALL_HUBS = [
    { id: "hub-cos", name: "COS" },
    { id: "hub-aahar", name: "Aahar" },
    { id: "hub-gblock", name: "G Block" },
    { id: "hub-jaggis", name: "Jaggis" },
];

function isOpenNow(open: string | null, close: string | null) {
    if (!open || !close) return true;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    return cur >= oh * 60 + om && cur <= ch * 60 + cm;
}

function fmt(t: string | null) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function HubPage() {
    const params = useParams();
    const hubId = (params?.hubId as string) ?? "";
    const [hub, setHub] = useState<Hub | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState("ALL");

    useEffect(() => {
        if (!hubId) return;
        fetch(`/api/hubs/${hubId}`)
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then(setHub)
            .catch(() => setError("Could not load this hub."))
            .finally(() => setLoading(false));
    }, [hubId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#121212] transition-colors duration-200 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 rounded-full border-4 border-[#9B1B1B]/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-[#9B1B1B] border-t-transparent animate-spin" />
                    </div>
                    <p className="text-[#686B78] dark:text-gray-400 text-sm font-medium">Loading shops...</p>
                </div>
            </div>
        );
    }

    if (error || !hub) {
        return (
            <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#121212] transition-colors duration-200 flex items-center justify-center">
                <div className="text-center space-y-6">
                    <div className="text-6xl">😕</div>
                    <p className="text-[var(--red)] font-medium">{error}</p>
                    <Link
                        href="/browse"
                        className="px-6 py-2.5 bg-[#9B1B1B] text-white rounded-xl font-semibold hover:bg-[#7A1414] transition-colors"
                    >
                        ← Back to hubs
                    </Link>
                </div>
            </div>
        );
    }

    const categories = ["ALL", ...Array.from(new Set(hub.vendors.map((v) => v.category)))];
    const filtered = activeCategory === "ALL" ? hub.vendors : hub.vendors.filter((v) => v.category === activeCategory);
    const otherHubs = ALL_HUBS.filter((h) => h.id !== hubId);

    return (
        <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#121212] transition-colors duration-200">
            {/* ─── HEADER ─── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hub-header-from)] via-[var(--hub-header-via)] to-[var(--hub-header-to)] px-6 pt-6 pb-10">
                <Link
                    href="/browse"
                    className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium mb-4"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to hubs
                </Link>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                            {hub.name}
                        </h1>
                        {hub.description && (
                            <p className="text-white/70 text-sm mt-1">{hub.description}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
                        <span className="text-white/90 text-sm font-semibold">
                            {hub.vendors.length} shop{hub.vendors.length !== 1 ? "s" : ""} available
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── CONTENT ─── */}
            <div className="max-w-6xl mx-auto px-6 -mt-4 pb-16">
                {/* Other hubs quick switch - NOW WITH COLOUR */}
                {otherHubs.length > 0 && (
                    <div className="mb-6">
                        <p className="text-xs font-semibold text-[#93959F] dark:text-gray-400 uppercase tracking-wider mb-2">
                            Other hubs
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {otherHubs.map((h) => (
                                <Link
                                    key={h.id}
                                    href={`/hub/${h.id}`}
                                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium 
                                               bg-[#FDF2F2] dark:bg-[#2A0D0D] text-[#9B1B1B] dark:text-[#C02020] border border-[#F5C6C6] dark:border-[#3D1515] 
                                               hover:bg-[#F5C6C6] dark:hover:bg-[#3D1515] hover:border-[#9B1B1B] 
                                               transition-all shadow-sm hover:shadow`}
                                >
                                    {h.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Category filter */}
                {categories.length > 2 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`
                                    flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all
                                    ${activeCategory === cat
                                        ? "bg-[#9B1B1B] text-white shadow-md"
                                        : "bg-white dark:bg-[#1A1A1A] text-[#686B78] dark:text-gray-400 border border-[#E9E9EB] dark:border-[#2A2A2A] hover:border-[#9B1B1B]/40"
                                    }
                                `}
                            >
                                {cat === "ALL" ? "All" : cat.charAt(0) + cat.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                )}

                {/* Vendor list */}
                {filtered.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-[#1A1A1A] rounded-3xl border border-[#E9E9EB] dark:border-[#2A2A2A]">
                        <div className="text-5xl mb-4">🔍</div>
                        <p className="text-[#1C1C1C] dark:text-gray-100 font-semibold text-lg">No shops in this category</p>
                        <p className="text-[#686B78] dark:text-gray-400 text-sm mt-1">Try selecting a different category</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filtered.map((v) => (
                            <VendorCard key={v.id} vendor={v} href={`/vendor/${v.id}`} />
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </main>
    );
}

// ─── VENDOR CARD ──────────────────────────────────────────────
const VendorCard = memo(function VendorCard({ vendor, href }: { vendor: Vendor; href: string }) {
    const [hovered, setHovered] = useState(false);
    const open = isOpenNow(vendor.openTime, vendor.closeTime);
    const cat = CATEGORY_STYLES[vendor.category] ?? CATEGORY_STYLES.OTHER;

    return (
        <Link
            href={open ? href : "#"}
            onClick={open ? undefined : (e) => e.preventDefault()}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`
                group relative w-full text-left bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden
                border border-[#E9E9EB] dark:border-[#2A2A2A] transition-all duration-300
                ${open ? "hover:shadow-xl hover:-translate-y-1 cursor-pointer block" : "cursor-default block"}
                ${hovered && open ? "shadow-xl" : "shadow-sm"} text-decoration-none text-inherit
            `}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
            {/* ─── Closed overlay: subtle grey wash, NO opacity on text ─── */}
            {!open && (
                <div className="absolute inset-0 bg-white/30 dark:bg-black/40 pointer-events-none" />
            )}

            <div className="flex items-stretch relative z-10">
                {/* Left visual */}
                <div className={`
                    w-24 flex-shrink-0 flex items-center justify-center
                    bg-gradient-to-br ${cat.bg} dark:saturate-50 dark:brightness-75
                    transition-all duration-300
                    ${!open ? "saturate-50" : ""}
                `}>
                    <div className="text-3xl">{cat.icon}</div>
                </div>

                {/* Right content */}
                <div className="flex-1 p-4 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: cat.bg, color: cat.text }}
                        >
                            {vendor.category.charAt(0) + vendor.category.slice(1).toLowerCase()}
                        </span>
                        <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                                open
                                    ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-gray-400"}`} />
                            {open ? "Open" : "Closed"}
                        </span>
                    </div>

                    <h3 className="text-lg font-extrabold text-[#1C1C1C] dark:text-gray-100 tracking-tight mt-1 truncate">
                        {vendor.name}
                    </h3>
                    {vendor.description && (
                        <p className="text-sm text-[#686B78] dark:text-gray-400 line-clamp-2 mt-0.5">
                            {vendor.description}
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#686B78] dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {vendor.location}
                        </span>
                        {vendor.openTime && vendor.closeTime && (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {fmt(vendor.openTime)} – {fmt(vendor.closeTime)}
                            </span>
                        )}
                        {vendor.rating && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Star className="h-3.5 w-3.5 fill-amber-500 stroke-amber-500" />
                                {vendor.rating.toFixed(1)}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {vendor.supportsTakeaway && (
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">
                                🥡 Takeaway
                            </span>
                        )}
                        {vendor.supportsDineIn && (
                            <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">
                                🪑 Dine In
                            </span>
                        )}
                        {vendor.supportsDelivery && (
                            <span className="text-[10px] font-semibold text-[#9B1B1B] dark:text-[#C02020] bg-[#FDF2F2] dark:bg-[#2A0D0D] px-2.5 py-1 rounded-full">
                                🛵 Delivery
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#F0F0F0] dark:border-[#2A2A2A]">
                        <span className="text-xs text-[#93959F] dark:text-gray-500">
                            {vendor._count.menuItems} item{vendor._count.menuItems !== 1 ? "s" : ""} on menu
                        </span>
                        {open && (
                            <span className="flex items-center gap-1 text-sm font-bold text-[#9B1B1B] group-hover:text-[#7A1414] transition-colors">
                                View menu
                                <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${hovered ? "translate-x-1" : ""}`} />
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
});