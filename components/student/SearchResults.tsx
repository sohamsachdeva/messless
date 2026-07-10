"use client";

import { useState, memo } from "react";
import Link from "next/link";
import {
  MapPin,
  Utensils,
  ChevronRight,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
export type SearchVendor = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  hub: { id: string; name: string };
  menuItems: { id: string; name: string }[];
  _count: { menuItems: number };
};

export type SearchHub = {
  id: string;
  name: string;
  description: string | null;
};

// ─── SEARCH RESULTS ───────────────────────────────────────────
export function SearchResults({
  searching,
  searchResults,
  searchQuery,
  onClear,
}: {
  searching: boolean;
  searchResults: { vendors: SearchVendor[]; hubs: SearchHub[] };
  searchQuery: string;
  onClear: () => void;
}) {
  if (searching) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-7 w-7 text-[#9B1B1B] animate-spin mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Searching...</p>
      </div>
    );
  }

  const hasResults = searchResults.hubs.length > 0 || searchResults.vendors.length > 0;

  if (!hasResults) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">No results found</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Try a different keyword</p>
        <button
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#FDF2F2] dark:bg-[#2A0D0D] text-[#9B1B1B] dark:text-[#C02020] rounded-full text-xs font-semibold hover:bg-[#F5C6C6] dark:hover:bg-[#3D1515] transition-colors"
        >
          Clear search
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {searchResults.hubs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Hubs</p>
          <div className="flex flex-wrap gap-2">
            {searchResults.hubs.map((hub) => (
              <Link
                key={hub.id}
                href={`/hub/${hub.id}`}
                className="px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-[#9B1B1B] hover:text-[#9B1B1B] dark:hover:text-[#C02020] hover:shadow-sm transition-all no-underline inline-block"
              >
                {hub.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {searchResults.vendors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
            {searchResults.vendors.length} shop{searchResults.vendors.length !== 1 ? "s" : ""} found
          </p>
          <div className="space-y-2.5">
            {searchResults.vendors.map((vendor, i) => (
              <div
                key={vendor.id}
                className="animate-fadeIn"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
              >
                <SearchResultCard vendor={vendor} query={searchQuery} href={`/vendor/${vendor.id}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SEARCH RESULT CARD ──────────────────────────────────────
const SearchResultCard = memo(function SearchResultCard({
  vendor,
  query,
  href,
}: {
  vendor: SearchVendor;
  query: string;
  href: string;
}) {
  const [hovered, setHovered] = useState(false);

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-100 text-gray-900 font-semibold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        w-full text-left bg-white dark:bg-[#1A1A1A] rounded-xl border p-4
        transition-all duration-150
        ${hovered ? "shadow-md border-gray-200 dark:border-gray-600 -translate-y-0.5" : "shadow-sm border-gray-100 dark:border-gray-800"}
        block no-underline text-inherit
      `}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div className="flex items-start gap-4">
        {/* Visual identifier */}
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xl flex-shrink-0">
          🏪
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{highlight(vendor.name)}</h3>
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {vendor.hub.name}
            </span>
          </div>
          {vendor.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{highlight(vendor.description)}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {vendor.location}
            </span>
            <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
            <span className="flex items-center gap-1">
              <Utensils className="h-3 w-3" />
              {vendor._count.menuItems} item{vendor._count.menuItems !== 1 ? "s" : ""}
            </span>
          </div>
          {vendor.menuItems.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vendor.menuItems.map((item) => (
                <span
                  key={item.id}
                  className="text-[10px] font-medium text-[#9B1B1B] dark:text-[#C02020] bg-[#FDF2F2] dark:bg-[#2A0D0D] px-2 py-0.5 rounded-full border border-[#F5C6C6]/50 dark:border-[#3D1515]/50"
                >
                  {highlight(item.name)}
                </span>
              ))}
              {vendor._count.menuItems > vendor.menuItems.length && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">+{vendor._count.menuItems - vendor.menuItems.length} more</span>
              )}
            </div>
          )}
        </div>

        <div className={`
          h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150
          ${hovered ? "bg-[#9B1B1B] text-white" : "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500"}
        `}>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
});

// ─── EMPTY FILTER STATE ──────────────────────────────────────
export function EmptyFilterState({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">🏪</div>
      <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">No hubs match this filter</p>
      <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Try selecting a different option</p>
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#FDF2F2] dark:bg-[#2A0D0D] text-[#9B1B1B] dark:text-[#C02020] rounded-full text-xs font-semibold hover:bg-[#F5C6C6] dark:hover:bg-[#3D1515] transition-colors"
      >
        Show all hubs
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
