import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import {
  SetPasswordInput,
  UpdateAccountInput,
  type AccountDTO,
  isPureGoogleCognitoUser,
  needsNicknameSetup,
} from '@echotype/shared';
import { parseFederatedTokenClaims } from '@echotype/shared';
import { adminDeleteCognitoUser, adminGetUserPasswordFacts } from '../auth/cognitoAdmin.js';
import { setPasswordForGoogleOnlyUser } from '../auth/googlePasswordSetup.js';
import { loadCognitoConfig } from '../auth/cognitoConfig.js';
import { syncAccountNicknameToCognito } from '../auth/syncAccountNicknameToCognito.js';
import { verifyAccessToken } from '../auth/verifyAccessToken.js';
import { verifyIdToken } from '../auth/verifyIdToken.js';
import { prisma } from '../prisma.js';
import { z } from 'zod';

const DeleteAccountBody = z.object({
  idToken: z.string().min(1).optional(),
  adminCognitoDelete: z.boolean().optional(),
});

function toAccountDTO(user: User, canSetPassword: boolean): AccountDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    needsNicknameSetup: needsNicknameSetup(user.name),
    onboardingSeededAt: user.onboardingSeededAt?.toISOString() ?? null,
    canSetPassword,
  };
}

/** Queried live per request (ADR: no caching) so the flag flips right after set-password. */
async function resolveCanSetPassword(req: FastifyRequest): Promise<boolean> {
  try {
    const { userPoolId } = loadCognitoConfig();
    const facts = await adminGetUserPasswordFacts({
      userPoolId,
      username: req.cognitoUsername,
    });
    return isPureGoogleCognitoUser(facts.userStatus, facts.identitiesRaw);
  } catch (err) {
    // Degrade to false: account page still loads, set-password section just hides.
    req.log.error({ err }, 'canSetPassword lookup failed');
    return false;
  }
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

export async function registerAccountRoutes(api: FastifyInstance) {
  api.get('/account', async (req) => {
    const [user, canSetPassword] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: req.userId } }),
      resolveCanSetPassword(req),
    ]);
    return toAccountDTO(user, canSetPassword);
  });

  api.post('/account/set-password', async (req, reply) => {
    const parsed = SetPasswordInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }

    // Converts the Google-only federated user to a linked native user; eligibility
    // is re-checked live inside (only pure Google users without a password).
    try {
      const result = await setPasswordForGoogleOnlyUser(
        {
          userId: req.userId,
          cognitoUsername: req.cognitoUsername,
          newPassword: parsed.data.newPassword,
        },
        undefined,
        req.log,
      );
      if (result.kind === 'not_eligible') {
        return reply.status(400).send({ error: 'password_already_set' });
      }
    } catch (err) {
      req.log.error({ err }, 'google-only set-password conversion failed');
      return reply.status(502).send({ error: 'cognito_set_password_failed' });
    }

    // Session tokens now belong to the deleted federated user; client logs out.
    return reply.status(204).send();
  });

  api.put('/account', async (req, reply) => {
    const parsed = UpdateAccountInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }

    const accessToken = bearerToken(req.headers.authorization);
    if (!accessToken) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: parsed.data.name },
    });

    try {
      await syncAccountNicknameToCognito(accessToken, parsed.data.name);
    } catch (err) {
      req.log.error({ err }, 'cognito nickname sync failed');
      return reply.status(502).send({ error: 'cognito_sync_failed' });
    }

    return toAccountDTO(user, await resolveCanSetPassword(req));
  });

  api.delete('/account', async (req, reply) => {
    const parsed = DeleteAccountBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }

    await prisma.user.deleteMany({ where: { id: req.userId } });

    if (parsed.data.adminCognitoDelete) {
      const accessToken = bearerToken(req.headers.authorization);
      if (!accessToken || !parsed.data.idToken) {
        return reply.status(400).send({ error: 'id_token_required' });
      }

      let accessPayload: Record<string, unknown>;
      let idPayload: Record<string, unknown>;
      try {
        accessPayload = (await verifyAccessToken(accessToken)) as Record<string, unknown>;
        idPayload = (await verifyIdToken(parsed.data.idToken)) as Record<string, unknown>;
      } catch {
        return reply.status(401).send({ error: 'unauthorized' });
      }

      if (String(accessPayload.sub) !== String(idPayload.sub)) {
        return reply.status(401).send({ error: 'token_mismatch' });
      }

      const claims = parseFederatedTokenClaims(accessPayload, idPayload);
      if (!claims) {
        return reply.status(400).send({ error: 'invalid_token_claims' });
      }

      const { userPoolId } = loadCognitoConfig();
      await adminDeleteCognitoUser({
        userPoolId,
        username: claims.cognitoUsername,
      });
    }

    return reply.status(204).send();
  });
}
