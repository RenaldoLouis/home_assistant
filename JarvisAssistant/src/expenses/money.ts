export const money = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

export const compactMoney = (amount: number) =>
  amount >= 1000000
    ? `${(amount / 1000000).toLocaleString('id-ID', {
        maximumFractionDigits: 1,
      })} jt`
    : amount >= 1000
    ? `${(amount / 1000).toLocaleString('id-ID', {
        maximumFractionDigits: 0,
      })} rb`
    : String(amount);
