# Blacker

Bot wyłapujący najlepsze promocje w polskich sklepach w listopadzie i w Black Week.
Zbiera ceny, liczy **realny rabat** (względem ceny Omnibus z 30 dni i własnej historii, a nie ceny przekreślonej),
a najlepszych kandydatów ocenia `claude-haiku-5-5`.

## Szybki start

```bash
pnpm install
pnpm test                                   # parsery, scoring, historia cen
pnpm scrape --dry-run                       # pobiera i ocenia oferty bez bazy
pnpm scrape --dry-run --source=pepper-hot   # tylko jedno źródło
pnpm scrape --ai-dry                        # jak dry-run + ocena AI 3 najlepszych (wymaga ANTHROPIC_API_KEY)
```

## Z bazą (Neon)

1. Załóż darmowy projekt na neon.tech, skopiuj `.env.example` do `.env` i wklej `DATABASE_URL`.
2. `pnpm db:push` tworzy tabele.
3. `pnpm scrape` zapisuje ceny i deale, a potem odpala ocenę AI (`--no-ai`, żeby ją pominąć).

## Harmonogram (GitHub Actions)

`.github/workflows/scrape.yml` uruchamia scraper co godzinę. W repo dodaj sekrety `DATABASE_URL` i `ANTHROPIC_API_KEY`.
Na Black Week (23-30.11) zmień cron na `*/15 * * * *`. Repo publiczne ma nielimitowane minuty Actions.

## Źródła

Lista w `config/sources.yaml`. Adaptery: `pepper` (RSS), `xkom-hotshot`, `jsonld` (dowolna strona produktu ze schema.org),
`shopify`, `woocommerce`. Mały sklep na Shopify/WooCommerce dodajesz jednym wpisem z adresem sklepu.

Zasady: respektujemy `robots.txt`, jedno zapytanie na kilka sekund na domenę, a sklepy blokujące boty (403) pomijamy.
