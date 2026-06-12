import "server-only";
import { NextResponse } from "next/server";

/** Creates an Error carrying an HTTP status, picked up by withErrors. */
export function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

function statusOf(err: unknown): number {
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return 500;
}

type RouteContext = { params: Record<string, string> };
type Handler = (req: Request, ctx: RouteContext) => Promise<Response>;

/**
 * Wraps a route handler so thrown errors with a `status` field map to the
 * matching HTTP code (401/403/404/...) and everything else becomes a 500.
 */
export function withErrors(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      const status = statusOf(err);
      const message =
        status === 500
          ? "Internal server error"
          : err instanceof Error
            ? err.message
            : "Request failed";
      if (status === 500) console.error(err);
      return NextResponse.json({ error: message }, { status });
    }
  };
}
