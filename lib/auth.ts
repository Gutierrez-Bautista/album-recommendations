import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import db from "@/src/db/";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  user: {
    additionalFields: {
      role: {
        type: ['user', 'admin'],
        defaultValue: 'user',
        input: false,
        required: true,
      }
    }
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
});