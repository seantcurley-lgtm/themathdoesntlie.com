import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { ReaderAuthError, verifyCloudflareAccessReader } from "../lib/cloudflare-access-reader.ts";

const now = new Date("2026-09-07T20:00:00.000Z");
const issuer = "https://tmdl.cloudflareaccess.com";
const audience = "ee-reader-audience";
const host = "ee.themathdoesntlie.com";
const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "reader-key", alg: "RS256", use: "sig" };
const jwks = createLocalJWKSet({ keys: [jwk] });

async function assertion(overrides = {}, protectedHeader = { alg: "RS256", kid: "reader-key" }) {
  const claims = { sub: "access-user-1", email: "reader@example.com", iss: issuer, aud: audience, iat: 1788810000, nbf: 1788810000, exp: 1788814800, ...overrides };
  return new SignJWT(claims).setProtectedHeader(protectedHeader).sign(privateKey);
}
function request(token, requestHost = host) {
  return new Request(`https://${requestHost}/api/authoritative-results`, { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} });
}
const config = { readerHost: host, teamDomain: "tmdl.cloudflareaccess.com", audience };

test("accepts a pinned RS256 Access assertion with exact issuer, audience, host, time, subject, and email", async () => {
  assert.deepEqual(await verifyCloudflareAccessReader(request(await assertion()), config, { jwks, currentDate: now }), { subject: "access-user-1", email: "reader@example.com" });
});

for (const [name, makeRequest, expected] of [
  ["missing assertion", async () => request(null), "ReaderAuthenticationRequired"],
  ["wrong hostname", async () => request(await assertion(), "worker.example.workers.dev"), "ReaderHostMismatch"],
  ["wrong issuer", async () => request(await assertion({ iss: "https://attacker.example" })), "ReaderAuthenticationInvalid"],
  ["wrong audience", async () => request(await assertion({ aud: "other-app" })), "ReaderAuthenticationInvalid"],
  ["expired token", async () => request(await assertion({ exp: 1788800000 })), "ReaderAuthenticationInvalid"],
  ["future token", async () => request(await assertion({ nbf: 1788820000 })), "ReaderAuthenticationInvalid"],
  ["missing subject", async () => request(await assertion({ sub: undefined })), "ReaderIdentityIncomplete"],
  ["missing email", async () => request(await assertion({ email: undefined })), "ReaderIdentityIncomplete"],
]) {
  test(`fails closed for ${name}`, async () => {
    const candidate = await makeRequest();
    await assert.rejects(() => verifyCloudflareAccessReader(candidate, config, { jwks, currentDate: now }), (error) => error instanceof ReaderAuthError && error.code === expected);
  });
}

test("rejects non-RS256 algorithms before trusting claims", async () => {
  const { privateKey: esPrivate } = await generateKeyPair("ES256");
  const token = await new SignJWT({ sub: "x", email: "x@example.com", iss: issuer, aud: audience, exp: 1788814800 }).setProtectedHeader({ alg: "ES256", kid: "reader-key" }).sign(esPrivate);
  await assert.rejects(() => verifyCloudflareAccessReader(request(token), config, { jwks, currentDate: now }), (error) => error instanceof ReaderAuthError && error.code === "ReaderAuthenticationInvalid");
});

test("rejects a tampered signed assertion", async () => {
  const token = await assertion();
  const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  await assert.rejects(() => verifyCloudflareAccessReader(request(tampered), config, { jwks, currentDate: now }), (error) => error instanceof ReaderAuthError && error.code === "ReaderAuthenticationInvalid");
});

test("fails closed as unavailable when JWKS retrieval fails", async () => {
  const token = await assertion();
  await assert.rejects(() => verifyCloudflareAccessReader(request(token), config, { jwks: async () => { throw new TypeError("network unavailable"); }, currentDate: now }), (error) => error instanceof ReaderAuthError && error.status === 503 && error.code === "ReaderAuthUnavailable");
});
