# KURULUM.md — App Factory Kurulum Talimatı

> Bu dosya **Claude Code tarafından uygulanmak** üzere yazılmıştır. Kullanıcı (Veron) bu dosyayı boş proje klasörüne koyar, Claude Code'u o klasörde açar ve "kur" der. Claude Code aşağıdaki talimatları sırayla uygular, sonunda kullanıcıya yeniden başlatma mesajını verir ve durur.

## Claude Code için talimatlar (sırayla)

0. Bu dosyanın TAMAMINI oku. Kullanıcıya soru sormadan önce A adımını yap.
A. **Ön kontrol:** `node --version` (18+ gerekli), `git --version`, `claude --version`, işletim sistemi. Node veya git yoksa kullanıcıya kurulum komutunu ver ve dur (Windows: `winget install OpenJS.NodeJS.LTS`, `winget install Git.Git`).
B. **Dizinler:** Bölüm 1'deki ağacı oluştur.
C. **Dosyalar:** Bölüm 2'deki her dosyayı verilen yola **birebir** yaz. İçerikleri "iyileştirme", kısaltma, yeniden düzenleme. Var olan dosyanın üzerine yaz (yalnızca `KURULUM.md` ve varsa `docs/REFERANS-RAPOR.md` dokunulmaz).
D. **Git:** repo yoksa `git init`; sonra `git add -A && git commit -m "chore: app-factory template"`.
E. **Plugin ve MCP:** Bölüm 3'teki komutları Bash ile çalıştır. Bir komut başarısız olursa kullanıcıya karşılık gelen `/plugin ...` slash komutunu ver (kullanıcı kendisi yazar), sonra devam et.
F. **Doğrulama:** Bölüm 4'teki kontrolleri yap; hata varsa düzelt ve tekrar doğrula.
G. **Bitir:** Kullanıcıya Bölüm 5'teki mesajı aynen ver ve **dur**. Bu oturumda uygulama üretmeye başlama, `/new-app` çalıştırma.

Notlar: Hook'lar Node.js ile yazılmıştır; Windows, macOS ve Linux'ta aynı çalışır, jq/PowerShell gerekmez. `settings.json` içindeki `"agent": "ceo"` satırı, yeniden başlatmadan sonra her oturumu CEO olarak açar.

---

## 1. Dizin yapısı

```
<proje-klasörü>/
├── CLAUDE.md
├── README.md
├── .gitignore
├── KURULUM.md                 (bu dosya)
├── .claude/
│   ├── settings.json
│   ├── agents/                (13 agent)
│   ├── skills/<ad>/SKILL.md   (8 skill)
│   └── hooks/                 (7 Node scripti)
├── docs/                      (Obsidian vault kökü)
│   ├── PROCESS.md  00-idea.md  01-prd.md  02-architecture.md  03-ux.md
│   ├── progress.md  blockers.md  features.base
│   ├── features/  decisions/  qa/  approvals/  packages/  specs/  autoimprove/
│   └── wiki/  (SCHEMA.md, index.md, log.md, raw/, pages/)
└── assets/                    (Higgsfield çıktıları)
```

Ek boş klasörler: `docs/wiki/pages/`, `assets/` (içine `.gitkeep`).

---

## 2. Dosyalar

Aşağıdaki her blok bir dosyadır. Başlıktaki yol proje köküne görelidir.


### 2.1 Kök dosyalar

#### Dosya: `CLAUDE.md`

`````markdown
# App Factory — Proje Kuralları

Bu klasör agent tabanlı bir uygulama üretim hattıdır. Ana oturum `ceo` agent'ıdır; kullanıcı (Veron) yalnızca CEO ile konuşur.

## Süreç (özet — ayrıntı docs/PROCESS.md)
- Kaynak gerçeği `docs/` altındaki dosyalardır; sohbet geçmişine göre kod yazma.
- Kapılar: G0 fikir → G1 PRD → G2 mimari → G3 UX → G4 kilometre taşı → G5 güvenlik/kalite → G6 yayın. Onay = `docs/approvals/<G>.ok` dosyası. Onay dosyasını yalnızca kullanıcı "onaylıyorum" dedikten sonra CEO yazar.
- Tek seferde tek feature. Feature bitti = testler yeşil + commit + `docs/progress.md` güncel + feature notunda `status: done`.
- GEÇTİ/KALDI kararını yalnızca `qa-evaluator` verir; developer kendi işini "geçti" ilan edemez.
- Geri alınamaz işlem (main'e push, deploy, veri silme, ücret/kredi, harici API anahtarı) her zaman kullanıcı onayı ister.
- Kullanıcıyla Türkçe konuş; kod, commit mesajı ve teknik doküman İngilizce.

## Karpathy kuralları
1. Önce düşün: varsayımları açıkça yaz; belirsizse sor; seçenekleri ve tercihini sun.
2. Önce basitlik: istenmeyen soyutlama, konfigürasyon, "ileride lazım olur" kodu yok. Test: "kıdemli bir mühendis bunu aşırı karmaşık bulur mu?"
3. Cerrahi değişiklik: yalnızca görevle ilgili dosyalara dokun; alakasız refactor yapma; kendi bıraktığın ölü kodu temizle.
4. Hedef odaklı: her görevin doğrulanabilir bitti tanımı var; kriter yoksa önce kriteri yaz.

## Stack varsayılanları (architect G2'de günceller)
- Web: TypeScript, Next.js (App Router) veya React + Vite, Tailwind; backend: Next route handlers + Supabase (Postgres/Auth/RLS) veya FastAPI
- Mobil: Expo (React Native) + TypeScript; yayın EAS Build/Submit
- Test: Vitest + Playwright (web), pytest (Python), Maestro (mobil E2E, opsiyonel)
- Yapı: `src/features/<feature>/...`, testler yanında. `docs/` klasörü Obsidian vault'tur; `docs/wiki/` çok-projeli mühendislik hafızası.

## Çalıştırma
- Komutlar `package.json` (dev, test, e2e, lint, typecheck) içinde tanımlıdır. Değiştirirsen bu bölümü güncelle.

## Öğrenilen kurallar (her hatadan sonra buraya ekle — /retro)
- (henüz yok)
`````

#### Dosya: `README.md`

`````markdown
# App Factory

Agent tabanlı uygulama üretim hattı (Claude Code). Kullanım: bu klasörü yeni bir uygulama için kopyala, içinde `claude` başlat (settings.json ana oturumu otomatik olarak `ceo` yapar) ve `/new-app <fikir>` yaz. Süreç: `docs/PROCESS.md`. Kurulum: `KURULUM.md`.
`````

#### Dosya: `.gitignore`

`````text
node_modules/
.env
.env.*
!.env.example
dist/
build/
.next/
coverage/
docs/.obsidian/workspace*.json
.claude/settings.local.json
.claude/agent-memory-local/
assets/raw/
`````

#### Dosya: `.claude/settings.json`

`````json
{
  "agent": "ceo",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "0",
    "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "2",
    "CLAUDE_CODE_SUBAGENT_MODEL": "sonnet"
  },
  "permissions": {
    "allow": [
      "Read", "Grep", "Glob", "WebSearch",
      "Edit(docs/**)", "Write(docs/**)",
      "Edit(src/**)", "Write(src/**)", "Edit(app/**)", "Write(app/**)",
      "Edit(tests/**)", "Write(tests/**)", "Edit(e2e/**)", "Write(e2e/**)",
      "Edit(assets/**)", "Write(assets/**)",
      "Bash(npm run *)", "Bash(npm test*)", "Bash(npm install*)", "Bash(npm ci*)",
      "Bash(npx vitest*)", "Bash(npx playwright*)", "Bash(npx tsc*)", "Bash(npx prettier*)",
      "Bash(npx eslint*)", "Bash(npx expo*)", "Bash(npx create-*)", "Bash(node *)",
      "Bash(git status*)", "Bash(git diff*)", "Bash(git add *)", "Bash(git commit *)",
      "Bash(git log*)", "Bash(git checkout -b *)", "Bash(git branch*)",
      "Bash(python -m pytest*)", "Bash(uv run *)", "Bash(claude plugin *)", "Bash(claude mcp *)"
    ],
    "deny": [
      "Read(.env)", "Read(.env.*)", "Read(**/secrets/**)",
      "Bash(rm -rf *)", "Bash(git push --force*)", "Bash(git reset --hard*)"
    ]
  },
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/session-start.js" } ] }
    ],
    "PostCompact": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/session-start.js" } ] }
    ],
    "PreToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [ { "type": "command", "command": "node .claude/hooks/gate-check.js" } ] },
      { "matcher": "Bash",
        "hooks": [ { "type": "command", "command": "node .claude/hooks/block-dangerous.js" } ] },
      { "matcher": "mcp__higgsfield__.*",
        "hooks": [ { "type": "command", "command": "node .claude/hooks/asset-guard.js" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [ { "type": "command", "command": "node .claude/hooks/post-format.js" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node .claude/hooks/stop-check.js" } ] }
    ]
  }
}
`````

### 2.2 Agent tanımları (.claude/agents/)

#### Dosya: `.claude/agents/ceo.md`

`````markdown
---
name: ceo
description: App Factory'nin tek iletişim noktası. Kullanıcıyla konuşur, süreci yönetir, uzman agent'lara görev dağıtır, karar kapılarında sorar. Kendisi kod yazmaz.
model: fable
effort: high
color: purple
tools: Agent(pm, ux, architect, developer, qa-evaluator, security-reviewer, devops, tech-writer, explorer, asset-designer, idea-validator, librarian), Read, Grep, Glob, Bash, Write, Edit, AskUserQuestion, TodoWrite, Skill
memory: project
initialPrompt: Oturum başladı. docs/progress.md, docs/features/ ve docs/approvals/ durumuna bak; kullanıcıya en fazla 4 satırlık "kaldığımız yer" özeti ver ve ne yapmak istediğini sor. Henüz proje yoksa /new-app ile başlanabileceğini söyle.
---

Sen bu uygulama fabrikasının CEO'susun. Kullanıcı (Veron) SADECE seninle konuşur; alt agent'lar kullanıcıya soru soramaz, sormak senin işin. Kullanıcıyla Türkçe konuş; kısa, net, karar odaklı ol.

## Görevin
1. docs/PROCESS.md'deki süreci uygula. Kaynak gerçeği docs/ altındaki dosyalardır.
2. Her fazı önce planla (plan modu), sonra uygun uzman agent'a docs/PROCESS.md §4'teki brief şablonuyla devret. Alt agent konuşma geçmişini görmez: dosya yollarını, kısıtları ve bitti tanımını açıkça yaz.
3. Bağımsız işleri paralel başlat (ör. ux + architect). Gürültülü işleri (log okuma, keşif) explorer'a ver; ana bağlamı temiz tut.
4. Alt agent çıktılarını sentezle. Kullanıcıya her kapıda 5–10 satırlık rapor: bitenler / açık kararlar / sonraki adım / tahmini limit tüketimi.
5. Karar kapılarında (G0–G6, ASSETS) DUR ve AskUserQuestion ile sor. Kullanıcı onaylayınca docs/approvals/<G>.ok dosyasını yaz (tarih + onaylanan özet). Onay yokken kapıyı geçmiş gibi davranma; hook'lar zaten engeller.

## Ne zaman sorarsın (eskalasyon)
docs/PROCESS.md §3. Kısaca: geri alınamaz işlem, kapsam değişikliği, ürünü etkileyen belirsizlik, 3 turda geçmeyen test, çelişen agent'lar, bütçe/limit riski. Bunlar dışında karar ver ve docs/decisions/ altına ADR yaz; kullanıcıyı boğma.

## Kurallar
- Sen kod yazmazsın; src/ altına dokunmazsın. Kod = developer. GEÇTİ/KALDI = qa-evaluator.
- Feature notlarını (docs/features/) ve progress.md'yi güncel tut; her feature sonu temiz durum.
- QA KALDI ise: bulguları developer'a ver, düzelt, yeniden QA. 3 turdan sonra kullanıcıya eskale et ve docs/qa/latest.md'ye `ESKALE: true` satırı ekle.
- Yıkıcı bir komut gerekiyorsa önce kullanıcıya sor; onaylarsa docs/approvals/DANGER.ok yaz (tek kullanımlık), sonra komutu çalıştırt.
- Fable limiti daralırsa kullanıcıya söyle ve opus'a geçmeyi öner.
- Higgsfield üretimi kredi harcar: önce ASSETS.ok için bütçe onayı al.
- Kilometre taşı sonunda /retro çalıştır: öğrenilenleri CLAUDE.md "Öğrenilen kurallar" ve docs/wiki'ye (librarian) işle.
- Hafızanı güncelle: kullanıcının tercihleri, tekrar eden hatalar, stack kararları.
`````

#### Dosya: `.claude/agents/idea-validator.md`

`````markdown
---
name: idea-validator
description: Bir uygulama fikrini kod yazılmadan önce pazar, rakip ve talep açısından eler. G0 öncesinde kullan.
model: sonnet
tools: Read, Write, WebSearch, WebFetch
---
Şüpheci bir ürün analistisin. docs/00-idea.md'deki fikri değerlendir:
1. Benzer/rakip ürünler (3–5), fiyatları, güçlü/zayıf yanları.
2. Talep sinyalleri: forum/Reddit şikâyetleri, arama hacmi ipuçları, mevcut çözümlerin boşlukları.
3. Bu fikrin fark yaratacağı tek cümle; yaratamıyorsa açıkça söyle.
4. Risk: yasal, platform politikası, pazar büyüklüğü.
Çıktı: docs/00-idea.md sonuna "## Fikir doğrulama" bölümü; karar: DEVAM / DARALT / VAZGEÇ + gerekçe. Kullanıcıyı ikna etmeye çalışma; kanıt göster.
`````

#### Dosya: `.claude/agents/pm.md`

`````markdown
---
name: pm
description: Fikirden PRD üretir — kullanıcı hikâyeleri, MVP kapsamı, kapsam dışı liste, kabul kriterleri. Yeni app veya kapsam değişikliğinde kullan.
model: sonnet
tools: Read, Write, Grep, Glob, WebSearch, WebFetch
---
Ürün yöneticisisin. docs/00-idea.md'yi oku. Çıktı: docs/01-prd.md (şablon: Özet, Hedef kullanıcı ve problem, Başarı ölçütleri, MVP özellikleri [öncelikli; her biri "As a … I want … so that …" + ölçülebilir kabul kriterleri], Kapsam dışı, Açık sorular).
İddialı ama MVP'ye sadık ol; teknik detay yazma. Açık soruları "CEO'nun kullanıcıya sorması gereken" başlığında listele. Diller ve ödeme/analitik gibi paketler istenmişse PRD'de ayrı özellik olarak yer alsın.
`````

#### Dosya: `.claude/agents/ux.md`

`````markdown
---
name: ux
description: PRD'den ekran envanteri, akışlar ve tasarım dili üretir. UX tasarımı veya görsel yön gerektiğinde kullan.
model: sonnet
tools: Read, Write, Grep, Glob, WebFetch
skills:
  - frontend-design
---
Ürün tasarımcısısın. docs/01-prd.md'yi oku. Çıktı: docs/03-ux.md — bilgi mimarisi, ekran envanteri, kritik akışlar, tasarım dili (renk/tipografi/spacing token'ları, ton), bileşen envanteri, erişilebilirlik notları.
Jenerik "AI görünümlü" arayüzden kaçın: bilinçli tipografi ve renk kararları, boş durum ve hata durumları tasarlanmış olsun. Mobil ve masaüstü genişlikleri düşün. Higgsfield ile üretilecek görsel varlıkları (ikon, illüstrasyon, hero) "Varlık listesi" başlığında listele.
`````

#### Dosya: `.claude/agents/architect.md`

`````markdown
---
name: architect
description: PRD ve UX'ten mimari, stack, veri modeli, API sözleşmesi ve ADR'ler üretir. Stack kararı, entegrasyon veya büyük refactor gerektiğinde kullan.
model: opus
effort: high
tools: Read, Grep, Glob, Write, WebSearch, WebFetch
memory: project
---
Baş mimarsın. Çıktı: docs/02-architecture.md + docs/decisions/ADR-NNN-*.md (şablon: docs/decisions/ADR-000-template.md).
İçerik: stack ve gerekçe, klasör yapısı, veri modeli, API sözleşmesi, auth, hosting/deploy yolu, 3. parti servisler (ücretli/hesap gerektirenleri "KULLANICI ONAYI" ile işaretle), tahmini aylık maliyet, riskler, çalıştırma komutları.
Uygulama detayını gereğinden erken kilitleme: teslimatları ve sınırları tanımla, yolu developer bulsun. Kullanıcının bildiği stack'i (React/TS, Python, Expo, Supabase) tercih et. Paket dokümanlarını (docs/packages/) dikkate al. Sonunda ilk 3 feature'ı (iskelet dahil) docs/features/ altında not olarak öner.
`````

#### Dosya: `.claude/agents/developer.md`

`````markdown
---
name: developer
description: Tek bir feature'ı uygular, test yazar, commit atar, progress.md ve feature notunu günceller. Kod yazma gerektiren her görevde kullan.
model: sonnet
tools: Read, Edit, Write, Bash, Grep, Glob
memory: project
maxTurns: 150
---
Kıdemli full-stack geliştiricisin. Brief'teki TEK feature'ı uygula.
Akış: docs/progress.md ve ilgili docs'u oku → feature notundaki kabul kriterlerini test olarak yaz → uygula → test/lint/typecheck yeşil → küçük anlamlı commit → feature notunu `status: qa` yap → progress.md'ye ne yaptığını, nasıl doğrulandığını, kalan riskleri yaz.
Kurallar: stub bırakma (buton var ama iş yapmıyorsa bitmemiştir); feature notundaki dosya sahipliği dışına çıkma; gereksiz soyutlama ekleme; varsayım yapmak yerine docs/blockers.md'ye soru yaz ve dur.
Sözleşme: kodlamadan önce docs/qa/<feature>-contract.md'ye "ne yapacağım + hangi davranışlar nasıl doğrulanacak" yaz (qa-evaluator inceler).
Engel: 3 denemeden sonra dur, docs/blockers.md'ye yaz. GEÇTİ kararı senin değil, qa-evaluator'ın.
`````

#### Dosya: `.claude/agents/qa-evaluator.md`

`````markdown
---
name: qa-evaluator
description: Çalışan uygulamayı Playwright ile gerçek tarayıcıda test eder, kabul kriterlerine karşı puanlar, GEÇTİ/KALDI kararı verir. Her feature ve sprint sonunda kullan.
model: opus
effort: high
tools: Read, Bash, Grep, Glob, Write
disallowedTools: Edit
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
memory: project
---
Şüpheci bir QA mühendisisin. Varsayılan tavrın: kanıt görmeden geçmez.
1. Sözleşmeyi (docs/qa/<feature>-contract.md) oku; belirsiz kriter varsa önce onu düzelt.
2. Uygulamayı çalıştır (docs/02-architecture.md'deki komut), Playwright ile kullanıcı gibi tıkla. Kabul kriterlerini tek tek dene; kenar durumlarını zorla (boş girdi, hata, yenileme, mobil genişlik, yavaş ağ). Sadece görüntü olan / stub özellikleri açıkça ara.
3. Her bulgu: tekrar üretme adımları + beklenen/gerçek + ekran görüntüsü yolu + muhtemel dosya:satır.
4. Puanla (1–10): İşlevsellik, Özellik bütünlüğü, Görsel/UX, Kod kalitesi (testler, hata yönetimi). Herhangi biri < 7 → KALDI. Bulduğun hatayı "önemsiz" diye geçiştirme; kararı yumuşatma.
5. Çıktı: docs/qa/<feature>-<tarih>.md ve aynı içerikle docs/qa/latest.md. İlk satırlar: `KARAR: GEÇTİ` veya `KARAR: KALDI`, `ESKALE: false`. Feature notunu GEÇTİ ise `status: done`, KALDI ise `status: fix` yap.
Kod düzenlemezsin; yalnızca raporlarsın. Mobil projede Playwright yerine Expo web önizlemesi + emülatör ekran görüntülerini kullan.
`````

#### Dosya: `.claude/agents/security-reviewer.md`

`````markdown
---
name: security-reviewer
description: Kod tabanını güvenlik açısından inceler (auth, yetki, injection, secret sızıntısı, bağımlılık açıkları). G5 öncesi ve ödeme/auth feature'larından sonra kullan.
model: sonnet
tools: Read, Grep, Glob, Bash, Write
disallowedTools: Edit
---
Uygulama güvenliği uzmanısın (OWASP odaklı). İncele: kimlik doğrulama ve yetkilendirme (özellikle RLS/rol kontrolleri), girdi doğrulama/injection, secret ve API anahtarı sızıntısı (kod, log, git geçmişi), bağımlılık açıkları (`npm audit` / `pip-audit`), CORS/CSRF/rate limit, ödeme webhook doğrulaması, kişisel veri işleme (docs/packages/legal.md kontrol listesi).
Çıktı: docs/security-review.md — bulgular önem derecesiyle (kritik/yüksek/orta/düşük), her biri dosya:satır + kanıt + düzeltme önerisi. Kod düzenlemezsin.
`````

#### Dosya: `.claude/agents/devops.md`

`````markdown
---
name: devops
description: CI/CD, ortam değişkenleri, deploy scriptleri ve mağaza derleme (EAS) kurar. G2 sonrası iskelet ve G6 yayın aşamasında kullan.
model: sonnet
tools: Read, Edit, Write, Bash, Grep, Glob
---
DevOps mühendisisin. Görevler: GitHub Actions CI (lint, typecheck, test, e2e), `.env.example`, deploy scripti (G2'de seçilen hedef: Vercel/Fly/Railway vb.), mobil için EAS build/submit yapılandırması, README "çalıştırma" bölümü.
Kurallar: deploy/push komutları docs/approvals/G6.ok olmadan çalışmaz (hook engeller); yayın gerektiren her adımı önce docs/progress.md'ye "yayın planı" olarak yaz, CEO kullanıcıdan onay alsın. Secret'ları asla dosyaya yazma; kullanıcıdan panel üzerinden girmesini iste.
`````

#### Dosya: `.claude/agents/tech-writer.md`

`````markdown
---
name: tech-writer
description: README, CHANGELOG, kullanıcı dokümanı ve mağaza açıklamalarını yazar. Yayın öncesi kullan.
model: haiku
tools: Read, Write, Grep, Glob
---
Teknik yazarsın. Kısa, doğru, güncel yaz. README: ne, nasıl çalıştırılır, env, test. CHANGELOG: sürüm başına kullanıcıya görünür değişiklikler. Mağaza metinleri: docs/packages/store.md'deki karakter sınırlarına uy; TR/EN/DE.
`````

#### Dosya: `.claude/agents/explorer.md`

`````markdown
---
name: explorer
description: Kod tabanını, logları ve test çıktılarını salt-okunur keşfeder; ana bağlamı kirletmeden özet döner. Büyük çıktı üreten her araştırmada kullan.
model: haiku
tools: Read, Grep, Glob, Bash
---
Salt-okunur keşif agent'ısın. Dosya yazma. Bulguları en fazla 30 satırlık özetle döndür: ilgili dosya yolları, kritik satırlar, ne bulunduğu, ne bulunmadığı. Tahmin yürütme; görmediğin şeyi "görülmedi" diye yaz.
`````

#### Dosya: `.claude/agents/asset-designer.md`

`````markdown
---
name: asset-designer
description: Higgsfield MCP ile uygulama görselleri (ikon, illüstrasyon, hero, mağaza görselleri), tanıtım videoları ve seslendirme üretir. docs/03-ux.md'deki varlık listesi ve ASSETS.ok onayı sonrası kullan.
model: sonnet
tools: Read, Write, Bash, Grep, Glob
mcpServers:
  - higgsfield
---
Görsel varlık tasarımcısısın. docs/03-ux.md'deki tasarım dilini (renk, ton, stil) ve "Varlık listesi"ni oku.
Kurallar: docs/approvals/ASSETS.ok yoksa hiçbir üretim yapma (hook zaten engeller). Her varlık için önce prompt taslağını assets/manifest.md'ye yaz, sonra üret; tutarlı maskot/karakter için Soul karakteri kullan. Üretilenleri assets/<tür>/ altına kaydet ve manifest'e ekle (dosya, prompt, model, kredi). Bütçe: manifest'teki kredi tahminini aşmadan dur ve CEO'ya rapor et. Telif: tanınmış marka/karakter üretme.
`````

#### Dosya: `.claude/agents/librarian.md`

`````markdown
---
name: librarian
description: docs/wiki altındaki uzun vadeli mühendislik hafızasını Karpathy LLM Wiki desenine göre derler ve günceller (kararlar, tekrar eden hatalar, stack notları). /retro sonrasında ve yeni kaynak eklendiğinde kullan.
model: sonnet
tools: Read, Write, Edit, Grep, Glob
memory: project
---
Kütüphanecisin. docs/wiki/SCHEMA.md'yi oku ve uygula. Kaynaklar: docs/wiki/raw/ (ham notlar), docs/progress.md, docs/qa/, docs/decisions/, CLAUDE.md "öğrenilen kurallar".
Kurallar: kapsamı belirtilmiş güncelleme yap ("wiki'yi güncelle" gibi kapsamsız istekleri kabul etme; hangi sayfalar sorusunu CEO'ya döndür). Her sayfa: wikilink'ler, frontmatter (type, updated, sources). index.md ve log.md'yi güncelle. Çelişki bulursan sayfaya "Çelişki" bloğu ekle, sessizce silme. Kullanıcının kendi notlarına dokunma (docs/wiki/raw/ salt-okunur).
`````

### 2.3 Skill tanımları (.claude/skills/)

#### Dosya: `.claude/skills/new-app/SKILL.md`

`````markdown
---
name: new-app
description: Yeni bir uygulama fikrini alır; fikir doğrulama ve G0 akışını başlatır (netleştirme soruları → docs/00-idea.md → onay → PRD).
argument-hint: <bir-iki cümlelik uygulama fikri>
---
Kullanıcının fikri: $ARGUMENTS

1. docs/ şablon dosyalarının var olduğunu doğrula (yoksa PROCESS.md'ye göre oluştur). Önceki bir proje varsa (docs/01-prd.md dolu) kullanıcıya "yeni klasörde başla" öner ve dur.
2. AskUserQuestion ile en fazla 6 soru sor: platform (web/mobil/masaüstü), hedef kullanıcı, MVP'de olmazsa olmaz 3 şey, olmaması gerekenler, hız/kapsam tercihi, ücretli servis/kredi kullanılabilir mi, diller.
3. docs/00-idea.md'yi doldur. idea-validator'ı çalıştır; sonucunu 5 satırda özetle (DEVAM/DARALT/VAZGEÇ).
4. G0 onayı iste (AskUserQuestion). Onay gelince docs/approvals/G0.ok yaz.
5. pm agent'ına PRD brief'i ver. PRD gelince kapsam sorularını sor ve G1 onayı iste; onayla birlikte docs/approvals/G1.ok yaz.
6. Kullanıcı istediği paketleri (i18n, payments, analytics, legal, store) belirttiyse her biri için /add-package çalıştır.
7. ux ve architect'i paralel başlat; sentezle; G2 ve G3 onaylarını iste. G2.ok yazılmadan kod dizinine yazılamaz (hook).
8. Feature notlarını (docs/features/) oluştur: ilk feature iskelet + CI + test altyapısı. Kullanıcıya /sprint ile devam edebileceğini söyle.
`````

#### Dosya: `.claude/skills/status/SKILL.md`

`````markdown
---
name: status
description: Projenin anlık durumunu raporlar — kapılar, açık feature'lar, son QA kararı, blocker'lar, kullanım.
---
docs/approvals/, docs/features/ (frontmatter status), docs/qa/latest.md, docs/blockers.md ve docs/progress.md son 20 satırını oku. En fazla 10 satırda raporla: geçilen kapılar · aktif sprint ve feature'lar (status ile) · son QA kararı · blocker'lar · sonraki adım · limit uyarısı (varsa). Kullanıcı bir şey sormadıysa soru sorma.
`````

#### Dosya: `.claude/skills/sprint/SKILL.md`

`````markdown
---
name: sprint
description: Sıradaki feature'ları üretir — sözleşme, uygulama, QA, düzeltme döngüsü; kilometre taşında G4 raporu.
argument-hint: [feature id'leri veya boş = sıradaki 1-3 feature] [--parallel]
---
Hedef: $ARGUMENTS

1. G2.ok yoksa dur ve kullanıcıya söyle. docs/features/ altında `status: todo` ve bağımlılıkları (`deps`) `done` olan feature'ları sırala; belirtilmediyse ilk 1–3'ünü seç (ilk sprint her zaman iskelet).
2. Her feature için: notu `status: contract` yap → developer'a brief ver (sözleşmeyi docs/qa/<feature>-contract.md'ye yazsın) → qa-evaluator sözleşmeyi incelesin → anlaşınca developer uygular (`status: dev`) → qa-evaluator test eder (`status: qa`) → KALDI ise `status: fix` ve düzeltme; 3 turdan sonra kullanıcıya eskale et (docs/qa/latest.md'ye `ESKALE: true`).
3. `--parallel` ve 3+ bağımsız feature varsa: her developer'ı `isolation: worktree` ile ayrı başlat; dosya sahipliği çakışmasın. Agent teams yalnızca kullanıcı isterse.
4. Sprint sonu: progress.md güncel, commit'ler atılmış, feature notları güncel. Kilometre taşıysa kullanıcıya G4 paketi ver: QA raporu özeti, çalıştırma komutu, ekran görüntüsü yolları, açık riskler, tüketim. G4 onayı gelince docs/approvals/G4-<n>.ok yaz ve /retro öner.
`````

#### Dosya: `.claude/skills/qa-gate/SKILL.md`

`````markdown
---
name: qa-gate
description: MVP'yi uçtan uca doğrular — tam QA turu, güvenlik incelemesi, sadeleştirme ve yasal kontrol listesi; G5 raporu.
---
1. qa-evaluator'a tüm MVP için uçtan uca test brief'i ver (tüm kabul kriterleri, kritik akışlar, mobil genişlik).
2. security-reviewer'ı çalıştır. docs/packages/legal.md kontrol listesini değerlendir (uygulanan paketler kadar).
3. Kod sadeleştirme: /simplify mevcutsa çalıştır; yoksa developer'a "ölü kod, tekrar, gereksiz soyutlama" temizliği brief'i ver.
4. Bulguları önem derecesine göre birleştir; kritik/yüksek olanlar düzeltilmeden G5 önerme. Kullanıcıya G5 raporu ver; onayla docs/approvals/G5.ok yaz.
`````

#### Dosya: `.claude/skills/release/SKILL.md`

`````markdown
---
name: release
description: Yayın akışı — deploy planı, kullanıcı onayı (G6), deploy, mağaza gönderimi hazırlığı, README/CHANGELOG.
---
1. G5.ok yoksa dur. devops'a yayın planı brief'i ver (hedef ortam, env değişkenleri, domain, geri alma planı, mağaza adımları — docs/packages/store.md).
2. Planı kullanıcıya özetle; ücret, domain ve hesap gerektiren adımları açıkça işaretle. G6 onayı iste; onayla docs/approvals/G6.ok yaz.
3. devops deploy eder (hook artık izin verir). Sonucu doğrula (canlı URL'de qa-evaluator kısa duman testi).
4. tech-writer README, CHANGELOG ve mağaza metinlerini üretir. Mağaza gönderimi kullanıcı tarafından yapılır; adım adım liste ver.
5. progress.md'ye yayın kaydı; /retro öner.
`````

#### Dosya: `.claude/skills/retro/SKILL.md`

`````markdown
---
name: retro
description: Kilometre taşı sonrası retrospektif — tekrar eden hataları CLAUDE.md kurallarına, öğrenilenleri docs/wiki'ye (librarian) işler; agent promptlarında iyileştirme önerir.
---
1. Son sprint'in progress.md, docs/qa/ ve docs/blockers.md kayıtlarını oku.
2. Tekrar eden hataları ve düzeltmeleri çıkar; her biri için CLAUDE.md "Öğrenilen kurallar" bölümüne tek satırlık kural ekle (mevcut kuralları tekrar etme).
3. librarian'a kapsamı belirtilmiş brief ver: hangi sayfalar (ör. stack/nextjs, hata/xyz, karar/adr-003) güncellenecek; docs/wiki/log.md'ye giriş.
4. Evaluator'ın kaçırdığı veya yanlış puanladığı bir bulgu varsa .claude/agents/qa-evaluator.md için somut prompt değişikliği öner (uygulamadan önce kullanıcıya göster).
5. Kullanıcıya 5 satırlık özet: ne öğrenildi, hangi kural eklendi, wiki'de ne değişti.
`````

#### Dosya: `.claude/skills/autoimprove/SKILL.md`

`````markdown
---
name: autoimprove
description: Karpathy autoresearch deseniyle tek bir ölçülebilir metriği gece boyu iyileştirir (öner → uygula → ölç → tut/geri al). docs/autoimprove/program.md tanımlar.
argument-hint: <metrik adı, ör. lighthouse | bundle | coverage | a11y> [tur sayısı]
---
Hedef: $ARGUMENTS

1. docs/autoimprove/program.md'yi oku; metrik, ölçüm komutu, zaman bütçesi ve yasak değişiklikler orada. G4 onaylı bir kilometre taşı yoksa dur.
2. Temiz git durumu şart; yeni dal aç: `autoimprove/<metrik>-<tarih>`.
3. Döngü (tur sayısı kadar, varsayılan 20): tek küçük değişiklik öner → uygula → testler yeşil mi → metriği ölç → iyileştiyse commit (mesajda metrik önce/sonra), değilse `git checkout -- .` ile geri al → docs/autoimprove/log.md'ye satır ekle.
4. Yasak: testleri silmek/zayıflatmak, metriği ölçen kodu değiştirmek, kapsam dışı dosyalara dokunmak, bağımlılık eklemek (program.md izin vermedikçe).
5. Bitince özet: denenen/tutulan değişiklikler, metrik toplam kazanımı, dalın adı. Ana dala merge kullanıcı kararıdır.
`````

#### Dosya: `.claude/skills/add-package/SKILL.md`

`````markdown
---
name: add-package
description: Hazır paketlerden birini projeye ekler (i18n, payments, analytics, legal, store) — docs/packages/<ad>.md tanımını feature notlarına ve ADR'ye dönüştürür, gereken onayları sorar.
argument-hint: <i18n | payments | analytics | legal | store>
---
Paket: $ARGUMENTS

1. docs/packages/$ARGUMENTS.md'yi oku. Tanımdaki "Kullanıcıya sorulacaklar" maddelerini AskUserQuestion ile sor (hesap, sağlayıcı seçimi, ücret).
2. architect'e brief ver: docs/decisions/ altına ADR ve docs/02-architecture.md'ye ilgili bölüm.
3. Tanımdaki adımları docs/features/ altında feature notlarına dönüştür (id, deps, kabul kriterleri, dosya sahipliği).
4. Paketin "Manuel adımlar" listesini kullanıcıya göster (hesap açma, anahtar girme, mağaza işlemleri). Secret'lar asla dosyaya yazılmaz; `.env.example` güncellenir.
`````

### 2.4 Hook scriptleri (.claude/hooks/)

#### Dosya: `.claude/hooks/_common.js`

`````javascript
// Ortak yardımcılar: stdin'den hook JSON'unu okur.
const fs = require('fs');
function readInput(cb) {
  let d = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (d += c));
  process.stdin.on('end', () => {
    let j = {};
    try { j = JSON.parse(d || '{}'); } catch (_) {}
    cb(j);
  });
}
function exists(p) { try { return fs.existsSync(p); } catch (_) { return false; } }
function block(msg) { console.error(msg); process.exit(2); }
module.exports = { readInput, exists, block };
`````

#### Dosya: `.claude/hooks/asset-guard.js`

`````javascript
// PreToolUse (mcp__higgsfield__*): kredi harcayan üretimler ASSETS.ok olmadan çalışmaz.
const { readInput, exists, block } = require('./_common');
readInput((j) => {
  const t = j.tool_name || '';
  const spends = /^mcp__higgsfield__(generate|create_website|deploy_website|dubbing|upscale|motion_control|shorts_studio_create|outpaint|remove_background|voice_change|personal_clipper_create|reframe)/i;
  if (spends.test(t) && !exists('docs/approvals/ASSETS.ok')) {
    block('Engellendi: Higgsfield üretimi kredi harcar. Kullanıcıdan bütçe onayı al ve docs/approvals/ASSETS.ok yaz.');
  }
  process.exit(0);
});
`````

#### Dosya: `.claude/hooks/block-dangerous.js`

`````javascript
// PreToolUse (Bash): yayın/push için G6 onayı, yıkıcı komut için tek kullanımlık DANGER.ok.
const fs = require('fs');
const { readInput, exists, block } = require('./_common');
readInput((j) => {
  const cmd = (j.tool_input && j.tool_input.command) || '';
  if (!cmd) process.exit(0);
  const release = /\b(git\s+push|vercel(\s+--prod)?\b|fly\s+deploy|railway\s+up|gh\s+release|npm\s+publish|eas\s+submit|eas\s+build\b.*--auto-submit)/i;
  const danger = /(\brm\s+-rf\b|\bgit\b[^\n]*\s(--force|-f)\b|\bgit\s+reset\s+--hard\b|\bdrop\s+(table|database)\b|Remove-Item[^\n]*-Recurse|\bdel\s+\/[sq]\b|\btruncate\s+table\b)/i;
  if (release.test(cmd) && !exists('docs/approvals/G6.ok')) {
    block('Engellendi: yayın/push için G6 onayı (docs/approvals/G6.ok) gerekli. Kullanıcıya AskUserQuestion ile sor.');
  }
  if (danger.test(cmd)) {
    if (exists('docs/approvals/DANGER.ok')) { try { fs.unlinkSync('docs/approvals/DANGER.ok'); } catch (_) {} process.exit(0); }
    block('Engellendi: yıkıcı komut. Kullanıcıya sor; onaylarsa docs/approvals/DANGER.ok yaz (tek kullanımlık) ve komutu tekrar dene.');
  }
  process.exit(0);
});
`````

#### Dosya: `.claude/hooks/gate-check.js`

`````javascript
// PreToolUse (Edit|Write): G2 onayı yokken kod dizinine yazılamaz.
const path = require('path');
const { readInput, exists, block } = require('./_common');
readInput((j) => {
  const f = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || '';
  if (!f) process.exit(0);
  let rel = path.relative(process.cwd(), path.resolve(f)).replace(/\\/g, '/');
  if (rel.startsWith('..')) process.exit(0); // proje dışı: karışma
  const free = [/^docs\//, /^\.claude\//, /^assets\//, /^README\.md$/, /^\.gitignore$/, /^CLAUDE\.md$/, /^KURULUM\.md$/];
  if (free.some((r) => r.test(rel))) process.exit(0);
  if (!exists('docs/approvals/G2.ok')) {
    block(`Engellendi: "${rel}" yazılamaz — G2 (mimari) onayı yok. Önce kullanıcıdan G2 onayı al ve docs/approvals/G2.ok oluştur.`);
  }
  process.exit(0);
});
`````

#### Dosya: `.claude/hooks/post-format.js`

`````javascript
// PostToolUse (Edit|Write): biçimlendirici varsa çalıştırır; yoksa sessizce geçer.
const { execSync } = require('child_process');
const { readInput } = require('./_common');
readInput((j) => {
  const f = (j.tool_input && j.tool_input.file_path) || '';
  if (!f || /(^|[\\/])docs[\\/]/.test(f)) process.exit(0);
  try {
    if (/\.(ts|tsx|js|jsx|json|css|scss|html)$/.test(f)) execSync(`npx --no-install prettier --log-level silent --write "${f}"`, { stdio: 'ignore' });
    else if (/\.py$/.test(f)) execSync(`ruff format "${f}"`, { stdio: 'ignore' });
  } catch (_) {}
  process.exit(0);
});
`````

#### Dosya: `.claude/hooks/session-start.js`

`````javascript
// SessionStart / PostCompact: kaldığımız yeri bağlama enjekte eder (stdout = context).
const fs = require('fs');
const path = require('path');
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }
const out = [];
const prog = read('docs/progress.md').trim().split('\n').filter(Boolean);
if (prog.length > 3) out.push('## progress.md (son 30 satır)\n' + prog.slice(-30).join('\n'));
const fdir = 'docs/features';
if (fs.existsSync(fdir)) {
  const open = [];
  for (const f of fs.readdirSync(fdir)) {
    if (!f.endsWith('.md') || f.startsWith('F-000')) continue;
    const t = read(path.join(fdir, f));
    const s = (t.match(/^status:\s*(.+)$/m) || [])[1];
    if (s && s.trim() !== 'done') open.push(`- ${f}: ${s.trim()}`);
  }
  if (open.length) out.push("## Açık feature'lar\n" + open.join('\n'));
}
const adir = 'docs/approvals';
if (fs.existsSync(adir)) {
  const g = fs.readdirSync(adir).filter((f) => f.endsWith('.ok')).sort();
  out.push('## Onaylı kapılar: ' + (g.length ? g.join(', ') : 'henüz yok'));
}
const qa = read('docs/qa/latest.md');
const k = (qa.match(/KARAR:\s*(\S+)/) || [])[1];
if (k && k !== 'YOK') out.push('## Son QA kararı: ' + k);
const bl = read('docs/blockers.md').trim().split('\n').filter(Boolean);
if (bl.length > 3) out.push('## blockers.md (son 10 satır)\n' + bl.slice(-10).join('\n'));
if (out.length) console.log('[app-factory durum]\n' + out.join('\n\n'));
`````

#### Dosya: `.claude/hooks/stop-check.js`

`````javascript
// Stop: QA KALDI iken oturum "bitti" diyemez; ESKALE: true ile kullanıcıya soru sorulabilir.
const fs = require('fs');
const { readInput, block } = require('./_common');
readInput((j) => {
  if (j.stop_hook_active) process.exit(0);
  let t = '';
  try { t = fs.readFileSync('docs/qa/latest.md', 'utf8'); } catch (_) { process.exit(0); }
  if (/KARAR:\s*KALDI/i.test(t) && !/ESKALE:\s*(true|evet)/i.test(t)) {
    block("QA raporu KALDI (docs/qa/latest.md). Bulguları developer'a ver, düzelt ve qa-evaluator ile yeniden test et. 3 turdan sonra kullanıcıya eskale et ve latest.md'ye 'ESKALE: true' yaz.");
  }
  process.exit(0);
});
`````

### 2.5 docs/ dosyaları

#### Dosya: `docs/PROCESS.md`

`````markdown
# PROCESS.md — App Factory Süreç Doktrini

CEO bu dosyayı her oturum başında bilir; tüm agent'lar ilgili bölümleri brief ile alır.

## 1. Roller
| Agent | Model | Görev | Yazabildiği yer |
|---|---|---|---|
| ceo | fable (limit daralınca opus) | Tek iletişim noktası; planlar, dağıtır, sentezler, kapılarda sorar | docs/ |
| idea-validator | sonnet | Fikri pazar/rakip/talep açısından eler (G0 öncesi) | docs/00-idea.md eki |
| pm | sonnet | PRD, kullanıcı hikâyeleri, kapsam | docs/01-prd.md |
| ux | sonnet | Ekran envanteri, akışlar, tasarım dili | docs/03-ux.md |
| architect | opus | Stack, veri modeli, API sözleşmesi, ADR'ler | docs/02-architecture.md, docs/decisions/ |
| developer | sonnet | Tek feature uygular, test yazar, commit atar | kod |
| qa-evaluator | opus | Playwright ile gerçek uygulamayı test eder; GEÇTİ/KALDI | docs/qa/ |
| security-reviewer | sonnet | Güvenlik incelemesi (salt-okunur) | docs/security-review.md |
| devops | sonnet | CI/CD, env, deploy scriptleri | ci, scripts |
| tech-writer | haiku | README, CHANGELOG, kullanıcı dokümanı | docs, README |
| explorer | haiku | Kod tabanı keşfi, log okuma (salt-okunur) | — |
| asset-designer | sonnet | Higgsfield ile görsel/video/ses varlıkları | assets/ |
| librarian | sonnet | docs/wiki hafızasını derler (Karpathy LLM Wiki) | docs/wiki/ |

## 2. Kapılar
| Kapı | Ne onaylanır | Zorlama |
|---|---|---|
| G0 Fikir | docs/00-idea.md: problem, kullanıcı, başarı ölçütü, platform, bütçe tercihi | CEO sorar |
| G1 PRD | MVP'ye giren/girmeyen özellikler, öncelik | approvals/G1.ok |
| G2 Mimari | Stack, hosting, DB, auth, ücretli servisler, tahmini aylık maliyet | approvals/G2.ok — G2 yoksa kod dizinine yazılamaz (hook) |
| G3 UX | Tasarım yönü, ekran listesi (küçük projede G1 ile birleşir) | approvals/G3.ok |
| ASSETS | Higgsfield kredi bütçesi | approvals/ASSETS.ok — yoksa üretim engellenir (hook) |
| G4 Kilometre taşı | QA raporu GEÇTİ + çalışan demo | approvals/G4-<n>.ok; QA KALDI iken oturum "bitti" diyemez (hook) |
| G5 Güvenlik/kalite | Security bulguları, /simplify çıktısı, yasal kontrol listesi | approvals/G5.ok |
| G6 Yayın | Deploy, domain, ücret, mağaza gönderimi | approvals/G6.ok — yoksa push/deploy engellenir (hook) |

Onay dosyası içeriği: tarih + onaylanan özet + kullanıcının kararı (bir cümle).

## 3. Eskalasyon (kapı dışında da sor)
Geri alınamaz işlem (push main, deploy, veri silme, ücret, harici API anahtarı) · kapsam değişikliği · ürünü etkileyen belirsizlik · aynı test 3 denemede geçmedi · agent'lar çelişiyor · tahmini limit/kredi tüketimi bütçeyi aşacak · yıkıcı komut gerekiyor (kullanıcı onaylarsa CEO `docs/approvals/DANGER.ok` yazar; hook tek kullanımlık kabul eder).

Sorma (kendin karar ver, ADR'ye not düş): dosya adlandırma, iç refactor, test yazımı, kütüphane sürümü, stil.

## 4. Delegasyon brief şablonu (her Agent çağrısında)
```
GÖREV: <tek cümle>
BAĞLAM DOSYALARI: <yollar ve bölümler>
KISITLAR: <stack, dosya sahipliği, "şunu değiştirme">
BİTTİ TANIMI: <ölçülebilir>
ÇIKTI FORMATI: <dosya yolu + rapor şablonu>
ENGEL DURUMUNDA: dur, docs/blockers.md'ye yaz, tahmin yürütme
```
Alt agent konuşma geçmişini görmez; brief eksiksiz olmalı.

## 5. Feature yaşam döngüsü
`todo → contract → dev → qa → fix → done` (veya `blocked`). Feature notu: `docs/features/F-NNN-<slug>.md` (frontmatter: id, title, status, owner, deps, sprint). İlk feature her zaman iskelet: proje kurulumu + CI + test altyapısı + boş ana sayfa.

Sprint sözleşmesi: developer `docs/qa/<feature>-contract.md`'ye "ne yapacağım + nasıl doğrulanır" yazar; qa-evaluator aynı dosyada onaylar/düzeltir; anlaşınca kod başlar.

QA turu: KALDI → developer düzeltir → tekrar QA; 3 turdan sonra CEO kullanıcıya eskale eder ve `docs/qa/latest.md`'ye `ESKALE: true` yazar.

## 6. Temiz durum kuralı
Her feature sonu: testler yeşil, küçük anlamlı commit, progress.md'de "ne yapıldı / nasıl doğrulandı / kalan risk", feature notu güncel. Oturum bağlamı dolarsa progress.md'den devam edilir.

## 7. Model ve limit yönetimi
developer=sonnet; ceo=fable (Max'te haftalık limitin %50'sine kadar; daralınca opus'a geç); architect/qa=opus; explorer/tech-writer=haiku. Efor: ceo/architect high, developer medium. Kapı raporlarına `/usage` tüketimini ekle. Agent teams yalnızca 3+ bağımsız feature paralel yazılacaksa (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Toplu tarama/doğrulama için dynamic workflow (kapılar arasında).

## 8. Paketler (/add-package)
i18n, payments, analytics, legal, store — `docs/packages/<ad>.md` tanımlar; skill feature notlarına ve ADR'ye dönüştürür.

## 9. Mobil farkları
Playwright web içindir; mobilde Expo web önizlemesi + Maestro (varsa) + emülatör ekran görüntüleri. Mağaza gönderimi ve inceleme cevabı kullanıcıdadır.

## 10. Hafıza
- Kısa vadeli: docs/progress.md, docs/features/, docs/qa/
- Uzun vadeli: docs/wiki/ (librarian, /retro), CLAUDE.md "öğrenilen kurallar", agent memory (`.claude/agent-memory/`)
`````

#### Dosya: `docs/00-idea.md`

`````markdown
# 00 — Fikir

- **Uygulama adı (geçici):**
- **Problem:**
- **Hedef kullanıcı:**
- **Başarı ölçütü (3 ay sonra "işe yaradı" dedirtecek şey):**
- **Platform:** web / mobil / masaüstü
- **MVP'de olmazsa olmaz 3 şey:**
- **Kesinlikle olmayacaklar:**
- **Hız/kapsam tercihi:** hızlı & ucuz / kapsamlı
- **Ücretli servis / kredi kullanılabilir mi:**
- **Diller:** TR / EN / DE
- **Fikir doğrulama özeti (idea-validator):**
`````

#### Dosya: `docs/01-prd.md`

`````markdown
# 01 — PRD

## Özet
## Hedef kullanıcı ve problem
## Başarı ölçütleri
## MVP özellikleri (öncelik sırasıyla)
Her madde: "As a … I want … so that …" + kabul kriterleri (ölçülebilir).
## Kapsam dışı
## Açık sorular (CEO'nun kullanıcıya sorması gerekenler)
`````

#### Dosya: `docs/02-architecture.md`

`````markdown
# 02 — Mimari

## Stack ve gerekçe
## Klasör yapısı
## Veri modeli
## API sözleşmesi (endpoint / şema)
## Auth ve yetkilendirme
## Hosting / deploy yolu
## 3. parti servisler (ücretli / hesap gerektirenler: KULLANICI ONAYI)
## Tahmini aylık maliyet
## Riskler
## Çalıştırma komutları
`````

#### Dosya: `docs/03-ux.md`

`````markdown
# 03 — UX

## Bilgi mimarisi ve ekran envanteri
## Kritik akışlar (adım adım)
## Tasarım dili (renk, tipografi, spacing token'ları, ton)
## Bileşen envanteri
## Erişilebilirlik notları
## Jenerik "AI görünümlü" arayüzden kaçınma kararları
`````

#### Dosya: `docs/progress.md`

`````markdown
# progress.md — kaldığımız yer

Her oturum sonu CEO/developer ekler: tarih · ne yapıldı · nasıl doğrulandı · kalan risk · sonraki adım.

---
`````

#### Dosya: `docs/blockers.md`

`````markdown
# blockers.md

Agent'lar takıldığında buraya yazar: tarih · agent · görev · engel · denenenler.
`````

#### Dosya: `docs/features.base`

`````yaml
filters:
  and:
    - file.inFolder("features")
    - file.ext == "md"
views:
  - type: table
    name: Board
    order:
      - file.name
      - title
      - status
      - owner
      - sprint
`````

#### Dosya: `docs/features/F-000-template.md`

`````markdown
---
id: F-000
title: Şablon feature
status: todo
owner: developer
deps: []
sprint: 0
---
## Açıklama
## Kabul kriterleri
- [ ] ...
## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
## Notlar / kararlar
`````

#### Dosya: `docs/decisions/ADR-000-template.md`

`````markdown
# ADR-000: <Başlık>

- **Tarih:**
- **Durum:** önerildi / kabul / değiştirildi
- **Bağlam:**
- **Karar:**
- **Alternatifler ve neden reddedildi:**
- **Sonuçlar / riskler:**
- **Kullanıcı onayı gerekli mi:** evet/hayır (ücret, hesap, geri alınamazlık)
`````

#### Dosya: `docs/qa/latest.md`

`````markdown
# QA — latest

KARAR: YOK
`````

#### Dosya: `docs/approvals/README.md`

`````markdown
Onay dosyaları: G1.ok, G2.ok, G3.ok, ASSETS.ok, G4-1.ok, G5.ok, G6.ok, DANGER.ok (tek kullanımlık).
Yalnızca CEO, kullanıcı açıkça onayladıktan sonra yazar. İçerik: tarih + onaylanan özet.
`````

#### Dosya: `docs/packages/i18n.md`

`````markdown
# Paket: i18n (çok dillilik — TR / EN / DE)

## Amaç
Uygulama ilk feature'dan itibaren çok dilli; metinler kodda değil çeviri dosyalarında.

## Kullanıcıya sorulacaklar
- Varsayılan dil? (TR / EN)
- Diller: TR, EN, DE — başka?
- URL'de dil ön eki (web) isteniyor mu (/de/...)? SEO için önerilir.

## Teknik seçim (architect ADR yazar)
- Next.js: `next-intl` (App Router, locale routing, mesaj dosyaları `messages/<lang>.json`)
- React + Vite: `i18next` + `react-i18next`
- Expo: `i18n-js` + `expo-localization`
- Tarih/sayı/para: `Intl` API; sağdan-sola dil yok.

## Feature notlarına dönüşecek adımlar
1. F-i18n-1 Altyapı: kütüphane, mesaj dosyaları, dil seçici, cihaz/tarayıcı dilinden varsayılan. Kabul: dil değişince tüm ekranlar değişir; eksik anahtar konsola uyarı.
2. F-i18n-2 İçerik: tüm sabit metinler anahtara taşınır; TR kaynak, EN/DE çeviri (`translate-content` skill'i varsa kullan; yoksa librarian/tech-writer). Kabul: `grep` ile kodda kalan sabit metin yok.
3. F-i18n-3 SEO/mağaza: hreflang ve locale meta (web); mağaza metinleri 3 dilde (store paketiyle).

## Kalite kuralı
qa-evaluator her dilde en az bir kritik akışı tıklar; taşan/kırpılan metinleri bildirir.

## Manuel adımlar
Yok.
`````

#### Dosya: `docs/packages/payments.md`

`````markdown
# Paket: payments (ödeme / abonelik)

## Amaç
Ücretli plan veya tek seferlik ödeme; güvenli, test edilebilir, geri alınabilir.

## Kullanıcıya sorulacaklar
- Model: tek seferlik / aylık abonelik / kullanım bazlı?
- Platform: web (Stripe) / mobil (RevenueCat üzerinden App Store & Play faturalama) / ikisi?
- Para birimi ve ülkeler (TR'de Stripe kısıtı varsa alternatif: iyzico/Paddle — architect değerlendirir).
- Ücretsiz deneme var mı?

## Teknik seçim (architect ADR yazar)
- Web: Stripe Checkout + Customer Portal + webhook (`checkout.session.completed`, `customer.subscription.*`); planlar DB'de; yetki kontrolü sunucu tarafında (RLS/middleware).
- Mobil: RevenueCat SDK (Expo uyumlu), ürünler App Store Connect / Play Console'da; webhook ile sunucuya senkron.
- Test: Stripe test modu ve test kartları; sandbox hesapları.

## Feature notlarına dönüşecek adımlar
1. F-pay-1 Plan modeli ve yetki: DB şeması, "plan gerektirir" koruması, ücretsiz durumda ne görünür.
2. F-pay-2 Ödeme akışı: Checkout/Portal veya RevenueCat paywall; başarı/iptal ekranları.
3. F-pay-3 Webhook ve senkron: imza doğrulama, idempotency, abonelik durumu güncelleme, iptal/iade.
4. F-pay-4 Test ve izleme: e2e test (test modu), Sentry'de ödeme hataları, analitik olayları.

## Güvenlik (security-reviewer zorunlu)
Webhook imzası doğrulanır; fiyat/plan istemciden gelmez; secret'lar yalnızca sunucu env'inde.

## Manuel adımlar (kullanıcı)
Stripe/RevenueCat hesabı açmak, ürün/fiyat tanımlamak, API anahtarlarını panel/env'e girmek, canlı moda geçişi onaylamak (G6).
`````

#### Dosya: `docs/packages/analytics.md`

`````markdown
# Paket: analytics (analitik + hata takibi)

## Amaç
Ne kullanılıyor, nerede kırılıyor — veriye dayalı iterasyon.

## Kullanıcıya sorulacaklar
- Analitik: PostHog (önerilen, ücretsiz katman, EU hosting) / Plausible (basit) / yok?
- Hata takibi: Sentry (önerilen) / yok?
- Çerez/izin: AB kullanıcıları varsa onay bannerı (legal paketiyle).

## Feature notlarına dönüşecek adımlar
1. F-an-1 Olay şeması: docs/analytics-events.md — 8–15 temel olay (kayıt, ilk değer anı, dönüşüm, hata), özellik adları, PII yok.
2. F-an-2 Entegrasyon: SDK'lar, ortam ayrımı (dev olay göndermez), kullanıcı kimliği hash'li.
3. F-an-3 Hata takibi: Sentry (web/Expo), sourcemap yükleme, kullanıcı geri bildirimi diyaloğu opsiyonel.
4. F-an-4 Geri bildirim döngüsü: haftalık özet komutu (`/status` içinde) — CEO, Sentry'den gelen hataları feature notuna dönüştürür (kullanıcı onayıyla).

## Manuel adımlar
Hesap açma, proje anahtarlarını env'e girme.
`````

#### Dosya: `docs/packages/legal.md`

`````markdown
# Paket: legal (yasal kapı — KVKK / GDPR / mağaza gereklilikleri)

## Amaç
Yayından önce yasal asgari gerekliliklerin karşılandığını doğrulamak. Bu bir kontrol listesidir, hukuki görüş değildir; şüphede kullanıcı bir uzmana danışır.

## Kullanıcıya sorulacaklar
- Hedef pazar: TR / AB (Almanya) / global? (AB → GDPR, TR → KVKK)
- Kişisel veri toplanıyor mu (e-posta, konum, ödeme, sağlık gibi hassas veri)?
- Çocuklara yönelik mi? (ek kurallar)

## Kontrol listesi (G5/G6'da CEO değerlendirir; eksikler feature olur)
- [ ] Gizlilik politikası ve kullanım koşulları sayfaları (TR/EN/DE), uygulama içinden erişilebilir
- [ ] Veri envanteri: docs/data-map.md — hangi veri, neden, nerede saklanıyor, süre
- [ ] Çerez/izin bannerı (AB) ve analitik onaya bağlı yükleme
- [ ] Hesap ve veri silme yolu (uygulama içi veya e-posta ile, 30 gün)
- [ ] Veri işleyen 3. taraflar listesi (hosting, analitik, ödeme) ve DPA'ları
- [ ] Mağaza gereklilikleri: Apple "App Privacy" beyanı, Google "Data safety" formu, hesap silme zorunluluğu
- [ ] E-posta gönderimi varsa abonelikten çıkma
- [ ] Hassas veri yoksa bunu açıkça belirt; varsa şifreleme ve erişim kısıtı

## Manuel adımlar
Politika metinlerinin son okuması ve şirket/kişi bilgilerinin girilmesi kullanıcıdadır.
`````

#### Dosya: `docs/packages/store.md`

`````markdown
# Paket: store (mobil mağaza yayını — Expo/EAS)

## Amaç
Expo uygulamasını App Store ve Google Play'e hazırlamak; gönderim kullanıcıda kalır.

## Kullanıcıya sorulacaklar
- Apple Developer (99 $/yıl) ve Google Play (25 $ tek seferlik) hesapları var mı?
- Uygulama adı, bundle id / package name, kategori, yaş sınıfı.
- İlk dağıtım: TestFlight / kapalı test → sonra yayın?

## Feature notlarına dönüşecek adımlar
1. F-st-1 Yapılandırma: app.json/app.config (adlar, id'ler, sürüm, izin açıklamaları), `eas.json` profilleri (development, preview, production).
2. F-st-2 Görseller: ikon (app-icon skill'i), splash, mağaza ekran görüntüleri (asset-designer, ASSETS.ok ile), tanıtım videosu opsiyonel.
3. F-st-3 Metinler: başlık (30), alt başlık (30), açıklama (4000), anahtar kelimeler (100) — TR/EN/DE (tech-writer).
4. F-st-4 Derleme: `eas build` (preview → production); crash yok, cihazda duman testi; `eas submit` yalnızca G6 sonrası (hook).
5. F-st-5 Uyum: legal paketindeki mağaza maddeleri; gizlilik politikası URL'si.

## Manuel adımlar (kullanıcı)
Hesap açma ve ödeme, sertifika/anahtar onayları (EAS yönetebilir), mağaza konsolunda formlar, inceleme cevapları, yayın butonu.
`````

#### Dosya: `docs/wiki/SCHEMA.md`

`````markdown
# docs/wiki — Mühendislik Hafızası Şeması (Karpathy LLM Wiki deseni)

## Klasörler
- `raw/` — ham kaynaklar: kullanıcının notları, makale özetleri, dış dokümanlar. Salt-okunur; librarian burayı derler, düzenlemez.
- `pages/` — derlenmiş sayfalar. Türler: `stack/<ad>.md` (teknoloji notu), `karar/<ad>.md` (ADR özetleri, projeler arası), `hata/<ad>.md` (tekrar eden hata + çözüm), `proje/<ad>.md` (her uygulama için bir sayfa), `desen/<ad>.md` (işe yarayan akışlar/promptlar).
- `index.md` — tüm sayfaların tek satırlık listesi (tür + özet).
- `log.md` — tarih sıralı işlem günlüğü (ne eklendi/değişti, kaynağı).

## Sayfa formatı
```
---
type: stack | karar | hata | proje | desen
updated: YYYY-MM-DD
sources: [raw/…, docs/…]
---
# Başlık
Kısa özet (2–3 cümle). Gövde. İlgili: [[sayfa-adı]] …
```

## Kurallar
- Kapsamı belirtilmiş güncelleme: "X ve Y sayfalarını şu kaynağa göre güncelle." Kapsamsız istek reddedilir.
- Çelişki: silme; sayfaya "## Çelişki" bloğu ekle, tarih ve kaynakla.
- Her /retro sonrası: hata/ ve desen/ sayfaları öncelikli; log.md'ye giriş.
- Obsidian: `docs/` vault kökü; wikilink'ler `[[pages/stack/nextjs]]` biçiminde.
`````

#### Dosya: `docs/wiki/index.md`

`````markdown
# Wiki index

(librarian doldurur — tür · sayfa · tek satır özet)
`````

#### Dosya: `docs/wiki/log.md`

`````markdown
# Wiki log

(tarih · işlem · sayfalar · kaynak)
`````

#### Dosya: `docs/wiki/raw/README.md`

`````markdown
Ham kaynaklar buraya: makale notları, kendi fikirlerin, dış dokümanlar. librarian bunları pages/ altına derler; bu klasörü düzenlemez.
`````

#### Dosya: `docs/autoimprove/program.md`

`````markdown
# autoimprove — program.md (Karpathy autoresearch deseni)

Bu dosya /autoimprove döngüsünün "araştırma yönergesi"dir. Agent Python/TS dosyalarını değiştirir; sen sadece bu dosyayı yazarsın.

## Metrikler (birini seç; komut tek sayı üretmeli)
| Ad | Ölçüm komutu | Yön | Not |
|---|---|---|---|
| lighthouse | `npx lighthouse http://localhost:3000 --output=json --quiet --chrome-flags="--headless" \| node scripts/lh-score.js` | yüksek iyi | dev sunucusu açık olmalı |
| bundle | `npm run build && node scripts/bundle-size.js` | düşük iyi | kB |
| coverage | `npx vitest run --coverage --reporter=json \| node scripts/coverage.js` | yüksek iyi | % |
| a11y | `npx playwright test e2e/a11y.spec.ts --reporter=json \| node scripts/a11y-score.js` | yüksek iyi | axe ihlal sayısı tersine |

(scripts/*.js dosyalarını ilk çalıştırmada developer yazar; her biri stdout'a tek sayı basar.)

## Zaman bütçesi
Her deneme en fazla 5 dakika; tur sayısı varsayılan 20.

## Keşif yönleri (öneri; agent özgür)
Gereksiz yeniden render, büyük bağımlılıklar, görsel optimizasyonu, lazy loading, önbellek başlıkları, test eksikleri, eksik aria etiketleri.

## Yasaklar
Testleri silmek/zayıflatmak · ölçüm scriptlerini değiştirmek · yeni bağımlılık eklemek (izin: hayır) · docs/ dışında dokümantasyon değiştirmek · feature davranışını değiştirmek.

## Tut / geri al
Metrik iyileşti ve testler yeşil → commit (`autoimprove(<metrik>): önce→sonra`). Aksi → `git checkout -- .`. Her tur `docs/autoimprove/log.md`'ye bir satır.
`````

#### Dosya: `docs/autoimprove/log.md`

`````markdown
# autoimprove log
| tarih | metrik | deneme | önce | sonra | karar |
|---|---|---|---|---|---|
`````

#### Dosya: `docs/specs/mission-control.md`

`````markdown
# Spec: Mission Control (izleme paneli) — ileride /new-app ile üretilecek

## Amaç
Multica benzeri yerel pano: hangi agent ne yaptı, hangi feature nerede, agent'lar birbirine ne söyledi, kapılar, kullanım. Dış servis yok.

## Veri kaynakları (hepsi yerel)
1. Hook olayları: `.claude/hooks/send-event.js` (eklenecek) her olayı `http://localhost:4000/events`'e POST eder (session_id, agent_type/agent_id, tool_name, özet, zaman).
2. Artefaktlar: docs/features/*.md (frontmatter), docs/progress.md, docs/qa/*.md, docs/qa/*-contract.md, docs/approvals/, docs/blockers.md.
3. Transkriptler: `~/.claude/projects/<proje>/<session>/subagents/agent-*.jsonl`.
4. (Agent teams açıksa) `~/.claude/tasks/<team>/`, `~/.claude/teams/<team>/inboxes/*.json`.

## Ekranlar
- Pano: feature'lar status sütunlarında (todo/contract/dev/qa/fix/done/blocked); sürükleme frontmatter'ı günceller.
- Thread: feature başına CEO brief → developer raporu → QA kararı → düzeltme turları (sözleşme dosyaları + transkriptler).
- Zaman çizelgesi: agent aktiviteleri ve araç çağrıları (hook akışı).
- Kapılar: G0–G6 + ASSETS durumu; Onayla butonu `docs/approvals/<G>.ok` yazar; Reddet `docs/approvals/<G>.deny.md` yazar (CEO okur).
- Kullanım: transkriptlerdeki usage alanlarından agent/oturum başına token.

## Stack
Vite + React + TypeScript + Tailwind; Node (chokidar dosya izleme, better-sqlite3, SSE); `localhost:4000`; VS Code Simple Browser veya tarayıcı sekmesi; Tailscale ile telefondan.

## v2
Panodan CEO'ya mesaj: Claude Code Channels protokolüyle özel kanal (MCP sunucusu).
`````

---

## 3. Plugin ve MCP kurulumu

Bash ile sırayla çalıştır (internet gerekir):

```bash
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install frontend-design@claude-plugins-official
claude plugin install code-review@claude-plugins-official
claude plugin marketplace add forrestchang/andrej-karpathy-skills
claude plugin install andrej-karpathy-skills@karpathy-skills
claude plugin marketplace add kepano/obsidian-skills
claude plugin install obsidian@obsidian-skills
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```

Opsiyonel (izleme paneli; kullanıcı isterse):
```bash
claude plugin marketplace add simple10/agents-observe
claude plugin install agents-observe
```

CLI komutu çalışmazsa kullanıcıya verilecek slash karşılıkları: `/plugin marketplace add <repo>` ve `/plugin install <ad>@<marketplace>`.

Not: `ux.md` içindeki `skills: - frontend-design` satırı plugin'in skill adına işaret eder. Kurulumdan sonra `/skills` listesinde ad farklıysa (ör. `frontend-design:frontend-design`) satırı ona göre düzelt. Eksik skill hata vermez, yalnızca atlanır.

Playwright tarayıcıları ilk QA turunda otomatik iner; istersen şimdi: `npx playwright install chromium`.

---

## 4. Doğrulama

1. `claude plugin validate .claude/agents` — frontmatter hatası olmamalı (komut yoksa atla; her agent dosyasında `name` ve `description` bulunduğunu elle doğrula).
2. Her hook için `node --check .claude/hooks/<dosya>.js`.
3. Hook davranış testi (beklenen çıkış kodları):
```bash
echo '{"tool_input":{"file_path":"src/app.ts"}}' | node .claude/hooks/gate-check.js; echo "beklenen 2, çıkan $?"
echo '{"tool_input":{"file_path":"docs/01-prd.md"}}' | node .claude/hooks/gate-check.js; echo "beklenen 0, çıkan $?"
echo '{"tool_input":{"command":"git push origin main"}}' | node .claude/hooks/block-dangerous.js; echo "beklenen 2, çıkan $?"
echo '{"tool_name":"mcp__higgsfield__generate_image"}' | node .claude/hooks/asset-guard.js; echo "beklenen 2, çıkan $?"
echo '{}' | node .claude/hooks/stop-check.js; echo "beklenen 0, çıkan $?"
node .claude/hooks/session-start.js
```
4. Sayım: `.claude/agents` 13 dosya, `.claude/skills` 8 klasör, `.claude/hooks` 7 dosya.
5. `git status` temiz; `git log --oneline` ilk commit'i gösteriyor.
6. `settings.json` geçerli JSON: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`.

---

## 5. Kullanıcıya verilecek bitiş mesajı (aynen)

> Kurulum tamam. Şimdi:
> 1. Claude Code'u kapat ve aynı klasörde yeniden aç (yeni `agents/` klasörü için gerekli). Açılışta CEO seni "kaldığımız yer" özetiyle karşılar.
> 2. `/status` yaz → "henüz proje yok" demeli.
> 3. `/mcp` yaz → Higgsfield için bir kez giriş yap.
> 4. `/model` ile Fable'ın listede olduğuna bak; yoksa `.claude/agents/ceo.md` içinde `model: fable` satırını `model: opus` yap.
> 5. Prova: `/new-app basit bir görev listesi web uygulaması (deneme)` → sorulara cevap ver → G1'de dur. Bu prova pipeline'ı kalibre eder; gerçek projeye bundan sonra geç.
> 6. Obsidian: "Open folder as vault" → bu klasörün `docs/` klasörü.
> 7. Telefondan yönetmek için oturumda `/remote-control`.

---

## 6. İlk hafta kalibrasyon listesi (kullanıcı için)

- CEO gereksiz yere soruyor mu / sormuyor mu? → `ceo.md` eskalasyon bölümünü düzelt.
- QA "geçti" dediği şeyde sen bug bulduysan → bulguyu `qa-evaluator.md`'ye somut kural olarak ekle (`/retro` bunu önerir).
- Developer kapsam dışına çıkıyorsa → feature notlarındaki "Dosya sahipliği" alanını doldur.
- Hook bir şeyi yanlış engelliyorsa → ilgili `.claude/hooks/*.js` regex'ini daralt.
- Limit: her kapıda `/usage`; Fable %50 tavanına yaklaşınca CEO'yu `opus`'a al.
- Her hatadan sonra: "CLAUDE.md'ye bir kural olarak ekle."

---

## 7. Günlük kullanım — komutlar

| Komut | Ne yapar |
|---|---|
| `/new-app <fikir>` | Yeni uygulama: doğrulama → G0 → PRD → G1 → UX+mimari → G2/G3 → feature listesi |
| `/status` | Durum raporu |
| `/sprint [F-id...] [--parallel]` | Sıradaki feature'ları üret (sözleşme → kod → QA → düzeltme) |
| `/add-package i18n|payments|analytics|legal|store` | Hazır paketi projeye ekle |
| `/qa-gate` | Uçtan uca QA + güvenlik + sadeleştirme + yasal liste → G5 |
| `/release` | Yayın planı → G6 → deploy → dokümanlar |
| `/retro` | Öğrenilenleri CLAUDE.md ve wiki'ye işle |
| `/autoimprove <metrik>` | Gece iyileştirme döngüsü |
| `/tasks`, `/usage`, `/mcp`, `/remote-control` | Claude Code yerleşik |

## 8. Yeni bir uygulamaya başlamak

Şablon klasörünü kopyala (`C:\dev\apps\<ad>`), içinde `claude` aç, `/new-app <fikir>`. Her uygulama kendi klasöründe, kendi `docs/` vault'unda yaşar; `docs/wiki/` projeler arası hafızayı taşımak için şablon klasörüne geri kopyalanabilir (veya tek bir ortak wiki klasörü `--add-dir` ile eklenir).
