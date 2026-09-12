import { getStore } from "@netlify/blobs";

export default async function handler(request) {
  const date = new URL(request.url).searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const store = getStore({ name: "donext-metrics", consistency: "strong" });
  const data = (await store.get(`hits/${date}`, { type: "json" })) || { date, total: 0, paths: {} };
  return Response.json(data);
}
