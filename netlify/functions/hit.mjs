import { getStore } from "@netlify/blobs";

export default async function handler(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return new Response("method not allowed", { status: 405, headers });
  let path = "/";
  let ref = "";
  try {
    const body = await request.json();
    path = String(body.path || "/").slice(0, 200);
    ref = String(body.ref || "").slice(0, 300);
  } catch {}
  // Netlify's modern runtime provides request-scoped Blobs credentials.
  const store = getStore({ name: "donext-metrics", consistency: "strong" });
  const date = new Date().toISOString().slice(0, 10);
  const key = `hits/${date}`;
  const current = (await store.get(key, { type: "json" })) || { date, total: 0, paths: {}, refs: {} };
  current.total = (current.total || 0) + 1;
  current.paths[path] = (current.paths[path] || 0) + 1;
  if (ref) {
    current.refs = current.refs || {};
    current.refs[ref] = (current.refs[ref] || 0) + 1;
  }
  await store.setJSON(key, current);
  return Response.json({ ok: true }, { headers });
}
