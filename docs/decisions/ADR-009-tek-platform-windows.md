# ADR-009 — Desteklenen tek platform: Windows

- **Tarih:** 2026-09-04
- **Durum:** Kabul edildi
- **Karar veren:** Kullanıcı (Veron), CEO sorusu üzerine — kapsam daraltmasıdır, PROCESS §3 "kapsam değişikliği" gereği soruldu.

## Bağlam

F-001'in CI iş akışı `[ubuntu-latest, windows-latest, macos-latest]` matrisiyle kurulmuştu.
Bu, PRD'nin ötesine geçen bir kapsam genişlemesiydi: PRD "Windows birincil platform, macOS de
desteklenir" diyordu, Linux hiçbir belgede geçmiyordu.

İlk gerçek CI koşusunda (2026-09-04, commit `9ae23bf`) `ubuntu-latest` iki testte kırmızı verdi;
`windows-latest` ve `macos-latest` fail-fast yüzünden hiç koşmadan iptal edildi:

- `tests/server/store/retention.test.ts:76` — karışık yol ayracı (`\` + `/`) içeren yolun veri
  kökü içinde sayılması bekleniyordu. Windows'ta `\` ayraçtır; POSIX'te dosya adında geçerli bir
  karakterdir. Yani Linux'taki `false` sonucu doğru davranıştı, kusur testin platform
  varsayımındaydı.
- `tests/server/store/jsonl-store.test.ts:175` — `expected 9 to be 10`. Kaynağı belirsiz;
  hipotezler gün sınırı/saat dilimi (gün dosyası yerel tarihe göre adlandırılıyor, CI UTC koşuyor)
  veya `.seq` kayma hatasının (QA bulgusu Ö1) farklı tezahürü.

macOS de POSIX olduğu için bu iki hatanın macOS'ta da çıkması bekleniyordu — yani ubuntu'yu
matristen çıkarmak sorunu ortadan kaldırmıyor, yalnızca 10 kat pahalı bir koşucuda (GitHub
dakika çarpanı: Linux 1x, Windows 2x, macOS 10x) daha geç görünmesini sağlıyordu.

## Karar

**Yalnızca Windows desteklenir.** macOS desteği iddiası PRD'den düşürüldü, Linux zaten kapsamda
değildi. CI matrisi kaldırıldı; iş akışı tek `runs-on: windows-latest` üzerinde koşar.

Gerekçe: panel yalnızca kullanıcının kendi Windows makinesinde, yalnızca localhost üzerinde
çalışan yerel bir araçtır (`docs/00-idea.md`: "yalnızca yerel; giriş yok, bulut yok, dış servis
yok"). Desteklenmeyecek bir platform için POSIX yol semantiği ve saat dilimi varsayımlarını
düzeltmek, kullanılmayan koda bakım yapmaktır — Karpathy §2 ihlali.

## Sonuçlar

- `docs/01-prd.md` hedef kullanıcı bölümündeki platform cümlesi güncellendi.
- `.github/workflows/ci.yml` tek platforma indirildi.
- **F-001 AC2'nin metni geçersizleşti:** "`npm install` native derleme olmadan tamamlanır
  (Windows + macOS)" artık yalnızca Windows'u kapsar. AC2'nin asıl güvencesi (native derleme
  gerektiren bağımlılık yok) `tests/deps.test.ts` ile platformdan bağımsız olarak korunuyor.
- **CI-1 ve CI-2 bulguları kapsam dışıdır** — POSIX'e özgü oldukları doğrulanırsa düzeltilmez.
  **Ancak CI-2 doğrulanmalıdır:** GitHub'ın Windows koşucusu da UTC saat diliminde çalışır, yani
  `expected 9 to be 10` bir saat dilimi hatasıysa **Windows'ta da çıkabilir** ve o zaman gerçek
  bir üründe hatadır. Windows-only CI koşusu bunu gösterecek.
- Bu karar geri alınabilir: macOS desteği ileride istenirse matris geri eklenir ve iki test
  platforma göre koşullandırılır.
