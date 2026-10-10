// A pack is a purchase. Duplicate pulls train existing cards; they do not refund coins.
export function settlePackPurchase(balance: number, cost: number, duplicateUpgrades: number): {
  balance: number;
  duplicateUpgrades: number;
} | null {
  if (!Number.isFinite(balance) || !Number.isFinite(cost) || cost < 0 || balance < cost) return null;
  return { balance: balance - cost, duplicateUpgrades: Math.max(0, Math.floor(duplicateUpgrades)) };
}
