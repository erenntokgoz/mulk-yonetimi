import { createServer } from "node:http";

// Test-only boundary fixture. The production Next.js page and health client stay real.
let state = "Healthy";
createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/v1/auth/register") {
    response.writeHead(202).end();
    return;
  }
  if (request.method === "POST" && request.url === "/api/v1/auth/confirm-email") {
    response.writeHead(204).end();
    return;
  }
  if (request.method === "POST" && request.url === "/api/v1/auth/login") {
    response.writeHead(204, { "Set-Cookie": "mulk.session=fixture; HttpOnly; SameSite=Lax; Path=/" }).end();
    return;
  }
  if (request.method === "POST" && request.url === "/api/v1/auth/logout") {
    response.writeHead(204, { "Set-Cookie": "mulk.session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" }).end();
    return;
  }
  if (request.method === "GET" && request.url === "/api/v1/me") {
    const authenticated = request.headers.cookie?.includes("mulk.session=fixture");
    response.writeHead(authenticated ? 200 : 401, { "Content-Type": "application/json" });
    response.end(JSON.stringify(authenticated ? { id: "fixture-user" } : { error: "unauthorized" }));
    return;
  }
  if (request.method === "POST" && request.url === "/state") {
    let body = "";
    for await (const chunk of request) body += chunk;
    if (!["Healthy", "Degraded", "Unhealthy", "Disconnected"].includes(body)) {
      response.writeHead(400).end();
      return;
    }
    state = body;
    response.writeHead(204).end();
    return;
  }
  if (request.url !== "/health") {
    response.writeHead(404).end();
    return;
  }
  if (state === "Disconnected") {
    request.socket.destroy();
    return;
  }
  response.writeHead(state === "Unhealthy" ? 503 : 200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    status: state,
    checks: [{ name: "sqlserver", status: state, durationMs: 2, description: null }],
  }));
}).listen(5089, "127.0.0.1");
