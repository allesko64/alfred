import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  spec: {
    url: "/api/docs",
  },
  theme: "deepSpace",
  darkMode: true,
  showSidebar: true,
  pageTitle: "Alfred API Reference",
});
