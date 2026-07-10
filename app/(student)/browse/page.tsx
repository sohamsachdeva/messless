"use client";

import { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { EmptyFilterState } from "@/components/student/SearchResults";
import {
  Search,
  Clock,
  TrendingUp,
  ChevronRight,
  Zap,
  Wallet,
  Bell,
  MapPin,
  Utensils,
  X,
  Star,
  Timer,
  Navigation,
  ChefHat,
  Flame,
} from "lucide-react";

const SearchResults = dynamic(() => import("@/components/student/SearchResults").then((m) => m.SearchResults), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-7 w-7 rounded-full border-4 border-[#9B1B1B]/20 border-t-[#9B1B1B] animate-spin mb-3" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Searching...</p>
    </div>
  ),
});

// ─── TYPES ───────────────────────────────────────────────────
type Hub = {
  id: string;
  name: string;
  description: string | null;
  _count: { vendors: number };
};

type SearchVendor = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  hub: { id: string; name: string };
  menuItems: { id: string; name: string }[];
  _count: { menuItems: number };
};

type SearchHub = {
  id: string;
  name: string;
  description: string | null;
};

type FilterKey = "ALL" | "POPULAR" | "24H";

// ─── META ────────────────────────────────────────────────────
// Using inline gradients (not Tailwind classes) so colors always render
const HUB_META: Record<
  string,
  { emoji: string; gradientStyle: string; tagline: string; accentColor: string; is24H: boolean }
> = {
  COS: {
    emoji: "⚽",
    gradientStyle: "linear-gradient(135deg, #F59E0B, #D97706, #EA580C)",
    tagline: "Sports complex food stalls",
    accentColor: "#D97706",
    is24H: false,
  },
  Aahar: {
    emoji: "🍱",
    gradientStyle: "linear-gradient(135deg, #34D399, #10B981, #0D9488)",
    tagline: "Main food court, all cuisines",
    accentColor: "#059669",
    is24H: false,
  },
  "G Block": {
    emoji: "☕",
    gradientStyle: "linear-gradient(135deg, #818CF8, #6366F1, #4F46E5)",
    tagline: "Between-lecture quick bites",
    accentColor: "#4F46E5",
    is24H: false,
  },
  Jaggis: {
    emoji: "🍔",
    gradientStyle: "linear-gradient(135deg, #FB7185, #E11D48, #BE123C)",
    tagline: "Popular campus quick-bite spot",
    accentColor: "#E11D48",
    is24H: true,
  },
};

const FEATURES = [
  { icon: Zap, label: "Order Ahead", desc: "Skip the queue" },
  { icon: Wallet, label: "Pay Online", desc: "UPI, Card & more" },
  { icon: Bell, label: "Live Tracking", desc: "Real-time updates" },
];

const FILTERS: { key: FilterKey; label: string; icon?: typeof Flame }[] = [
  { key: "ALL", label: "All" },
  { key: "POPULAR", label: "Popular", icon: Flame },
  { key: "24H", label: "Open 24 Hours", icon: Clock },
];

// Swiggy-style "What's on your mind?" categories
const CRAVING_CATEGORIES = [
  { label: "Pizza", icon: "🍕", color: "#E93B3B" },
  { label: "Burger", icon: "🍔", color: "#F59E0B" },
  { label: "Coffee", icon: "☕", color: "#6B4226" },
  { label: "Biryani", icon: "🍛", color: "#D97706" },
  { label: "Momos", icon: "🥟", color: "#10B981" },
  { label: "Sandwich", icon: "🥪", color: "#6366F1" },
  { label: "Pasta", icon: "🍝", color: "#EC4899" },
  { label: "South Indian", icon: "🥞", color: "#8B5CF6" },
  { label: "Chinese", icon: "🥡", color: "#EF4444" },
  { label: "Dessert", icon: "🍰", color: "#F472B6" },
];

// ─── SKELETON ────────────────────────────────────────────────
function SwiggyCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse">
      <div className="h-36 bg-gradient-to-br from-gray-100 dark:from-gray-800 to-gray-200 dark:to-gray-700" />
      <div className="p-4 space-y-2.5">
        <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3.5 w-full rounded bg-gray-100 dark:bg-gray-800" />
        <div className="flex items-center gap-3 pt-2">
          <div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-14 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <SwiggyCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────
export default function BrowsePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    vendors: SearchVendor[];
    hubs: SearchHub[];
  }>({ vendors: [], hubs: [] });
  const [searching, setSearching] = useState(false);
  const [hoveredHub, setHoveredHub] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults({ vendors: [], hubs: [] });
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((data) => setSearchResults(data))
        .catch(() => setSearchResults({ vendors: [], hubs: [] }))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch hubs
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;
    fetch("/api/hubs")
      .then((r) => r.json())
      .then(setHubs)
      .finally(() => setLoading(false));
  }, [status, router]);

  // Filter hubs
  const filteredHubs = useMemo(() => {
    if (activeFilter === "ALL") return hubs;
    if (activeFilter === "POPULAR") return hubs.filter((h) => h._count.vendors >= 3);
    if (activeFilter === "24H") return hubs.filter((h) => HUB_META[h.name]?.is24H);
    return hubs;
  }, [hubs, activeFilter]);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const totalShops = hubs.reduce((acc, h) => acc + h._count.vendors, 0);
  const showResults = searchQuery.trim().length >= 2;

  const handleQuickSearch = useCallback((term: string) => {
    setSearchQuery(term);
    searchRef.current?.focus();
  }, []);

  // ─── LOADING STATE ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#121212] transition-colors duration-200">
        {/* Placeholder header */}
        <div className="bg-white dark:bg-[#1A1A1A] border-b border-gray-100 dark:border-gray-800 px-4 md:px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="h-5 w-48 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-16 space-y-6">
          <div className="h-10 w-full max-w-xl rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
            ))}
          </div>
          <SkeletonGrid />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#121212] transition-colors duration-200">
      {/* ─── HEADER ─── Swiggy-style: clean white bar with location ─── */}
      <div className="sticky top-0 z-40 bg-white dark:bg-[#1A1A1A] border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                <MapPin className="h-4 w-4 text-[#9B1B1B] flex-shrink-0" />
                <span className="truncate">Thapar University, Patiala</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="hidden sm:flex items-center gap-1">
                <ChefHat className="h-3.5 w-3.5" />
                {totalShops} shops
              </span>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
              <span className="text-gray-400 dark:text-gray-500">{greeting}, {firstName}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-16">
        {/* ─── SEARCH ─── */}
        <div className="relative group max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[#9B1B1B]" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search for dishes, shops, or hubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-20 py-3 rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:outline-none focus:border-[#9B1B1B] focus:ring-2 focus:ring-[#9B1B1B]/10 transition-all"
            aria-label="Search"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* ─── "WHAT'S ON YOUR MIND?" CAROUSEL ─── Swiggy-style ─── */}
        {!showResults && (
          <div className="mt-7">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">What&apos;s on your mind?</h2>
            <div className="flex gap-5 overflow-x-auto pb-3 scrollbar-hide -mx-4 md:-mx-8 px-4 md:px-8">
              {CRAVING_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => handleQuickSearch(cat.label)}
                  className="flex flex-col items-center gap-2 flex-shrink-0 group"
                >
                  <div
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-200 group-hover:shadow-md group-hover:scale-105 group-active:scale-95"
                    style={{ backgroundColor: `${cat.color}12` }}
                  >
                    {cat.icon}
                  </div>
                  <span className="text-[11px] md:text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── DIVIDER ─── */}
        <div className="mt-7 mb-5 border-t border-gray-100 dark:border-gray-800" />

        {/* ─── SECTION HEADER + FILTERS ─── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {showResults
                ? `Results for "${searchQuery}"`
                : activeFilter === "ALL"
                  ? "All Hubs"
                  : activeFilter === "POPULAR"
                    ? "Popular Hubs"
                    : "Open 24 Hours"}
            </h2>
            {!showResults && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{filteredHubs.length} hub{filteredHubs.length !== 1 ? "s" : ""} • {totalShops} shops</p>
            )}
          </div>

          {/* Filter pills */}
          {!showResults && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`
                    flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap
                    transition-all duration-150 border
                    ${
                      activeFilter === f.key
                        ? "bg-[#9B1B1B] text-white border-[#9B1B1B] shadow-sm"
                        : "bg-white dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }
                  `}
                >
                  {f.icon && <f.icon className="h-3 w-3" />}
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── SEARCH RESULTS ─── */}
        {showResults ? (
          <SearchResults
            searching={searching}
            searchResults={searchResults}
            searchQuery={searchQuery}
            onClear={() => setSearchQuery("")}
          />
        ) : (
          /* ─── HUB GRID ─── Swiggy-style restaurant cards ─── */
          <>
            {filteredHubs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredHubs.map((hub, i) => {
                  const meta = HUB_META[hub.name] ?? {
                    emoji: "🏪",
                    gradientStyle: "linear-gradient(135deg, #9CA3AF, #6B7280)",
                    tagline: hub.description ?? "",
                    accentColor: "#6B7280",
                    is24H: false,
                  };
                  const isHovered = hoveredHub === hub.id;
                  const isPopular = hub._count.vendors >= 3;

                  return (
                    <div
                      key={hub.id}
                      className="animate-fadeIn"
                      style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
                    >
                      <SwiggyHubCard
                        hub={hub}
                        meta={meta}
                        isHovered={isHovered}
                        isPopular={isPopular}
                        onHoverStart={() => setHoveredHub(hub.id)}
                        onHoverEnd={() => setHoveredHub(null)}
                        href={`/hub/${hub.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyFilterState onReset={() => setActiveFilter("ALL")} />
            )}
          </>
        )}

        {/* ─── FEATURES STRIP ─── Minimal, Swiggy-style ─── */}
        {!showResults && (
          <div className="mt-14">
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 px-4 py-5">
              {FEATURES.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#FDF2F2] dark:bg-[#2A0D0D] flex items-center justify-center text-[#9B1B1B] dark:text-[#C02020]">
                    <item.icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{item.label}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center text-[10px] text-gray-400 dark:text-gray-500 pb-1">
              {totalShops} shops across {hubs.length} hubs on campus
            </div>
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

// ─── SWIGGY-STYLE HUB CARD ─────────────────────────────────────
const SwiggyHubCard = memo(function SwiggyHubCard({
  hub,
  meta,
  isHovered,
  isPopular,
  onHoverStart,
  onHoverEnd,
  href,
}: {
  hub: Hub;
  meta: {
    emoji: string;
    gradientStyle: string;
    tagline: string;
    accentColor: string;
    is24H: boolean;
  };
  isHovered: boolean;
  isPopular: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  href: string;
}) {
  const vendorCount = hub._count.vendors;
  return (
    <Link
      href={href}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      className={`
        group relative w-full text-left rounded-2xl overflow-hidden
        bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-[#9B1B1B]/30 focus:ring-offset-2 dark:focus:ring-offset-gray-900
        ${isHovered ? "shadow-xl shadow-black/8 -translate-y-0.5" : "shadow-sm"} block text-inherit no-underline
      `}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      {/* ─── "Image" Area ─── Inline gradient so it always renders ─── */}
      <div
        className="relative h-36 flex items-center justify-center overflow-hidden"
        style={{ background: meta.gradientStyle }}
      >
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,white_1px,transparent_1px)] bg-[length:12px_12px]" />
        
        {/* Emoji */}
        <div className={`
          relative text-5xl md:text-6xl transition-all duration-300
          ${isHovered ? "scale-110 -rotate-6" : "scale-100 rotate-0"}
          drop-shadow-lg
        `}>
          {meta.emoji}
        </div>

        {/* Shop count badge — bottom-left overlay like Swiggy offers */}
        <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-lg">
          <div className="flex -space-x-1">
            {[1, 2, 3].slice(0, Math.min(vendorCount, 3)).map((n) => (
              <div key={n} className="w-4 h-4 rounded-full bg-white/30 border border-white/20" />
            ))}
          </div>
          <span className="text-[11px] font-bold text-white">{vendorCount} shop{vendorCount !== 1 ? "s" : ""}</span>
        </div>

        {/* 24H badge — top-right — neutral dark, not pink */}
        {meta.is24H && (
          <div className="absolute top-3 right-3 bg-gray-800/85 backdrop-blur-sm rounded-full px-2.5 py-0.5 shadow-lg flex items-center gap-1">
            <Timer className="h-3 w-3 text-white" />
            <span className="text-[10px] font-bold text-white">OPEN 24H</span>
          </div>
        )}

        {/* Popular badge — top-left — brand red, consistent with rating */}
        {isPopular && (
          <div className="absolute top-3 left-3 bg-[#9B1B1B]/85 backdrop-blur-sm rounded-full px-2.5 py-0.5 shadow-lg flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-white" />
            <span className="text-[10px] font-bold text-white">POPULAR</span>
          </div>
        )}
      </div>

      {/* ─── Content Area ─── */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{hub.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{meta.tagline}</p>
          </div>
          
          {/* Rating badge — brand red like Swiggy uses orange consistently */}
          <div className="flex items-center gap-0.5 bg-[#9B1B1B] rounded-md px-1.5 py-0.5 flex-shrink-0">
            <Star className="h-2.5 w-2.5 fill-white text-white" />
            <span className="text-[10px] font-bold text-white">{vendorCount}</span>
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-2 mt-2.5 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-0.5">
            <Navigation className="h-3 w-3" />
            On campus
          </span>
          <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
          <span className="flex items-center gap-0.5">
            <Utensils className="h-3 w-3" />
            {vendorCount * 8}+ items
          </span>
        </div>

        {/* CTA */}
        <div className="mt-3.5 pt-2.5 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Explore hub</span>
          <div className={`
            flex items-center gap-0.5 text-xs font-semibold transition-all duration-200
            ${isHovered ? "text-[#9B1B1B] translate-x-0" : "text-gray-500 dark:text-gray-400"}
          `}>
            <span>Browse shops</span>
            <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isHovered ? "translate-x-0.5" : ""}`} />
          </div>
        </div>

        {/* Accent bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-200"
          style={{
            background: isHovered ? meta.accentColor : "transparent",
            opacity: isHovered ? 1 : 0,
          }}
        />
      </div>
    </Link>
  );
});

