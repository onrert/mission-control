import fs from 'node:fs'

// D2 (docs/qa/F-012-contract.md §7) — denylist değil, tehlikeli ad-uzayı ALLOWLIST'i: bu dört
// önekle başlayan HER değişken, aşağıdaki istisna listesinde değilse temizlenir. Bu, tek bir
// `ANTHROPIC_API_KEY` kontrolünden çok daha geniş bir yüzeyi kapatır (`ANTHROPIC_AUTH_TOKEN`,
// `CLAUDE_CODE_USE_BEDROCK`/`_VERTEX` gibi bulut-sağlayıcı bayrakları dahil).
const DANGEROUS_PREFIXES = ['ANTHROPIC_', 'CLAUDE_', 'AWS_', 'GOOGLE_']

// Bu üç isim `.claude/settings.json`'ın kendi `env` bloğuyla (satır 3-7) birebir aynı —
// kimlik/bulut-yönlendirme sinyali değil, barındırılan CEO oturumunun kendi alt-agent
// derinlik/model operasyonel ayarları. Sözleşme §7.
const ALLOWED_ENV_EXCEPTIONS = new Set([
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
  'CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH',
  'CLAUDE_CODE_SUBAGENT_MODEL',
])

/** Saf fonksiyon: `env`'i DEĞİŞTİRMEZ, yalnızca hangi anahtarların temizleneceğini raporlar. */
export function checkApiKeyBarrier(env: NodeJS.ProcessEnv): { strippedVars: string[] } {
  const strippedVars: string[] = []
  for (const key of Object.keys(env)) {
    if (ALLOWED_ENV_EXCEPTIONS.has(key)) continue
    if (DANGEROUS_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      strippedVars.push(key)
    }
  }
  return { strippedVars }
}

/**
 * `env`'i MUTATE EDER: tehlikeli ad-uzayındaki her değişkeni `delete` eder. Değerler asla
 * döndürülmez/loglanmaz — yalnızca adlar (K2, "sessiz olmama" ilkesi çağıranın sorumluluğunda).
 * `child_process.spawn`'a açıkça `env` verilmezse çocuk süreç ebeveynin `process.env`'ini
 * spawn ANINDA miras alır (Node çekirdek davranışı) — bu yüzden bu fonksiyon `query()`
 * çağrılmadan hemen önce çağrılmalıdır.
 */
export function stripApiKey(env: NodeJS.ProcessEnv): { strippedVars: string[] } {
  const { strippedVars } = checkApiKeyBarrier(env)
  for (const key of strippedVars) {
    delete env[key]
  }
  return { strippedVars }
}

/**
 * N6 — `apiKeyHelper` bir ayar dosyası alanıdır, env değişkeni değil; bu allowlist'in
 * KAPSAMADIĞI bir yol. Yalnızca **proje** seviyesi (`.claude/settings.json`) kontrol edilir
 * (kullanıcı/local seviyeleri bilinen sınırlama, v1'de kapsam dışı). Dosya okunamıyorsa veya
 * ayrıştırılamıyorsa `false` döner (sessiz varsayım: yapılandırılmamış).
 */
export function hasApiKeyHelperConfigured(settingsJsonPath: string): boolean {
  try {
    const raw = fs.readFileSync(settingsJsonPath, 'utf8')
    const parsed = JSON.parse(raw) as { apiKeyHelper?: unknown }
    return typeof parsed.apiKeyHelper === 'string' && parsed.apiKeyHelper.length > 0
  } catch {
    return false
  }
}
