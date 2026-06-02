import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar JWT del usuario con anon client
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que el usuario es admin
    const { data: isAdmin, error: adminError } = await anonClient.rpc("is_admin", {
      p_user_id: user.id,
    });

    if (adminError) {
      console.error("resolve_match: error checking admin status:", adminError);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A partir de acá, usar service_role client — la key nunca cruzó la red
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { match_id, score_a, score_b } = await req.json();

    if (
      typeof match_id !== "number" || !Number.isInteger(match_id) || match_id < 1 ||
      !Number.isInteger(score_a) || score_a < 0 || score_a > 20 ||
      !Number.isInteger(score_b) || score_b < 0 || score_b > 20
    ) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`resolve_match: admin=${user.id} resolving match_id=${match_id}, score=${score_a}-${score_b}`);

    const { data, error: rpcError } = await adminClient.rpc("resolve_match_db", {
      p_match_id: match_id,
      p_score_a: score_a,
      p_score_b: score_b,
    });

    if (rpcError) {
      if (rpcError.code === "P0002") {
        return new Response(JSON.stringify({ error: "Match not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("resolve_match: rpc error:", rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = data[0];
    console.log(`resolve_match: done. predictions_processed=${summary.predictions_processed}, exact_count=${summary.exact_count}, max_points=${summary.max_points_awarded}`);

    // Broadcast Realtime — no bloquea la respuesta si falla
    const channel = adminClient.channel("leaderboard:updates");
    await channel.subscribe();
    try {
      await channel.send({
        type: "broadcast",
        event: "match_resolved",
        payload: {
          match_id,
          resolved_at: new Date().toISOString(),
          total_users_affected: summary.predictions_processed,
        },
      });
    } catch (broadcastError) {
      console.error("resolve_match: realtime broadcast failed (non-blocking):", broadcastError);
    }
    await adminClient.removeChannel(channel);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          match_id,
          predictions_processed: summary.predictions_processed,
          exact_count: summary.exact_count,
          max_points_awarded: summary.max_points_awarded,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("resolve_match error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
