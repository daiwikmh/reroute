// MoneyGram's Stellar-based cash-out (MoneyGram Access / MoneyGram Ramps)
// only actually settles in the corridors it's confirmed to have launched in
// — not MoneyGram's much larger ~180-country retail network, most of which
// has no Stellar rail behind it. Confirmed corridors: US, Canada, Kenya, and
// the Philippines (original Oct 2021 launch), plus Colombia and El Salvador
// (2026 Latin America expansion). El Salvador uses USD as its official
// currency, so its payout currency is USD, same as the US.
export type OffRampCountry = {
  country: string;
  name: string;
  currency: string;
};

export const OFFRAMP_COUNTRIES: OffRampCountry[] = [
  { country: "US", name: "United States", currency: "USD" },
  { country: "CA", name: "Canada", currency: "CAD" },
  { country: "KE", name: "Kenya", currency: "KES" },
  { country: "PH", name: "Philippines", currency: "PHP" },
  { country: "CO", name: "Colombia", currency: "COP" },
  { country: "SV", name: "El Salvador", currency: "USD" },
];
