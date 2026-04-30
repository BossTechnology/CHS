export const config = { runtime: 'edge' };
import Stripe from "stripe";
import { withNewRelic, nrLog } from './_newrelic.js'

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

export default withNewRelic("stripe-webhook", async function handler(req) {
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
    nrLog(`Stripe webhook signature verification failed: ${err.message}`, "error", { handler: "stripe-webhook" });
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const purchaseId = session.client_reference_id;

    if (!purchaseId) {
      nrLog("checkout.session.completed missing client_reference_id", "error", { handler: "stripe-webhook" });
      return new Response("OK", { status: 200 });
    }

    try {
      const result = await fulfillPurchase(purchaseId);
      if (!result || result.status === "not_found") {
        nrLog(`pending_purchase not found: ${purchaseId}`, "warn", { handler: "stripe-webhook", purchaseId });
      } else if (result.status === "already_fulfilled") {
        nrLog(`Purchase ${purchaseId} already fulfilled (idempotent retry)`, "info", { handler: "stripe-webhook", purchaseId });
      } else if (result.status === "credited") {
        nrLog(`Credited ${result.credited} tokens via purchase ${purchaseId}`, "info", { handler: "stripe-webhook", purchaseId, credited: result.credited });
      }
    } catch (err) {
      nrLog(`Failed to fulfill purchase: ${err.message}`, "error", { handler: "stripe-webhook", purchaseId });
      return new Response("Internal error", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
});
