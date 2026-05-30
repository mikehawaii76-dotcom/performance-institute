const { calculatePrices } = require("./db");

async function stripeRequest(path, body) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Stripe error");
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { promoCode, patientEmail } = JSON.parse(event.body);
    const pricing = calculatePrices(promoCode);
    const unitAmount = Math.round(pricing.discountedPrice * 100);

    const origin = event.headers.origin ||
      (event.headers.referer ? event.headers.referer.split("/").slice(0,3).join("/") : null) ||
      process.env.SITE_URL;

    const metadata = {
      promo_code: pricing.repCode || "",
      rep_name: pricing.repName || "",
      rep_email: pricing.repEmail || "",
      rep_commission: pricing.repCommission.toString(),
      patient_email: patientEmail || "",
    };

    const sessionBody = {
      mode: "subscription",
      "payment_method_types[]": "card",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": unitAmount.toString(),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": "The Performance Institute — Monthly Membership",
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout.html`,
      ...Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])
      ),
      ...Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [`subscription_data[metadata][${k}]`, v])
      ),
    };

    if (patientEmail) sessionBody.customer_email = patientEmail;

    const session = await stripeRequest("/checkout/sessions", sessionBody);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      }),
    };
  } catch (err) {
    console.error("create-checkout error:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
