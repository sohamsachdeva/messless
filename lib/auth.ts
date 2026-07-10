// ============================================================
// lib/auth.ts
// Students  → login with @thapar.edu email (or Google)
// Vendors   → login with phone number only
// Admins    → login with @thapar.edu email (or Google)
// ============================================================

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  providers: [
    // ── Google OAuth — students + admins only ────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Credentials ──────────────────────────────────────────
    // Field name is "login" — accepts email (student/admin)
    // OR phone number (vendor). The frontend sends the raw value.
    CredentialsProvider({
      name: "credentials",
      credentials: {
        login:    { label: "Email or Phone", type: "text"     },
        password: { label: "Password",       type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;

        const login = credentials.login.trim();
        const isPhone = /^[6-9]\d{9}$/.test(login);

        let user;

        if (isPhone) {
          // ── VENDOR path — look up by phone number ──────────
          user = await prisma.user.findFirst({
            where: {
              phone: login,
              role:  Role.VENDOR,
            },
          });

          if (!user) return null;
          if (!user.password) return null;

          // Must be approved by admin
          const vendor = await prisma.vendor.findFirst({
            where: { ownerId: user.id, isApproved: true },
          });

          if (!vendor) {
            // Throw so NextAuth passes the message to the error page
            throw new Error("Your vendor account is pending admin approval.");
          }

        } else {
          // ── STUDENT / ADMIN path — look up by email ────────
          if (!login.endsWith("@thapar.edu")) return null;

          user = await prisma.user.findUnique({
            where: { email: login.toLowerCase() },
          });

          if (!user || !user.password) return null;

          // Vendors must NOT log in via email path
          if (user.role === Role.VENDOR) return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id:       user.id,
          name:     user.name,
          email:    user.email,
          role:     user.role,
          thaparId: user.thaparId,
        };
      },
    }),
  ],

  callbacks: {
    // ── signIn — Google only, block non-thapar emails ────────
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true; // credentials handled above

      const email = user.email ?? "";

      if (!email.endsWith("@thapar.edu")) return false;

      // Auto-create student on first Google login
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            name:  user.name ?? "Thapar User",
            email,
            role:  Role.STUDENT,
          },
        });
      }

      return true;
    },

    // ── JWT — attach role + id to token ──────────────────────
    async jwt({ token, user }) {
      if (user) {
        // Fresh login — user is returned from authorize() or OAuth provider
        if ((user as any).role) {
          // Credentials login — user object already has role from authorize()
          token.id       = user.id;
          token.role     = (user as any).role;
          token.thaparId = (user as any).thaparId ?? undefined;
        } else if (user.email) {
          // Google OAuth — look up DB user by email to get role
          const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
          if (dbUser) {
            token.id       = dbUser.id;
            token.role     = dbUser.role;
            token.thaparId = dbUser.thaparId ?? undefined;
          }
        }
      } else if (token.id) {
        // Token refresh — sync role from DB
        const dbUser = await prisma.user.findUnique({ where: { id: token.id } });
        if (dbUser) {
          token.role     = dbUser.role;
          token.thaparId = dbUser.thaparId ?? undefined;
        }
      }
      return token;
    },

    // ── Session — expose role + id to client ─────────────────
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id       = token.id as string;
        session.user.role     = token.role as Role;
        session.user.thaparId = token.thaparId as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};