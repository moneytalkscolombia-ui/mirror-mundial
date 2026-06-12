import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization header" }, 401);

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !user) return json({ error: "Invalid session" }, 401);

  const { data: isAdmin } = await anonClient.rpc("is_admin", { p_user_id: user.id });
  if (!isAdmin) return json({ error: "Forbidden: admin required" }, 403);

  const adminClient = createClient(supabaseUrl, serviceKey);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const op = body.op;

  try {
    if (op === "list_users") {
      const { data, error } = await adminClient
        .from("profiles")
        .select("id, email, display_name, champion_pick, is_vip, vip_bonus_points, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ users: data });
    }

    if (op === "set_vip") {
      const { user_id, is_vip } = body;
      if (!user_id || typeof is_vip !== "boolean") return json({ error: "user_id e is_vip requeridos" }, 400);
      const { error } = await adminClient
        .from("profiles")
        .update({ is_vip, vip_bonus_points: is_vip ? 10 : 0 })
        .eq("id", user_id);
      if (error) throw error;
      await adminClient.rpc("refresh_leaderboard").then(() => {}, () => {});
      const { error: refreshErr } = await adminClient.from("leaderboard").select("user_id").limit(1);
      return json({ success: true });
    }

    if (op === "list_matches") {
      const { data, error } = await adminClient
        .from("matches")
        .select("*")
        .order("kickoff_at", { ascending: true });
      if (error) throw error;
      return json({ matches: data });
    }

    if (op === "add_match") {
      const { team_a, team_b, kickoff_at, is_colombia, stage, flag_a, flag_b } = body;
      if (!team_a || !team_b || !kickoff_at || !stage) return json({ error: "Faltan campos" }, 400);
      const { data, error } = await adminClient
        .from("matches")
        .insert({ team_a, team_b, kickoff_at, status: "scheduled", is_colombia: !!is_colombia, stage, flag_a, flag_b })
        .select()
        .single();
      if (error) throw error;
      return json({ match: data });
    }

    if (op === "update_match") {
      const { match_id, fields } = body;
      if (!match_id || !fields) return json({ error: "match_id y fields requeridos" }, 400);
      const allowed = ["team_a", "team_b", "kickoff_at", "is_colombia", "stage", "flag_a", "flag_b", "status"];
      const clean: Record<string, unknown> = {};
      for (const k of allowed) if (k in fields) clean[k] = fields[k];
      const { error } = await adminClient.from("matches").update(clean).eq("id", match_id);
      if (error) throw error;
      return json({ success: true });
    }

    if (op === "preview_resolve") {
      const { match_id, score_a, score_b } = body;
      const { data: match } = await adminClient.from("matches").select("is_colombia").eq("id", match_id).single();
      if (!match) return json({ error: "Partido no existe" }, 404);
      const { data: preds, error } = await adminClient
        .from("predictions")
        .select("user_id, pred_a, pred_b, profiles(display_name)")
        .eq("match_id", match_id);
      if (error) throw error;
      const preview = [];
      for (const p of preds || []) {
        const { data: calc } = await adminClient.rpc("calculate_points", {
          pred_a: p.pred_a, pred_b: p.pred_b, score_a, score_b, is_colombia: match.is_colombia,
        });
        const points = Array.isArray(calc) ? calc[0]?.points : calc?.points;
        preview.push({
          display_name: (p as any).profiles?.display_name,
          pred: `${p.pred_a}-${p.pred_b}`,
          points: points ?? 0,
        });
      }
      return json({ preview, total_predictions: preview.length });
    }

    if (op === "resolve") {
      const { match_id, score_a, score_b } = body;
      if (match_id == null || score_a == null || score_b == null) return json({ error: "Faltan campos" }, 400);
      const { error } = await adminClient.rpc("resolve_match_db", {
        p_match_id: match_id, p_score_a: score_a, p_score_b: score_b,
      });
      if (error) throw error;
      return json({ success: true });
    }

    if (op === "list_predictions") {
      const { match_id } = body;
      const { data, error } = await adminClient
        .from("predictions")
        .select("pred_a, pred_b, points_awarded, last_edited_at, profiles(display_name, email)")
        .eq("match_id", match_id)
        .order("last_edited_at", { ascending: false });
      if (error) throw error;
      return json({ predictions: data });
    }

    return json({ error: "op desconocida" }, 400);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});