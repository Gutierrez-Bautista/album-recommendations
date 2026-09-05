import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import db from "@/src/db/";
import { nextCookies } from "better-auth/next-js";

import { sessions, users, accounts, verifications } from "@/src/db/schema/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      sessions,
      users,
      accounts,
      verifications
    }
  }),
  user: {
    additionalFields: {
      role: {
        type: ['user', 'admin'],
        defaultValue: 'user',
        input: false,
        required: true,
      }
    },
    deleteUser: { enabled: true },
  },
  socialProviders: {
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    }
  },
  account: {
    encryptOAuthTokens: true,
  },

  plugins: [
    nextCookies(),
  ]
});