import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config (no DB imports)
 * Used by middleware which runs on Edge runtime
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = auth?.user?.role === "ADMIN";
      const pathname = nextUrl.pathname;

      // Public routes: login page and auth API
      if (pathname === "/login" || pathname.startsWith("/api/auth")) {
        return true;
      }

      // API routes: return 401 JSON if not logged in (not redirect)
      if (pathname.startsWith("/api/")) {
        if (!isLoggedIn) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Admin-only API routes
        if (pathname.startsWith("/api/admin") && !isAdmin) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        return true;
      }

      // Admin routes: must be logged in AND admin
      if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) return false;
        if (!isAdmin) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      // Everything else (pages): must be logged in
      if (!isLoggedIn) return false;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // Empty here, filled in auth.ts (server-side only)
} satisfies NextAuthConfig;
