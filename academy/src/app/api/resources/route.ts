import { NextResponse } from "next/server";
import { z } from "zod";
import { queryResources } from "@/lib/repository";
import {
  PaginationQuerySchema,
  RepoResourceCategorySchema,
} from "@/lib/schemas";

export const maxDuration = 10;

const ResourcesQuerySchema = PaginationQuerySchema.extend({
  category: RepoResourceCategorySchema.optional(),
  q: z.string().trim().max(80).optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const rawParams: Record<string, string | undefined> = {
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    };

    const parsed = ResourcesQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_QUERY",
            message: "Invalid query parameters for /api/resources.",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const result = queryResources({
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      category: parsed.data.category,
      q: parsed.data.q && parsed.data.q.length > 0 ? parsed.data.q : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to query repository resources.",
        },
      },
      { status: 500 },
    );
  }
}
