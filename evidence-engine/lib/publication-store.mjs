import { NO_AUTHORITATIVE_STATE, normalizeSecurityId, selectAuthoritativeState, sha256Text } from "./longitudinal-state.mjs";

export class IntegrityConflictError extends Error {
  constructor(message = "stateFingerprint matched an existing publication with a different recordHash.") {
    super(message);
    this.name = "IntegrityConflictError";
    this.code = "IntegrityConflict";
  }
}

/** Reference append contract used by the D1 route and deterministic unit tests. */
export async function appendImmutableRecord(records, incoming) {
  const computedHash = await sha256Text(incoming.recordJson);
  if (computedHash !== incoming.recordHash) throw new IntegrityConflictError("Incoming exact-record hash is invalid.");
  const existing = records.find((record) => record.stateFingerprint === incoming.stateFingerprint);
  if (existing) {
    if (existing.recordHash !== incoming.recordHash) throw new IntegrityConflictError();
    return { created: false, record: existing };
  }
  if (records.some((record) => record.resultId === incoming.resultId)) {
    throw new IntegrityConflictError("Result ID already identifies a different immutable publication.");
  }
  records.push(Object.freeze({ ...incoming }));
  return { created: true, record: incoming };
}

export function resolveTickerAlias(aliases, ticker, timestamp) {
  const normalized = String(ticker ?? "").trim().toUpperCase();
  const asOf = new Date(timestamp).toISOString();
  const matches = aliases.filter((alias) =>
    alias.ticker === normalized && alias.validFrom <= asOf && (!alias.validTo || alias.validTo > asOf),
  );
  const identities = [...new Set(matches.map((alias) => normalizeSecurityId(alias.securityId)))];
  if (identities.length !== 1) return null;
  return identities[0];
}

export function queryAsOf(records, aliases, { securityId, ticker, timestamp }) {
  const resolved = securityId
    ? normalizeSecurityId(securityId)
    : resolveTickerAlias(aliases, ticker, timestamp);
  if (!resolved) {
    return { kind: NO_AUTHORITATIVE_STATE, asOf: new Date(timestamp).toISOString(), securityId: null };
  }
  return selectAuthoritativeState(records, { securityId: resolved, timestamp });
}
