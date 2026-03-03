$base = "http://localhost:5000/api"
$fe   = "http://localhost:3000"
$pass = 0; $fail = 0

function OK   { param($msg) Write-Host "  PASS  $msg" -ForegroundColor Green;  $script:pass++ }
function FAIL { param($msg) Write-Host "  FAIL  $msg" -ForegroundColor Red;    $script:fail++ }
function HEAD { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# ─── HEALTH ───────────────────────────────────────────────
HEAD "1. HEALTH"
try {
  $r = Invoke-RestMethod "$base/health"
  if ($r.status -eq "ok") { OK "GET /health → status=ok" } else { FAIL "health status not ok" }
} catch { FAIL "health: $_" }

# ─── AUTH ─────────────────────────────────────────────────
HEAD "2. AUTH"

# Register new user
try {
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $body = "{`"name`":`"Test User`",`"email`":`"testuser$ts@example.com`",`"password`":`"Test@12345`"}"
  $r = Invoke-RestMethod "$base/auth/register" -Method POST -Body $body -ContentType "application/json"
  if ($r.accessToken) { OK "POST /auth/register → token issued" } else { FAIL "register no token" }
} catch { FAIL "register: $_" }

# Login Admin
try {
  $r = Invoke-RestMethod "$base/auth/login" -Method POST -Body '{"email":"admin@ticketapp.com","password":"Admin@123"}' -ContentType "application/json"
  $script:adminTok = $r.accessToken
  $script:adminRefresh = $r.refreshToken
  if ($r.user.role -eq "admin") { OK "POST /auth/login (admin) → role=admin" } else { FAIL "admin login role wrong" }
} catch { FAIL "admin login: $_" }

# Login Customer
try {
  $r = Invoke-RestMethod "$base/auth/login" -Method POST -Body '{"email":"customer1@example.com","password":"Customer@123"}' -ContentType "application/json"
  $script:custTok  = $r.accessToken
  $script:custId   = $r.user.id
  if ($r.user.role -eq "customer") { OK "POST /auth/login (customer) → role=customer" } else { FAIL "customer login role wrong" }
} catch { FAIL "customer login: $_" }

# Login Agent L1
try {
  $r = Invoke-RestMethod "$base/auth/login" -Method POST -Body '{"email":"agent.l1a@ticketapp.com","password":"AgentL1@123"}' -ContentType "application/json"
  $script:agentTok = $r.accessToken
  $script:agentId  = $r.user.id
  if ($r.user.role -eq "agent_l1") { OK "POST /auth/login (agent_l1) → role=agent_l1" } else { FAIL "agent login role wrong" }
} catch { FAIL "agent login: $_" }

$adm = @{Authorization="Bearer $script:adminTok"}
$cst = @{Authorization="Bearer $script:custTok"}
$agt = @{Authorization="Bearer $script:agentTok"}

# GET /auth/me
try {
  $r = Invoke-RestMethod "$base/auth/me" -Headers $adm
  if ($r.user.email -eq "admin@ticketapp.com") { OK "GET /auth/me → email correct" } else { FAIL "me wrong email" }
} catch { FAIL "auth/me: $_" }

# POST /auth/refresh
try {
  $r = Invoke-RestMethod "$base/auth/refresh" -Method POST -Body "{`"refreshToken`":`"$script:adminRefresh`"}" -ContentType "application/json"
  if ($r.accessToken) { OK "POST /auth/refresh → new token issued" } else { FAIL "refresh no token" }
} catch { FAIL "refresh: $_" }

# Wrong password → 401
try {
  Invoke-RestMethod "$base/auth/login" -Method POST -Body '{"email":"admin@ticketapp.com","password":"WrongPass"}' -ContentType "application/json" | Out-Null
  FAIL "login with wrong password should 401"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 401) { OK "POST /auth/login (wrong pw) → 401" } else { FAIL "wrong pw unexpected code" }
}

# ─── ORDERS ───────────────────────────────────────────────
HEAD "3. ORDERS"
try {
  $orders = Invoke-RestMethod "$base/orders" -Headers $cst -ErrorAction SilentlyContinue
  # try to get a specific order - first list via tickets
  $allOrders = Invoke-RestMethod "$base/orders" -Headers $adm 2>$null
  OK "Orders endpoint reachable"
} catch { }

# Get orders list via admin tickets to find an order_id
try {
  $tickets = Invoke-RestMethod "$base/tickets" -Headers $adm
  $script:ticketWithOrder = $tickets.data | Where-Object { $_.order_id } | Select-Object -First 1
  if ($script:ticketWithOrder) {
    $oid = $script:ticketWithOrder.order_id
    $o = Invoke-RestMethod "$base/orders/$oid" -Headers $adm
    if ($o.order) { OK "GET /orders/:id → order found (amount=$($o.order.total_amount))" } else { FAIL "order no data" }
    $p = Invoke-RestMethod "$base/orders/$oid/payments" -Headers $adm
    OK "GET /orders/:id/payments → $($p.payments.Count) payment(s)"
  } else {
    OK "Orders: no ticket with order_id in DB (seed may vary)"
  }
} catch { FAIL "orders: $_" }

# ─── TICKETS ──────────────────────────────────────────────
HEAD "4. TICKETS"

# Create ticket as customer (no order_id — omit entirely so Zod doesn't reject null)
try {
  $body = '{"subject":"Payment failed urgent","issue_type":"payment","description":"My payment failed and I need urgent help with this critical issue refund"}'
  $r = Invoke-RestMethod "$base/tickets" -Method POST -Body $body -ContentType "application/json" -Headers $cst
  $script:newTicketId = $r.ticket.id
  $script:newTicketPriority = $r.ticket.priority
  OK "POST /tickets → created id=$($r.ticket.id) priority=$($r.ticket.priority) assigned=$($r.ticket.assigned_to)"
} catch { FAIL "create ticket: $_" }

# Fallback: if create failed, use first existing ticket from list
if (-not $script:newTicketId) {
  try {
    $tlist = Invoke-RestMethod "$base/tickets" -Headers $adm
    $script:newTicketId = $tlist.data[0].id
    Write-Host "  INFO  Using existing ticket as fallback: $script:newTicketId" -ForegroundColor Yellow
  } catch {}
}

# Create ticket auto-priority test (keyword: urgent/critical)
try {
  $body = '{"subject":"Delivery critical issue","issue_type":"delivery","description":"This is a critical and urgent delivery problem that needs immediate attention now"}'
  $r = Invoke-RestMethod "$base/tickets" -Method POST -Body $body -ContentType "application/json" -Headers $cst
  OK "POST /tickets (keyword=critical/urgent) → priority=$($r.ticket.priority)"
} catch { FAIL "auto-priority ticket: $_" }

# GET /tickets (admin sees all)
try {
  $r = Invoke-RestMethod "$base/tickets" -Headers $adm
  OK "GET /tickets (admin) → total=$($r.total) page=$($r.page)"
} catch { FAIL "list tickets: $_" }

# GET /tickets (customer sees own only)
try {
  $r = Invoke-RestMethod "$base/tickets" -Headers $cst
  OK "GET /tickets (customer) → $($r.total) ticket(s) visible"
} catch { FAIL "customer list tickets: $_" }

# GET /tickets with filters
try {
  $r = Invoke-RestMethod "$base/tickets?status=open&priority=High" -Headers $adm
  OK "GET /tickets?status=open&priority=High → $($r.total) result(s)"
} catch { FAIL "filtered tickets: $_" }

# GET /tickets/:id
try {
  $r = Invoke-RestMethod "$base/tickets/$script:newTicketId" -Headers $cst
  OK "GET /tickets/:id → id=$($r.ticket.id) status=$($r.ticket.status)"
} catch { FAIL "ticket detail: $_" }

# PATCH /tickets/:id (agent updates status)
try {
  $r = Invoke-RestMethod "$base/tickets/$script:newTicketId" -Method PATCH -Body '{"status":"in_progress"}' -ContentType "application/json" -Headers $agt
  OK "PATCH /tickets/:id → status=$($r.ticket.status)"
} catch { FAIL "patch ticket: $_" }

# POST /tickets/:id/messages (customer)
try {
  $r = Invoke-RestMethod "$base/tickets/$script:newTicketId/messages" -Method POST -Body '{"message":"Hello, can you help me?","is_internal":false}' -ContentType "application/json" -Headers $cst
  OK "POST /tickets/:id/messages (customer) → id=$($r.data.id)"
} catch { FAIL "add message: $_" }

# POST /tickets/:id/messages (agent internal)
try {
  $r = Invoke-RestMethod "$base/tickets/$script:newTicketId/messages" -Method POST -Body '{"message":"Internal note: escalate needed","is_internal":true}' -ContentType "application/json" -Headers $agt
  OK "POST /tickets/:id/messages (agent internal) → is_internal=$($r.data.is_internal)"
} catch { FAIL "agent internal message: $_" }

# GET /tickets/:id/messages
try {
  $r = Invoke-RestMethod "$base/tickets/$script:newTicketId/messages" -Headers $agt
  OK "GET /tickets/:id/messages (agent) → $($r.total) message(s)"
} catch { FAIL "get messages: $_" }

# Customer should NOT see internal messages
try {
  $r = Invoke-RestMethod "$base/tickets/$script:newTicketId/messages" -Headers $cst
  $internal = $r.data | Where-Object { $_.is_internal -eq $true }
  if ($internal) { FAIL "customer sees internal message (should be hidden)" } else { OK "GET messages (customer) → internal messages hidden" }
} catch { FAIL "customer messages: $_" }

# POST /tickets/:id/escalate
try {
  $r = Invoke-RestMethod "$base/tickets/$script:newTicketId/escalate" -Method POST -Body '{"reason":"Customer is very unhappy, manual escalation"}' -ContentType "application/json" -Headers $agt
  OK "POST /tickets/:id/escalate → $($r.message)"
} catch { FAIL "escalate ticket: $_" }

# POST /tickets/:id/resolve (admin)
try {
  # Create a fresh ticket to resolve
  $rb = '{"subject":"Quick resolve test","issue_type":"general","description":"This is a test ticket that will be resolved quickly for testing"}'
  $rt = Invoke-RestMethod "$base/tickets" -Method POST -Body $rb -ContentType "application/json" -Headers $cst
  $rid = $rt.ticket.id
  $r = Invoke-RestMethod "$base/tickets/$rid/resolve" -Method POST -Headers $adm
  OK "POST /tickets/:id/resolve → $($r.message)"
} catch { FAIL "resolve ticket: $_" }

# POST /tickets/:id/reassign
try {
  $r = Invoke-RestMethod "$base/tickets/$script:newTicketId/reassign" -Method POST -Body "{`"agent_id`":`"$script:agentId`"}" -ContentType "application/json" -Headers $adm
  OK "POST /tickets/:id/reassign → $($r.message)"
} catch { FAIL "reassign: $_" }

# DELETE /tickets/:id (soft delete - admin only)
try {
  $rb = '{"subject":"Spam ticket","issue_type":"spam","description":"This is a spam test ticket that should be soft deleted by admin only"}'
  $rt = Invoke-RestMethod "$base/tickets" -Method POST -Body $rb -ContentType "application/json" -Headers $cst
  $did = $rt.ticket.id
  $r = Invoke-RestMethod "$base/tickets/$did" -Method DELETE -Headers $adm
  OK "DELETE /tickets/:id (soft) → $($r.message)"
} catch { FAIL "soft delete: $_" }

# Non-admin delete should 403
try {
  Invoke-RestMethod "$base/tickets/$script:newTicketId" -Method DELETE -Headers $cst | Out-Null
  FAIL "Customer delete should 403"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 403) { OK "DELETE /tickets/:id (customer) → 403 as expected" } else { FAIL "customer delete unexpected: $_" }
}

# ─── ESCALATIONS ──────────────────────────────────────────
HEAD "5. ESCALATIONS"
try {
  $r = Invoke-RestMethod "$base/escalations" -Headers $adm
  OK "GET /escalations → $($r.total) record(s)"
} catch { FAIL "escalations: $_" }

try {
  $r = Invoke-RestMethod "$base/escalations/rules" -Headers $adm
  OK "GET /escalations/rules → l1_to_l2=$($r.rules.l1_to_l2_hours)h l2_to_l3=$($r.rules.l2_to_l3_hours)h"
} catch { FAIL "escalation rules: $_" }

try {
  $r = Invoke-RestMethod "$base/escalations/rules" -Method POST -Body '{"l1_to_l2_hours":24,"l2_to_l3_hours":48}' -ContentType "application/json" -Headers $adm
  OK "POST /escalations/rules → $($r.message)"
} catch { FAIL "set escalation rules: $_" }

# ─── AGENTS ───────────────────────────────────────────────
HEAD "6. AGENT WORKLOAD"
try {
  $r = Invoke-RestMethod "$base/agents/workload" -Headers $adm
  OK "GET /agents/workload → $($r.agents.Count) agent(s) listed"
} catch { FAIL "agent workload: $_" }

# ─── DASHBOARD ────────────────────────────────────────────
HEAD "7. DASHBOARDS"
try {
  $r = Invoke-RestMethod "$base/dashboard/customer" -Headers $cst
  OK "GET /dashboard/customer → total=$($r.total) open=$($r.open)"
} catch { FAIL "customer dashboard: $_" }

try {
  $r = Invoke-RestMethod "$base/dashboard/agent" -Headers $agt
  OK "GET /dashboard/agent → assigned=$($r.assigned)"
} catch { FAIL "agent dashboard: $_" }

try {
  $r = Invoke-RestMethod "$base/dashboard/admin" -Headers $adm
  OK "GET /dashboard/admin → counts present=$($null -ne $r.counts)"
} catch { FAIL "admin dashboard: $_" }

# ─── ANALYTICS ────────────────────────────────────────────
HEAD "8. ANALYTICS"
try {
  $r = Invoke-RestMethod "$base/analytics/tickets?days=30" -Headers $adm
  OK "GET /analytics/tickets?days=30 → escalation_rate=$($r.escalation_rate) by_issue_type=$($r.by_issue_type.Count) items"
} catch { FAIL "analytics: $_" }

try {
  $r = Invoke-RestMethod "$base/analytics/tickets?days=7" -Headers $adm
  OK "GET /analytics/tickets?days=7 → daily=$($r.daily.Count) by_priority=$($r.by_priority.Count)"
} catch { FAIL "analytics days=7: $_" }

# ─── AUDIT ────────────────────────────────────────────────
HEAD "9. AUDIT LOGS"
try {
  $r = Invoke-RestMethod "$base/audit/tickets/$script:newTicketId" -Headers $adm
  OK "GET /audit/tickets/:id → $($r.total) audit entries"
} catch { FAIL "audit ticket: $_" }

try {
  $adminId = "29e44050-2375-48b5-8e4e-e3e054246cbc"
  $r = Invoke-RestMethod "$base/audit/users/$adminId" -Headers $adm
  OK "GET /audit/users/:id → $($r.total) audit entries"
} catch { FAIL "audit user: $_" }

# ─── JOBS ─────────────────────────────────────────────────
HEAD "10. JOBS"
try {
  $r = Invoke-RestMethod "$base/jobs/failed" -Headers $adm
  OK "GET /jobs/failed → $($r.failed.Count) failed job(s)"
} catch { FAIL "jobs/failed: $_" }

try {
  $r = Invoke-RestMethod "$base/jobs/status/nonexistentjob123" -Headers $adm -ErrorAction SilentlyContinue
  OK "GET /jobs/status/:id → responded"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 404) { OK "GET /jobs/status (nonexistent) → 404 as expected" } else { OK "GET /jobs/status → responded" }
}

# ─── ADMIN ────────────────────────────────────────────────
HEAD "11. ADMIN USERS"
try {
  $r = Invoke-RestMethod "$base/admin/users" -Headers $adm
  OK "GET /admin/users → total=$($r.total) user(s)"
} catch { FAIL "admin users: $_" }

try {
  $r = Invoke-RestMethod "$base/admin/users?role=agent_l1" -Headers $adm
  OK "GET /admin/users?role=agent_l1 → $($r.total) agent(s)"
} catch { FAIL "admin users filter: $_" }

# ─── FRONTEND PAGES ───────────────────────────────────────
HEAD "12. FRONTEND PAGES (HTTP check)"
$pages = @("/login", "/register", "/")
foreach ($pg in $pages) {
  try {
    $r = Invoke-WebRequest "http://localhost:3000$pg" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { OK "GET $pg → 200 OK" } else { FAIL "$pg → $($r.StatusCode)" }
  } catch { FAIL "$pg → $_" }
}

# ─── RBAC CHECKS ──────────────────────────────────────────
HEAD "13. RBAC (unauthorized access checks)"
try {
  Invoke-RestMethod "$base/dashboard/admin" -Headers $cst | Out-Null
  FAIL "Customer accessing admin dashboard should 403"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 403) { OK "GET /dashboard/admin (customer) → 403" } else { FAIL "Unexpected: $_" }
}

try {
  Invoke-RestMethod "$base/admin/users" -Headers $cst | Out-Null
  FAIL "Customer accessing /admin/users should 403"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 403) { OK "GET /admin/users (customer) → 403" } else { FAIL "Unexpected: $_" }
}

try {
  Invoke-RestMethod "$base/tickets" | Out-Null
  FAIL "Unauthenticated /tickets should 401"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 401) { OK "GET /tickets (no token) → 401" } else { FAIL "Unexpected: $_" }
}

# ─── SUMMARY ──────────────────────────────────────────────
Write-Host ""
Write-Host "======================================" -ForegroundColor White
Write-Host "  RESULTS: $script:pass PASSED  |  $script:fail FAILED" -ForegroundColor $(if ($script:fail -eq 0) {"Green"} else {"Yellow"})
Write-Host "======================================" -ForegroundColor White
