import { getStore } from "@netlify/blobs";

function store() {
  return getStore({
    name: "donext-metrics",
    consistency: "strong",
    siteID: "ab135705-766e-44d1-b5b9-55c787bd2286",
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

export async function handler(event) {
  const date = (event.queryStringParameters && event.queryStringParameters.date) || new Date().toISOString().slice(0, 10);
  if (!process.env.NETLIFY_BLOBS_TOKEN) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "missing blobs token" }) };
  }
  const s = store();
  const data = (await s.get(`hits/${date}`, { type: "json" })) || { date, total: 0, paths: {} };
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
