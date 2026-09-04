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
