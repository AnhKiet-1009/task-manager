import {
  accounts,
  type AppDatabase,
  sessions,
  users,
  verifications,
} from "@taskmanager/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export interface AuthConfig {
  secret: string;
  baseUrl: string;
  trustedOrigins: string[];
  githubClientId?: string;
  githubClientSecret?: string;
}

function hasCrossOriginTarget(baseUrl: string, trustedOrigins: string[]): boolean {
  try {
    const apiOrigin = new URL(baseUrl).origin;
    return trustedOrigins.some((origin) => {
      try {
        return new URL(origin).origin !== apiOrigin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function createAuth(db: AppDatabase, config: AuthConfig) {
  const socialProviders =
    config.githubClientId && config.githubClientSecret
      ? {
          github: {
            clientId: config.githubClientId,
            clientSecret: config.githubClientSecret,
          },
        }
      : undefined;

  const isHttps = config.baseUrl.startsWith("https://");
  const isCrossSiteHttps =
    isHttps && hasCrossOriginTarget(config.baseUrl, config.trustedOrigins);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    secret: config.secret,
    baseURL: config.baseUrl,
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    ...(isCrossSiteHttps
      ? {
          advanced: {
            useSecureCookies: true,
            defaultCookieAttributes: {
              sameSite: "none" as const,
              secure: true,
              httpOnly: true,
            },
          },
        }
      : {}),
    ...(socialProviders ? { socialProviders } : {}),
  });
}

export type AppAuth = ReturnType<typeof createAuth>;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
}
