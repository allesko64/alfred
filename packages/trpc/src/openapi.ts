import { generateOpenApiDocument } from "trpc-to-openapi";
import { appRouter } from "./root";

// Generated lazily (not at module load) so a broken openapi annotation on
// any single procedure can't take down every tRPC route that imports this
// package's barrel.
export function getOpenApiDocument() {
  return generateOpenApiDocument(appRouter, {
    title: "Alfred API",
    description: "Alfred AI Software Engineer API Documentation",
    version: "1.0.0",
    baseUrl: "http://localhost:3000/api",
    docsUrl: "http://localhost:3000/docs",
    tags: ["workspace", "feature", "prd", "task", "github", "review", "billing"],
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  });
}
