// Prints shell exports with a JWT secret and anon/service keys signed with it.
import crypto from 'node:crypto';

const secret = process.env.JWT_SECRET ?? 'local-test-jwt-secret-with-at-least-32-characters';
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const sign = (payload) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600;
console.log(`export JWT_SECRET='${secret}'`);
console.log(`export ANON_KEY='${sign({ role: 'anon', iss: 'supabase', iat, exp })}'`);
console.log(`export SERVICE_KEY='${sign({ role: 'service_role', iss: 'supabase', iat, exp })}'`);
