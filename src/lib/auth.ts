import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user, maxRow, durRow] = await Promise.all([
          prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: { roles: true },
          }),
          prisma.settings.findUnique({ where: { key: "login_max_attempts" } }),
          prisma.settings.findUnique({ where: { key: "login_lock_duration_min" } }),
        ]);
        const maxFails = typeof maxRow?.value === "number" ? maxRow.value : 5;
        const lockMins = typeof durRow?.value === "number" ? durRow.value : 15;

        if (!user || !user.passwordHash || !user.isActive || user.deletedAt) {
          return null;
        }

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) {
          // Increment fail count, lock after configurable threshold
          const fails = user.loginFailCount + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginFailCount: fails,
              lockedUntil: fails >= maxFails ? new Date(Date.now() + lockMins * 60 * 1000) : undefined,
            },
          });
          return null;
        }

        // Reset fail count on success
        await prisma.user.update({
          where: { id: user.id },
          data: { loginFailCount: 0, lockedUntil: null },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((r) => r.role),
          isAhliMajlis: user.isAhliMajlis,
          departmentId: user.departmentId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = (user as { roles: Role[] }).roles;
        token.isAhliMajlis = (user as { isAhliMajlis: boolean }).isAhliMajlis;
        token.departmentId = (user as { departmentId: string | null }).departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.roles = token.roles as Role[];
        session.user.isAhliMajlis = token.isAhliMajlis as boolean;
        session.user.departmentId = token.departmentId as string | null;
      }
      return session;
    },
  },
});

// ─── Type augmentation ────────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roles: Role[];
      isAhliMajlis: boolean;
      departmentId: string | null;
    };
  }
}
