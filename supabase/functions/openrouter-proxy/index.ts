import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured in Supabase secrets." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const { endpoint, method = "POST", body } = await req.json();
    if (!endpoint) {
      return new Response(JSON.stringify({ error: "endpoint is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const url = `${OPENROUTER_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://drive-app.com",
        "X-Title": "DRiVE",
      },
    };

    if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const res = await fetch(url, fetchOptions);
    const data = await res.json();

    // Pass through OpenRouter's status code so the client can see the real error
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.status,
    });
  } catch (error: any) {
    console.error("OpenRouter proxy error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
