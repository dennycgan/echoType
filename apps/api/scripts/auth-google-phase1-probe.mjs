// Google sign-in Phase 1 smoke (local / post-terraform-apply; NOT wired into CI).
//
// Part A (always): shared cognitoOAuth unit tests + redirect URI contract.
// Part B (PROBE_AWS=1): read-only Cognito checks (domain, Google IdP, OAuth client).
// Part C (PROBE_MANUAL=1): print Hosted UI authorize URL for manual browser test.
//
// Run:
//   node apps/api/scripts/auth-google-phase1-probe.mjs
//   PROBE_AWS=1 node apps/api/scripts/auth-google-phase1-probe.mjs
//   PROBE_MANUAL=1 node apps/api/scripts/auth-google-phase1-probe.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CognitoIdentityProviderClient,
  DescribeIdentityProviderCommand,
  DescribeUserPoolClientCommand,
  DescribeUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  buildCognitoAuthorizeUrl,
  buildGoogleIdpRedirectUri,
} from '@echotype/shared';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT_DOMAIN_PREFIX = 'echotype-ink';
const DEFAULT_REGION = 'ap-southeast-2';

function loadDotEnv(relativeSegments) {
  const envPath = join(ROOT, ...relativeSegments);
  try {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadDotEnv(['apps', 'api', '.env']);
loadDotEnv(['apps', 'web', '.env']);

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function config() {
  const region = process.env.COGNITO_REGION ?? process.env.VITE_COGNITO_REGION ?? DEFAULT_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID ?? process.env.VITE_COGNITO_USER_POOL_ID ?? '';
  const clientId = process.env.COGNITO_CLIENT_ID ?? process.env.VITE_COGNITO_CLIENT_ID ?? '';
  const domainPrefix = process.env.COGNITO_DOMAIN_PREFIX ?? DEFAULT_DOMAIN_PREFIX;
  const webOrigin = process.env.WEB_ORIGIN ?? 'https://echotype.ink';
  return { region, userPoolId, clientId, domainPrefix, webOrigin };
}

function partA() {
  console.log('--- Part A: cognitoOAuth unit tests + redirect URI contract ---');
  execFileSync('pnpm', ['--filter', '@echotype/shared', 'test'], {
    stdio: 'inherit',
    cwd: ROOT,
  });

  const { domainPrefix, region } = config();
  const redirectUri = buildGoogleIdpRedirectUri(domainPrefix, region);
  assert(redirectUri.endsWith('/oauth2/idpresponse'), 'Google IdP redirect URI shape');
  console.log(`Part A OK: redirect URI template ${redirectUri}`);
}

async function partB() {
  if (process.env.PROBE_AWS !== '1') {
    console.log('Part B skipped (set PROBE_AWS=1 for read-only Cognito checks)');
    return;
  }

  console.log('--- Part B: AWS Cognito read-only ---');
  const { region, userPoolId, clientId, domainPrefix } = config();
  assert(userPoolId, 'COGNITO_USER_POOL_ID required for Part B');
  assert(clientId, 'COGNITO_CLIENT_ID required for Part B');

  const client = new CognitoIdentityProviderClient({ region });

  const pool = await client.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId }));
  const domain = pool.UserPool?.Domain;
  assert(domain === domainPrefix, `pool domain expected ${domainPrefix}, got ${domain ?? '(none)'}`);

  const idp = await client.send(
    new DescribeIdentityProviderCommand({
      UserPoolId: userPoolId,
      ProviderName: 'Google',
    }),
  );
  assert(idp.IdentityProvider?.ProviderName === 'Google', 'Google IdP must exist');

  const appClient = await client.send(
    new DescribeUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
    }),
  );
  const providers = appClient.UserPoolClient?.SupportedIdentityProviders ?? [];
  assert(providers.includes('Google'), `client must support Google IdP, got ${providers.join(', ')}`);
  assert(
    appClient.UserPoolClient?.AllowedOAuthFlows?.includes('code'),
    'client must allow authorization code OAuth flow',
  );
  assert(
    appClient.UserPoolClient?.AllowedOAuthFlowsUserPoolClient === true,
    'AllowedOAuthFlowsUserPoolClient must be true',
  );

  console.log('Part B OK: Cognito domain, Google IdP, and OAuth client verified');
}

function partC() {
  if (process.env.PROBE_MANUAL !== '1') {
    console.log('Part C skipped (set PROBE_MANUAL=1 to print Hosted UI authorize URL)');
    return;
  }

  console.log('--- Part C: manual Hosted UI URL ---');
  const { region, clientId, domainPrefix, webOrigin } = config();
  assert(clientId, 'COGNITO_CLIENT_ID required for Part C');

  const redirectUri = `${webOrigin.replace(/\/$/, '')}/auth/callback`;
  const url = buildCognitoAuthorizeUrl({
    domainPrefix,
    region,
    clientId,
    redirectUri,
    identityProvider: 'Google',
  });

  console.log('Manual acceptance (Phase 1):');
  console.log(`  1. GCP OAuth redirect URI must match: ${buildGoogleIdpRedirectUri(domainPrefix, region)}`);
  console.log(`  2. Open: ${url}`);
  console.log('  3. Complete Google sign-in → expect redirect to /auth/callback?code=... (404 OK until Phase 2)');
  console.log('  4. Regression: email/password login still works (auth-phase4-probe Part B)');
}

await partA();
await partB();
partC();
console.log('auth-google-phase1-probe complete');
