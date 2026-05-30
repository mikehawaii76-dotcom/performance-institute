const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const { REPS } = require("./db");

const OWNER_EMAIL = "mensperformancemd@gmail.com";

async function sendEmail(to, subject, html) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: `"The Performance Institute" <${process.env.GMAIL_USER}>`,
    to,
    bcc: OWNER_EMAIL,
    subject,
    html,
  });
}

function buildReportEmail(rep, payments, month, year) {
  const totalEarned = payments.reduce((sum, p) => sum + p.commission, 0).toFixed(2);
  const rows = payments.map(p => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${p.patientEmail}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">$${p.amountPaid.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">$${p.commission.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${p.paidAt}</td>
    </tr>
  `).join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0a1628;padding:24px 32px;">
        <h1 style="color:#fff;margin:0;font-size:20px;">The Performance Institute</h1>
        <p style="color:#8899aa;margin:4px 0 0;">Referral Earnings Report</p>
      </div>
      <div style="padding:32px;">
        <p>Hi ${rep.name},</p>
        <p>Here is your referral earnings summary for <strong>${month} ${year}</strong>.</p>
        <div style="background:#f5f7fa;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
          <div style="font-size:13px;color:#666;margin-bottom:4px;">Total earned this month</div>
          <div style="font-size:36px;font-weight:700;color:#0a1628;">$${totalEarned}</div>
          <div style="font-size:13px;color:#666;margin-top:4px;">${payments.length} active patient${payments.length !== 1 ? "s" : ""}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f5f7fa;">
              <th style="padding:8px 12px;text-align:left;color:#666;font-weight:500;">Patient</th>
              <th style="padding:8px 12px;text-align:left;color:#666;font-weight:500;">Billed</th>
              <th style="padding:8px 12px;text-align:left;color:#666;font-weight:500;">Your Commission</th>
              <th style="padding:8px 12px;text-align:left;color:#666;font-weight:500;">Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:32px;font-size:13px;color:#999;">
          Payments are processed by the 10th of the following month.<br>
          Questions? Reply to this email or contact mensperformancemd@gmail.com.
        </p>
      </div>
    </div>
  `;
}

exports.handler = async () => {
  try {
    const now = new Date();
    // Report covers the previous calendar month
    const reportDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthStart = Math.floor(reportDate.getTime() / 1000);
    const monthEnd = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
    const monthName = reportDate.toLocaleString("default", { month: "long" });
    const year = reportDate.getFullYear();

    // Pull all paid invoices from last month
    const invoices = await stripe.invoices.list({
      status: "paid",
      created: { gte: monthStart, lt: monthEnd },
      limit: 100,
    });

    // Group payments by rep promo code
    const repPayments = {};

    for (const invoice of invoices.data) {
      if (!invoice.subscription) continue;
      const sub = await stripe.subscriptions.retrieve(invoice.subscription);
      const meta = sub.metadata || {};
      const code = (meta.promo_code || "").toUpperCase();
      if (!code || !REPS[code]) continue;

      const rep = REPS[code];
      const amountPaid = invoice.amount_paid / 100;
      const commission = parseFloat((amountPaid * (rep.commissionPercent / 100)).toFixed(2));
      const patientEmail = meta.patient_email || invoice.customer_email || "unknown";
      const paidAt = new Date(invoice.created * 1000).toLocaleDateString();

      if (!repPayments[code]) repPayments[code] = [];
      repPayments[code].push({ patientEmail, amountPaid, commission, paidAt });
    }

    // Send a report to each rep who had activity
    for (const [code, payments] of Object.entries(repPayments)) {
      const rep = REPS[code];
      const html = buildReportEmail(rep, payments, monthName, year);
      await sendEmail(
        rep.email,
        `Your Performance Institute Referral Report — ${monthName} ${year}`,
        html
      );
      console.log(`Report sent to ${rep.name} (${rep.email}) — ${payments.length} payments`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ sent: Object.keys(repPayments).length }),
    };
  } catch (err) {
    console.error("monthly-report error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
