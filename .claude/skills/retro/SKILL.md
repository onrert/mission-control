---
name: retro
description: Kilometre taşı sonrası retrospektif — tekrar eden hataları CLAUDE.md kurallarına, öğrenilenleri docs/wiki'ye (librarian) işler; agent promptlarında iyileştirme önerir.
---
1. Son sprint'in progress.md, docs/qa/ ve docs/blockers.md kayıtlarını oku.
2. Tekrar eden hataları ve düzeltmeleri çıkar; her biri için CLAUDE.md "Öğrenilen kurallar" bölümüne tek satırlık kural ekle (mevcut kuralları tekrar etme).
3. librarian'a kapsamı belirtilmiş brief ver: hangi sayfalar (ör. stack/nextjs, hata/xyz, karar/adr-003) güncellenecek; docs/wiki/log.md'ye giriş.
4. Evaluator'ın kaçırdığı veya yanlış puanladığı bir bulgu varsa .claude/agents/qa-evaluator.md için somut prompt değişikliği öner (uygulamadan önce kullanıcıya göster).
5. Kullanıcıya 5 satırlık özet: ne öğrenildi, hangi kural eklendi, wiki'de ne değişti.
