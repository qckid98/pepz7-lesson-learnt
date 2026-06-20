import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use edge-compatible config for middleware (no DB imports)
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // The authorized callback in authConfig handles the logic
});

export const config = {
  // Match all routes EXCEPT: static files, images, favicon, auth API, public assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png|logo.png|api/auth).*)"],
};
