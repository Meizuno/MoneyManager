import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose'

// Access-token verification against the auth service's published keys
// (/.well-known/jwks.json, fetched once and cached) instead of a GET
// /validate per request. That endpoint checks nothing more — the
// signature, a mandatory expiry, and `sub` — so the answer is the same
// without the round trip, which a server-rendered page used to pay three
// or four times (the page middleware, /api/auth/me, each of its own API
// calls).
//
// What can't be settled here is still asked of the service (`remote`): a
// token in an algorithm the keys don't cover (HS256, from before the
// switch to EdDSA), a key id the set doesn't have even after a refetch, or
// keys that can't be fetched at all.
//
// The service sets no issuer or audience today (JWT_ISSUER / JWT_AUDIENCE
// are unset in the stack); if it starts to, check them here as well.

/** Resolves to the token's user id, or null when it isn't a valid token. */
export type TokenVerifier = (token: string) => Promise<string | null>

// Failures that are answers: the token is expired, forged or malformed,
// and asking the service would only say so again.
const SETTLED = [
  errors.JWTExpired,
  errors.JWTClaimValidationFailed,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed
]

export function createTokenVerifier(
  keys: JWTVerifyGetKey,
  remote: (token: string) => Promise<string | null>
): TokenVerifier {
  return async (token) => {
    if (!token) return null
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ['EdDSA', 'RS256'],
        requiredClaims: ['exp', 'sub']
      })
      return typeof payload.sub === 'string' && payload.sub ? payload.sub : null
    }
    catch (error) {
      if (SETTLED.some(kind => error instanceof kind)) return null
      return remote(token)
    }
  }
}
