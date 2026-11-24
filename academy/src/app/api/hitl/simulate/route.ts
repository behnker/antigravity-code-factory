import { NextResponse } from "next/server";
import { evaluateHitlCommand } from "@/lib/hitl-evaluator";
import {
  HitlSimulateRequestSchema,
  HitlSimulateResponseSchema,
} from "@/lib/schemas";

export const maxDuration = 10;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        {
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: "Content-Type header must be application/json.",
          },
        },
        { status: 415 },
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Request body must be valid JSON.",
          },
        },
        { status: 400 },
      );
    }

    const parsed = HitlSimulateRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Validation failed for HITL simulation request.",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const evaluation = evaluateHitlCommand(
      parsed.data.commandLine,
      parsed.data.bypassSandbox,
    );
    const verifiedResponse = HitlSimulateResponseSchema.parse(evaluation);

    return NextResponse.json(verifiedResponse, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to evaluate HITL command.",
        },
      },
      { status: 500 },
    );
  }
}
