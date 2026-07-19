import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { GooglePasswordSetupDeps } from './googlePasswordSetup.js';
import { setPasswordForGoogleOnlyUser } from './googlePasswordSetup.js';

process.env.COGNITO_USER_POOL_ID ??= 'ap-southeast-2_test';
process.env.COGNITO_CLIENT_ID ??= 'test-client';
process.env.COGNITO_REGION ??= 'ap-southeast-2';

const GOOGLE_SUB = '102517236086495542136';
const ORPHAN_USERNAME = `Google_${GOOGLE_SUB}`;
const OLD_SUB = 'f92ef468-3031-7016-8540-3889b018e6d8';
const NEW_SUB = '11111111-2222-3333-4444-555555555555';

const pureGoogleIdentities = JSON.stringify([
  { userId: GOOGLE_SUB, providerName: 'Google', providerType: 'Google', primary: 'true' },
]);

type Call = { name: string; args: unknown };

function buildDeps(overrides: Partial<GooglePasswordSetupDeps> = {}) {
  const calls: Call[] = [];
  const deps: GooglePasswordSetupDeps = {
    adminGetUserPasswordFacts: async (args) => {
      calls.push({ name: 'getFacts', args });
      return { userStatus: 'EXTERNAL_PROVIDER', identitiesRaw: pureGoogleIdentities };
    },
    adminListUsersByEmail: async (args) => {
      calls.push({ name: 'listByEmail', args });
      // Default: only the orphan holds the email (fresh conversion).
      return [{ username: ORPHAN_USERNAME, status: 'EXTERNAL_PROVIDER', sub: OLD_SUB }];
    },
    adminCreateNativeUser: async (args) => {
      calls.push({ name: 'createNative', args });
      return { username: NEW_SUB, sub: NEW_SUB };
    },
    adminSetPermanentUserPassword: async (args) => {
      calls.push({ name: 'setPassword', args });
    },
    adminDeleteCognitoUser: async (args) => {
      calls.push({ name: 'deleteUser', args });
    },
    adminLinkGoogleToNativeUser: async (args) => {
      calls.push({ name: 'link', args });
    },
    findUserById: async (id) => {
      calls.push({ name: 'findUser', args: id });
      return { email: 'user@example.com', name: 'Nick' };
    },
    migrateUserId: async (oldId, newId) => {
      calls.push({ name: 'migrateId', args: { oldId, newId } });
    },
    reportError: (error) => {
      calls.push({ name: 'reportError', args: error });
    },
    ...overrides,
  };
  return { deps, calls };
}

describe('setPasswordForGoogleOnlyUser (create-first order)', () => {
  let input: { userId: string; cognitoUsername: string; newPassword: string };

  beforeEach(() => {
    input = { userId: OLD_SUB, cognitoUsername: ORPHAN_USERNAME, newPassword: 'Abcdef12' };
  });

  it('converts: create native -> set password -> migrate id -> delete orphan -> link', async () => {
    const { deps, calls } = buildDeps();
    const result = await setPasswordForGoogleOnlyUser(input, deps);

    assert.deepEqual(result, { kind: 'converted' });
    assert.deepEqual(
      calls.map((c) => c.name),
      [
        'getFacts',
        'findUser',
        'listByEmail',
        'createNative',
        'setPassword',
        'migrateId',
        'deleteUser',
        'link',
      ],
    );

    const create = calls.find((c) => c.name === 'createNative')?.args as {
      email: string;
      name?: string;
    };
    assert.equal(create.email, 'user@example.com');
    assert.equal(create.name, 'Nick');

    const set = calls.find((c) => c.name === 'setPassword')?.args as {
      username: string;
      password: string;
    };
    assert.equal(set.username, NEW_SUB);
    assert.equal(set.password, 'Abcdef12');

    const migrate = calls.find((c) => c.name === 'migrateId')?.args as {
      oldId: string;
      newId: string;
    };
    assert.deepEqual(migrate, { oldId: OLD_SUB, newId: NEW_SUB });

    const del = calls.find((c) => c.name === 'deleteUser')?.args as { username: string };
    assert.equal(del.username, ORPHAN_USERNAME);

    const link = calls.find((c) => c.name === 'link')?.args as {
      nativeUsername: string;
      googleSub: string;
    };
    assert.equal(link.nativeUsername, NEW_SUB);
    assert.equal(link.googleSub, GOOGLE_SUB);
  });

  it('resumes a half-built native twin instead of creating a duplicate', async () => {
    const { deps, calls } = buildDeps({
      adminListUsersByEmail: async () => [
        { username: ORPHAN_USERNAME, status: 'EXTERNAL_PROVIDER', sub: OLD_SUB },
        { username: NEW_SUB, status: 'FORCE_CHANGE_PASSWORD', sub: NEW_SUB },
      ],
    });
    const result = await setPasswordForGoogleOnlyUser(input, deps);

    assert.deepEqual(result, { kind: 'converted' });
    assert.equal(calls.some((c) => c.name === 'createNative'), false);
    const set = calls.find((c) => c.name === 'setPassword')?.args as { username: string };
    assert.equal(set.username, NEW_SUB);
  });

  it('returns not_eligible for a CONFIRMED session user (password already exists)', async () => {
    const { deps, calls } = buildDeps({
      adminGetUserPasswordFacts: async () => ({
        userStatus: 'CONFIRMED',
        identitiesRaw: pureGoogleIdentities,
      }),
    });
    const result = await setPasswordForGoogleOnlyUser(input, deps);

    assert.deepEqual(result, { kind: 'not_eligible' });
    assert.equal(calls.some((c) => c.name === 'createNative'), false);
    assert.equal(calls.some((c) => c.name === 'deleteUser'), false);
  });

  it('returns not_eligible for an EXTERNAL_PROVIDER user without Google identity', async () => {
    const { deps } = buildDeps({
      adminGetUserPasswordFacts: async () => ({
        userStatus: 'EXTERNAL_PROVIDER',
        identitiesRaw: undefined,
      }),
    });
    const result = await setPasswordForGoogleOnlyUser(input, deps);
    assert.deepEqual(result, { kind: 'not_eligible' });
  });

  it('throws before any Cognito mutation when the Postgres row is missing', async () => {
    const { deps, calls } = buildDeps({ findUserById: async () => null });

    await assert.rejects(
      () => setPasswordForGoogleOnlyUser(input, deps),
      /postgres_user_missing/,
    );
    assert.equal(calls.some((c) => c.name === 'createNative'), false);
    assert.equal(calls.some((c) => c.name === 'deleteUser'), false);
  });

  it('compensates a migration failure by deleting the native twin, then rethrows', async () => {
    const { deps, calls } = buildDeps({
      migrateUserId: async () => {
        throw new Error('db_down');
      },
    });

    await assert.rejects(() => setPasswordForGoogleOnlyUser(input, deps), /db_down/);

    const deletes = calls.filter((c) => c.name === 'deleteUser');
    assert.equal(deletes.length, 1);
    assert.equal((deletes[0]!.args as { username: string }).username, NEW_SUB);
    // Orphan untouched; failure reported.
    assert.equal(calls.some((c) => c.name === 'link'), false);
    assert.equal(calls.some((c) => c.name === 'reportError'), true);
  });

  it('reports but rethrows original error when compensation delete also fails', async () => {
    const { deps, calls } = buildDeps({
      migrateUserId: async () => {
        throw new Error('db_down');
      },
      adminDeleteCognitoUser: async () => {
        throw new Error('cognito_down');
      },
    });

    await assert.rejects(() => setPasswordForGoogleOnlyUser(input, deps), /db_down/);
    assert.equal(calls.filter((c) => c.name === 'reportError').length, 2);
  });

  it('still succeeds when orphan delete fails after the migration commit point', async () => {
    const { deps, calls } = buildDeps({
      adminDeleteCognitoUser: async () => {
        throw new Error('cognito_down');
      },
    });

    const result = await setPasswordForGoogleOnlyUser(input, deps);

    assert.deepEqual(result, { kind: 'converted' });
    // Link skipped (orphan still holds the Google identity); failure reported.
    assert.equal(calls.some((c) => c.name === 'link'), false);
    assert.equal(calls.some((c) => c.name === 'reportError'), true);
  });

  it('still succeeds when the final link fails (next Google sign-in self-heals)', async () => {
    const { deps, calls } = buildDeps({
      adminLinkGoogleToNativeUser: async () => {
        throw new Error('link_down');
      },
    });

    const result = await setPasswordForGoogleOnlyUser(input, deps);

    assert.deepEqual(result, { kind: 'converted' });
    assert.equal(calls.some((c) => c.name === 'reportError'), true);
  });
});
