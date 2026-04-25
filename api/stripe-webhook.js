export const config = { runtime: 'edge' };
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Atomic, idempotent fulfillment via single Postgres function.
// See supabase/migrations/002_idempotent_fulfillment.sql.
async function fulfillPurchase(purchaseId) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/fulfill_purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ p_purchase_id: purchaseId }),
  });

  if (!res.ok) {
    throw new Error(`fulfill_purchase RPC failed: ${await res.text()}`);
  }

  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
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

    try {
      const result = await fulfillPurchase(purchaseId);
      if (!result || result.status === "not_found") {
        console.warn(`pending_purchase not found: ${purchaseId}`);
      } else if (result.status === "already_fulfilled") {
        console.log(`Purchase ${purchaseId} already fulfilled (idempotent retry); skipping`);
      } else if (result.status === "credited") {
        console.log(`Credited ${result.credited} tokens via purchase ${purchaseId}`);
      }
    } catch (err) {
      console.error("Failed to fulfill purchase:", err.message);
      return new Response("Internal error", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}
