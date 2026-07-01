import type { PrismaClient, User } from '@prisma/client';

export class ProfileIncompleteError extends Error {
  constructor() {
    super('profile_incomplete');
    this.name = 'ProfileIncompleteError';
  }
}

export type AccessTokenClaims = {
  sub: string;
  email?: string;
  username?: string;
  name?: string;
};

export function resolveUserProfile(claims: AccessTokenClaims): { email: string; name: string } | null {
  const email = claims.email?.trim() || claims.username?.trim() || '';
  const name = claims.name?.trim() || '';
  if (!email || !name) return null;
  return { email, name };
}

export async function ensureUser(prisma: PrismaClient, claims: AccessTokenClaims): Promise<User> {
  const { sub } = claims;
  if (!sub) {
    throw new Error('missing sub');
  }

  const profile = resolveUserProfile(claims);
  const existing = await prisma.user.findUnique({ where: { id: sub } });

  if (existing) {
    if (!profile) return existing;
    const data: { email?: string; name?: string } = {};
    if (profile.email !== existing.email) data.email = profile.email;
    if (profile.name !== existing.name) data.name = profile.name;
    if (Object.keys(data).length === 0) return existing;
    return prisma.user.update({ where: { id: sub }, data });
  }

  if (!profile) {
    throw new ProfileIncompleteError();
  }

  return prisma.user.create({
    data: {
      id: sub,
      email: profile.email,
      name: profile.name,
    },
  });
}
