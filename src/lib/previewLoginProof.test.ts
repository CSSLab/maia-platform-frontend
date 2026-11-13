import { Buffer } from 'buffer'
import { generateKeyPairSync, verify } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from 'src/pages/api/login-origin'
import {
  PREVIEW_PROOF_CONTEXT,
  PREVIEW_PROOF_SECONDS,
  signLoginOrigin,
} from './previewLoginProof'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const KEY = privateKey
  .export({ format: 'der', type: 'pkcs8' })
  .toString('base64')
const HOST = 'maia-platform-frontend-git-some-branch-maia-platform.vercel.app'
const NOW = 1_800_000_000_000

const decode = (text: string) =>
  Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

describe('signLoginOrigin', () => {
  it('signs the host as an https origin that expires in ten minutes', () => {
    const proof = signLoginOrigin(HOST.toUpperCase(), KEY, NOW) as string
    const [body, signature] = proof.split('.')
    expect(JSON.parse(decode(body).toString())).toEqual({
      origin: `https://${HOST}`,
      expires: NOW / 1000 + PREVIEW_PROOF_SECONDS,
    })
    expect(
      verify(
        null,
        new Uint8Array(Buffer.from(PREVIEW_PROOF_CONTEXT + body)),
        publicKey,
        new Uint8Array(decode(signature)),
      ),
    ).toBe(true)
    expect(proof).not.toMatch(/[+/=]/)
  })

  it('signs nothing but a *.vercel.app host', () => {
    for (const host of [
      'www.maiachess.com',
      'evil.example',
      `${HOST}:443`,
      `a.${HOST}.evil.example`,
      '',
    ])
      expect(signLoginOrigin(host, KEY, NOW)).toBeNull()
  })
})

describe('GET /api/login-origin', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })

  const call = (method = 'GET') => {
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      headers: {} as Record<string, string>,
    }
    const response = {
      setHeader: (k: string, v: string) => (res.headers[k] = v),
      status: (code: number) => {
        res.statusCode = code
        return response
      },
      json: (body: unknown) => {
        res.body = body
      },
    }
    handler(
      { method, headers: { host: HOST } } as unknown as NextApiRequest,
      response as unknown as NextApiResponse,
    )
    return res
  }

  it('answers a proof on a preview with the key', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.PREVIEW_LOGIN_SIGNING_KEY = KEY
    const res = call()
    expect(res.statusCode).toBe(200)
    expect(typeof (res.body as { proof: string }).proof).toBe('string')
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('is a 404 in production, without the key, or for other methods', () => {
    process.env.PREVIEW_LOGIN_SIGNING_KEY = KEY
    process.env.VERCEL_ENV = 'production'
    expect(call().statusCode).toBe(404)
    process.env.VERCEL_ENV = 'preview'
    expect(call('POST').statusCode).toBe(404)
    delete process.env.PREVIEW_LOGIN_SIGNING_KEY
    expect(call().statusCode).toBe(404)
  })
})
