import Razorpay from "razorpay";

export function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_WEBHOOK_SECRET,
  );
}

export function amountToPaise(amountInr: string): number {
  const [whole, frac = ""] = amountInr.split(".");
  const paise = `${whole}${frac.padEnd(2, "0").slice(0, 2)}`;
  return Number.parseInt(paise, 10);
}
