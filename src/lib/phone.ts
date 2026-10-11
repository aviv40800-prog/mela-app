// Normalises Israeli mobile numbers to E.164 (+9725XXXXXXXX). Returns null when invalid.
export function normalizeIsraeliPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let local: string;
  if (digits.startsWith("+972")) local = digits.slice(4);
  else if (digits.startsWith("972")) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;
  if (!/^5\d{8}$/.test(local)) return null;
  return `+972${local}`;
}
