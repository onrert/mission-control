---
type: hata
updated: 2026-09-04
sources: [CLAUDE.md, docs/progress.md]
---
# Claude Code araç tuzakları (App Factory kurulumu)

Kurulum sırasında (bkz. [[desen/app-factory-hatti]]) rastlanan 5 tekrar eden araç davranışı ve çözümleri; CLAUDE.md "Öğrenilen kurallar" bölümünden derlendi.

## 1. Bash heredoc çift ters bölüyü teke düşürüyor
**Belirti:** Ters bölü içeren JS regex'li dosyalar (ör. Windows yol ayracını değiştiren `replace`) Bash heredoc ile yazılınca bozuluyor.
**Kök neden:** Bash heredoc içeriği shell tarafından işleniyor, `\\` → `\`'ya düşüyor.
**Çözüm:** Ters bölü içeren dosyaları Bash ile yazma; Write aracını kullan ve `node --check` ile doğrula. Not: bu kuralın kendisi de ilk yazımda aynı hataya takıldı — kural yazılırken bile tuzağa düşüldü.

## 2. Heredoc içindeki kaçış dizileri kontrol karakterine dönüşüyor
**Belirti:** `\a` gibi diziler heredoc içinde literal metin değil kontrol karakteri olarak yorumlanıyor.
**Kök neden:** Shell heredoc genişletmesi kaçış dizilerini işliyor, dosya içeriği bozuluyor.
**Çözüm:** Aynı çözüm — Write aracı kullan, dosya içeriğini Bash heredoc'a gömme.

## 3. Hook'lar yazıldıkları oturumda anında aktifleşiyor
**Belirti:** Hook kuran/dokümante eden komutlar kendi regex'lerine takılıp kendini engelliyor.
**Kök neden:** Hook dosyaya yazılır yazılmaz aynı oturumda devreye giriyor; kurulum komutunun metni de hook'un taradığı girdiye dahil oluyor.
**Çözüm:** Tetikleyici komut metnini Bash'e gömme, dosyayı Write ile yaz.

## 4. ToolSearch/SendMessage yok
**Belirti:** Bir alt agent'ın işini başka bir agent'a "devam ettir" diye aktarmak mümkün değil.
**Kök neden:** Bu ortamda ToolSearch kapalı, dolayısıyla SendMessage de yok; agent'lar birbirinin geçmişini görmüyor.
**Çözüm:** Yeni agent aç, brief'i eksiksiz tekrar yaz.

## 5. `claude plugin validate` agent klasörüne uygulanmıyor
**Belirti:** Komut agent/skill klasörlerini doğrulamıyor.
**Kök neden:** Komut plugin manifesti bekliyor, agent klasörü manifest formatında değil.
**Çözüm:** Agent/skill frontmatter'ını `name` + `description` grep'iyle elle doğrula.

İlgili: [[desen/app-factory-hatti]] [[proje/gorev-listesi-denemesi]]
