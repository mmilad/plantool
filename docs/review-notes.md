# Erkundung der CLI (2026-11-08)

Getestet wurden die Abnahme mit dem Pokémon-Beispiel über die CLI (Agent-Sicht) und typische Fehlbedienungen in einem Testprojekt außerhalb des Repos.

## Behoben in dieser Runde

- Unbewertete Optionen bekamen Score 0 und wurden als Vorschlag gezeigt. Jetzt kein Vorschlag, bis bewertet wurde.
- Agenten konnten Entscheidungen des Menschen treffen oder wieder öffnen. Der Standard-Entscheider ist jetzt `unknown`; Entscheidungen des Menschen brauchen `--by human`.
- Fehlende Ticket-Angabe zeigt eine verständliche Meldung statt „undefined“.
- Ungültiges JSON bei `--input`/`--output` nennt den Fehler direkt.
- `ticket create` warnt, wenn schon ein Ticket mit gleichem Titel existiert, und zeigt den Befehl zum Verlinken.
- Eine Ticket-Übernahme (`done`) bei aktiver Beanspruchung braucht den Beanspruchenden (`--agent`) oder `--force`.
- Konsumenten mit `needs full` und nur geplantem Mock erhalten eine Warnung in `check`.
- `done` ohne `--note` gibt einen Hinweis aus, blockiert aber nicht.
- JSON-Ausgaben von Tickets enthalten jetzt den `key`.
- Die Reihenfolge im Produkt-Blueprint ist umgesetzt (`after` erzeugt `blocks`-Relationen).
- `ticket create` nennt verwandte Tickets anhand überlappender Titelwörter (ohne Index oder Modell). `check` meldet Tickets, deren Text den Titel eines anderen Tickets nennt, ohne dass die beiden verlinkt sind (`UNLINKED_MENTION`).
- Ein generisches Feature-Blueprint ist vorhanden.
- Die Web-Ansicht hat eine Entscheidungsseite: Liste mit Filter „braucht eine Person“, Optionen mit Auswahl und Wiedereröffnen (als Mensch).
- `ticket create` nutzt ein Embedding-Modell für Hinweise auf verwandte Tickets, wenn es verfügbar ist (sonst nur Titelwörter). Das ist nur ein Hinweis, keine Dublette.
- Der Test der CLI setzte `PMAN_NO_REGISTER` statt `HEIST_NO_REGISTER` und hätte Testprojekte in der echten Registry hinterlassen. Behoben.
- Der Standard-Eigentümer einer Entscheidung ist in der Anzeige jetzt `agent`, wie beim Anlegen.
- Server-Routen für Entscheidungen (anlegen, lesen, bewerten, empfehlen, entscheiden, wieder öffnen) sind vorhanden und getestet. Über HTTP gilt `by` standardmäßig als Mensch, weil die Web-Ansicht im Namen der Person handelt.

## Offen (Stand 2026-11-09)

1. `done` ohne Notiz ist erlaubt und bekommt nur einen Hinweis. Das bleibt so, bis Teams es anders wollen.
2. Die Dublettenwarnung vergleicht identische Titel. Ähnlichkeit per Modell ist nur ein Hinweis mit Schwelle 0,86, weil die Werte bei Testdaten eng beieinander liegen (unverwandt 0,77–0,82, verwandt 0,86–0,97, ein Fehlalarm bei 0,864).
3. Das Feature-Blueprint ist da, aber noch nicht an echten Features geprüft.
4. `decide --by human` ist eine Angabe, die jeder setzen kann. Das schützt vor Versehen, nicht vor einem Agenten, der die Antwort erfindet. Das steht im Briefing.
5. Die HTTP-Routen haben keine eigene Berechtigung. Sie sind nur lokal erreichbar und mit CSRF-Token geschützt. Ein Agent mit Zugriff auf den Server könnte also als Mensch entscheiden. Das wurde bewusst so akzeptiert.
6. Offen außerhalb des Repos: `where heist` auf dem Windows-Rechner prüfen (Namenskollision), Abhängigkeit `@huggingface/transformers` dort installieren, falls semantische Hinweise gewünscht sind, und danach das Projekt in ein neues Git-Repo mit dem Schlüssel HEIST verschieben.
