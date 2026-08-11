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
  assert.doesNotMatch(html, />History</);
  assert.match(html, /Public mode · local exports/);
  assert.match(html, />Scoring</);
  assert.match(html, /Microsoft Corporation/);
});
