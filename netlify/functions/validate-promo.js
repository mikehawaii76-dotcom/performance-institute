const { calculatePrices, getRep } = require("./db");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const { promoCode } = JSON.parse(event.body);
    const rep = getRep(promoCode);
    if (!rep) {
      return { statusCode: 200, body: JSON.stringify({ valid: false }) };
    }
    const pricing = calculatePrices(promoCode);
    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: true,
        discountedPrice: pricing.discountedPrice,
        savings: parseFloat((pricing.monthlyPrice - pricing.discountedPrice).toFixed(2)),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
