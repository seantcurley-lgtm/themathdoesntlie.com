import { env } from "cloudflare:workers";
import { performAuthoritativeRead } from "@/lib/authoritative-read";
import { ReaderAuthError, verifyCloudflareAccessReader } from "@/lib/cloudflare-access-reader";

export const runtime = "edge";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cf-Access-Jwt-Assertion",
};

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

function config() {
  const bindings = env as unknown as Record<string, unknown>;
  return {
    readerHost: String(bindings.EVIDENCE_ENGINE_READER_HOST ?? ""),
    teamDomain: String(bindings.CF_ACCESS_TEAM_DOMAIN ?? ""),
    audience: String(bindings.CF_ACCESS_AUD ?? ""),
  };
}

export async function GET(request: Request) {
  try {
    await verifyCloudflareAccessReader(request, config());
    const result = await performAuthoritativeRead(request);
    return response(result.body, result.status);
  } catch (error) {
    if (error instanceof ReaderAuthError) return response({ error: error.message, code: error.code }, error.status);
    const message = error instanceof Error ? error.message : "Authoritative read failed.";
    const migrationMissing = message.includes("no such table") || message.includes("no column named") || message.includes("has no column named");
    return response({ error: migrationMissing ? "The authoritative state migration has not been applied." : "Authoritative results are unavailable." }, migrationMissing ? 503 : 400);
  }
}

function methodNotAllowed() {
  return new Response(JSON.stringify({ error: "This facade permits authenticated authoritative GET requests only." }), {
    status: 405,
    headers: { ...privateHeaders, "Content-Type": "application/json", Allow: "GET" },
  });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
