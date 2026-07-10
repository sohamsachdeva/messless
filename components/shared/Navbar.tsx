"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import ThemeToggle from "./ThemeToggle";

type Role = "STUDENT" | "VENDOR" | "ADMIN";

type NavLink = {
  href: string;
  label: string;
  emoji: string;
};

export default function Navbar() {
  const { data: session, status } = useSession();

  const router = useRouter();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);

  // Hide navbar
  if (pathname && ["/", "/login", "/register"].includes(pathname)) {
    return null;
  }

  const role = (session?.user?.role as Role | undefined) ?? "STUDENT";

  const name =
    session?.user?.name?.trim()?.split(" ")[0] ??
    "User";

  const NAV: Record<Role, NavLink[]> = {
    STUDENT: [
      {
        href: "/browse",
        label: "Home",
        emoji: "🏠",
      },
      {
        href: "/orders",
        label: "Orders",
        emoji: "🧾",
      },
      {
        href: "/cart",
        label: "Cart",
        emoji: "🛒",
      }
    ],

    VENDOR: [
      {
        href: "/vendor/dashboard",
        label: "Dashboard",
        emoji: "📊",
      },
      {
        href: "/vendor/menu",
        label: "Menu",
        emoji: "🍽️",
      },
      {
        href: "/vendor/orders",
        label: "Orders",
        emoji: "🧾",
      },
    ],

    ADMIN: [
      {
        href: "/admin/dashboard",
        label: "Dashboard",
        emoji: "📊",
      },
      {
        href: "/admin/vendors",
        label: "Vendors",
        emoji: "🏪",
      },
      {
        href: "/admin/menu-items",
        label: "Menu",
        emoji: "🍽️",
      },
      {
        href: "/admin/analytics",
        label: "Analytics",
        emoji: "📈",
      },
    ],
  };

  const links = NAV[role];

  const getHomeRoute = () => {
    switch (role) {
      case "VENDOR":
        return "/vendor/dashboard";

      case "ADMIN":
        return "/admin/dashboard";

      default:
        return "/browse";
    }
  };

  function navigate(path: string) {
    router.push(path);
    setMenuOpen(false);
  }

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/browse") {
      return pathname.startsWith("/hub");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            height: 60,
            margin: "0 auto",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}

          <button
            onClick={() => navigate(getHomeRoute())}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "#9B1B1B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              M
            </div>

            <span
              style={{
                fontWeight: 800,
                fontSize: 18,
                color: "var(--text-primary)",
                letterSpacing: "-0.03em",
              }}
            >
              MessLess
            </span>
          </button>

          {/* Nav */}

          <div
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
            }}
          >
            {links.map((link) => (
              <button
                key={link.href}
                onClick={() => navigate(link.href)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 10,
                  padding: "8px 14px",

                  background: isActive(link.href)
                    ? "#FDF2F2"
                    : "transparent",

                  color: isActive(link.href)
                    ? "var(--primary)"
                    : "var(--text-secondary)",

                  fontWeight:
                    isActive(link.href)
                      ? 700
                      : 500,

                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{link.emoji}</span>

                {link.label}
              </button>
            ))}

            <ThemeToggle />
          </div>

          {/* User */}

          <div style={{ position: "relative" }}>
            {status === "authenticated" ? (
              <>
                <button
                  onClick={() =>
                    setMenuOpen((v) => !v)
                  }
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    background:
                      menuOpen
                        ? "var(--bg-elevated)"
                        : "var(--bg-card)",

                    padding: "6px 12px",

                    display: "flex",
                    alignItems: "center",
                    gap: 8,

                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#9B1B1B",
                      color: "#fff",

                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",

                      fontWeight: 700,
                    }}
                  >
                    {name[0]?.toUpperCase()}
                  </div>

                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {name}
                  </span>

                  <span
                    style={{
                      transform: menuOpen
                        ? "rotate(180deg)"
                        : "none",

                      transition: ".15s",
                    }}
                  >
                    ▼
                  </span>
                </button>

                {menuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,

                      width: 230,

                      background: "var(--bg-card)",

                      border: "1px solid var(--border)",

                      borderRadius: 14,

                      boxShadow:
                        "0 12px 30px rgba(0,0,0,.12)",

                      overflow: "hidden",

                      zIndex: 100,
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {session.user?.name}
                      </div>

                      <div
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: 12,
                        }}
                      >
                        {session.user?.email}
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#9B1B1B",
                        }}
                      >
                        {role}
                      </div>
                    </div>

                    <div
                      style={{
                        borderTop:
                          "1px solid var(--bg-elevated)",
                      }}
                    >
                      <button
                        onClick={() => {
                          setMenuOpen(false);

                          signOut({
                            callbackUrl:
                              "/login",
                          });
                        }}
                        style={{
                          width: "100%",

                          padding: 12,

                          border: "none",

                          background: "none",

                          color: "#E23744",

                          cursor: "pointer",

                          textAlign: "left",

                          fontWeight: 700,
                        }}
                      >
                        🚪 Sign out
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() =>
                  router.push("/login")
                }
                style={{
                  background:
                    "#9B1B1B",

                  color: "#fff",

                  border: "none",

                  padding:
                    "10px 16px",

                  borderRadius: 10,

                  cursor: "pointer",
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div
          onClick={() =>
            setMenuOpen(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 49,
          }}
        />
      )}
    </>
  );
}