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
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY not configured in Supabase secrets." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { endpoint, method = "POST", body } = await req.json();
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "endpoint is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // --- INTERCEPT FREE GOOGLE TTS ---
    if (endpoint.startsWith("/v1/text-to-speech/free-google-")) {
      const isWithTimestamps = endpoint.endsWith("/with-timestamps");
      const voiceMatch = endpoint.match(/free-google-([a-z\-A-Z0-9]+)/);
      const rawLang = voiceMatch ? voiceMatch[1] : 'en-US';
      const tl = rawLang.replace('-with', '').replace('-timestamps', '');
      
      const text = body?.text || "No text provided";
      
      // Fetch from Google Translate TTS
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Google TTS failed: ${res.status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
        });
      }
      
      const audioData = await res.arrayBuffer();
      const uint8 = new Uint8Array(audioData);
      
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);

      // Return ElevenLabs-compatible payload
      return new Response(
        JSON.stringify({ 
          audio_base64: base64, 
          content_type: res.headers.get("content-type") || "audio/mpeg",
          alignment: isWithTimestamps ? {
            characters: text.split(''),
            character_start_times_seconds: text.split('').map((_, i) => i * 0.05),
            character_end_times_seconds: text.split('').map((_, i) => (i * 0.05) + 0.05)
          } : undefined
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    // --- END INTERCEPT ---

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

    if (!res.ok) {
      let errDetail = 'ElevenLabs API error';
      try {
        const errJson = await res.json();
        errDetail = errJson?.detail?.message || errJson?.detail || errJson?.error || JSON.stringify(errJson);
      } catch {
        errDetail = await res.text();
      }
      return new Response(JSON.stringify({ error: errDetail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 to client so supabase.functions.invoke doesn't throw FunctionsHttpError
      });
    }

    // ElevenLabs TTS returns audio binary, not JSON
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("audio/") || contentType.includes("octet-stream")) {
      const audioData = await res.arrayBuffer();
      const uint8 = new Uint8Array(audioData);
      // Safe base64 conversion — byte-by-byte to avoid call stack overflow
      // (String.fromCharCode.apply pushes N args onto stack and crashes on large audio)
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);
      return new Response(
        JSON.stringify({ audio_base64: base64, content_type: contentType }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Otherwise return JSON (e.g. voice list)
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("ElevenLabs proxy error:", error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal proxy error' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
