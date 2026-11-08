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

## Offen (nach Priorität)

1. `ticket create --format json` und `ticket list --format json` enthalten keinen `key`, `next` dagegen schon. Agenten sollten überall dieselben Felder bekommen.
2. `done` ohne Notiz ist erlaubt. Vermutlich sollte mindestens `--note` oder `--verified` verlangt werden.
3. Die Dubletten-Warnung vergleicht nur identische Titel. Die semantische Ähnlichkeit (`similarTickets`) wird beim Anlegen noch nicht genutzt.
4. Für Features wie „Trade offer flow“ gibt es kein Blueprint. Ein generisches Feature-Blueprint würde die Planung erleichtern.
5. `decide --by human` ist eine Angabe, die jeder setzen kann. Das schützt vor Versehen, nicht vor einem Agenten, der die Antwort erfindet. Das muss im Briefing ehrlich stehen.
6. Noch nicht geprüft: eine Entscheidung, die ein Feature blockiert, über die Web-UI, Server-Routen und die Option mit eigenem Plan bei gewählter Option.
