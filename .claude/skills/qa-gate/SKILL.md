---
name: qa-gate
description: MVP'yi uçtan uca doğrular — tam QA turu, güvenlik incelemesi, sadeleştirme ve yasal kontrol listesi; G5 raporu.
---
1. qa-evaluator'a tüm MVP için uçtan uca test brief'i ver (tüm kabul kriterleri, kritik akışlar, mobil genişlik).
2. security-reviewer'ı çalıştır. docs/packages/legal.md kontrol listesini değerlendir (uygulanan paketler kadar).
3. Kod sadeleştirme: /simplify mevcutsa çalıştır; yoksa developer'a "ölü kod, tekrar, gereksiz soyutlama" temizliği brief'i ver.
4. Bulguları önem derecesine göre birleştir; kritik/yüksek olanlar düzeltilmeden G5 önerme. Kullanıcıya G5 raporu ver; onayla docs/approvals/G5.ok yaz.
