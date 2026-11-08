// KI-Coach für das Trading Journal
// Schickt die Journal-Daten an Claude und gibt die Analyse zurück.
// Secret in Supabase: ANTHROPIC_API_KEY

const ALLOWED_USER = "8ac534c7-d4e7-4af9-931b-076f5197cf25"; // nur Myrons Account
const ORIGINS = ["https://myronmg.github.io"];
const MODEL = "claude-sonnet-5-5";
const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const SYSTEM =
  "Du bist ein erfahrener, ehrlicher Trading-Coach für Krypto-Futures-Trader. " +
  "Du arbeitest nur mit den Daten, die du bekommst, nennst konkrete Zahlen und gibst umsetzbare, messbare Regeln. " +
  "Kein Disclaimer-Gerede, keine erfundenen Fakten. Antworte auf Deutsch, locker (du), in Markdown.";

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
  if (!KEY) return json(req, { error: "ANTHROPIC_API_KEY fehlt: in Supabase → Edge Functions → Secrets eintragen." }, 500);

  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").slice(0, 150000);
  if (prompt.length < 50) return json(req, { error: "Keine Daten übergeben." }, 400);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return json(req, { error: "Claude API: " + (j?.error?.message ?? r.status) }, 502);

  const text = (j.content ?? [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n")
    .trim();
  return json(req, { text });
});
