import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";

export type ReaderIdentity = { subject: string; email: string };
export type ReaderAuthConfig = { readerHost: string; teamDomain: string; audience: string };

export class ReaderAuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ReaderAuthError";
  }
}

const remoteKeys = new Map<string, JWTVerifyGetKey>();

function required(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ReaderAuthError(503, "ReaderAuthUnavailable", `${name} is not configured.`);
  }
  return value.trim();
}

export function normalizeReaderAuthConfig(config: ReaderAuthConfig) {
  const readerHost = required(config.readerHost, "EVIDENCE_ENGINE_READER_HOST").toLowerCase();
  const rawTeamDomain = required(config.teamDomain, "CF_ACCESS_TEAM_DOMAIN");
  const issuerUrl = new URL(rawTeamDomain.includes("://") ? rawTeamDomain : `https://${rawTeamDomain}`);
  if (issuerUrl.protocol !== "https:" || issuerUrl.pathname !== "/" || issuerUrl.search || issuerUrl.hash) {
    throw new ReaderAuthError(503, "ReaderAuthUnavailable", "CF_ACCESS_TEAM_DOMAIN must be an HTTPS origin.");
  }
  return { readerHost, issuer: issuerUrl.origin, audience: required(config.audience, "CF_ACCESS_AUD") };
}

function remoteJwks(issuer: string) {
  let jwks = remoteKeys.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
      cacheMaxAge: 10 * 60_000,
      cooldownDuration: 30_000,
    });
    remoteKeys.set(issuer, jwks);
  }
  return jwks;
}

export async function verifyCloudflareAccessReader(
  request: Request,
  config: ReaderAuthConfig,
  options: { jwks?: JWTVerifyGetKey; currentDate?: Date } = {},
): Promise<ReaderIdentity> {
  const normalized = normalizeReaderAuthConfig(config);
  if (new URL(request.url).hostname.toLowerCase() !== normalized.readerHost) {
    throw new ReaderAuthError(403, "ReaderHostMismatch", "Authoritative reads are limited to the configured first-party host.");
  }
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion) {
    throw new ReaderAuthError(401, "ReaderAuthenticationRequired", "A verified Cloudflare Access identity is required.");
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(assertion, options.jwks ?? remoteJwks(normalized.issuer), {
      algorithms: ["RS256"], issuer: normalized.issuer, audience: normalized.audience,
      currentDate: options.currentDate,
    }));
  } catch (error) {
    if (!(error instanceof errors.JOSEError)) {
      throw new ReaderAuthError(503, "ReaderAuthUnavailable", "Cloudflare Access verification keys are unavailable.");
    }
    throw new ReaderAuthError(403, "ReaderAuthenticationInvalid", "The Cloudflare Access identity could not be verified.");
  }
  if (typeof payload.sub !== "string" || !payload.sub.trim() || typeof payload.email !== "string" || !payload.email.trim()) {
    throw new ReaderAuthError(403, "ReaderIdentityIncomplete", "The verified identity is missing required claims.");
  }
  return { subject: payload.sub, email: payload.email };
}
