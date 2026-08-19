const SAFE_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "if-modified-since",
  "if-none-match"
];
const SAFE_RESPONSE_HEADERS = ["content-type", "content-disposition", "etag", "last-modified"];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function configuredOrigin() {
  const raw = String(process.env.DDD_API_ORIGIN || "").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const localDev = process.env.NETLIFY_DEV === "true" && local;
    if (url.protocol !== "https:" && !localDev) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export default async (request) => {
  const origin = configuredOrigin();
  if (!origin) return json({ detail: "Production API upstream is not configured." }, 503);

  const incoming = new URL(request.url);
  if (origin === incoming.origin) {
    return json({ detail: "Production API upstream is invalid." }, 503);
  }

  const upstream = new URL(`${incoming.pathname}${incoming.search}`, `${origin}/`);
  const headers = new Headers();
  for (const name of SAFE_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-forwarded-proto", "https");

  try {
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body,
      redirect: "follow"
    });

    const responseHeaders = new Headers();
    for (const name of SAFE_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("cache-control", "no-store");
    responseHeaders.set("x-content-type-options", "nosniff");

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("[Dinner Dice & Dragons] API proxy upstream request failed", error);
    return json({ detail: "Production API is temporarily unavailable." }, 502);
  }
};

export const config = {
  path: "/api/*"
};
