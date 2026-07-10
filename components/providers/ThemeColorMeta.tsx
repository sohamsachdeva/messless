"use client";

// ============================================================
// components/providers/ThemeColorMeta.tsx
// Dynamically updates the <meta name="theme-color"> tag
// so the browser address bar matches the current theme.
// Next.js renders two SSR meta tags (one per media query);
// this component updates the matching one on manual toggle.
// ============================================================

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const color = resolvedTheme === "dark" ? "#121212" : "#F8F8F8";
    const theme = resolvedTheme === "dark" ? "dark" : "light";

    // On first toggle, find the SSR-rendered meta tag matching this theme
    // and remove its media query so it takes effect.
    // On subsequent toggles, the matching tag already has no media attribute,
    // so fall back to the plain meta tag.
    let meta = document.querySelector(
      `meta[name="theme-color"][media="(prefers-color-scheme: ${theme})"]`,
    ) as HTMLMetaElement | null;

    if (!meta) {
      meta = document.querySelector(
        'meta[name="theme-color"]:not([media])',
      ) as HTMLMetaElement | null;
    }

    if (meta) {
      meta.removeAttribute("media");
      meta.setAttribute("content", color);
    }
  }, [resolvedTheme, mounted]);

  return null;
}
