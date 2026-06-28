import { createAuthClient } from "better-auth/react";

// No baseURL: requests stay same-origin so this works whether the app is
// opened via localhost or the ngrok tunnel, without hardcoding either.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
