import { NextResponse } from "next/server";
import { getOpenApiDocument } from "@alfred/trpc";

export function GET() {
  return NextResponse.json(getOpenApiDocument());
}
