export const config = { runtime: 'edge' };
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function creditTokens(userId, totalTokens, purchaseId) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const headers = {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  // Atomic credit via RPC (bypasses RLS with service key)
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/credit_tokens`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_user_id: userId, p_amount: totalTokens }),
  });

  if (!rpcRes.ok) {
    throw new Error(`credit_tokens RPC failed: ${await rpcRes.text()}`);
  }

  // Mark pending_purchase as fulfilled
  await fetch(`${supabaseUrl}/rest/v1/pending_purchases?id=eq.${purchaseId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fulfilled_at: new Date().toISOString() }),
  });
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const purchaseId = session.client_reference_id;

    if (!purchaseId) {
      console.error("checkout.session.completed missing client_reference_id");
      return new Response("OK", { status: 200 });
    }

    // Look up the pending purchase
    const lookupRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/pending_purchases?id=eq.${purchaseId}&fulfilled_at=is.null&select=*`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    const records = await lookupRes.json();
    if (!records || records.length === 0) {
      // Already fulfilled or not found — idempotent, return 200
      console.warn(`pending_purchase not found or already fulfilled: ${purchaseId}`);
      return new Response("OK", { status: 200 });
    }

    const purchase = records[0];
    try {
      await creditTokens(purchase.user_id, purchase.total_tokens, purchaseId);
      console.log(`Credited ${purchase.total_tokens} tokens to user ${purchase.user_id}`);
    } catch (err) {
      console.error("Failed to credit tokens:", err.message);
      return new Response("Internal error", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}
