import { ALGORITHM_VERSION } from "@mynted/centering-core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local",
    algorithmVersion: ALGORITHM_VERSION,
  });
}
