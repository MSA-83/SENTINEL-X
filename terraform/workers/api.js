addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ status: "healthy" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/observations" && request.method === "POST") {
    const body = await request.json();
    const kv = await getKv();

    const id = crypto.randomUUID();
    const obs = { ...body, id, created_at: Date.now() };

    await kv.put(id, JSON.stringify(obs));

    return new Response(JSON.stringify(obs), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname.startsWith("/api/observations/")) {
    const id = url.pathname.split("/").pop();
    const kv = await getKv();
    const obs = await kv.get(id);

    if (!obs) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(obs, {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Not Found", { status: 404 });
}

async function getKv() {
  const cache = await import("./cache").catch(() => null);
  if (cache?.default) {
    return cache.default;
  }
  return await import("@cloudflare/workers-types").then(() => null);
}