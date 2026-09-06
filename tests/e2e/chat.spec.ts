import { test, expect } from '@playwright/test'

/**
 * F-012 F6 — sohbet ekranı için ana akış E2E'si (QA'nın "sıfır E2E kabul edilemez" bulgusuna
 * yanıt, `docs/qa/F-012-2026-09-06-tur2.md` §3). `playwright.chat.config.ts`'in başlattığı
 * `chat-fake-server.ts` gerçek üretim sunucusunu enjekte edilmiş sahte bir `query()` ile
 * çalıştırır — burada gerçek tarayıcı, gerçek HTTP/SSE üzerinden gerçek `session.ts` kodunu
 * (permission/history/SSE mantığı DEĞİŞMEDEN) tetikler. Kota: **0**.
 *
 * Kapsam (QA'nın istediği asgari akış): mesaj gönder → akan cevap → izin kartı → karar.
 * Abartılmadı — tek senaryo, tek tur.
 */
test('mesaj gönder → akan cevap görünür → izin kartı çıkar → onayla → sonuç ve kapanış cevabı görünür', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('tab', { name: 'Sohbet' }).click()
  const screen = page.getByTestId('chat-screen')
  await expect(screen).toBeVisible()

  const composer = page.getByPlaceholder('CEO’ya yaz…')
  await composer.fill('Klasörü kontrol eder misin?')
  await page.getByRole('button', { name: 'Gönder' }).click()

  // Kullanıcı balonu hemen (chat_user_echo SSE'si) görünür.
  await expect(page.getByText('Klasörü kontrol eder misin?')).toBeVisible()

  // Akan cevap: `chat-fake-server.ts` kelime kelime `stream_event` yayınlıyor — "CEO yazıyor…"
  // etiketi yalnızca `status:'streaming'` iken görünür (bkz. `MessageBubble`).
  await expect(page.getByText('CEO yazıyor…')).toBeVisible({ timeout: 5000 })

  // İzin kartı: `role="group"` `aria-label="İzin isteği"` (bkz. `PermissionCard`).
  const permissionCard = page.getByRole('group', { name: 'İzin isteği' })
  await expect(permissionCard).toBeVisible({ timeout: 5000 })
  await expect(permissionCard).toContainText('Bash')
  await expect(permissionCard).toContainText('ls -la')

  await permissionCard.getByRole('button', { name: 'Onayla' }).click()

  // Kolabe olmuş izin satırı (Ö8) — kart TAMAMEN silinmez, tek satıra döner.
  await expect(page.getByText('Onaylandı — ls -la çalıştı')).toBeVisible({ timeout: 5000 })
  await expect(permissionCard).toHaveCount(0)

  // Kapanış cümlesi — akış bitip `status:'done'` olunca "CEO yazıyor…" etiketi kaybolur.
  await expect(page.getByText('Klasörde iki dosya buldum, hazır.')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('CEO yazıyor…')).toHaveCount(0)

  // Sayfa yenilemesi: geçmiş kalıcı (AC7'nin metin kısmı) — kullanıcı mesajı ve nihai cevap
  // `GET /api/chat/history`'den geri gelir.
  await page.reload()
  await page.getByRole('tab', { name: 'Sohbet' }).click()
  await expect(page.getByText('Klasörü kontrol eder misin?')).toBeVisible()
  await expect(page.getByText('Klasörde iki dosya buldum, hazır.')).toBeVisible()
})
