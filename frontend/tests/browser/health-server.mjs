import { createServer } from "node:http";

// Test-only boundary fixture. The production Next.js page and health client stay real.
let state = "Healthy";
let properties = [];
let propertyListDelay = 0;
const units = new Map();
let tenants = [];
let leases = [];
const leaseRates = new Map();
const leaseRenewals = new Map();
let charges = [];
let payments = [];
let deposits = [];
let expenses = [];
let profile = { displayName: "Test kullanıcısı", email: "fixture@example.test", emailConfirmed: false };
let notificationPreferences = { emailEnabled: false, rentDueEnabled: true, overdueRentEnabled: true, leaseEndEnabled: true, rentAnniversaryEnabled: true };
let notifications = [];
let documents = [];
const idempotentResults = new Map();
let failNextFinanceOnce = false;
let failedRequest = null;
let retryVerified = false;
createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/reset-data") {
    properties = []; units.clear(); tenants = []; leases = []; leaseRates.clear(); leaseRenewals.clear(); charges = []; payments = []; deposits = []; expenses = []; notifications = []; documents = []; idempotentResults.clear();
    profile = { displayName: "Test kullanıcısı", email: "fixture@example.test", emailConfirmed: false };
    notificationPreferences = { emailEnabled: false, rentDueEnabled: true, overdueRentEnabled: true, leaseEndEnabled: true, rentAnniversaryEnabled: true };
    propertyListDelay = 0; failNextFinanceOnce = false; failedRequest = null; retryVerified = false;
    response.writeHead(204).end(); return;
  }
  if (request.method === "POST" && ["/api/v1/auth/forgot-password", "/api/v1/auth/resend-confirmation"].includes(request.url)) {
    response.writeHead(202).end();
    return;
  }
  if (request.method === "POST" && request.url === "/api/v1/auth/reset-password") {
    response.writeHead(204).end();
    return;
  }
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
  if (request.url?.startsWith("/api/v1/me/profile") || request.url?.startsWith("/api/v1/me/notification-preferences")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    if (request.url.startsWith("/api/v1/me/profile")) {
      if (request.method === "PUT") { let body = ""; for await (const chunk of request) body += chunk; profile = { ...profile, ...JSON.parse(body) }; }
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(profile)); return;
    }
    if (request.method === "PUT") { let body = ""; for await (const chunk of request) body += chunk; notificationPreferences = JSON.parse(body); }
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(notificationPreferences)); return;
  }
  if (request.url?.startsWith("/api/v1/notifications")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    if (request.method === "POST" && request.url === "/api/v1/notifications/read-all") {
      const now = new Date().toISOString(); notifications = notifications.map(item => ({ ...item, readAtUtc: item.readAtUtc ?? now }));
      response.writeHead(204).end(); return;
    }
    const markRead = request.url.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
    if (request.method === "PATCH" && markRead) {
      notifications = notifications.map(item => item.id === markRead[1] ? { ...item, readAtUtc: new Date().toISOString() } : item);
      response.writeHead(204).end(); return;
    }
    if (request.method === "GET" && request.url.startsWith("/api/v1/notifications")) {
      const url = new URL(request.url, "http://localhost"); const unreadOnly = url.searchParams.get("unreadOnly") === "true";
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ items: notifications.filter(item => !unreadOnly || !item.readAtUtc), page: 1, pageSize: 25, hasMore: false })); return;
    }
  }
  if (request.url?.startsWith("/api/v1/documents")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    if (request.method === "GET" && request.url.startsWith("/api/v1/documents")) {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ items: documents, page: 1, pageSize: 25, hasMore: false })); return;
    }
    if (request.method === "POST" && request.url.endsWith("/upload-intents")) { response.writeHead(503).end(); return; }
    if (request.method === "POST" && request.url.endsWith("/complete")) { response.writeHead(503).end(); return; }
    if (request.method === "GET" && request.url.endsWith("/download-url")) { response.writeHead(503).end(); return; }
    if (request.method === "DELETE") { documents = []; response.writeHead(204).end(); return; }
  }
  if (request.url?.startsWith("/api/v1/properties")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    if (request.method === "GET" && request.url.startsWith("/api/v1/properties?")) {
      if (propertyListDelay) await new Promise((resolve) => setTimeout(resolve, propertyListDelay));
      const includeArchived = new URL(request.url, "http://localhost").searchParams.get("includeArchived") === "true";
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ items: properties.filter((entry) => includeArchived || !entry.archivedAtUtc), page: 1, pageSize: 25, hasMore: false }));
      return;
    }
    if (request.method === "POST" && request.url === "/api/v1/properties") {
      let body = ""; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      const item = { id: properties.length ? "00000000-0000-0000-0000-000000000002" : "00000000-0000-0000-0000-000000000001", name: input.name, address: input.address,
        propertyKind: input.propertyKind, archivedAtUtc: null, version: "AAAAAAAAB9E=" };
      properties.push(item);
      response.writeHead(201, { "Content-Type": "application/json" }); response.end(JSON.stringify(item)); return;
    }
    const update = request.url.match(/^\/api\/v1\/properties\/([^/]+)$/);
    if (update && request.method === "PATCH") {
      let body = ""; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      const item = properties.find((entry) => entry.id === update[1]);
      if (!item) { response.writeHead(404).end(); return; }
      if (input.version !== item.version || input.name === "Conflict") { response.writeHead(409, { "Content-Type": "application/problem+json" }).end(JSON.stringify({ title: "Mülk değişti. Kaydı yenileyin." })); return; }
      item.name = input.name; item.address = input.address; item.version = "AAAAAAAAB9I=";
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(item)); return;
    }
    const unitRoute = request.url.match(/^\/api\/v1\/properties\/([^/]+)\/units(?:\?.*)?$/);
    if (unitRoute && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json" });
      const includeArchived = new URL(request.url, "http://localhost").searchParams.get("includeArchived") === "true";
      const items = (units.get(unitRoute[1]) ?? []).filter((item) => includeArchived || !item.archivedAtUtc);
      response.end(JSON.stringify({ items, page: 1, pageSize: 25, hasMore: false })); return;
    }
    if (unitRoute && request.method === "POST") {
      let body = ""; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      const item = { id: `00000000-0000-0000-0000-${String((units.get(unitRoute[1]) ?? []).length + 10).padStart(12, "0")}`,
        propertyId: unitRoute[1], label: input.label, usageType: input.usageType, doorNumber: input.doorNumber,
        areaM2: input.areaM2, isDefault: false };
      units.set(unitRoute[1], [...(units.get(unitRoute[1]) ?? []), item]);
      response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(item)); return;
    }
    const unitArchive = request.url.match(/^\/api\/v1\/properties\/([^/]+)\/units\/([^/]+)\/archive$/);
    if (unitArchive && request.method === "POST") {
      const item = (units.get(unitArchive[1]) ?? []).find((entry) => entry.id === unitArchive[2]);
      if (!item) { response.writeHead(404).end(); return; }
      if (leases.some((lease) => lease.unitId === item.id && lease.status === "ACTIVE"))
        { response.writeHead(409).end(); return; }
      item.archivedAtUtc = new Date().toISOString(); response.writeHead(204).end(); return;
    }
    const archive = request.url.match(/^\/api\/v1\/properties\/([^/]+)\/archive$/);
    if (archive && request.method === "POST") {
      let body = ""; for await (const chunk of request) body += chunk;
      if (!JSON.parse(body).version) { response.writeHead(400).end(); return; }
      const item = properties.find((entry) => entry.id === archive[1]);
      if (!item) { response.writeHead(404).end(); return; }
      item.archivedAtUtc = new Date().toISOString(); response.writeHead(204).end(); return;
    }
  }
  if (request.url?.startsWith("/api/v1/tenants")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    if (request.method === "GET" && request.url === "/api/v1/tenants?search=delay") await new Promise((resolve) => setTimeout(resolve, 350));
    if (request.method === "GET" && request.url.startsWith("/api/v1/tenants")) {
      const url = new URL(request.url, "http://localhost"); const q = (url.searchParams.get("q") ?? "").toLocaleLowerCase("tr");
      const includeArchived = url.searchParams.get("includeArchived") === "true";
      const items = tenants.filter((tenant) => (includeArchived || !tenant.archivedAtUtc) && (!q || JSON.stringify(tenant).toLocaleLowerCase("tr").includes(q)));
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ items, page: 1, pageSize: 100, hasMore: false })); return;
    }
    if (request.method === "POST" && request.url === "/api/v1/tenants") {
      let body = ""; for await (const chunk of request) body += chunk; const input = JSON.parse(body);
      const tenant = { id: `00000000-0000-0000-0000-${String(tenants.length + 20).padStart(12, "0")}`, ...input, archivedAtUtc: null, version: "AAAAAAAAB9E=" };
      tenants.push(tenant); response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(tenant)); return;
    }
    const match = request.url.match(/^\/api\/v1\/tenants\/([^/]+)(?:\/archive)?$/);
    const tenant = match && tenants.find((entry) => entry.id === match[1]);
    if (tenant && request.method === "PATCH") {
      let body = ""; for await (const chunk of request) body += chunk; const input = JSON.parse(body);
      if (input.version !== tenant.version || input.email === "conflict@example.test") { response.writeHead(409).end(); return; }
      Object.assign(tenant, input, { version: "AAAAAAAAB9I=" }); response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(tenant)); return;
    }
    if (tenant && request.method === "POST" && request.url.endsWith("/archive")) {
      let body = ""; for await (const chunk of request) body += chunk; if (JSON.parse(body).version !== tenant.version) { response.writeHead(409).end(); return; }
      tenant.archivedAtUtc = new Date().toISOString(); response.writeHead(204).end(); return;
    }
  }
  if (request.url?.startsWith("/api/v1/leases")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    if (request.method === "GET" && request.url.startsWith("/api/v1/leases?")) {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ items: leases, page: 1, pageSize: 100, hasMore: false })); return;
    }
    if (request.method === "POST" && request.url === "/api/v1/leases") {
      let body = ""; for await (const chunk of request) body += chunk; const input = JSON.parse(body);
      const lease = { id: `10000000-0000-0000-0000-${String(leases.length + 1).padStart(12, "0")}`, ...input, status: "DRAFT", terminationDate: null, terminationReason: null, version: "AAAAAAAAB9E=" };
      leases.push(lease); leaseRates.set(lease.id, [{ effectiveFrom: lease.startDate, monthlyAmount: input.monthlyAmount, reason: null }]); leaseRenewals.set(lease.id, []);
      response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(lease)); return;
    }
    const ratesPath = request.url.match(/^\/api\/v1\/leases\/([^/]+)\/rates$/);
    if (ratesPath && request.method === "GET") { response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(leaseRates.get(ratesPath[1]) ?? [])); return; }
    if (ratesPath && request.method === "POST") {
      let body = ""; for await (const chunk of request) body += chunk; const rate = JSON.parse(body);
      leaseRates.set(ratesPath[1], [...(leaseRates.get(ratesPath[1]) ?? []), rate]);
      response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(rate)); return;
    }
    const renewalsPath = request.url.match(/^\/api\/v1\/leases\/([^/]+)\/renewals$/);
    if (renewalsPath && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(leaseRenewals.get(renewalsPath[1]) ?? [])); return;
    }
    if (renewalsPath && request.method === "POST") {
      let body = ""; for await (const chunk of request) body += chunk; const input = JSON.parse(body);
      const lease = leases.find((item) => item.id === renewalsPath[1]);
      if (!lease) { response.writeHead(404).end(); return; }
      if (input.version !== lease.version || lease.status !== "ACTIVE") { response.writeHead(409).end(); return; }
      const renewal = { id: `30000000-0000-0000-0000-${String((leaseRenewals.get(lease.id) ?? []).length + 1).padStart(12, "0")}`,
        previousEndDate: lease.plannedEndDate, newEndDate: input.newEndDate, effectiveFrom: input.effectiveFrom,
        monthlyAmount: input.monthlyAmount, reason: input.reason, occurredAtUtc: new Date().toISOString() };
      lease.plannedEndDate = input.newEndDate; lease.version = "AAAAAAAAB9M=";
      leaseRenewals.set(lease.id, [...(leaseRenewals.get(lease.id) ?? []), renewal]);
      leaseRates.set(lease.id, [...(leaseRates.get(lease.id) ?? []), {
        effectiveFrom: input.effectiveFrom, monthlyAmount: input.monthlyAmount, reason: input.reason }]);
      response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(renewal)); return;
    }
    const action = request.url.match(/^\/api\/v1\/leases\/([^/]+)\/(activate|terminate)$/);
    const lease = action && leases.find((entry) => entry.id === action[1]);
    if (lease && request.method === "POST") {
      let body = ""; for await (const chunk of request) body += chunk; const input = JSON.parse(body);
      if (input.version !== lease.version) { response.writeHead(409).end(); return; }
      if (action[2] === "activate") {
        lease.status = "ACTIVE";
        const rate = (leaseRates.get(lease.id) ?? [])[0];
        charges.push({ id: `20000000-0000-0000-0000-${String(charges.length + 1).padStart(12, "0")}`, leaseId: lease.id, tenantId: lease.tenantId, periodStart: "2026-01-01", dueDate: "2026-01-01", amount: rate?.monthlyAmount ?? lease.monthlyAmount, paidAmount: 0, balance: rate?.monthlyAmount ?? lease.monthlyAmount, status: "UNPAID", isOverdue: false });
      }
      else { lease.status = "TERMINATED"; lease.terminationDate = input.terminationDate; lease.terminationReason = input.reason; }
      lease.version = "AAAAAAAAB9I=";
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(lease)); return;
    }
  }
  if (request.url?.startsWith("/api/v1/deposits")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    const movementRoute = request.url.match(/^\/api\/v1\/deposits\/([^/]+)\/movements(?:\?.*)?$/);
    if (movementRoute && request.method === "GET") { const rows=deposits.find(x=>x.id===movementRoute[1])?.movements??[]; response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({items:rows,page:1,pageSize:100,hasMore:false})); return; }
    if (request.method === "GET") { response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({items:deposits.map(d=>({id:d.id,leaseId:d.leaseId,amountAgreed:d.amountAgreed,custodyType:d.custodyType,note:d.note,balance:d.balance})),page:1,pageSize:100,hasMore:false})); return; }
    let body=""; for await(const chunk of request) body+=chunk; const input=JSON.parse(body); const id=request.headers["idempotency-key"];
    if(id&&idempotentResults.has(id)){response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify(idempotentResults.get(id)));return;}
    let result; if(request.method==="POST"&&request.url==="/api/v1/deposits"){const lease=leases.find(x=>x.id===input.leaseId);if(!lease){response.writeHead(404).end();return;}result={id:`60000000-0000-0000-0000-${String(deposits.length+1).padStart(12,"0")}`,leaseId:lease.id,amountAgreed:lease.depositAmount,custodyType:input.custodyType,note:input.note,balance:0,movements:[]};deposits.push(result);}
    else if(movementRoute&&request.method==="POST"){const deposit=deposits.find(x=>x.id===movementRoute[1]);if(!deposit){response.writeHead(404).end();return;}const value=Number(input.amount)*(input.movementType==="RETURNED"?-1:1);if(deposit.balance+value<0){response.writeHead(409).end();return;}deposit.balance+=value;result={id:`61000000-0000-0000-0000-${String((deposit.movements??[]).length+1).padStart(12,"0")}`,depositId:deposit.id,...input,amount:value};deposit.movements.push(result);}
    else {response.writeHead(404).end();return;} if(id)idempotentResults.set(id,result);response.writeHead(201,{"Content-Type":"application/json"}).end(JSON.stringify(result));return;
  }
  if (request.url?.startsWith("/api/v1/expenses")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    if(request.method==="GET"){const url=new URL(request.url,"http://localhost");const items=expenses.filter(x=>(!url.searchParams.get("fromDate")||x.expenseOn>=url.searchParams.get("fromDate"))&&(!url.searchParams.get("toDate")||x.expenseOn<=url.searchParams.get("toDate")));response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({items,page:1,pageSize:100,hasMore:false}));return;}
    let body="";for await(const chunk of request)body+=chunk;const input=JSON.parse(body);const id=request.headers["idempotency-key"];
    if(id&&idempotentResults.has(id)){response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify(idempotentResults.get(id)));return;}
    if(request.method==="POST"&&request.url==="/api/v1/expenses"){const item={id:`70000000-0000-0000-0000-${String(expenses.length+1).padStart(12,"0")}`,...input,status:"RECORDED",voidedAtUtc:null,voidReason:null};expenses.push(item);if(id)idempotentResults.set(id,item);response.writeHead(201,{"Content-Type":"application/json"}).end(JSON.stringify(item));return;}
    const match=request.url.match(/^\/api\/v1\/expenses\/([^/]+)\/void$/);if(match&&request.method==="POST"){const item=expenses.find(x=>x.id===match[1]);if(!item){response.writeHead(404).end();return;}item.status="VOIDED";item.voidReason=input.reason;item.voidedAtUtc=new Date().toISOString();response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify(item));return;}response.writeHead(404).end();return;
  }
  if(request.url?.startsWith("/api/v1/dashboard/summary")){
    if(!request.headers.cookie?.includes("mulk.session=fixture")){response.writeHead(401).end();return;}response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({periodStart:"2026-11-01",asOf:"2026-11-14",activeProperties:properties.filter(x=>!x.archivedAtUtc).length,totalUnits:[...units.values()].flat().length,occupiedUnits:0,vacantUnits:[...units.values()].flat().length,periodCharges:0,periodUnpaid:0,overdueBalance:0,recordedExpenses:0,cashFlow:{fromDate:"2026-11-01",toDate:"2026-11-14",propertyId:null,unitId:null,cashIn:0,allocated:0,unallocated:0,cashOut:0,netOperatingCashFlow:0}}));return;
  }
  if(request.url?.startsWith("/api/v1/reports/cashflow")){
    if(!request.headers.cookie?.includes("mulk.session=fixture")){response.writeHead(401).end();return;}const url=new URL(request.url,"http://localhost");const fromDate=url.searchParams.get("fromDate")??"2026-01-01";const toDate=url.searchParams.get("toDate")??"2026-12-31";const paid=expenses.filter(x=>x.status==="RECORDED"&&x.paidOn&&x.paidOn>=fromDate&&x.paidOn<=toDate).reduce((a,x)=>a+Number(x.amount),0);response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({fromDate,toDate,propertyId:url.searchParams.get("propertyId"),unitId:url.searchParams.get("unitId"),cashIn:0,allocated:0,unallocated:url.searchParams.has("propertyId")||url.searchParams.has("unitId")?null:0,cashOut:paid,netOperatingCashFlow:-paid}));return;
  }
  if (request.url?.startsWith("/api/v1/rent-charges") || request.url?.startsWith("/api/v1/payments")) {
    if (!request.headers.cookie?.includes("mulk.session=fixture")) { response.writeHead(401).end(); return; }
    if (request.method === "GET" && request.url.startsWith("/api/v1/rent-charges")) {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ items: charges, page: 1, pageSize: 100, hasMore: false })); return;
    }
    if (request.method === "GET" && request.url.startsWith("/api/v1/payments")) {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ items: payments, page: 1, pageSize: 100, hasMore: false })); return;
    }
    let body = ""; for await (const chunk of request) body += chunk;
    const input = JSON.parse(body || "{}"); const key = request.headers["idempotency-key"];
    if (request.method === "POST" && key && failNextFinanceOnce) { failNextFinanceOnce = false; failedRequest = { url: request.url, key, body }; response.writeHead(503).end(); return; }
    if (request.method === "POST" && failedRequest) { retryVerified = failedRequest.url === request.url && failedRequest.key === key && failedRequest.body === body; failedRequest = null; }
    if (key && idempotentResults.has(key)) { const result = idempotentResults.get(key); response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result)); return; }
    let result; let status = 201;
    if (request.method === "POST" && request.url === "/api/v1/payments") {
      result = { id: `30000000-0000-0000-0000-${String(payments.length + 1).padStart(12, "0")}`, ...input, status: "RECORDED", allocatedAmount: 0, unallocatedAmount: input.amount, voidedAtUtc: null, voidReason: null, allocations: [] }; payments.push(result);
    } else if (request.method === "POST" && request.url.endsWith("/allocations")) {
      const paymentId = request.url.split("/")[4]; const payment = payments.find((entry) => entry.id === paymentId); const charge = charges.find((entry) => entry.id === input.rentChargeId);
      if (!payment || !charge || Number(input.amount) > Number(payment.unallocatedAmount) || Number(input.amount) > Number(charge.balance)) { response.writeHead(409).end(); return; }
      const allocation = { id: `40000000-0000-0000-0000-${String((payment.allocations ?? []).length + 1).padStart(12, "0")}`, rentChargeId: charge.id, amount: input.amount, isEffective: true };
      payment.allocations.push(allocation); payment.allocatedAmount = Number(payment.allocatedAmount) + Number(input.amount); payment.unallocatedAmount = Number(payment.amount) - Number(payment.allocatedAmount); charge.paidAmount = Number(charge.paidAmount) + Number(input.amount); charge.balance = Number(charge.amount) - Number(charge.paidAmount); charge.status = charge.balance === 0 ? "PAID" : "PARTIAL"; result = allocation;
    } else if (request.method === "POST" && request.url.endsWith("/void")) {
      const paymentId = request.url.split("/")[4]; result = payments.find((entry) => entry.id === paymentId); if (!result) { response.writeHead(404).end(); return; }
      for (const allocation of result.allocations) { const charge = charges.find((entry) => entry.id === allocation.rentChargeId); if (charge) { charge.paidAmount -= Number(allocation.amount); charge.balance += Number(allocation.amount); charge.status = charge.paidAmount === 0 ? "UNPAID" : "PARTIAL"; } allocation.isEffective = false; }
      result.status = "VOIDED"; result.voidReason = input.reason; result.voidedAtUtc = new Date().toISOString();
    } else if (request.method === "POST" && request.url.includes("/corrections")) {
      const chargeId = request.url.split("/")[4]; const charge = charges.find((entry) => entry.id === chargeId); if (!charge) { response.writeHead(404).end(); return; }
      result = { id: `50000000-0000-0000-0000-${String(Date.now()).slice(-12)}`, rentChargeId: charge.id, previousAmount: charge.amount, amount: input.amount, reason: input.reason, occurredAtUtc: new Date().toISOString() }; charge.amount = input.amount; charge.balance = Number(input.amount) - Number(charge.paidAmount);
    } else { response.writeHead(404).end(); return; }
    if (key) idempotentResults.set(key, result);
    response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(result)); return;
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
  if (request.method === "POST" && request.url === "/finance-fail-once") { failNextFinanceOnce = true; failedRequest = null; retryVerified = false; response.writeHead(204).end(); return; }
  if (request.method === "GET" && request.url === "/finance-retry-verified") { response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ verified: retryVerified })); return; }
  if (request.method === "POST" && request.url === "/properties-delay") {
    let body = ""; for await (const chunk of request) body += chunk;
    propertyListDelay = Number(body) || 0; response.writeHead(204).end(); return;
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
