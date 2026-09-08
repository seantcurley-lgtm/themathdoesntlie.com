import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

const loaderSource = `
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return {
        url: "data:text/javascript,export const env = {};",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  }
`;
register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, import.meta.url);

test("renders the public TMDL workbench shell", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>Evidence Engine \| The Math Doesn&#x27;t Lie<\/title>/);
  assert.match(html, /Return to The Math Doesn&#x27;t Lie/);
  assert.match(html, />History</);
  assert.match(html, /Browser publication unavailable/);
  assert.match(html, /Resolving authoritative state/);
  assert.match(html, />Scoring</);
  assert.match(html, /Microsoft Corporation/);
});

test("built authoritative facade fails closed and exposes no mutation method", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("reader-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const runtime = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const context = { waitUntil() {}, passThroughOnException() {} };
  const unconfigured = await worker.fetch(new Request("https://ee.themathdoesntlie.com/api/authoritative-results"), runtime, context);
  assert.equal(unconfigured.status, 503);
  assert.match(unconfigured.headers.get("cache-control") ?? "", /private, no-store/);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const mutation = await worker.fetch(new Request("https://ee.themathdoesntlie.com/api/authoritative-results", { method, body: method === "POST" ? "{}" : undefined }), runtime, context);
    assert.equal(mutation.status, 405);
    assert.equal(mutation.headers.get("allow"), "GET");
  }
});

test("built state service rejects anonymous publication and keeps History private", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("authorization-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/evaluations", { method: "POST", body: "{}" }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 403);
  assert.match(await response.text(), /requires job authorization/i);

  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const mutation = await worker.fetch(
      new Request("http://localhost/api/evaluations?id=eer_fixture", { method }),
      { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(mutation.status, 405);
  }
});
