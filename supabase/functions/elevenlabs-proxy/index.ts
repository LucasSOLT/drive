import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ELEVENLABS_BASE = "https://api.elevenlabs.io";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY not configured in Supabase secrets.");
    }

    const { endpoint, method = "POST", body } = await req.json();
    if (!endpoint) throw new Error("endpoint is required");

    const url = `${ELEVENLABS_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const res = await fetch(url, fetchOptions);

    // ElevenLabs TTS returns audio binary, not JSON
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("audio/") || contentType.includes("octet-stream")) {
      const audioData = await res.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));
      return new Response(
        JSON.stringify({ audio_base64: base64, content_type: contentType }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: res.status,
        }
      );
    }

    // Otherwise return JSON (e.g. voice list)
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.status,
    });
  } catch (error: any) {
    console.error("ElevenLabs proxy error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
