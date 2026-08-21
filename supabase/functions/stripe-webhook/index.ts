import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Mapping Stripe Product IDs to credit rewards ($1 = 800 credits rate)
const STRIPE_PRODUCT_MAP: Record<string, { plan?: string; credits: number; tokens?: number }> = {
  'prod_V39P0bldW5B81K': { plan: 'starter', credits: 800, tokens: 1 },
  'prod_V39QUI2q0UksUE': { plan: 'creator', credits: 4000, tokens: 999 },
  'prod_V39Rk4GFXUQzfr': { credits: 4000 },
  'prod_V39RrcOuNLHL0k': { credits: 8000 },
  'prod_V39tRiQNNkEakV': { credits: 16000 },
  'prod_V3A8hGCwQIErJo': { credits: 42000 },
  'prod_V3A8yTBkbqjOSy': { credits: 88000 },
};

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;

      if (userId) {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        for (const item of lineItems.data) {
          const productId = item.price?.product as string;
          const reward = STRIPE_PRODUCT_MAP[productId];

          if (reward) {
            // Update user balance safely in Supabase
            await supabase.rpc("add_user_credits", {
              target_user_id: userId,
              credit_amount: reward.credits,
              token_amount: reward.tokens || 0,
              new_plan: reward.plan || null,
            });

            // Log purchase transaction
            await supabase.from("credit_transactions").insert({
              user_id: userId,
              amount: reward.credits,
              type: "purchase",
              description: `Purchased ${item.description}`,
              stripe_payment_id: session.payment_intent as string,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
