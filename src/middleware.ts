import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use edge-compatible config for middleware (no DB imports)
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // The authorized callback in authConfig handles the logic
});

export const config = {
  // Match all routes EXCEPT: static files, images, favicon, auth API, ALL API routes
  // API routes handle their own auth — middleware breaks large file uploads if it intercepts them
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png|logo.png|api).*)"],
};
