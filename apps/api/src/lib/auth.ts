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
  corsOrigin: string;
  githubClientId?: string;
  githubClientSecret?: string;
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
    trustedOrigins: [config.corsOrigin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
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
