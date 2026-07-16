import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CognitoNativeUserProfile } from '../auth/cognitoAdmin.js';
import type { FederatedLinkOutcome } from '../auth/federatedLink.js';
import {
  reconcileLinkedNativeAccount,
  type LinkedNativeAccountDeps,
} from './federatedAuth.js';

const email = 'pending-native@example.com';
const nativeUsername = '690e8408-6001-7078-d5b4-694c1c970e50';
const profile: CognitoNativeUserProfile = {
  username: nativeUsername,
  sub: nativeUsername,
  email,
  name: 'PreservedNick',
};
const identities = [
  {
    userId: '107121059094644779940',
    providerName: 'Google',
    providerType: 'Google',
  },
];

function missingUserDeps(calls: string[]): LinkedNativeAccountDeps {
  return {
    findUserByEmail: async (actualEmail) => {
      calls.push(`find:${actualEmail}`);
      return null;
    },
    getNativeProfile: async (actualUsername) => {
      calls.push(`get:${actualUsername}`);
      return profile;
    },
    upsertUserByEmail: async (data) => {
      calls.push(`upsert:${data.id}:${data.email}:${data.name}`);
      return { id: data.id, name: data.name };
    },
    syncNativeAttributes: async (actualUsername, name) => {
      calls.push(`sync:${actualUsername}:${name}`);
    },
  };
}

describe('reconcileLinkedNativeAccount', () => {
  it('materializes the native Postgres user after a new link', async () => {
    const calls: string[] = [];
    const result: FederatedLinkOutcome = {
      linked: true,
      requiresReauth: true,
      reason: 'linked',
      nativeUsername,
    };

    await reconcileLinkedNativeAccount(
      result,
      {
        sub: 'orphan-sub',
        email,
        'cognito:username': 'Google_107121059094644779940',
      },
      {
        sub: 'orphan-sub',
        email,
        'cognito:username': 'Google_107121059094644779940',
        identities,
      },
      missingUserDeps(calls),
    );

    assert.deepEqual(calls, [
      `find:${email}`,
      `get:${nativeUsername}`,
      `upsert:${nativeUsername}:${email}:PreservedNick`,
      `sync:${nativeUsername}:PreservedNick`,
    ]);
  });

  it('recovers an already-linked account whose Postgres row is still missing', async () => {
    const calls: string[] = [];
    const result: FederatedLinkOutcome = {
      linked: false,
      requiresReauth: false,
      reason: 'already_linked',
    };

    await reconcileLinkedNativeAccount(
      result,
      {
        sub: nativeUsername,
        email,
        'cognito:username': nativeUsername,
      },
      {
        sub: nativeUsername,
        email,
        'cognito:username': nativeUsername,
        identities,
      },
      missingUserDeps(calls),
    );

    assert.deepEqual(calls, [
      `find:${email}`,
      `get:${nativeUsername}`,
      `upsert:${nativeUsername}:${email}:PreservedNick`,
      `sync:${nativeUsername}:PreservedNick`,
    ]);
  });
});
