/** Decode JWT payload for display/session hints only — not signature verification. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  const segment = parts[1];
  if (!segment) return {};
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function jwtExpirySeconds(token: string): number | null {
  const exp = decodeJwtPayload(token).exp;
  return typeof exp === 'number' ? exp : null;
}

export function claimString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
