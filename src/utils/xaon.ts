// System XAON ID Generator
// Format: XX00-XX00 (2 uppercase letters + 2 digits - 2 uppercase letters + 2 digits)
// Example: YE32-GT24, XA12-ON34

export function generateXaonId(seed?: string): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';

  if (seed && seed.trim().length > 0) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    hash = Math.abs(hash);

    const l1 = letters[hash % 26];
    const l2 = letters[Math.floor(hash / 26) % 26];
    const d1 = digits[Math.floor(hash / (26 * 26)) % 10];
    const d2 = digits[Math.floor(hash / (26 * 26 * 10)) % 10];

    const l3 = letters[Math.floor(hash / 7) % 26];
    const l4 = letters[Math.floor(hash / 13) % 26];
    const d3 = digits[Math.floor(hash / 17) % 10];
    const d4 = digits[Math.floor(hash / 23) % 10];

    return `${l1}${l2}${d1}${d2}-${l3}${l4}${d3}${d4}`;
  }

  const getLetters = (count: number) =>
    Array.from({ length: count }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const getDigits = (count: number) =>
    Array.from({ length: count }, () => digits[Math.floor(Math.random() * digits.length)]).join('');

  return `${getLetters(2)}${getDigits(2)}-${getLetters(2)}${getDigits(2)}`;
}

export function formatXaonDisplay(xaonId?: string, fallbackSeed?: string): string {
  if (xaonId && xaonId.trim().length > 0) {
    return xaonId.toUpperCase();
  }
  return generateXaonId(fallbackSeed);
}
