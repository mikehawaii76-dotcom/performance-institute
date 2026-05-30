const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// In-memory log (replace with a real DB like Fauna or Supabase in production)
// For Netlify, we use Stripe itself as the source of truth via metadata
// This webhook fires on every successful invoice payment

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Only act on successful invoice payments (covers both first payment and recurring)
  if (stripeEvent.type === "invoice.payment_succeeded") {
    const invoice = stripeEvent.data.object;
    const subscriptionId = invoice.subscription;

    if (!subscriptionId) return { statusCode: 200, body: "No subscription" };

    // Retrieve subscription to get our metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const meta = subscription.metadata || {};

    const promoCode = meta.promo_code;
    const repEmail = meta.rep_email;
    const repName = meta.rep_name;
    const repCommission = parseFloat(meta.rep_commission || "0");
    const patientEmail = meta.patient_email || invoice.customer_email || "unknown";
    const amountPaid = invoice.amount_paid / 100;
    const paidAt = new Date(invoice.created * 1000).toISOString();

    // Only log if a valid promo code is attached
    if (promoCode && repEmail) {
      console.log(JSON.stringify({
        event: "referral_payment",
        promoCode,
        repName,
        repEmail,
        repCommission,
        patientEmail,
        amountPaid,
        subscriptionId,
        paidAt,
      }));
      // In production, write this to Supabase/FaunaDB/Airtable here
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
