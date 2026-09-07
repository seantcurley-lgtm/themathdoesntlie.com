import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generationEvents, generationManifests } from "@/db/schema";
import { sha256Text, stableSerialize, verifyBearerAuthorization } from "@/lib/longitudinal-state.mjs";

export const runtime = "edge";

async function authorized(request: Request) {
  return verifyBearerAuthorization(
    request.headers.get("authorization"),
    (env as unknown as Record<string, unknown>).EVIDENCE_ENGINE_PUBLICATION_TOKEN,
  );
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return Response.json({ error: "Controlled Evidence Engine state access requires job authorization." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return Response.json({ error: "generation id is required." }, { status: 400 });
  try {
    const db = getDb();
    const [manifest] = await db.select().from(generationManifests).where(eq(generationManifests.id, id)).limit(1);
    if (!manifest) return Response.json({ error: "Generation manifest not found." }, { status: 404 });
    const events = await db.select().from(generationEvents).where(eq(generationEvents.generationId, id));
    return Response.json({ manifest: JSON.parse(manifest.manifestJson), manifestHash: manifest.manifestHash, events: events.map((event) => JSON.parse(event.detailJson)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Generation lookup failed." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ error: "Anonymous generation publication is prohibited." }, { status: 403 });
  try {
    const payload = await request.json() as { manifest?: Record<string, unknown>; events?: Array<Record<string, unknown>> };
    if (!payload.manifest || !Array.isArray(payload.events)) throw new Error("manifest and events are required.");
    const manifestJson = stableSerialize(payload.manifest);
    const manifestHash = await sha256Text(manifestJson);
    const generationId = String(payload.manifest.generationId ?? "");
    if (!generationId) throw new Error("manifest.generationId is required.");
    const db = getDb();
    const [existing] = await db.select().from(generationManifests).where(eq(generationManifests.id, generationId)).limit(1);
    if (existing) {
      if (existing.manifestHash !== manifestHash) return Response.json({ error: "Generation ID already has a different immutable manifest.", code: "IntegrityConflict" }, { status: 409 });
      return Response.json({ generationId, manifestHash, created: false });
    }
    for (let index = 0; index < payload.events.length; index += 1) {
      const event = payload.events[index];
      await db.insert(generationEvents).values({ id: `ege_${await sha256Text(`${generationId}|${index}|${stableSerialize(event)}`)}`, generationId, occurredAt: String(event.occurredAt ?? payload.manifest.completedAt), securityId: event.securityId == null ? null : String(event.securityId), outcome: String(event.outcome ?? "Failed"), resultId: event.resultId == null ? null : String(event.resultId), detailJson: stableSerialize(event) }).onConflictDoNothing();
    }
    await db.insert(generationManifests).values({ id: generationId, startedAt: String(payload.manifest.startedAt), completedAt: String(payload.manifest.completedAt), status: Number(payload.manifest.failedCount ?? 0) > 0 ? "CompletedWithFailures" : "Completed", manifestHash, manifestJson });
    return Response.json({ generationId, manifestHash, created: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Generation publication failed." }, { status: 400 });
  }
}
