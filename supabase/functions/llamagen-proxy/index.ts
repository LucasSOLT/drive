import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LLAMAGEN_BASE = "https://api.llamagen.ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LLAMAGEN_API_KEY");
    if (!apiKey) {
      throw new Error("LLAMAGEN_API_KEY environment variable is not configured in Supabase secrets.");
    }

    const { endpoint, method = "POST", body } = await req.json();

    if (!endpoint) {
      throw new Error("endpoint is required");
    }

    const url = `${LLAMAGEN_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    console.log(`LlamaGen proxy: ${method} ${url}`);
    if (body) console.log(`LlamaGen payload:`, JSON.stringify(body));

    const res = await fetch(url, fetchOptions);
    const responseText = await res.text();

    console.log(`LlamaGen response status: ${res.status}`);
    console.log(`LlamaGen response body: ${responseText.substring(0, 500)}`);

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      // If not JSON, wrap the text
      data = { raw: responseText, status: res.status };
    }

    if (!res.ok) {
      return new Response(JSON.stringify({ 
        error: data.message || data.error || `LlamaGen API returned ${res.status}`,
        details: data,
        status: res.status
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 to client so supabase.functions.invoke doesn't throw
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("LlamaGen proxy error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Return 200 so the client gets the error message instead of a generic HTTP error
    });
  }
});
