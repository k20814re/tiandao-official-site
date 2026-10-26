import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const API = "https://www.travel.taipei/open-api/zh-tw/Events/Activity";
const SOURCE_CODE = "taipei-travel-activity";
const ALLOWED_ORIGINS = new Set([
  "https://tiandaoonline.com",
  "https://www.tiandaoonline.com",
]);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin":
    origin &&
    (ALLOWED_ORIGINS.has(origin) || origin.startsWith("http://127.0.0.1:"))
      ? origin
      : "https://tiandaoonline.com",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

function text(html: unknown) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function lineValue(body: string, labels: string[]) {
  const rows = body
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  for (const row of rows) {
    const label = labels.find((v) => row.startsWith(v));
    if (label)
      return row
        .slice(label.length)
        .replace(/^[：:｜|]\s*/, "")
        .trim();
  }
  return "";
}
function toIso(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function authorized(req: Request, userClient: any) {
  const cronSecret = Deno.env.get("TAIPEI_SYNC_SECRET");
  const supplied = req.headers.get("x-sync-secret");
  if (cronSecret && supplied && supplied === cronSecret) return true;
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return false;
  const { data } = await userClient
    .from("exhibition_admin_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.role === "publisher";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST")
    return Response.json(
      { error: "method_not_allowed" },
      { status: 405, headers: cors(origin) },
    );

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
  });
  if (!(await authorized(req, userClient)))
    return Response.json(
      { error: "publisher_required" },
      { status: 403, headers: cors(origin) },
    );

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: source, error: sourceError } = await db
    .from("trade_event_sources")
    .select("id")
    .eq("code", SOURCE_CODE)
    .single();
  if (sourceError)
    return Response.json(
      { error: "source_not_configured", detail: sourceError.message },
      { status: 500, headers: cors(origin) },
    );

  let page = 1;
  let totalCount = Number.POSITIVE_INFINITY;
  let fetched = 0;
  let createdOrUpdated = 0;
  const failures: string[] = [];

  do {
    const response = await fetch(API + "?page=" + page, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TianDaoCommerce/1.0 (+https://tiandaoonline.com)",
      },
    });
    if (!response.ok) throw new Error("Taipei API HTTP " + response.status);
    const body = await response.json();
    totalCount = Math.max(0, Number(body.total || 0));
    const rows = Array.isArray(body.data) ? body.data : [];
    fetched += rows.length;

    const keys = rows.map((row: any) => "taipei-travel:" + row.id);
    const { data: existing } = await db
      .from("trade_events")
      .select("canonical_key,publication_status")
      .in("canonical_key", keys);
    const statuses = new Map(
      (existing ?? []).map((row: any) => [
        row.canonical_key,
        row.publication_status,
      ]),
    );

    const normalized = rows.flatMap((row: any) => {
      const startsAt = toIso(row.begin);
      const endsAt = toIso(row.end);
      if (!row.id || !row.title || !startsAt || !endsAt) {
        failures.push(
          "page " +
            page +
            " id " +
            String(row.id ?? "?") +
            ": required field missing",
        );
        return [];
      }
      const description = text(row.description);
      const canonicalKey = "taipei-travel:" + row.id;
      const address = String(
        row.address || lineValue(description, ["展覽地址", "活動地址", "地址"]),
      ).trim();
      const venue = lineValue(description, [
        "展覽地點",
        "活動地點",
        "地點",
        "Venue",
      ]);
      const openHours = lineValue(description, [
        "開放時間",
        "參觀時間",
        "營業時間",
        "時間",
      ]);
      return [
        {
          canonical_key: canonicalKey,
          title_zh: String(row.title).trim(),
          summary: description.slice(0, 12000),
          industry: "觀光活動",
          event_type: "activity",
          country_code: "TW",
          city: "臺北市",
          venue_name: venue || null,
          address: address || null,
          latitude: row.nlat ? Number(row.nlat) : null,
          longitude: row.elong ? Number(row.elong) : null,
          starts_at: startsAt,
          ends_at: endsAt,
          daily_hours: openHours
            ? [{ raw: openHours, source: "description", needs_review: true }]
            : [],
          organizer_name: String(row.organizer || "").trim() || null,
          official_url: String(row.url || "").trim() || null,
          registration_url: Array.isArray(row.links)
            ? (row.links.find((link: any) => /報名/.test(String(link.subject)))
                ?.src ?? null)
            : null,
          ticket_info: String(row.ticket || "").trim() || null,
          status: "scheduled",
          verification_status: "single_official_source",
          publication_status: statuses.get(canonicalKey) === "published" ? "published" : "draft",
          source_id: source.id,
          external_id: String(row.id),
          timezone: "Asia/Taipei",
          currency_code: "TWD",
          translations: {},
          last_seen_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
          source_updated_at: toIso(row.modified),
          deleted_at: null,
        },
      ];
    });

    if (normalized.length) {
      const { error } = await db
        .from("trade_events")
        .upsert(normalized, { onConflict: "canonical_key" });
      if (error) throw error;
      createdOrUpdated += normalized.length;
    }
    page += 1;
  } while (fetched < totalCount && page <= 100);

  return Response.json(
    {
      source: SOURCE_CODE,
      fetched,
      created_or_updated: createdOrUpdated,
      review_required: true,
      failures: failures.slice(0, 25),
    },
    { headers: { ...cors(origin), "Content-Type": "application/json" } },
  );
});

