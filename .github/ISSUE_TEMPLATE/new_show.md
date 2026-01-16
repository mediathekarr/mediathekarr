---
name: Neue Show / Ruleset
about: Eine neue Show oder ein Ruleset hinzufügen
title: '[Show] '
labels: show-request
assignees: ''
---

## Show Informationen

- **Name der Show**:
- **Mediathek**: [z.B. ARD, ZDF, Arte]
- **TVDB ID** (falls vorhanden):
- **TMDB ID** (falls vorhanden):

## Mediathek Topic

Der exakte Name des Topics in der Mediathek (wie in MediathekViewWeb angezeigt):

```
z.B. "Tatort", "heute-show", "Terra X"
```

## Episode Format

Wie sind die Episoden in der Mediathek benannt?

Beispiel-Titel aus der Mediathek:

```
z.B. "Tatort: Der Fall (S01/E05)"
z.B. "heute-show vom 15.01.2024"
```

## Regex Vorschläge (optional)

Falls du Regex-Erfahrung hast:

- **Episode Regex**:
- **Season Regex**:

## Matching Strategie

- [ ] SeasonAndEpisodeNumber (S01E01 Format)
- [ ] DateBased (Datum im Titel)
- [ ] TitleMatch (Titel-basiert)

## Zusätzlicher Kontext

Weitere relevante Informationen zur Show oder zum gewünschten Matching.

---

**Hinweis**: Falls du das Ruleset selbst erstellen möchtest, schau dir die [CONTRIBUTING.md](../../CONTRIBUTING.md) an und erstelle direkt einen Pull Request.
