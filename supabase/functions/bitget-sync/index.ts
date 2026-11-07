// Bitget -> Trading Journal Sync
// Holt geschlossene Futures-Positionen (read-only) und gibt sie ans Journal zurück.
// Secrets in Supabase: BITGET_API_KEY, BITGET_API_SECRET, BITGET_PASSPHRASE

const ALLOWED_USER = "8ac534c7-d4e7-4af9-931b-076f5197cf25"; // nur Myrons Account
const ORIGINS = ["https://myronmg.github.io"];
const BASE = "https://api.bitget.com";
const DAY = 86400000;

const KEY = Deno.env.get("BITGET_API_KEY") ?? "";
const SECRET = Deno.env.get("BITGET_API_SECRET") ?? "";
const PASS = Deno.env.get("BITGET_PASSPHRASE") ?? "";

type Pos = {
  id: string; symbol: string; side: string; entry: number; exit: number;
  size: number; pnl: number; fees: number; open: number; close: number;
};

function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  const ok = ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": ok ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });

async function sign(msg: string) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
  let b = "";
  for (const c of s) b += String.fromCharCode(c);
  return btoa(b);
}

async function bg(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const pq = path + (qs ? "?" + qs : "");
  const ts = Date.now().toString();
  const r = await fetch(BASE + pq, {
    headers: {
      "ACCESS-KEY": KEY,
      "ACCESS-SIGN": await sign(ts + "GET" + pq),
      "ACCESS-TIMESTAMP": ts,
      "ACCESS-PASSPHRASE": PASS,
      "Content-Type": "application/json",
      "locale": "en-US",
    },
  });
  const j = await r.json().catch(() => ({}));
  if (j.code !== "00000") throw new Error(`Bitget ${j.code ?? r.status}: ${j.msg ?? "Fehler"}`);
  return j.data;
}

const n = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : Number(v));

// Klassisches Konto: /api/v2/mix/position/history-position
async function v2(productType: string, start: number, end: number): Promise<Pos[]> {
  const out: Pos[] = [];
  let cur = "";
  for (let i = 0; i < 30; i++) {
    const p: Record<string, string> = { productType, startTime: String(start), endTime: String(end), limit: "100" };
    if (cur) p.idLessThan = cur;
    const d = await bg("/api/v2/mix/position/history-position", p);
    const list = d?.list ?? [];
    for (const x of list) {
      out.push({
        id: String(x.positionId), symbol: x.symbol, side: String(x.holdSide ?? "").toLowerCase(),
        entry: n(x.openAvgPrice), exit: n(x.closeAvgPrice), size: n(x.closeTotalPos ?? x.openTotalPos),
        pnl: x.netProfit != null ? n(x.netProfit) : n(x.pnl) + n(x.openFee) + n(x.closeFee) + n(x.totalFunding),
        fees: n(x.openFee) + n(x.closeFee) + n(x.totalFunding),
        open: n(x.ctime ?? x.cTime), close: n(x.utime ?? x.uTime),
      });
    }
    if (list.length < 100 || !d?.endId || d.endId === cur) break;
    cur = d.endId;
  }
  return out;
}

// Unified Trading Account: /api/v3/position/history-position
async function v3(category: string, start: number, end: number): Promise<Pos[]> {
  const out: Pos[] = [];
  let cur = "";
  for (let i = 0; i < 30; i++) {
    const p: Record<string, string> = { category, startTime: String(start), endTime: String(end), limit: "100" };
    if (cur) p.cursor = cur;
    const d = await bg("/api/v3/position/history-position", p);
    const list = d?.list ?? [];
    for (const x of list) {
      out.push({
        id: String(x.positionId), symbol: x.symbol, side: String(x.posSide ?? x.holdSide ?? "").toLowerCase(),
        entry: n(x.openPriceAvg), exit: n(x.closePriceAvg), size: n(x.closeTotalPos ?? x.openTotalPos),
        pnl: n(x.netProfit),
        fees: n(x.openFeeTotal) + n(x.closeFeeTotal) + n(x.totalFunding),
        open: n(x.createdTime), close: n(x.updatedTime),
      });
    }
    if (list.length < 100 || !d?.cursor || d.cursor === cur) break;
    cur = d.cursor;
  }
  return out;
}

async function userId(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", {
    headers: { Authorization: auth, apikey },
  });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Nur POST" }, 405);

  if ((await userId(req)) !== ALLOWED_USER) return json(req, { error: "Nicht berechtigt – bitte im Journal einloggen." }, 401);
  if (!KEY || !SECRET || !PASS) return json(req, { error: "Bitget-Keys fehlen: BITGET_API_KEY, BITGET_API_SECRET und BITGET_PASSPHRASE in Supabase → Edge Functions → Secrets eintragen." }, 500);

  const body = await req.json().catch(() => ({}));
  const end = Date.now();
  const start = Math.max(Number(body.since) || end - 30 * DAY, end - 89 * DAY);

  const all = new Map<string, Pos>();
  const errors: string[] = [];
  let okCalls = 0;

  for (const t of ["USDT-FUTURES", "USDC-FUTURES"]) {
    try { for (const p of await v2(t, start, end)) all.set(p.id, p); okCalls++; }
    catch (e) { errors.push(`v2 ${t}: ${(e as Error).message}`); }
  }
  if (all.size === 0) {
    for (const t of ["USDT-FUTURES", "USDC-FUTURES"]) {
      try { for (const p of await v3(t, start, end)) all.set(p.id, p); okCalls++; }
      catch (e) { errors.push(`v3 ${t}: ${(e as Error).message}`); }
    }
  }

  if (!okCalls) return json(req, { error: errors[0] ?? "Bitget nicht erreichbar", details: errors }, 502);

  const positions = [...all.values()].filter((p) => p.close).sort((a, b) => a.close - b.close);
  return json(req, { positions, from: start, to: end });
});
