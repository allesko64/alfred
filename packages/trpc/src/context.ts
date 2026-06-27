import { db } from "@alfred/db";

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export interface CreateContextOptions {
  session: AuthSession | null;
}

export function createContext({ session }: CreateContextOptions) {
  return {
    db,
    session,
    user: session?.user ?? null,
  };
}

export type Context = ReturnType<typeof createContext>;
