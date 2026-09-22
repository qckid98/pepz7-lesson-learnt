import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email atau Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const identifier = credentials.identifier as string;

        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { username: identifier }
            ]
          },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
});
