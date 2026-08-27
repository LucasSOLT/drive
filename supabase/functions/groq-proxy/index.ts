import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_BASE = "https://api.groq.com/openai/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      throw new Error("GROQ_API_KEY not configured in Supabase secrets.");
    }

    const { endpoint, method = "POST", body } = await req.json();
    if (!endpoint) throw new Error("endpoint is required");

    const url = `${GROQ_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    };

    if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const res = await fetch(url, fetchOptions);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Always return 200 so supabase.functions.invoke doesn't throw FunctionsHttpError
    });
  } catch (error: any) {
    console.error("Groq proxy error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Return 200 even on error so client doesn't get FunctionsHttpError
    });
  }
});
