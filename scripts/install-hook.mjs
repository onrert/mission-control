#!/usr/bin/env node
// Kurulum scripti: `.claude/hooks/send-event.cjs`'i hedef projeye kopyalar ve
// `.claude/settings.json`'daki 13 hook olay tipine kayıt ekler (idempotent, yedekli).
// Sözleşme: docs/qa/F-004-contract.md §6. CEO kararı D: bu script yalnızca testin kendi
// oluşturduğu geçici dizinlere ve (kod turunda, bir kez) bu deponun kendi köküne karşı
// çalıştırılır — gerçek bir kullanıcı projesine kurulum CEO/kullanıcı onayı gerektiren, bu
// feature'ın dışında bir adımdır.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const HOOK_COMMAND = 'node .claude/hooks/send-event.cjs'

// Mimari §8.3 "TAM metin" — 13 olay tipi, hangilerinin `matcher: "*"` taşıdığı dahil.
const HOOK_EVENT_TYPES = [
  { name: 'SessionStart', matcher: undefined },
  { name: 'SessionEnd', matcher: undefined },
  { name: 'UserPromptSubmit', matcher: undefined },
  { name: 'PreToolUse', matcher: '*' },
  { name: 'PostToolUse', matcher: '*' },
  { name: 'PostToolUseFailure', matcher: '*' },
  { name: 'SubagentStart', matcher: '*' },
  { name: 'SubagentStop', matcher: '*' },
  { name: 'Stop', matcher: undefined },
  { name: 'StopFailure', matcher: undefined },
  { name: 'Notification', matcher: '*' },
  { name: 'PreCompact', matcher: '*' },
  { name: 'PostCompact', matcher: '*' },
]

function buildHookGroup(matcher) {
  const group = { hooks: [{ type: 'command', command: HOOK_COMMAND, async: true, timeout: 5 }] }
  if (matcher !== undefined) return { matcher, ...group }
  return group
}

function groupAlreadyInstalled(existingGroups, matcher) {
  return existingGroups.some((group) => {
    if (!group || !Array.isArray(group.hooks)) return false
    const hasCommand = group.hooks.some((h) => h && h.command === HOOK_COMMAND)
    if (!hasCommand) return false
    return group.matcher === matcher
  })
}

/**
 * Mevcut `hooks` nesnesine 13 olay tipini birleştirir (mimari §8.3 son not: mevcut gruplar
 * dokunulmadan kalır, yeni grup ayrıca eklenir). `Array.isArray` olmayan bir alan varsa
 * (kullanıcının elle bozduğu bir settings.json) o olay tipi atlanır, süreç durmaz.
 */
function mergeHooks(existingHooksObj) {
  const merged = { ...existingHooksObj }
  let addedCount = 0
  let alreadyCount = 0
  const skippedInvalid = []

  for (const { name, matcher } of HOOK_EVENT_TYPES) {
    const existing = merged[name]
    if (existing !== undefined && !Array.isArray(existing)) {
      skippedInvalid.push(name)
      continue
    }
    const arr = Array.isArray(existing) ? existing.slice() : []
    if (groupAlreadyInstalled(arr, matcher)) {
      alreadyCount++
      merged[name] = arr
      continue
    }
    arr.push(buildHookGroup(matcher))
    merged[name] = arr
    addedCount++
  }

  return { merged, addedCount, alreadyCount, skippedInvalid }
}

function printUsageError(message) {
  process.stderr.write(`Hata: ${message}\n`)
  process.exitCode = 1
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const positional = args.filter((a) => a !== '--dry-run')
  const targetArg = positional[0]

  if (!targetArg) {
    printUsageError('hedef proje yolu verilmedi. Kullanım: npm run install-hook -- <proje-yolu>')
    return
  }

  const targetDir = path.resolve(targetArg)
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    printUsageError(`"${targetArg}" bulunamadı veya bir dizin değil.`)
    return
  }

  const claudeDir = path.join(targetDir, '.claude')
  const settingsPath = path.join(claudeDir, 'settings.json')
  const backupPath = `${settingsPath}.bak`

  let existingRaw = null
  let existingSettings

  if (fs.existsSync(settingsPath)) {
    existingRaw = fs.readFileSync(settingsPath, 'utf8')
    try {
      existingSettings = JSON.parse(existingRaw)
    } catch {
      printUsageError('.claude/settings.json bozuk (geçersiz JSON), elle düzeltin. Hiçbir dosyaya dokunulmadı.')
      return
    }
  } else {
    existingSettings = { hooks: {} }
  }

  if (!existingSettings || typeof existingSettings !== 'object' || Array.isArray(existingSettings)) {
    printUsageError('.claude/settings.json beklenmeyen bir yapıya sahip (nesne değil), elle düzeltin. Hiçbir dosyaya dokunulmadı.')
    return
  }

  const existingHooksObj =
    existingSettings.hooks && typeof existingSettings.hooks === 'object' && !Array.isArray(existingSettings.hooks)
      ? existingSettings.hooks
      : {}

  const { merged, addedCount, alreadyCount, skippedInvalid } = mergeHooks(existingHooksObj)
  const sourceScript = path.join(REPO_ROOT, '.claude', 'hooks', 'send-event.cjs')
  const targetScript = path.join(claudeDir, 'hooks', 'send-event.cjs')

  if (dryRun) {
    process.stdout.write(
      `[--dry-run] Kopyalanacak: ${targetScript}\n` +
        `[--dry-run] ${addedCount} olay tipi eklenecek, ${alreadyCount} zaten var.\n`
    )
    if (skippedInvalid.length > 0) {
      process.stdout.write(
        `[--dry-run] Uyarı: ${skippedInvalid.join(', ')} beklenmeyen bir yapıya sahip (dizi değil), atlanacak.\n`
      )
    }
    return
  }

  // Yedek — yalnızca ilk çalıştırmadan önceki saf durumu yakalar (§6 gerekçesi: birleştirme
  // algoritması kanıtlanmış biçimde yalnızca ekleyicidir, tek anlamlı geri dönüş noktası "hiç
  // kurulmamış" hâldir).
  if (existingRaw !== null && !fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, existingRaw, 'utf8')
  }

  fs.mkdirSync(path.join(claudeDir, 'hooks'), { recursive: true })
  fs.copyFileSync(sourceScript, targetScript)

  const newSettings = { ...existingSettings, hooks: merged }
  const serialized = JSON.stringify(newSettings, null, 2)
  const tmpPath = `${settingsPath}.tmp-${process.pid}`
  fs.writeFileSync(tmpPath, serialized, 'utf8')
  fs.renameSync(tmpPath, settingsPath)

  process.stdout.write(
    `Kurulum tamamlandı: ${addedCount} eklendi, ${alreadyCount} zaten var.\n` +
      (existingRaw !== null
        ? `Yedek: ${backupPath}\n`
        : 'Yedek alınmadı (önceden bir settings.json yoktu).\n')
  )
  if (skippedInvalid.length > 0) {
    process.stderr.write(
      `Uyarı: ${skippedInvalid.join(', ')} beklenmeyen bir yapıya sahip (dizi değil), atlandı.\n`
    )
  }
}

await main()
