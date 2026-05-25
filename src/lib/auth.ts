import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma";
import { signPending2faToken, verifyPending2faToken } from "@/lib/pending-2fa";
import { verifyTotpCode, consumeRecoveryCode } from "@/lib/totp";
import bcrypt from "bcryptjs";

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
        if (!credentials) return null;
        // NextAuth v5 narrows credentials to declared keys only; cast to access
        // extra fields passed via signIn() (pendingToken, totpCode, recoveryCode)
        const creds = credentials as Record<string, unknown>;

        // ── Path A: second factor (pendingToken present) ──────────────────
        if (creds.pendingToken) {
          const userId = verifyPending2faToken(creds.pendingToken as string);
          if (!userId) return null;

          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: true },
          });
          if (!user || !user.isActive || user.deletedAt || !user.totpEnabled || !user.totpSecret) return null;

          const totpCode = (creds.totpCode as string | undefined)?.replace(/\s/g, "");
          const recoveryCode = creds.recoveryCode as string | undefined;

          if (totpCode) {
            if (!verifyTotpCode(totpCode, user.totpSecret)) return null;
            await prisma.user.update({
              where: { id: userId },
              data: { loginFailCount: 0, lockedUntil: null },
            });
          } else if (recoveryCode) {
            if (!user.totpRecoveryCodes) return null;
            const remaining = await consumeRecoveryCode(recoveryCode, user.totpRecoveryCodes);
            if (remaining === null) return null;
            // Merge recovery code consumption and lockout reset into one DB round-trip
            await prisma.user.update({
              where: { id: userId },
              data: { totpRecoveryCodes: remaining, loginFailCount: 0, lockedUntil: null },
            });
          } else {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles.map((r) => r.role),
            isAhliMajlis: user.isAhliMajlis,
            departmentId: user.departmentId,
          };
        }

        // ── Path B: first factor (email + password) ───────────────────────
        if (!credentials.email || !credentials.password) return null;

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

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) {
          const fails = user.loginFailCount + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginFailCount: fails,
              lockedUntil:
                fails >= maxFails
                  ? new Date(Date.now() + lockMins * 60 * 1000)
                  : undefined,
            },
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { loginFailCount: 0, lockedUntil: null },
        });

        // Password valid — check if 2FA required before issuing session
        if (user.totpEnabled && user.totpSecret) {
          const pending = signPending2faToken(user.id);
          throw new Error("TOTP_REQUIRED:" + pending);
        }

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
