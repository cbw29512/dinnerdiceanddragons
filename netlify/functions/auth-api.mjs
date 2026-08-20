import api from "./api.mjs";

function jsonError() {
  return new Response(JSON.stringify({ detail: "Authentication request failed." }), {
    status: 500,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

async function proxyRequest(request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/auth-api(?=\/|$)/, "/api");

  const init = {
    method: request.method,
    headers: request.headers
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  return new Request(url, init);
}

export default async (request) => {
  try {
    return await api(await proxyRequest(request));
  } catch (error) {
    console.error("[Dinner Dice & Dragons] Auth proxy failure", {
      error_type: String(error?.name || error?.constructor?.name || "Error").slice(0, 100)
    });
    return jsonError();
  }
};

export const config = {
  path: "/auth-api/*"
};
