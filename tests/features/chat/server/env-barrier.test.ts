import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  checkApiKeyBarrier,
  hasApiKeyHelperConfigured,
  stripApiKey,
} from '../../../../src/features/chat/server/env-barrier'

describe('env-barrier — checkApiKeyBarrier (saf, mutate etmez)', () => {
  it('ANTHROPIC_/CLAUDE_/AWS_/GOOGLE_ önekli değişkenleri raporlar, env değişmez', () => {
    const env = {
      ANTHROPIC_API_KEY: 'sk-secret',
      AWS_SECRET_ACCESS_KEY: 'x',
      GOOGLE_APPLICATION_CREDENTIALS: '/path',
      CLAUDE_CODE_USE_BEDROCK: '1',
      PATH: '/usr/bin',
      HOME: '/home/x',
    }
    const { strippedVars } = checkApiKeyBarrier(env)
    expect(strippedVars.sort()).toEqual(
      [
        'ANTHROPIC_API_KEY',
        'AWS_SECRET_ACCESS_KEY',
        'GOOGLE_APPLICATION_CREDENTIALS',
        'CLAUDE_CODE_USE_BEDROCK',
      ].sort()
    )
    // saf fonksiyon: env nesnesi dokunulmamış kalır
    expect(env.ANTHROPIC_API_KEY).toBe('sk-secret')
  })

  it("allowlist istisnası: session.ts'in kendi CLAUDE_CODE_* operasyonel değişkenleri dokunulmaz", () => {
    const env = {
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '0',
      CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '2',
      CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet',
      CLAUDE_CODE_USE_VERTEX: '1',
    }
    const { strippedVars } = checkApiKeyBarrier(env)
    expect(strippedVars).toEqual(['CLAUDE_CODE_USE_VERTEX'])
  })

  it('tehlikeli önekle başlamayan değişkenlere dokunmaz', () => {
    const env = { NODE_ENV: 'test', MC_PORT: '7333' }
    expect(checkApiKeyBarrier(env).strippedVars).toEqual([])
  })
})

describe('env-barrier — stripApiKey (mutate eder)', () => {
  it("tehlikeli değişkenleri env'den siler, istisnaları bırakır", () => {
    const env: NodeJS.ProcessEnv = {
      ANTHROPIC_API_KEY: 'secret',
      CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet',
      NODE_ENV: 'test',
    }
    const { strippedVars } = stripApiKey(env)
    expect(strippedVars).toEqual(['ANTHROPIC_API_KEY'])
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.CLAUDE_CODE_SUBAGENT_MODEL).toBe('sonnet')
    expect(env.NODE_ENV).toBe('test')
  })
})

describe('env-barrier — hasApiKeyHelperConfigured (N6)', () => {
  it('apiKeyHelper tanımlıysa true döner', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-apikeyhelper-'))
    const file = path.join(dir, 'settings.json')
    fs.writeFileSync(file, JSON.stringify({ apiKeyHelper: '/usr/local/bin/get-key.sh' }))
    try {
      expect(hasApiKeyHelperConfigured(file)).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('apiKeyHelper yoksa/dosya yoksa/bozuksa false döner', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-apikeyhelper-'))
    const file = path.join(dir, 'settings.json')
    fs.writeFileSync(file, JSON.stringify({ agent: 'ceo' }))
    try {
      expect(hasApiKeyHelperConfigured(file)).toBe(false)
      expect(hasApiKeyHelperConfigured(path.join(dir, 'yok.json'))).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })
})
