import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose'
import { createTokenVerifier } from '../../../server/utils/tokens'

// Keys like the auth service's: Ed25519, published with a kid.
let signing: CryptoKey
let other: CryptoKey
let jwk: JWK

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' })
  signing = pair.privateKey
  other = (await generateKeyPair('EdDSA', { crv: 'Ed25519' })).privateKey
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'EdDSA', use: 'sig' }
})

const token = (claims: Record<string, unknown>, key: CryptoKey = signing, kid = 'k1', expires: string | number = '15m') =>
  new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA', kid }).setIssuedAt().setExpirationTime(expires).sign(key)

function verifier() {
  const remote = vi.fn(async (_token: string): Promise<string | null> => 'from-remote')
  const verify = createTokenVerifier(createLocalJWKSet({ keys: [jwk] }), remote)
  return { verify, remote }
}

describe('createTokenVerifier', () => {
  it('accepts a token signed with the published key, without asking the service', async () => {
    const { verify, remote } = verifier()
    expect(await verify(await token({ sub: 'user-1' }))).toBe('user-1')
    expect(remote).not.toHaveBeenCalled()
  })

  it('refuses an expired token outright', async () => {
    const { verify, remote } = verifier()
    expect(await verify(await token({ sub: 'user-1' }, signing, 'k1', Math.floor(Date.now() / 1000) - 60))).toBeNull()
    expect(remote).not.toHaveBeenCalled()
  })

  it('refuses a token signed with another key under the same kid', async () => {
    const { verify, remote } = verifier()
    expect(await verify(await token({ sub: 'user-1' }, other))).toBeNull()
    expect(remote).not.toHaveBeenCalled()
  })

  it('refuses a token without a subject', async () => {
    const { verify } = verifier()
    expect(await verify(await token({}))).toBeNull()
  })

  it('refuses garbage and an empty string', async () => {
    const { verify, remote } = verifier()
    expect(await verify('')).toBeNull()
    expect(await verify('not.a.token')).toBeNull()
    expect(remote).not.toHaveBeenCalled()
  })

  it('asks the service about a key id it does not publish (a rotation in flight)', async () => {
    const { verify, remote } = verifier()
    expect(await verify(await token({ sub: 'user-1' }, other, 'k2'))).toBe('from-remote')
    expect(remote).toHaveBeenCalledOnce()
  })

  it('asks the service about an HS256 token from before the switch to EdDSA', async () => {
    const { verify, remote } = verifier()
    const legacy = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('a-shared-secret-of-at-least-thirty-two-bytes'))
    expect(await verify(legacy)).toBe('from-remote')
    expect(remote).toHaveBeenCalledWith(legacy)
  })

  it('asks the service when the keys cannot be fetched', async () => {
    const remote = vi.fn(async () => 'from-remote')
    const unreachable = async () => {
      throw new TypeError('fetch failed')
    }
    const verify = createTokenVerifier(unreachable, remote)
    expect(await verify(await token({ sub: 'user-1' }))).toBe('from-remote')
  })
})
