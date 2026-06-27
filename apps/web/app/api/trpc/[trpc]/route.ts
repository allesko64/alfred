import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@alfred/trpc";
import { auth } from "@/lib/auth";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await auth.api.getSession({ headers: req.headers });

      return createContext({
        session: session
          ? {
              user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
              },
            }
          : null,
      });
    },
  });

export { handler as GET, handler as POST };
