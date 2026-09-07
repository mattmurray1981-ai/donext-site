import { getStore } from "@netlify/blobs";

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function store() {
  return getStore({
    name: "donext-metrics",
    consistency: "strong",
    siteID: "ab135705-766e-44d1-b5b9-55c787bd2286",
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "method not allowed" };
  if (!process.env.NETLIFY_BLOBS_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "missing blobs token" }) };
  }
  let path = "/";
  let ref = "";
  try {
    const body = JSON.parse(event.body || "{}");
    path = String(body.path || "/").slice(0, 200);
    ref = String(body.ref || "").slice(0, 300);
  } catch (e) {}
  const s = store();
  const key = `hits/${dayKey()}`;
  const current = (await s.get(key, { type: "json" })) || { date: dayKey(), total: 0, paths: {}, refs: {} };
  current.total = (current.total || 0) + 1;
  current.paths[path] = (current.paths[path] || 0) + 1;
  if (ref) {
    current.refs = current.refs || {};
    current.refs[ref] = (current.refs[ref] || 0) + 1;
  }
  await s.setJSON(key, current);
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}
