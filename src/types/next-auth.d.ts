import type { DefaultSession } from "next-auth";

export type AppRole = "ADMIN" | "SPECIALIST" | "STORE";

declare module "next-auth" {
  interface User {
    role: AppRole;
    storeId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: AppRole;
      storeId?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: AppRole;
    storeId?: string | null;
  }
}
