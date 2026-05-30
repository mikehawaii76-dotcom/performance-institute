// Rep registry - add new reps here
// promo codes are case-insensitive (always stored/compared uppercase)
const REPS = {
  TEST: {
    name: "Test Test",
    email: "Mikehawaii76@gmail.com",
    code: "TEST",
    discountPercent: 10,   // patient gets 10% off
    commissionPercent: 20, // rep earns 20% of discounted price
  },
};

const BASE_PRICE = 199.00;

function getRep(promoCode) {
  if (!promoCode) return null;
  return REPS[promoCode.toUpperCase()] || null;
}

function calculatePrices(promoCode) {
  const rep = getRep(promoCode);
  if (!rep) {
    return {
      monthlyPrice: BASE_PRICE,
      discountedPrice: BASE_PRICE,
      repCommission: 0,
      repCode: null,
    };
  }
  const discountedPrice = parseFloat((BASE_PRICE * (1 - rep.discountPercent / 100)).toFixed(2));
  const repCommission = parseFloat((discountedPrice * (rep.commissionPercent / 100)).toFixed(2));
  return {
    monthlyPrice: BASE_PRICE,
    discountedPrice,
    repCommission,
    repCode: rep.code,
    repName: rep.name,
    repEmail: rep.email,
  };
}

module.exports = { getRep, calculatePrices, REPS, BASE_PRICE };
