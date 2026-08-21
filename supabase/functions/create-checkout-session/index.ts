import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-03-31.basil",
  httpClient: Stripe.createFetchHttpClient(),
});

// Monthly Creator Pass price ID — needs 'subscription' mode
const SUBSCRIPTION_PRICE = 'price_1U337Z3YM398Mh5D58XFSbiB';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { priceId, userId, successUrl, cancelUrl } = await req.json();

    if (!priceId) {
      throw new Error("priceId is required");
    }

    const mode = priceId === SUBSCRIPTION_PRICE ? "subscription" : "payment";

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      client_reference_id: userId || "anonymous",
      metadata: { userId: userId || "anonymous" },
      success_url: successUrl || "https://drive-app.com/#/library?purchase=success",
      cancel_url: cancelUrl || "https://drive-app.com/#/library?purchase=canceled",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Checkout error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
