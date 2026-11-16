import { describe, expect, it } from 'vitest'

import { describeAnthropicError } from './anthropicErrors.ts'

const reply = (status: number, type: string, message: string) =>
  new Response(JSON.stringify({ error: { message, type }, type: 'error' }), { status })

describe('describeAnthropicError', () => {
  it('recognizes a missing credit balance behind a 400', async () => {
    const out = await describeAnthropicError(
      reply(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'),
    )
    expect(out.kind).toBe('billing')
    expect(out.log).toContain('nema kredita')
  })

  it('maps auth, model and rate errors', async () => {
    expect((await describeAnthropicError(reply(401, 'authentication_error', 'invalid x-api-key'))).kind).toBe('auth')
    expect((await describeAnthropicError(reply(404, 'not_found_error', 'model: x'))).kind).toBe('model')
    expect((await describeAnthropicError(reply(429, 'rate_limit_error', 'slow down'))).kind).toBe('rate')
    expect((await describeAnthropicError(reply(400, 'invalid_request_error', 'image exceeds 5 MB'))).kind).toBe('input')
  })
})
