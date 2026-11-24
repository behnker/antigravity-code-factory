import { NextResponse } from "next/server";
import { z } from "zod";
import { queryCourses } from "@/lib/repository";
import { PaginationQuerySchema } from "@/lib/schemas";

export const maxDuration = 10;

const CoursesQuerySchema = PaginationQuerySchema.extend({
  level: z
    .enum(["beginner", "intermediate", "senior", "all-levels"])
    .optional(),
  tag: z.string().trim().min(1).max(40).optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const rawParams: Record<string, string | undefined> = {
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      level: url.searchParams.get("level") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
    };

    const parsed = CoursesQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_QUERY",
            message: "Invalid query parameters for /api/courses.",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const result = queryCourses({
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      level: parsed.data.level,
      tag: parsed.data.tag,
    });

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to load course catalog.",
        },
      },
      { status: 500 },
    );
  }
}
