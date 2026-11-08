# UI-Review: aktueller Stand

**Geprüft:** 2026-10-31 (fortlaufende Prüfung)  
**Umfang:** laufende lokale UI, Oberflächen in `src/server.js` sowie die zugehörige heist-Planung.  
**Planungsregel:** Dieses Dokument enthält Beobachtungen, Probleme und Vorschläge. Umsetzungsplanung und Ticket-Zugehörigkeiten werden in heist gepflegt; keine Produktdateien in einer Review-Runde ändern.

## Neuester Review-Checkpoint — 2026-10-31

- **Live-App:** Erneuter gezielter Start mit `node bin/heist.js serve --port 4000` meldete die URL `http://127.0.0.1:4000`. Der In-App-Browser lief in einen Timeout; ein lokaler HTTP-Aufruf wurde vom Socketzugriffsschutz abgewiesen. Den gestarteten Prozess habe ich danach beendet. Damit ist der explizite Portstart belegt, aber keine Browserdarstellung; der Standardstart ohne Override bleibt laut Quellcode dynamisch.
- **Quell-/Planabgleich:** `src/server.js` zeigt weiterhin die sehr schlichte Ausgangsoberfläche: englische UI-Texte, lange Ticketliste mit großen Buttons, keine sichtbaren Eltern-/Relationsbereiche und fest codierte Statusoptionen. Diese bestehenden Befunde sind den Aufgaben für deutsche Texte (`01a189de-0250-7a08-91c5-9cab74a14d8f`), Navigation/Detail (`01a189a9-42ad-7d98-bb63-7d9d4d25351d`, `01a189a9-42af-7e67-93b4-dcdb41bbad6a`) sowie konfigurierbare Ticketfelder (`01a189af-d766-703b-a961-52a10b86081f`) zugeordnet.
- **Suche:** Die Oberfläche leitet Treffer aktuell in den Ticket-Detailaufruf; der Zielvertrag verlangt je nach Trefferart Ticket-, Kommentar- oder Dokumentnavigation. Das bestehende Routing-Ticket `01a189c7-e5a5-7fd7-b0e1-4adec7831943` deckt den Quellbefund ab.
- **Entwürfe:** SVGs bleiben Zielbilder und sind kein Nachweis über die echte Oberfläche. Spätere Browserabnahme bleibt ein eigener Nachweis.
- **Planungsbestand:** `heist validate --format json` ist gültig: 46 Tickets, 4 Dokumente, 204 Beziehungen. Das Review-Ticket bleibt direkt unter der UI-Programm-Wurzel und bestehende Parent-/`blocks`-Kanten sind erhalten.
- **Nächster Live-Schritt:** Sobald die App erreichbar ist, Startfläche und Navigation prüfen, anschließend Detail mit Elternpfad/Unteraufgaben/Beziehungen/Kommentaren, danach Suchtreffer je Typ, Dokumente, 390/320px sowie Tastatur/Fokus.

### Laufzeit- und Wireframe-Abgleich — 2026-10-31

Der aktuelle Quellstand bestätigt den konkreten Portwiderspruch: `bin/heist.js` übergibt bei fehlendem `--port` den Wert `0`; `src/server.js` hat ebenfalls `port = 0` als Funktionsstandard. Ein ausdrücklich angegebener Port 4000 bindet und wird ausgegeben, aber die App-Vorgabe verlangt 4000 bereits für den Standardstart und eine klare Fehlermeldung bei Belegung. Das bestehende Ticket `01a18d87-251e-7ff7-9678-7a437fd0ef76` ist `todo/high`, direktes Kind des UI-Programms und besitzt bereits die passende `blocks`-Kante zum visuellen Review `01a189a9-42b5-71b8-a846-9dc1985e3102`. Es bleibt alleiniger Owner; weder zusätzliches Ticket noch Kantenänderung nötig.

Der HTTP-Start auf 4000 war in dieser Umgebung nicht browserseitig prüfbar (Timeout im In-App-Browser; lokaler HTTP-Client erhielt Socketzugriffsverweigerung). Der Prozess wurde wieder beendet. Es gibt deshalb keinen Screenshot- oder Interaktionsnachweis aus dieser Runde. Als nächster Quellabgleich bleiben der feste Standardport und die bereits geplanten UI-Datenverträge relevant.

Beim Volltextabgleich wurde außerdem in `ui-wireframe.md` eine Beispielzeile mit dem wörtlichen kanonischen Titel „Eine klare, moderne Jira-inspirierte …“ gefunden. Sie stammt aus dem aktuellen heist-Zieldokument und ist keine freigegebene Stilrichtung. Die vier betroffenen Ziel-/Plandokumente werden bereits revisionssicher über `01a189f8-f7bf-7921-b4cf-b3269ac6239d` und anschließend `01a189ad-9320-7ba9-a8ad-4656341eb4e5` gepflegt; bis dahin bleiben solche Vorschauen als Datenmomentaufnahme markiert. Keine `.heist`-Dokumentdatei direkt geändert.

### Ticketzeile: Status-/Bereitschaftsdaten im echten Browservertrag

`src/server.js` rendert im Ticketbaum gegenwärtig Titel und `rollup`; gespeicherter Status und Priorität fehlen in der Zeile. Der `/api/tree`-Endpunkt liefert zwar `status`, `priority` und `rollup`, aber keine Blockerbereitschaft oder Blockerziele. Die abgestimmten Entwürfe verlangen gespeicherten Status, Priorität und getrennte, benannte Bereitschaft. Die Zuständigkeit bleibt beim vorhandenen Status-/Rollup-/Bereitschaftsticket `01a189b6-43ac-78a2-a06b-345c6fa56083` in Abstimmung mit Navigation/Filter `01a189a9-42ad-7d98-bb63-7d9d4d25351d`; die gebündelte Abfrage und stabile Blockerziele gehören in denselben Datenvertrag. Keine neue Aufgabe oder Parent-/Relationsänderung.

### Desktopentwurf: 720px-Abnahmeviewport von 800px-Zeichenfläche unterscheiden

Das Wireframe benennt 1280 × 720 als Desktop-Prüfgröße, während `ui-fp-layout.svg` eine Zeichenfläche von 1280 × 800 hat. Der Kartenbereich endet bei y=768; eine Listenmetazeile liegt bei y=729. Bei einem 720px-Viewport sind daher der untere Kartenrand und ein Teil der letzten Listenzeile außerhalb des ersten Bildschirms. Das ist nicht automatisch ein Layoutfehler, aber das SVG darf nicht als 1280 × 720 Live-Abnahmebild gelten. In der späteren Browserprüfung bei exakt 1280 × 720 Scrollverhalten und Sichtbarkeit der letzten Zeilen prüfen; das vorhandene 800px-SVG als erweitertes Arbeitsraster kennzeichnen oder zusätzlich einen klaren 720px-Viewport-Ausschnitt bereitstellen. Zuständigkeit bleibt im bestehenden Visual-QA-Ticket `01a189a9-42b5-71b8-a846-9dc1985e3102`; keine neue Aufgabe oder Kantenänderung.

### Nächste Planungsreihenfolge — 2026-10-31

Das aktuelle Ziel bleibt maßgeblich; ein neues Ziel würde die vorhandene Arbeit nur aufteilen. Für den nächsten Durchlauf ergibt sich aus den bestehenden Zuständigkeiten und Abhängigkeiten diese Reihenfolge:

1. **UI-Konzept entscheidungsreif machen** (`01a189ad-5c7c-7e68-b165-79fb9f674539` unter UI-Richtung, `todo/high`). fp.dev als schlichte, änderbare visuelle Referenz ist bestätigt. Die vorhandenen Layout-, Navigations- und Mobile-Entwürfe dienen als konkrete Vorschläge; das Konzept legt den Startzustand fest, ohne eine dauerhafte Markenidentität zu behaupten.
2. **Den festen Serverstart parallel voranbringen** (`01a18d87-251e-7ff7-9678-7a437fd0ef76`, `todo/high`). Er blockiert nur die echte Browserabnahme und kann unabhängig vom Konzept bearbeitet werden. Standard `127.0.0.1:4000`, bei Belegung klar abbrechen; kein Zufallsport und kein zweiter stiller Start.
3. **Bestehende Fachpakete nach dem Konzeptabgleich präzisieren**, ohne sie umzuhängen: Navigation/Liste, Ticketdetail, Suche, Dokumente, Responsive und Icons bleiben unter ihren bestehenden Parents. Daten-/API-Lücken stehen im jeweiligen zuständigen Ticket; nur belegte, noch nicht abgedeckte Probleme würden eine neue Aufgabe rechtfertigen.
4. **Live-Abnahme erst nach Serverfreigabe fortsetzen**: zuerst Einstieg und Navigation, dann Detail und Suche, danach Dokumente, 390/320px sowie Tastatur/Fokus. Pro Bereich neue, belegte Lücken ergänzen und an den vorhandenen Owner zurückspielen.

Diese Reihenfolge nutzt vorhandene Parent- und `blocks`-Beziehungen; sie ändert weder Prioritäten noch Ticketzugehörigkeiten. Die Konzeptdateien bleiben Vorschläge, bis die konkreten Layoutentscheidungen bestätigt sind.

### Abgleich bestehender Abdeckung — 2026-10-31

Der statische Quellabgleich ergab zwei sichtbare Planungsrisiken, aber keine ungedeckte neue Aufgabe:

- **Direktlinks und Browserverlauf:** `src/server.js` liefert die Oberfläche nur auf `/`; unbekannte Pfade liefern 404. Eine Ticket-ID in der Browseradresse, Direktaufruf und Zurück/Vorwärts sind ausdrücklich im bestehenden Navigationsticket `01a189c1-79a0-74ae-b519-20b51b0aefa8` unter Navigation geplant. Keine separate Routing-Aufgabe anlegen; beim nächsten Konzeptabgleich die URL-Form mit dem Serverrouting festlegen.
- **Lade-, Fehler- und Leerzustände:** Die UI-`api()`-Funktion wirft bei HTTP-Fehlern, während Lade-, Such-, Speichern-, Erstellen- und Kommentarhandler im aktuellen `src/server.js` keine sichtbare Fehlerbehandlung haben. Das bestehende Rückmeldungsticket `01a189b2-43b1-775a-89f1-388cdd0af53c` unter dem UI-Review deckt Lade-, Fehler-, Leer- und Erfolgsmeldungen sowie Formdatenerhalt ab. Die vorhandene Abdeckung reicht; beim Konzeptabgleich konkrete Zustände und Wiederholungswege priorisieren, kein neues Ticket erzeugen.

Beide Befunde stammen aus statischem Quell-/heist-Abgleich, nicht aus einer aktuellen Live-Prüfung. Die Ticket-Parents und vorhandenen Beziehungen wurden nicht geändert.

### Konzeptkonsistenz — Projektkopf — 2026-10-31

Beim Gegenlesen der genehmigten Leitplanke gegen die Mockups zeigt sich ein konkreter Widerspruch: `docs/ui-wireframe.md` legt fest, dass eine heist-Serverinstanz genau ein Projekt bindet und deshalb **keinen Projektumschalter** zeigt. `docs/ui-fp-layout.svg` hält sich daran und zeigt den Projektnamen als statischen Kontext. Die historische Ergänzung im Konzept-Ticket `01a189ad-5c7c-7e68-b165-79fb9f674539` nennt denselben Mock jedoch „Kopf mit Projektauswahl“. Das kann unnötigen Implementierungsumfang suggerieren. Vorschlag: die Ticketnotiz bei der Konzeptpflege auf „Projektname als Kontext, kein Umschalter“ korrigieren; Parent des Konzepttickets unter UI-Richtung bleibt bestehen, keine neue Aufgabe oder Relation nötig.

### Mockup-Datenumfang — 2026-10-31

Der aktuelle heist-Bestand hat 46 Tickets insgesamt, zehn direkte Kinder unter dem UI-Programm und elf Einträge, wenn die im Mock geöffnete Konzept-Unteraufgabe mitgezählt wird. `docs/ui-fp-layout.svg` zeigte links zuvor „Alle Tickets · 46“, obwohl die sichtbare Liste nur diesen UI-Programmbereich abbildet. Das war ein irreführender Filter-/Zählvertrag. Die Überschrift ist auf „UI-Programm“ mit „10 direkt · 11 sichtbar“ geändert; die heist-Zugehörigkeiten und die übrigen Ticketbeispiele bleiben unverändert. Quelle: aktueller `heist tree`-Abgleich; Mockup, keine Live-App-Beobachtung.

### Mobiles Ticketdetail — Datenprüfung 2026-10-31

`docs/ui-ticket-detail-320.svg` zeigt weiterhin das echte Ticket „Planungsdokumente und Projektübersicht gestalten“. Gegen den aktuellen heist-Bestand geprüft: gespeicherter Status `todo`, Priorität `normal`, sechs direkte Unteraufgaben sowie vier Beziehungen. Die Vorschau gibt den eingehenden Konzept-Blocker als „Wartet auf“, den ausgehenden Blocker zur visuellen Prüfung als „Blockiert“ und die beiden `relates_to`-Beziehungen getrennt wieder. Elternpfad, Zahl und Beziehungsrichtung stimmen; keine Mockup- oder Ticketänderung nötig. Dies bestätigt statische Planungsdaten, keine aktuelle Browseransicht.

### Projektübersicht — alle bereiten Einstiege zeigen — 2026-10-31

Die heist-Projektübersicht zählt zwei `todo`-Arbeitspakete ohne offene `blocks`-Voraussetzungen: UI-Richtung (high) und festen Serverstart auf Port 4000 (high). Das UI-Review ist `in_progress` und ebenfalls ohne offenen Blocker; sieben weitere direkte Kinder sind blockiert. Die Desktop-Vorschau zählte zwar beide bereiten Aufgaben, zeigte aber nur die UI-Richtung als auswählbaren Einstieg; beide mobilen Vorschauen zeigten ebenfalls nur einen der zwei bereiten Einstiege. Das unterschlug das hoch priorisierte Serverticket, das außerdem Voraussetzung für Live-Visual-QA ist. Alle drei Übersichten und das Wireframe zeigen jetzt beide Einstiege, mit Status/Priorität getrennt von Readiness. Zuständigkeit bleibt Projektübersicht `01a189a9-42b1-7518-a6e0-89b4577b1270`; Parents und bestehende Blocks-/`relates_to`-Kanten bleiben unverändert.

### Projektname und Dokumentübersicht — Datenabgleich — 2026-10-31

`.heist/config.json` nennt den Projektnamen `heistman`. Die Entwürfe zeigen daneben die konstante Produktbezeichnung „Heistman“ und darunter den tatsächlichen Projektkontext „heistman“; für das aktuelle Repository ist das klar und konsistent. Das zuständige Projektkontext-Ticket `01a189b3-4333-7e1b-b876-5033943bcc37` bleibt dennoch nötig, damit andere heist-Projekte dynamisch aus `config.name` beschriftet werden. Die Dokumentvorschau stimmt ebenfalls mit dem aktuellen Bestand überein: vier Dokumente (zwei Ziele, zwei Pläne, keine Entscheidungen); der ausgewählte UI-Plan hat acht Ticketlinks. Keine Daten- oder Ticketzugehörigkeit geändert.

### Kanonisches UI-Ziel und UI-Plan — Stil- und Icon-Semantik korrigieren — 2026-10-31

Der Widerspruch steht in beiden kanonischen Dokumenten. Das UI-Ziel `01a189a9-429a-7005-8722-2847de61b01b` nennt Jira als Referenz für Navigation, Ticketübersichten, Filter und Detailansichten und fordert Icons für Tickettypen. Der UI-Plan `01a189a9-42b7-7724-92e3-8da8d2a2dcfe` nennt Jira als Referenz für Informationsarchitektur und Arbeitsfluss und fordert Symbole für Tickettypen. Das widerspricht der bestätigten Leitplanke (fp.dev als schlichte visuelle Richtung; Jira nur für Arbeitsabläufe) und dem bestehenden Icon-Ticket `01a189a9-42a6-7a27-adb9-e30a8df78d54`: heist besitzt kein Tickettyp-Feld und soll keine Epic-/Story-/Bug-Icons oder entsprechende Semantik erfinden.

Vorgeschlagene Korrektur nach Verfügbarkeit der revision-sicheren Dokumentbearbeitung: „Die vorläufige visuelle Richtung orientiert sich an fp.dev: schlicht, hell und eigenständig. Jira dient ausschließlich als Orientierung für klare Planungsabläufe. Icons verwenden vorhandene heist-Bereiche und Aktionen. Status und Priorität können jeweils ein Symbol erhalten, bleiben aber zusätzlich sichtbar beschriftet. Keine Tickettyp-Icons oder neue Semantik erfinden.“ Die Titelvorschläge im vorigen Abschnitt bleiben gültig. Zuständig für die app-gestützte Textpflege ist die bestehende Dokumentbearbeitungsaufgabe `01a189f8-f7bf-7921-b4cf-b3269ac6239d` unter Projektübersicht; die Symbolregeln sind mit dem Icon-Ticket abzustimmen. Keine kanonische `.heist`-Datei direkt geändert, keine neue Aufgabe und keine Relationsänderung.

## Review-Notiz zur UI-Planung — 2026-10-31

Der wiederkehrende Prüfauftrag ist in heist präzisiert: Livezustand von Quell-/Planbefunden trennen; Startfläche, Navigation/Baum, Suche je Trefferart, Detail, Beziehungen/Kommentare, Dokumente, 390/320px und Tastatur/Fokus systematisch prüfen; Nachweise mit Soll, Auswirkung, betroffenem Fach-Ticket und Live-/statischem Status in diesem Dokument festhalten. Bestehende zuständige Tickets zuerst aktualisieren und nur belegte, bislang ungedeckte Lücken neu planen. Ist die App nicht erreichbar, wird das als Laufzeitblocker notiert und unabhängiger statischer/heist-Abgleich fortgeführt. Vorhandene Ticket-Parents und Relations bleiben erhalten; heist-Validierung folgt auf Änderungen.

### Quellstand-Recheck — Desktop-Erstansicht, Liste und Detail — 2026-10-31

Der aktuelle `src/server.js` bestätigt statisch weiterhin drei bereits zugeordnete Abweichungen:

- Ohne Auswahl zeigt `#detail` nur „Select a ticket to inspect it.“ statt der im Konzept vorgesehenen Projektübersicht. Zuständigkeit: Navigation/Arbeitsliste `01a189a9-42ad-7d98-bb63-7d9d4d25351d` und Übersicht `01a189a9-42b1-7518-a6e0-89b4577b1270`.
- `load()` rendert in jeder Ticketzeile Titel und `t.rollup`, aber weder gespeicherten Status noch Priorität. Zuständigkeit: Navigation `01a189a9-42ad-7d98-bb63-7d9d4d25351d`, abgestimmt mit Ticketfeldern `01a189af-d766-703b-a961-52a10b86081f`.
- `show()` startet mit einem offenen Editierformular und rendert die Beschreibung zusätzlich ein zweites Mal; Elternpfad und navigierbare Beziehungen stehen nicht im normalen Detail. Zuständigkeit: Detail/Bearbeitungsfluss `01a189a9-42af-7e67-93b4-dcdb41bbad6a`.

Dies sind Quellbefunde, keine aktuelle Browserabnahme. Die zuständigen Tickets sind weiterhin `todo` und behalten ihre bestehenden Parents unter dem UI-Programm; es wurde keine neue Aufgabe angelegt und keine Relation geändert. Die Liveprüfung bleibt bis zur regulären Erreichbarkeit des Servers offen.



## Quell- und Zugehörigkeitsabgleich — 2026-10-31

Der erneute heist-Abgleich bestätigt, dass die UI-Review-Aufgabe `01a189ac-28f7-7250-b817-2026a531a7b5` weiterhin `in_progress` und direkt unter der Programmwurzel `01a189a9-429e-7fb4-9d2c-8db0221f8942` eingeordnet ist. Die bestehenden Beziehungen wurden nicht geändert. Navigation und Detail sind direkte Kinder des UI-Programms; das Status-/Feldticket bleibt beim Detailpaket verschachtelt; das Suchroutingticket bleibt Kind der Navigation. Der Quelltext enthält weiterhin die beschriebenen englischen UI-Texte und fest codierten Statusoptionen. Alle betroffenen Tickets stehen noch auf `todo`; daraus entsteht kein neues Duplikatticket, da die Befunde bereits zugeordnet und geplant sind. Livezustand bleibt ungeprüft, bis die lokale App erreichbar ist.

### Projektübersichtsvorschau

`docs/ui-prototype-overview.svg` zeigt zehn direkte UI-Arbeitspakete: zwei offene/bereite, eines in Arbeit und sieben blockierte. Abgleich mit `heist tree` bestätigt zehn direkte Kinder und genau diese Status-/Blockeraufteilung; im Mock stehen dazu die zwei bereiten Beispiele UI-Richtung und Serverstart sowie das laufende Review. Das Projektübersichtsticket `01a189a9-42b1-7518-a6e0-89b4577b1270` bleibt direktes Kind des UI-Programms. Seine bestehende Abhängigkeit vom Konzept, Blocks-Kante zur visuellen Abnahme sowie `relates_to`-Kante zur Responsive-Aufgabe bleiben erhalten. Keine Planänderung nötig; Mockzahlen sind nur ein Beispielstand und müssen bei späteren Ticketänderungen erneut geprüft werden.


### Desktop-Ticketansicht: Priorität des Beispiel-Tickets

Im `ui-fp-layout.svg` steht beim ausgewählten Konzeptticket die Priorität „Hoch“. Der aktuelle heist-Datensatz bestätigt `todo`/`high` und den Parent UI-Richtung. Ein später angehängter Absatz in derselben Ticketbeschreibung nannte dagegen noch `todo/normal`. Diesen veralteten Beschreibungswert habe ich über heist auf `todo/high` berichtigt. Die Parent-Zuordnung und sämtliche bestehenden `blocks`-Beziehungen des Konzepts blieben unverändert. Der sichtbare Mock war korrekt; korrigiert wurde nur der widersprechende Planungstext.

### Mobile Ticketdetails: Zugehörigkeiten und Beziehungsrichtung

`ui-prototype-mobile.svg` (390×844) und `ui-ticket-detail-320.svg` (320px) zeigen dasselbe echte Beispiel-Ticket `01a189a9-42b1-7518-a6e0-89b4577b1270`. heist bestätigt den Titel, Status `todo`/„Offen“, Priorität `normal`/„Normal“, direkten Parent UI-Programm `01a189a9-429e-7fb4-9d2c-8db0221f8942`, sechs direkte Unteraufgaben und vier Beziehungen. Richtungen im 390px-Zähler sind korrekt: eine eingehende `blocks`-Kante („wartet auf“), eine ausgehende `blocks`-Kante („blockiert“) und zwei `relates_to`. Das 320px-Mock zeigt dazu dieselben vier Ziele einzeln. Parents und Kanten blieben unverändert; kein neuer Ticketbedarf. Statische Datenprüfung, keine Live-Browserabnahme.


### Globale Suchvorschau und Trefferziele

`ui-search-preview.svg` gegen heist-Suche und bestehende Aufgaben geprüft. Die Ticketkarte zeigt den aktuellen UI-Programmtitel, ID-Präfix und gespeicherten Status; die Kommentarprobe verweist auf das reale Ticket „Ticketauswahl über stabile URLs direkt öffnen und Browserverlauf unterstützen“ und einen dort gespeicherten Review-Kommentar. Ziel- und Plankarte verwenden die aktuell kanonischen heist-Titel; Jira in diesen nutzerverfassten Dokumenttiteln ist Quelldateninhalt, keine Jira-Marke in der UI-Chrome. Filter decken Ticket, Kommentar sowie Ziele, Pläne und Entscheidungen ab. Typgerechte Zielnavigation ist im vorhandenen Suchroutingticket `01a189c7-e5a5-7fd7-b0e1-4adec7831943` geplant; Dokumentlesemodus bleibt dem Dokumentpaket `01a189af-50ab-71b9-9f11-92e13989409f` zugeordnet. Parents und Relations unverändert. Port 4000 hat derzeit keinen sichtbaren Listener; ein lokaler HTTP-Aufruf wird in dieser Umgebung mit Socket-Zugriffsverweigerung blockiert. Deshalb ist dies eine heist-/Entwurfsprüfung und keine aktuelle Liveabnahme.

### Suchfluss: Trefferziel und verspätete Antworten — Quellabgleich 2026-10-31

Der aktuelle `src/server.js`-Handler rendert alle `/api/search`-Treffer als Buttons und ruft für jeden `show(id)` auf; `show()` lädt ausschließlich `/api/tickets/:id`. Damit führen Kommentar- und Dokumenttreffer weiterhin auf den Ticket-Endpunkt statt zum jeweiligen Ziel. Zusätzlich startet `oninput` die Suche bei jedem Tastendruck ohne Entprellung oder Abbruch. Beide Lücken sind bereits geplant: Typrouting ist Kind der Ticketnavigation (`01a189c7-e5a5-7fd7-b0e1-4adec7831943`), Begrenzung/Paging, Querywechsel und verspätete Antworten sind im Geschwisterticket `01a189d4-0a9c-718d-9aed-be4cb53e46d4` erfasst; dessen `relates_to`-Beziehung zum Routingticket bleibt bestehen. Die Beispieltitel und Kommentarzuordnung im Suchmock stimmen mit heist-Suche überein. Kein weiteres Ticket nötig; Live-Klickpfad bleibt mangels laufender App ungeprüft.

### Ticketstatus: Core übernimmt leere Update-Werte — Zuständigkeit offen

Der aktuelle Core-Quelltext bestätigt den bereits im Feldticket `01a189af-d766-703b-a961-52a10b86081f` geplanten Randfall für Create und Update: `validateTicketInput()` prüft `input.status` nur, wenn es truthy ist. Beim Erstellen umgeht `status: ""` die Prüfung und `input.status ?? statuses[0]` speichert den leeren String. Beim Update wird der Patch mit dem bestehenden Datensatz zusammengeführt; sowohl `status: ""` als auch `status: null` umgehen die Prüfung und können als ungültiger Status gespeichert werden. Ein Whitespace-String ist truthy und wird als unbekannter Status abgelehnt. Das UI soll weiterhin stets einen gültigen konfigurierten Wert senden; die Core-Validierung muss explizite leere/null Statuswerte bei Updates zurückweisen und den Datensatz unverändert lassen. Im aktuellen heist-Bestand gibt es kein Core-Ticket oder Core-Parent für die eigentliche Core-Korrektur; daher kein neues Ticket unter der UI-Wurzel angelegt. Das bestehende UI-Feldticket behält seine fachliche Zuständigkeit und Zugehörigkeit.

### Accessibility: Fokus- und Landmarkenbefund weiterhin im Quellstand

Der aktuelle `src/server.js`-Quellstand bestätigt statisch die offenen Punkte aus dem Accessibility-Ticket `01a189b2-a6a6-74d9-b7c4-d9e344090079`: `#tree` enthält generische `.row`-`div`s mit nativen Buttons, aber keine benannte Navigations-/Listenstruktur oder programmatische Auswahl; `show()` ersetzt `#detail` per `innerHTML`, ohne Fokusziel oder Live-Region. Die frühere DOM-Messung mit 39 Zeilen stammt vom 2026-10-30 und bleibt historisch; die aktuelle heist-Struktur umfasst 46 Tickets und erlaubt daraus allein keine neue Live-DOM-Zählung. Das zuständige Ticket bleibt Kind des Responsive-/Barrierefreiheitspakets; die bestehenden Abstimmungen mit mobiler Navigation und Ticketnavigation bleiben erhalten. Keine neue Aufgabe; Liveprüfung von Tastatur/Fokus weiter offen.

### Stilreferenz und kanonische Ziel-/Plantitel

Die bestätigte visuelle Leitplanke lautet fp.dev: schlicht, hell und später änderbar; Jira ist Orientierung für Planungsabläufe. `ui-wireframe.md` trennt dies bereits klar. Die kanonischen heist-Titel für UI-Ziel und UI-Plan bezeichnen beide die Oberfläche jedoch als „Jira-inspiriert“, wodurch die gewünschte visuelle Referenz allein aus den Titeln missverstanden werden kann. Titelvorschläge für die spätere revisionssichere Dokumentbearbeitung: Ziel „Eine schlichte, klare Planungsoberfläche für Heistman gestalten“; UI-Plan „UI-Plan: fp.dev-inspirierte Heistman-Oberfläche“; Review-Plan „Fortlaufender UI-Review und Verbesserung der Heistman-Oberfläche“. Die drei Dokumente behalten getrennte Aufgaben: Zielbild, Umsetzungspfad und wiederkehrende Prüfung. Zuständige bestehende Aufgabe ist `01a189ad-9320-7ba9-a8ad-4656341eb4e5` unter dem laufenden UI-Review; die bestehende `blocks`-Kante von `01a189f8-f7bf-7921-b4cf-b3269ac6239d` zur Konsolidierung bleibt Voraussetzung. Kanonische Dokumente bleiben bis zur Bearbeitungsfunktion unverändert.

### Dokumentlink-Mockup: zugänglicher Zähler

Im `ui-documents-links-mobile.svg` stimmen sichtbarer Zähler und heist-Audit überein: 11 Verknüpfungseinträge, 10 eindeutige Ziele (neun Ticketziele plus ein verknüpftes UI-Zieldokument). Die SVG-Beschreibung für Screenreader war noch beim älteren Stand 10/9. Sie ist auf elf Einträge mit Aufschlüsselung aktualisiert: zehn Ticketlinks zu neun Tickets, das Review-Ticket doppelt, plus ein UI-Zieldokument. Das bestehende Konsolidierungsticket `01a189ad-9320-7ba9-a8ad-4656341eb4e5` bleibt Kind des laufenden UI-Reviews; seine Blocks-/relates_to-Zuordnungen sind unverändert. Keine kanonischen Dokumentlinks geändert.


### Projektübersicht: Readiness ist im Browservertrag noch nicht verfügbar

Das Desktopmockup zeigt eine „Offen · bereit“-Karte und konkrete nächste Arbeit. Der fachliche Projektübersichtstext begrenzt diese Kennzahl korrekt: Readiness erst darstellen, wenn Semantik und Datenschnittstelle verfügbar und geklärt sind. Der Quellenabgleich bestätigt, dass `src/index.js` zwar `project.readiness(id)` mit Blockern bereitstellt, der Browser-Endpunkt `/api/tree` in `src/server.js` aber nur Baumitems, Gesamtzahl, Offset und Limit liefert; eine Relations-/Readiness-Route für die UI fehlt. Daher ist die Karte ein Zielbild, keine heute verfügbare Browserfunktion. Diese API-Voraussetzung ist bereits im Projektstartticket `01a189b1-a4e4-7227-aca6-1283ecc6d8bd` geplant; Parent unter Projektübersicht und bestehende Relations bleiben erhalten. Kein zusätzliches Ticket nötig.

### Status-Board: Desktop-Beschreibung korrigiert

`ui-board-preview.svg` zeigte sichtbar zehn direkte UI-Programmkinder (neun Karten im gespeicherten Status „Offen“, eine in „In Arbeit“), doch der SVG-`desc` sagte, das Board enthalte nur neun direkte Kinder. Der Screenreader-Text ist korrigiert und nennt jetzt sowohl zehn direkte Kinder als auch deren Statusaufteilung. Die 390px-Beschreibung nennt bereits neun offene aus zehn direkten Kindern; der 320px-Entwurf nennt drei sichtbare Karten aus neun offenen. Das Board-Arbeitspaket bleibt Kind der Ticketnavigation und durch die bestehende Konzept-Blocks-Kante abhängig; keine Relationsänderung.

### Status-Board bei 320px: Gesamtzahl korrigiert

Der 320px-Mock zeigte „9 direkte Arbeitspakete“, obwohl heist, Desktop-Board und 390px-Board zehn direkte Kinder des UI-Programms führen. Die offene Spalte mit „9 Tickets“ ist korrekt; nur der Gesamtzähler war veraltet. Gesamtzahl in `ui-board-preview-320.svg` auf zehn korrigiert. Parent und Beziehungen des Boardtickets bleiben unverändert.

### Ticketdetail: Elternpfad muss als Navigation erkennbar sein

Der 320px-Detailentwurf hatte am Beispiel `01a189a9-42b1-7518-a6e0-89b4577b1270` nur den generischen Text „UI-Programm · Arbeitspaket“. heist bestätigt als kanonischen Parent `Schlichte Planungsoberfläche für Heistman gestalten und umsetzen`; der bisherige Text zeigte weder dessen Namen noch einen Linkzustand. Den Entwurf auf einen gekürzten kanonischen Parent-Titel umgestellt und `ui-wireframe.md` präzisiert: Vorfahren sind navigierbare Links über die bestehende stabile Ticketnavigation, der aktuelle Ticketname bleibt die Seitenüberschrift. Vollständiger zugänglicher Name trotz visueller Kürzung. Parent- und Relationsdaten blieben unverändert; bestehende Navigations-/Browserverlaufstickets decken das Verhalten ab, daher kein neues Ticket.

Der Detailbeispielabgleich bestätigt außerdem Status `todo`, Priorität `normal`, sechs direkte Untertickets und vier echte Beziehungen: eine eingehende `blocks`-Kante (Konzept blockiert das Ticket), eine ausgehende `blocks`-Kante und zwei `relates_to`. Die vier Karten und ihre Richtungen im 320px-Mock stimmen damit; die Unteraufgabenanzahl stimmt ebenfalls. Das ist eine statische heist-Prüfung, keine Live-Browserabnahme.

### Desktop-Ticketdetail: Abhängigkeitszusammenfassung am aktuellen Bestand messen

Im ausgewählten Konzeptticket `01a189ad-5c7c-7e68-b165-79fb9f674539` zeigte `ui-fp-layout.svg` drei Blockziele ohne Hinweis, dass es nur Beispiele sind. heist enthält 34 ausgehende `blocks`-Beziehungen dieses Tickets über mehrere fachliche Parents hinweg. Die Kurzzeile des Mockups nennt nun die Gesamtzahl und kennzeichnet die drei sichtbaren Bereiche als Beispiele. Damit wird die Kartenfläche aussagekräftig, ohne 34 Tickets in das Layout zu quetschen. Keine Ticketbeziehung oder Parent-Zuordnung geändert; das Beispiel bleibt statisch und muss bei künftigen Planänderungen erneut abgeglichen werden.

### Dokumentnavigation und Lesemodus: Datenstand 2026-10-31

`ui-documents-mobile.svg` und `ui-documents-links-mobile.svg` gegen die vier kanonischen heist-Dokumente geprüft: zwei Ziele und zwei Pläne, alle `todo`; die Status-/Typfilter und sichtbaren Titel stimmen. UI-Plan enthält acht Ticketlinks. Review-Plan enthält elf Einträge, davon zehn Ticketlinkeinträge zu neun eindeutigen Tickets sowie ein zusätzliches verknüpftes Zieldokument; das Reviewticket ist weiterhin doppelt. Die Entwürfe zeigen dieses Duplikat ausdrücklich und versprechen keine automatische Löschung. Bestehende Aufgabe für revisionssichere Ziel-/Planbearbeitung `01a189f8-f7bf-7921-b4cf-b3269ac6239d` und Linkkonsolidierung `01a189ad-9320-7ba9-a8ad-4656341eb4e5` decken die nötigen Schritte bereits ab; letztere bleibt Kind des laufenden UI-Reviews, Dokumentbearbeitung bleibt unter „Planungsdokumente und Projektübersicht“. Keine neue Aufgabe und keine Änderung kanonischer Links erforderlich. Die App ist aktuell nicht erreichbar; dies bleibt ein statischer Daten-/Entwurfsabgleich.

### Laufzeitstatus — 2026-10-31

Die aktuelle CUA-Browserinventur zeigte zunächst keinen lokalen App-Tab. Ein direkter Browseraufruf von `http://127.0.0.1:4000/` endete danach mit `ERR_CONNECTION_REFUSED`: Der feste Zielport ist aus dem Browser aktuell nicht erreichbar. Frühere Shell-Aufrufe an 4000 und den früheren Port 59456 endeten mit Socket-Berechtigungsfehlern und sind kein zusätzlicher Listenernachweis. Es wurde keine weitere Serverinstanz gestartet. Eine Live-UI-Sichtprüfung bleibt offen, bis der reguläre Start unter Port 4000 gelingt.

### Serverstart: fester Port ist im Plan, im Quellstand noch nicht wirksam

Quellabgleich am 2026-10-31: `bin/heist.js` übergibt im Standardstart `port: Number(opts.port ?? 0)`; `src/server.js` verwendet ebenfalls `port = 0` als Funktionsstandard. Node bindet so einen zufällig verfügbaren Port. Das widerspricht dem festgelegten Standard `127.0.0.1:4000` ohne stillen Ersatzport. Der aktuelle HTTP-Portcheck ist wegen Socket-Berechtigungen nicht aussagekräftig zum Listenerstatus und beweist auch nicht das Verhalten eines Starts. Das vorhandene hoch priorisierte Ticket `01a18d87-251e-7ff7-9678-7a437fd0ef76` beschreibt genau diese Aufrufstellen und die gewünschte Abnahme; es bleibt direktes Kind des UI-Programms und blockiert bereits die visuelle Abnahme. Keine parallele Aufgabe und keine Änderung an Produktdateien.

### Status-Board: Beispielkarten gegen den aktuellen Ticketbaum

Die dargestellten direkten Karten in Desktop-, 390px- und 320px-Board wurden mit `heist tree` abgeglichen: UI-Richtung `todo/high`, Icon-System `todo/normal`, Navigation `todo/high`, Detail `todo/high` und Projektübersicht `todo/normal`; alle fünf sind direkte Kinder der UI-Programmwurzel. Die erste ist offen und ohne eingehenden Blocker, die übrigen vier zeigen getrennte Blockerbereitschaft. Desktop zeigt zusätzlich das laufende Review unter `in_progress/normal`. Die neun offenen Karten plus eine Karte in Arbeit und die Summen der Blockerhinweise stimmen. Keine weitere Kartenkorrektur oder neue Planaufgabe nötig. Das Board bleibt ein statischer Zielentwurf; die Live-App hat noch keine Boardroute. Das Boardticket bleibt unter Ticketnavigation und seine bestehenden Abhängigkeiten, insbesondere zum Beziehungspaket, bleiben maßgeblich.

### Desktop-Ticketliste: markiertes Unterticket mit Parent zeigen

Die markierte Zeile in `ui-fp-layout.svg` war das Unterticket „Schlichtes UI-Konzept …“ (Parent: UI-Richtung), aber die Listenprobe zeigte den Parent nicht. Gleichzeitig wurden die zehn sichtbaren Zeilen mit „10 Arbeitspakete“ beschrieben, obwohl eine Zeile kein direktes Programmkind ist. Der Mock zeigt jetzt den direkten Parent „UI-Richtung und Informationsarchitektur festlegen“ und rückt das markierte Konzept sichtbar darunter ein; die übrigen direkten Arbeitspakete folgen auf derselben Ebene. Die heist-Parent-Zuordnung wurde nicht geändert. Mobile Listenbeispiele zeigen direkte Programmpakete ohne diese ausgewählte Unterticket-Konstellation und bleiben davon unberührt.

Die geänderte Desktop-SVG ist XML-gültig und die Listenkoordinaten bleiben innerhalb der linken Arbeitsfläche. Eine gerenderte Sichtprüfung war hier nicht möglich: Die Browserrichtlinie blockiert lokale `file:`-Adressen, und es ist kein lokaler SVG-Renderer verfügbar. Diese Runde bestätigt daher die Daten-/Strukturkorrektur, nicht die gerenderte Typografie.

### Ticketliste: Readiness braucht einen gebündelten Browserdatenvertrag

Die 390px- und 320px-Listenentwürfe zeigen für direkte Arbeitspakete gespeicherten Status, Priorität und getrennte Bereitschaft. Der aktuelle Browser-Endpunkt `/api/tree` liefert zwar `status`, `priority` und `rollup`, aber weder Bereitschaft noch Blockerziele; `src/index.js` hat dafür nur `project.readiness(id)` für ein einzelnes Ticket, das intern Tickets und Beziehungen erneut vollständig liest. Das vorhandene Status-/Rollup-/Bereitschaftsticket `01a189b6-43ac-78a2-a06b-345c6fa56083` muss deshalb neben der Semantik auch eine gebündelte Browserabfrage für sichtbare Tickets planen (oder den Baumvertrag ergänzen), inklusive stabiler Blocker-IDs/Titel. Rollup und Bereitschaft müssen dieselbe Regel für erledigte Blocker verwenden. Das Navigationsticket bleibt über die bestehende `relates_to`-Kante abgestimmt; Eltern und andere Beziehungen bleiben unverändert. Keine neue Aufgabe erforderlich.

### Übergreifender Ziel-/Planabgleich — nächste Pflege in bestehenden Aufgaben — 2026-10-31

Der Abgleich zeigt, dass die Korrektur nicht beim einzelnen UI-Plan endet: Auch das verknüpfte UI-Ziel `01a189a9-429a-7005-8722-2847de61b01b` trägt im Titel „Jira-inspiriert“ und beschreibt Jira als Referenz für Navigation, Listen, Filter und Details. Das laufende Review-Ziel `01a189ac-28ff-73c2-8a77-2320703d3924` sowie der Review-Plan `01a189ac-2905-7324-b64b-59d828960a48` enthalten dieselbe zu breite Jira-Leitlinie. Das Icon-Ticket `01a189a9-42a6-7a27-adb9-e30a8df78d54` ist bereits korrekt: keine Tickettyp-Semantik erfinden.

Nächste Planungsschritte innerhalb der existierenden Zugehörigkeiten: (1) Nach Verfügbarkeit der revision-sicheren Dokumentbearbeitung die Titel und Ziele/Pläne konsistent auf fp.dev als vorläufige visuelle Referenz und Jira ausschließlich für Planungsabläufe ausrichten. (2) Im bestehenden Review-Ticket `01a189ac-28f7-7250-b817-2026a531a7b5` diesen vollständigen Dokumentumfang festhalten. (3) Priorisierung an den echten Blockern ausrichten: erst festen Port 4000 und erreichbare Laufzeit, dann visuelles Konzept und davon abhängige Listen-/Detail-/Icon-Entscheidungen; unabhängige Review- und Datenvertragsarbeit kann parallel geplant bleiben. Keine neuen Ziele oder Tickets anlegen, keine kanonischen `.heist`-Dokumente direkt bearbeiten und keine Parent-/Relations-Kanten verändern.

Damit ist das bestehende Ziel weiterhin passend; es braucht eine konsistente Nachschärfung über die vorhandenen Dokumente und ihre bestehenden Bearbeitungstickets. Die Live-App bleibt aktuell nicht erreichbar (siehe Laufzeitstatus), daher sind Aussagen zur tatsächlichen Darstellung weiterhin als statische Prüfung gekennzeichnet.

### Priorisierung und Dokumentkonsistenz — Abgleich mit aktuellem heist-Baum — 2026-10-31

Der aktuelle direkte UI-Programmbaum enthält zehn Arbeitspakete: neun `todo` und das Review `in_progress`. Das hoch priorisierte Port-4000-Ticket ist weiterhin `todo`; heist hält bereits eine `blocks`-Kante zur visuellen Prüfung. Das bestätigt die richtige Reihenfolge für Live-Abnahme: keine weitere Browser-UI-Bewertung behaupten, bis der feste Start gelingt. Konzept/Informationsarchitektur bleibt ebenfalls `todo/high` und steuert danach die fachlichen Detailpakete. Die Icon-Aufgabe ist `todo/normal` und soll erst nach abgestimmtem Konzept konkretisiert werden.

Dokumentenabgleich: Das separate UI-Ziel und der UI-Plan widersprechen weiterhin der fp.dev/Jira-Leitplanke und nennen Tickettyp-Icons. Zusätzlich führen Review-Ziel und Review-Plan Jira noch als Stilreferenz. Die heist-Aufgabe zur revision-sicheren Dokumentbearbeitung ist bereits vorhanden und dem Projektübersichtspaket zugeordnet; der wiederkehrende Review bleibt direktes Kind des UI-Programms. Korrektur deshalb über diese vorhandene Bearbeitungsaufgabe und die bestehende Dokumentenkonsolidierung planen. Keine neuen Tasks, keine Parent- oder Relation-Änderungen.

Nächster konkreter Review-Schritt: an der Dokumentbearbeitungsaufgabe Titel-/Textänderung für alle vier betroffenen kanonischen Dokumente bündeln; danach im heist-Dokumentbestand kontrollieren, dass die Nutzerleitplanke durchgängig ist und die Suche-/Dokumentvorschauen keine alten Titelfragmente mehr zeigen. Parallel kann der Live-Start über das vorhandene Port-Ticket geklärt werden; erst dann Screenshots und Browserzustände aktualisieren. Die App selbst bleibt in dieser Runde ungeprüft, da der letzte echte Browseraufruf Port 4000 mit `ERR_CONNECTION_REFUSED` quittierte.

### Entwurfsbeschreibungen: Jira als Stilreferenz entfernt — 2026-10-31

Die repoweite Suche nach Jira-/Tickettyp-Begriffen in `docs/*` hat zwei Darstellungen gefunden, in denen Jira fälschlich als visueller Stilanker erschien: Die Zugänglichkeitsbeschreibung von `ui-prototype.svg` und Variante B in `ui-layout-options.svg`. Beide Formulierungen sind jetzt neutral bzw. ausdrücklich fp.dev-orientiert. Die sichtbaren Such-/Dokumentvorschauen behalten dagegen die aktuell gespeicherten kanonischen heist-Titel unverändert; sie sind Datenproben, keine freigegebenen Neubenennungen. Ihre alten Jira-Titel bleiben deshalb bis zur revisionssicheren Pflege als offen ausgewiesener Planungsbefund stehen. Der reguläre Review erwähnt Jira weiterhin nur im bestätigten Sinn als Orientierung für Arbeitsabläufe. Keine Produktdateien oder heist-Zuordnungen geändert.

### Icon-Inventar: bestehende Ticketbeziehungen fehlen als eigener Kandidat — 2026-10-31

Der Abgleich von `ui-icon-preview.svg` mit dem aktuellen heist-Datenmodell bestätigt die bewusst generischen Ticketzeichen sowie getrennte, ausgeschriebene Status-, Prioritäts- und Readinesshinweise. Das Inventar deckt Suche, Kommentare, Navigation, Dokumentbereiche und Aktionen ab, enthält aber kein eigenes Symbol für bestehende Ticketbeziehungen (`blocks`/`relates_to`). Beziehungen sind ein echter, zentraler Ticketbereich im Detail und haben bereits ein eigenes Fachpaket; ein schlichtes Kettenlink-Symbol wäre ein sinnvoller Kandidat für Abschnittsnavigation/Beziehungsgruppen. Es soll nur mit sichtbarem Label bzw. zugänglichem Namen verwendet werden und darf die Richtung/Semantik der jeweiligen Beziehung nicht allein über das Symbol vermitteln. Zuständigkeit: vorhandenes Icon-Ticket `01a189a9-42a6-7a27-adb9-e30a8df78d54`, abgestimmt mit Ticketdetail und Relationspaket unter ihren bestehenden Parents. Noch keine SVG-Änderung am Kandidateninventar, bis die Symbolauswahl im Konzept abgestimmt ist; keine neue Aufgabe oder Relationsänderung.

### Datenvertrag: Ticketfelder und Beziehungen gegen aktuelle UI prüfen — 2026-10-31

Der aktuelle `src/server.js`-Quellstand bestätigt zwei bereits geplante Lücken, aber auch die Trennung der Zuständigkeiten: Das Ticketformular zeigt Status/Priorität nur teilweise; Editieren sendet Titel, Status und Beschreibung, während Priorität, Labels und Properties fehlen. Das ist im Feldticket `01a189af-d766-703b-a961-52a10b86081f` bereits präzise erfasst; Properties haben mangels Schema ausdrücklich keinen erfundenen Eingabevertrag. Die Ticketanlage bleibt beim kontextbezogenen Unterticket-Ticket `01a189b1-f688-7fd0-9d9d-33b3016a1acc`.

Der Server stellt weiterhin keine `/api/relations`-Leseroute bereit, obwohl der Core Beziehungen lesen kann. Anzeige/Navigieren bleibt daher beim bestehenden Ticket `01a189af-d764-72c3-a674-f5601919f131`; sicheres Anlegen/Lösen ist bewusst im separaten Ticket `01a18c8f-1f44-7856-827e-624aeb1e0e07` geplant und durch die Anzeige-/Konzeptvoraussetzung blockiert. Elternpfad bleibt separat von Relationskanten. Diese Aufteilung passt zur UI-Semantik und verhindert, dass ein Mock eine heute nicht verfügbare API als fertig erscheinen lässt.

Keine neue Lücke ohne Owner gefunden und kein Ticket umgehängt. Für den nächsten Planabgleich die Reihenfolge im Auge behalten: UI-Konzept → lesbare Feld-/Beziehungsdatenverträge → optionale schreibende Beziehungsverwaltung → Browserabnahme. Die visuellen Mockups bleiben Zielzustände, bis Laufzeit und APIs dafür verfügbar sind.

### Laufender Browser-Check — erneuter Port-4000-Versuch — 2026-10-31

Der tatsächliche Browseraufruf `http://127.0.0.1:4000/` endet weiterhin mit `net::ERR_CONNECTION_REFUSED`. Das ist ein direkter Live-Verbindungsbefund; es wurde kein weiterer Server gestartet und kein alternativer Port ausprobiert, um keine zweite Instanz offenzuhalten. Damit bleibt die Live-UI-Abnahme ausgesetzt. Der nächste handlungsfähige Schritt liegt beim bestehenden hoch priorisierten Serverticket `01a18d87-251e-7ff7-9678-7a437fd0ef76`; nach dessen regulärem Start unter 4000 werden Screenshot und Browserabnahme anhand des abgestimmten Konzepts fortgesetzt. Unabhängiger Quell-/Datenabgleich ist in dieser Runde weiter möglich, ersetzt die Live-Prüfung aber nicht.

### Dokumentbearbeitung und Vorschauen: zusammenhängende Pflegefolge — 2026-10-31

Der erneute Bestandsabgleich bestätigt vier kanonische Dokumente mit überholter Jira-Stilbenennung bzw. -Semantik: UI-Ziel `01a189a9-429a-7005-8722-2847de61b01b`, UI-Plan `01a189a9-42b7-7724-92e3-8da8d2a2dcfe`, Review-Ziel `01a189ac-28ff-73c2-8a77-2320703d3924` und Review-Plan `01a189ac-2905-7324-b64b-59d828960a48`. Vorhandene Rollen bleiben getrennt: Zielbild, UI-Umsetzungspfad, wiederkehrendes Reviewziel und dessen ausführbarer Reviewplan. Erst kanonische Texte/Titel in der App revisionssicher aktualisieren; dann exakt die davon abgeleiteten Datenproben in `ui-documents-mobile.svg`, `ui-documents-links-mobile.svg`, `ui-prototype-overview*.svg`, `ui-search-preview*.svg` und dem ASCII-Raster in `ui-wireframe.md` nachziehen. Bis dahin die Vorschauen unverändert lassen, damit sie den gespeicherten heist-Stand korrekt wiedergeben.

Die Zuständigkeit bleibt zweistufig und passend: `01a189f8-f7bf-7921-b4cf-b3269ac6239d` ermöglicht die sichere Dokumentpflege unter Projektübersicht; anschließend `01a189ad-9320-7ba9-a8ad-4656341eb4e5` bereinigt gezielt Links/Duplikate unter dem laufenden Review. Vor der Linkpflege Zielrollen, einzelne Ticketrelevanz und vorhandene Beziehungen erneut aus der App prüfen. UI-Ziel an Programmwurzel anbinden, nicht pauschal an alle Nachfahren; vorhandenen Review-Zieldokument-Link behalten; doppelte Reviewticketlinks einzeln bereinigen. Eltern und Relations bleiben unangetastet. Keine Dokumentdateien oder Vorschauen vorzeitig an hypothetische Titel anpassen.

### Suchplanung: Keyword → optional ONNX/SQLite → Hybrid — Abhängigkeitsprüfung — 2026-10-31

Der fachliche Suchpfad ist im heist-Baum bereits sauber in drei Ebenen getrennt: aktuelles Keyword-Routing/Paging unter Ticketnavigation; optionale lokale Semantik im Roadmap-Kind `01a189bd-b44d-7e95-84fc-66d307543b12`; darin getrennte ONNX-Embedding-, SQLite-Rebuild- und Hybrid-API/UI-Aufgaben. Kantenprüfung bestätigt: UI-Konzept, stabile Suchziele, Typrouting, Accessibility und Suchpaging blockieren den Einstieg in die spätere semantische Suche. Embedding und SQLite-Index blockieren jeweils die Hybridintegration. Die semantische Suche ist nur mit `relates_to` an die visuelle Prüfung und Responsive-Arbeit angebunden, blockiert also den Keyword-MVP und dessen Browserabnahme nicht.

Die Ticketbeschreibungen decken Node.js/ONNX lokal, `all-MiniLM-L6-v2` samt Sprachqualitätsvergleich, rebuildbaren SQLite-Index, deterministische Hybridrangfolge, Filter, Paging, Generation-Snapshots, Keyword-Fallback und Datenschutz ohne externe Embeddingdienste ab. Der aktuelle `src/server.js` liefert weiterhin ausschließlich Keywordtreffer und keine Modus-/Indexbereitschaft; die Vorschauen kennzeichnen Semantik korrekt als später. Im aktuellen Review ist keine zusätzliche Aufgabe oder Abhängigkeitskante nötig. Eltern und Relations bleiben wie geplant; künftige Reviewrunde soll Modellqualität gegen lokale, nicht-kanonische mehrsprachige Suchfälle messen, bevor aus der bevorzugten Baseline eine feste Entscheidung wird.

### Projektübersicht: zusätzliche Visual-QA-Blocker benannt — 2026-10-31

Abgleich der drei Projektübersichtsentwürfe mit eingehenden `blocks`-Kanten des Visual-QA-Tickets `01a189a9-42b5-71b8-a846-9dc1985e3102`: neben den Konzept-/Fachpaketen sind die drei zusätzlichen Voraussetzungen tatsächlich Port 4000 (`01a18d87-251e-7ff7-9678-7a437fd0ef76`), revision-sichere Entscheidungsbearbeitung (`01a18c80-146f-7e0b-a373-040e6f17cda9`) und Beziehungsverwaltung (`01a18c8f-1f44-7856-827e-624aeb1e0e07`). Desktop-, 390px- und 320px-Übersicht benennen sie jetzt direkt, statt nur „drei weitere Voraussetzungen“ zu sagen. Die Gesamtzahl und Readiness-Kennzeichnung blieben unverändert; Parents und Relations im heist-Bestand wurden nicht geändert. Diese genauere Blockerzeile macht den Einstieg handlungsfähiger. Live-Dashboard/API für Readiness bleibt weiterhin geplant, die Vorschauen sind statische Momentaufnahmen.

### Mobile Ticketliste: vorhandene Filterfelder im schmalen Layout erreichbar halten — 2026-10-31

Der fachliche Filtervertrag verlangt kombinierbare Status-, Prioritäts-, Label- und Hierarchiebereichsfilter (`01a189cc-4797-7974-9f3d-010740b102de`). Die 390px- und 320px-Listenentwürfe zeigten bisher nur „Status: Alle“; dadurch wirkte es, als sei mobil allein der Statusfilter verfügbar. Beide Entwürfe benennen nun im 44px-Einstieg die gesamte Filterfläche und Screenreader-Beschreibung nennt dieselben vier vorhandenen Felder. `ui-wireframe.md` hält fest, dass der Einstieg alle Filter kombinierbar öffnet und aktive Filter einzeln entfernbar bleiben. Keine zusätzlichen Datenfelder/Filter erfunden; Eltern-/Relationszuordnungen unberührt. Das mobile Detail-/Zurück-Verhalten bleibt bei der bestehenden Responsive-Aufgabe `01a189b0-0f28-7715-8ac6-c689065acab1`; die Filtersemantik und Zustandsregeln bleiben unter dem Navigation-Unterticket.

### Mobiles Ticketdetail: kanonischen Parent zeigen und Beziehungskarten als Ziele markieren — 2026-10-31

Abgleich der Beispiel-ID `01a189a9-42b1-7518-a6e0-89b4577b1270` mit heist: direkter Parent ist die Programmwurzel „Schlichte Planungsoberfläche für Heistman gestalten und umsetzen“, nicht nur das generische Label „UI-Programm“. `ui-ticket-relations-mobile.svg` nannte zuvor „UI-Programm“ als Elternpfad; der sichtbare Pfad ist jetzt ein gekürzter kanonischer Titel und die SVG-Bildbeschreibung nennt den vollständigen Parent. Dasselbe Vollnamens-/Linkmuster ist in `ui-ticket-detail-320.svg` ergänzt.

Zusätzlich wirkten die vier Beziehungskarten zuvor wie statische Labels. Gegen-Ticket-Titel sind in beiden mobilen Detailentwürfen jetzt als Linkziele erkennbar (blauer, unterstrichener Titel); Beziehungsart und Richtung bleiben separat ausgeschrieben. Die Karten bleiben Beispiele für Anzeige/Navigieren. Parents oder Relations wurden nicht verändert. Fachlich bleibt die Beziehungsanzeige beim Detailticket `01a189af-d764-72c3-a674-f5601919f131`, das kompakte mobile Wechsel-/Fokusverhalten beim Responsive-Unterticket `01a189b0-0f28-7715-8ac6-c689065acab1`; stable URL/Browserverlauf bleibt beim bestehenden Navigationsticket.

### Ticketanlage: Form-, Parent- und Rückmeldevertrag über drei Viewports — 2026-10-31

Quell- und Mockabgleich für `ui-ticket-create-desktop.svg`, `ui-ticket-create-mobile.svg`, `ui-ticket-create-320.svg` und `ui-ticket-create-feedback.svg`: Root-Erstellung zeigt keinen Parent und bleibt eigener Einstieg; Unterticket-Erstellung übernimmt sichtbaren, festen Elternticketkontext. Titel ist Pflicht, Beschreibung optional; Status beginnt beim ersten konfigurierten Wert, Priorität beim Core-Standard `normal`, Labels sind optional. Die Screens versprechen keine freie Properties-Eingabe und keine Statuskaskade. Das entspricht dem Core-Create-Vertrag sowie dem bestehenden Unterticket-Ticket `01a189b1-f688-7fd0-9d9d-33b3016a1acc`.

Die Rückmeldevorschau trennt lokale Validierung, bestätigte Ablehnung, unklare POST-Antwort und bestätigten 201-Erfolg mit fehlgeschlagenem Refresh. Bei unklarem Ausgang ist kein blinder zweiter Create vorgesehen; nach bestätigtem Erfolg wiederholt „Liste aktualisieren“ keinen POST. Dies passt zum aktuellen serverseitigen ID-Vertrag ohne Idempotenzschlüssel und zur vorhandenen Rückmeldungsplanung. Der bekannte Core-Randfall expliziter leerer Statuswerte bleibt im bestehenden Create-/Feldticket erfasst; UI sendet stets gültigen konfigurierten Wert bzw. lässt ihn nur aus, wenn Core-Default greifen soll.

In dieser Runde keine nicht abgedeckte Formular- oder Parent-Zuordnungslücke gefunden; daher keine neue Aufgabe und keine Kantenänderung. Abnahme später mit Root- und Child-Fixtures: Parent leer vs. exakt aktueller Parent, parent unverändert nach Anlage, Standard-/Custom-Status, Priorität/Labels, Validierungsfehler, unklarer Ausgang und erfolgreicher Create bei fehlgeschlagenem Refresh. Zugehörigkeit bleibt beim Detail-/Anlageticket; sprachliche Meldungen beim bestehenden UI-Feedbackticket.

### Rückmeldungsentwurf: Nutzertext von API-Planung trennen — 2026-10-31

Beim Sprachreview von `ui-ticket-create-feedback.svg` standen interne Begriffe wie „POST ohne Antwort“, „sicher prüfen · API-Vertrag nötig“, „zweiter POST“ und „Refreshfehler“ sichtbar in einer als Rückmeldeentwurf gezeichneten Ansicht. Das vermischte Produkttext und Implementierungsnotiz und ließ eine nicht verfügbare Schaltfläche wie eine echte sichere Prüfung aussehen. Der Entwurf kennzeichnet nun die farbigen Bereiche als Produkttextvorschläge und graue Kästen als interne Planungs-/Abnahmehinweise. Der unklare Zustand spricht verständlich von nicht bestätigter Erstellung, bietet „Zur Ticketliste“ an und empfiehlt, zuerst nach dem Titel zu suchen; ein blinder zweiter Create wird nicht angeboten. Beim bestätigten Erstellungsfall heißt es, dass das Ticket trotz Listenfehler angelegt ist; die Aktionen öffnen das Ticket oder laden nur die Liste neu. Keine neue Rückmeldungslogik behauptet: eine Schnittstellen-Planungsnotiz hält weiter fest, dass automatische sichere Prüfung/Idempotenz aktuell nicht verfügbar ist. Zuständigkeit bleibt beim bestehenden Rückmeldungs-Ticket `01a189b2-43b1-775a-89f1-388cdd0af53c` unter Visual-QA und in Abstimmung mit Ticketanlage; Parents/Relations unverändert.

### UI-Sprache: Bereitschaft und abgeleiteten Arbeitsstand verständlich benennen — 2026-10-31

Der Durchlauf über die sichtbaren und assistiven Textteile fand noch technische Kurzformen in mehreren Entwürfen: „Readiness“ in Projektübersicht/Listenbeschreibung und „Rollup“ im ASCII-Wireframe. Diese Begriffe sind in den Produkttexten nun als „Bereitschaft“ bzw. „Abgeleiteter Arbeitsstand“ ausgedrückt. Die Trennung bleibt erhalten: „Offen“ ist der gespeicherte Ticketstatus; „blockiert“ beschreibt die Bereitschaft aufgrund offener Voraussetzungen; abgeleiteter Arbeitsstand wird getrennt benannt. Die datierte Momentaufnahme und keine neue gespeicherte Statusart wird versprochen. Begriffsverantwortung liegt beim bestehenden UI-Sprachticket `01a189de-0250-7a08-91c5-9cab74a14d8f`; Semantik/Zuordnung beim Status-/Bereitschaftsticket `01a189b6-43ac-78a2-a06b-345c6fa56083`. Keine neuen Felder oder Kanten.

### Desktop-Ticketliste: vollständigen Filtervertrag sichtbar machen — 2026-10-31

Der Abgleich von `ui-fp-layout.svg` mit dem Navigation-/Filterticket zeigte bisher nur Status- und Prioritätscontrols. Der bestehende Vertrag umfasst außerdem Labels und den ausgewählten Hierarchiebereich. Im freien Platz der Filterzeile ist jetzt ein dritter kombinierbarer Einstieg „Labels · Bereich“ ergänzt; die Bildbeschreibung nennt alle vier vorhandenen Felder. Das schließt die desktopseitige Darstellung an die bereits nachgeschärften 390px-/320px-Entwürfe an. Keine Assignee-/Sprint-Filter, gespeicherten Ansichten oder neue Ticketfelder ergänzt. Fachliche Zuständigkeit bleibt im Navigation-Unterticket `01a189cc-4797-7974-9f3d-010740b102de` unter Ticketnavigation; mobile Darstellung bleibt im bestehenden Responsive-Paket. Keine Parent-/Relations-Änderung.

### Icon-Inventar: Beziehungen als Kandidat ergänzt — 2026-10-31

Der bestehende Icon-Entwurf hatte Suche, Kommentare, Status, Priorität und Blockerbereitschaft abgedeckt, aber keine sichtbare Markierung für den realen Beziehungsabschnitt eines Tickets. `ui-icon-preview.svg` enthält jetzt ein schlichtes Link-Symbol als ausdrücklich unverbindlichen Kandidaten. Die Wireframe-Regel stellt klar: Richtung (`incoming`/`outgoing`), Beziehungstyp (`blocks`/`relates_to`) und Ticketziel bleiben Text; das Symbol allein behauptet keine Blockierrichtung. Planung bleibt im vorhandenen Inventar-Unterticket `01a189b0-9e75-77bd-ab31-a73a0dd328b5` unter dem Icon-Systempaket, abgestimmt mit Ticketdetail und Relationspflege unter ihren bestehenden Parents. Noch keine Icon-Bibliothek ausgewählt und kein Produktasset eingebaut; keine neue Aufgabe oder Relation.

### Listen-/Detailfluss: URL- und Datenzugriffe gegen den aktuellen Server prüfen

Quellabgleich von `src/server.js`: `show(id)` ersetzt den Detailbereich, ändert aber weder URL noch Verlauf; `pushState`/`popstate` sind nicht vorhanden. Der HTML-Handler bedient nur `GET /`; `/tickets/<id>` endet derzeit mit 404. Ein Ticketziel in der Query (`/?ticket=<id>`) wäre mit dem vorhandenen Wurzelpfad kompatibel, ein Kommentaranker kann als Fragment (`#comment=<id>`) ergänzt werden. `history.state` kann flüchtige Listenposition/Filter beim Zurückkehren erhalten; Suchtext und Filter bleiben aus der teilbaren URL. Das ist jetzt als konkreter, noch nicht umgesetzter Vorschlag im Wireframe notiert und gehört zum bestehenden Navigation-Unterticket `01a189c1-79a0-74ae-b519-20b51b0aefa8`.

Der Datenaustausch bleibt auf die bestehenden Owners verteilt: `/api/tickets/:id` liefert das Ticket mit `parentId`, aber keinen Elternpfad; `/api/context/:id` kann Vorfahren budgetbedingt kürzen und gibt derzeit sein intern berechnetes `omitted`-Objekt nicht zurück. Direkter Elternname und sichtbare Kürzungshinweise sind daher beim Kontext-/Detailpaket `01a189d6-6aa6-713b-9d56-2ad00bb3fe36` bzw. Ticketdetail zu lösen; ein unvollständiges Kontextpaket darf nicht wie ein vollständiger Breadcrumb aussehen. Für Beziehungen existiert weiterhin keine HTTP-Leseroute, obwohl der Core `relations.list(id)` unterstützt; das bleibt beim bestehenden Anzeige-Ticket `01a189af-d764-72c3-a674-f5601919f131`, getrennt von sicherem Schreiben unter `01a18c8f-1f44-7856-827e-624aeb1e0e07`.

Zusätzlicher Quellabgleich bestätigt die richtige Zuständigkeit für Suchnavigation: der Browser ruft `show(hit.id)` unabhängig vom Treffertyp auf; Dokument-IDs oder Kommentar-IDs werden dadurch fälschlich als Ticket-ID behandelt. Das vorhandene Routingticket `01a189c7-e5a5-7fd7-b0e1-4adec7831943` deckt genau diese Abbildung ab. Keine neue Aufgabe und keine Parent-/Relationsänderung nötig.

### Projektübersicht: zuletzt geänderte Tickets ergänzen — 2026-10-31

Abgleich des bestehenden Startseitenpakets `01a189b1-a4e4-7227-aca6-1283ecc6d8bd` mit den drei `ui-prototype-overview*.svg`-Entwürfen: Die heist-Aufgabe verlangt ausdrücklich einen kleinen Bereich für zuletzt geänderte Tickets; bisher fehlte er in allen drei Ansichten. Aus dem echten Ticketbestand nach `updatedAt` absteigend und ID-Tie-Break stammen zum Datenstand 2026-10-31: laufendes UI-Review (In Arbeit, UI-Programm), UI-Konzept (Offen, UI-Richtung) und Status-/Bereitschaftspaket (Offen, Ticketdetail), alle aktualisiert am 31.10.2026. Die Desktop-, 390px- und 320px-Vorschauen zeigen diese drei eindeutigen Beispiele jetzt mit Status und Elternkontext. Die Beschriftung sagt ausdrücklich, dass dies keine Kommentar-/Aktivitätschronik ist; Kommentare ändern `updatedAt` nicht.

Das bestehende API-/Skalierungsticket `01a189d9-4947-72a1-b472-becb5d135e79` fordert die begrenzte Abfrage, stabile Ticketziele, Elternkontext, eindeutige IDs und Sortierung nach `updatedAt`; die Mockups versprechen keine Live-Summary. Projektstatus bleibt zehn direkte Kinder: zwei offene bereite, eins in Arbeit und sieben blockierte. Startseiten-/API-Tickets behalten ihre bestehenden Parents und ihre Hierarchiebeziehung; keine neuen Tickets oder Relations.

Zusatzprüfung der Blockersemantik für den aktuellen Datenstand: Bei allen 46 Tickets stimmt `tree.rollup === blocked` mit `tickets.readiness().ready === false` überein (0 Datenabweichungen); die zehn direkten UI-Arbeitspakete ergeben weiter 2 offene bereite, 1 in Arbeit und 7 blockierte. Der bekannte Algorithmusunterschied bleibt dennoch relevant, sobald eine eingehende `blocks`-Kante auf ein erledigtes Quellticket zeigt; das aktuelle Dataset enthält keinen solchen Gegenbeleg. Abnahme deshalb mit gezielten done-/cancelled-Blocker-Fixtures im bestehenden Status-/Bereitschaftsticket `01a189b6-43ac-78a2-a06b-345c6fa56083` beibehalten. Die lokale SVG-URL wurde vom In-App-Browser aus Sicherheitsgründen abgewiesen; SVG-XML, Koordinaten und Textbreiten sind geprüft, eine gerenderte Sichtabnahme der neuen Karten ist damit ausdrücklich nicht erfolgt.

### Projektübersicht: leeren Einstieg ergänzen — 2026-10-31

Im bestehenden Startseitenpaket `01a189b1-a4e4-7227-aca6-1283ecc6d8bd` fehlt neben der befüllten Übersicht ein konkreter Zustand für null Tickets und null Planungsdokumente. Drei statische Entwürfe ergänzen Desktop, 390px und 320px. Sie zeigen keine erfundenen Kennzahlen oder Bereitschaftswerte, sondern eine klare erste Aktion „Erstes Ticket erstellen“ und einen ehrlichen Hinweis auf noch fehlende Planungsdokumente. Zugehörigkeit bleibt bei der Startseite; keine neue Aufgabe, Parent- oder Relationsänderung.

### UI-Konzept: offene Richtungsentscheidungen selbst festgelegt — 2026-10-31

Der Nutzer hat die offenen Gestaltungsentscheidungen an mich delegiert. Ich habe daher die bisherige Empfehlung in `ui-wireframe.md` als Arbeitsrichtung festgelegt: Projektübersicht als Start; oben eine kompakte horizontale Navigation; Desktop-Tickets als schmale, unabhängig scrollbar gehaltene Liste plus Detail; Mobil mit unterer Hauptnavigation und fokussiertem Liste-/Detailwechsel; Lesen vor Bearbeiten; gespeicherter Status, Priorität, abgeleiteter Arbeitsstand und Bereitschaft separat; echte heist-Dokumentlinks; helles, schlichtes Layout mit lokalen Inline-SVGs und sichtbaren Labels. MVP bleibt ohne Board und ohne aktivierte semantische Suche, bis ONNX-/SQLite-Voraussetzungen bereit sind. Die Nullbestandsansicht zeigt nur „Erstes Ticket erstellen“. Port 4000 bleibt Voraussetzung der Live-Abnahme.

Dies präzisiert das bestehende Konzept-Ticket `01a189a9-42a4-7e89-8ab8-2f6a204818ed` und die bereits zugehörigen Pakete für Navigation, Detail, Übersicht, Icons und Responsive. Keine neuen Tickets, Parents oder Relations; Produktdateien blieben unverändert.

### Umsetzung begonnen: fester UI-Port — 2026-10-31

Der erste kleine Umsetzungsschritt folgt dem bestehenden hoch priorisierten Serverticket `01a18d87-251e-7ff7-9678-7a437fd0ef76`: CLI und `serve()`-Standard verwenden jetzt `127.0.0.1:4000`; ungültige Portwerte werden abgewiesen. Bei `EADDRINUSE` gibt es einen klaren `PORT_IN_USE`-Fehler mit der URL und dem Hinweis, dass keine weitere Instanz gestartet wurde. `--open` bleibt hinter dem erfolgreichen Bind. README und CLI-Hilfe nennen den festen Standard. Das Ticket bleibt in Arbeit, bis der tatsächliche Start, Konfliktfall und Browserzugriff abgenommen sind. Bestehende Loopback-/Host-/Origin-/CSRF-Regeln und alle Ticketzugehörigkeiten bleiben unverändert.

Der UI-Abgleich hat außerdem die alte Abstimmungsformulierung im Wireframe auf die festgelegte Arbeitsrichtung umgestellt. Desktopvariante A ist ausgewiesen; B und C bleiben als verworfene Alternativen dokumentiert. Neue Leerzustand-Vorschauen sind jetzt in der Übersicht der Artefakte verlinkt. Kein weiteres Ticket und keine Kante wurden angelegt oder verändert.

### UI-Konzept abgeschlossen, erste Umsetzung freigegeben — 2026-10-31

Die Arbeitsrichtung wurde nach Nutzervorgabe autonom festgelegt und in `docs/ui-wireframe.md` als entscheidungsbasierte Basis konsolidiert. Das Konzeptpaket und sein Konzept-Unterticket stehen in heist auf `done`; die bestehenden Blocks-Kanten geben Navigation, Icon-System, Übersicht und Responsive frei. Ticketdetail hat weiterhin den geplanten Blocker für stabile URLs/Browserverlauf. Die visuelle Prüfung bleibt durch neun vorhandene Fachpakete blockiert; der Serverstart auf 4000 läuft als erster Code-Schritt und ist noch nicht live abgenommen. Parents und 204 Relations sind unverändert. Nächster sichtbarer UI-Owner ist die hoch priorisierte Ticketnavigation; Detail folgt nach stabilem URL-/Verlaufspaket.

### Erster UI-Umsetzungsschritt — Navigation und stabile Ticketziele — 2026-10-31

Nach dem abgeschlossenen Konzept wurde der erste sichtbare UI-Ausschnitt im bestehenden Navigation-/URL-Paket begonnen. `src/ui.js` ergänzt den alten Einzelkopf durch eine schlichte deutsche Kopfzeile mit den Bereichen Übersicht, Tickets und Planungsdokumente, eine kompakte paginierte Ticketliste mit Titel-/Status-/Prioritätsfiltern, getrennte gespeicherte Status-/Prioritäts- und abgeleitete Arbeitsstandanzeigen sowie ein lesbares Ticketdetail mit direktem Elternlink, Untertickets und Kommentaren. Die globale Suche leitet typgerecht auf Ticket, Kommentaranker oder Dokumentleser. Ticketziele verwenden `/?ticket=<id>`; History/Popstate erhalten die Auswahl, und flüchtige Listenfilter/-position liegen im Tabzustand. Mobile erhält einen fokussierten Detailzustand mit Rückweg.

Der feste Portstart meldet exakt `http://127.0.0.1:4000`; ein zweiter Standardstart wurde mit `PORT_IN_USE` abgewiesen, ohne Ersatzport oder weitere Instanz. Die Serverbindung läuft. Ein direkter Node-HTTP-Aufruf vom Shell-Prozess wird von der Umgebung mit `EACCES` blockiert; deshalb sind echte Browserdarstellung sowie Zurück/Vorwärts/Reload weiterhin unbestätigt und dem bestehenden Visual-QA-/URL-Abnahmeumfang zugeordnet. Nur Syntax-/Einbettungsprüfung, `git diff --check` und `heist validate` wurden ausgeführt; keine Testsuite.

### Port-4000-Erreichbarkeit im In-App-Browser — 2026-10-31

Nach Nutzerhinweis sind beide In-App-Tabs (`127.0.0.1:4000` und `localhost:4000`) mit „Diese Website ist nicht erreichbar“ fehlgeschlagen. Ein CLI-Start meldete zwar die URL und ein zweiter Start in derselben Ausführungsumgebung erhielt `PORT_IN_USE`; Shell-`fetch` bekam `EACCES`, während `netstat` und Windows-Listenerabfrage den Node-Prozess nicht sehen. Der Hintergrundprozess wurde beendet, weil er im Browser nicht erreichbar war. Das deutet auf getrennte Netzwerk-/Prozessumgebungen für Ausführung und In-App-Browser hin; es belegt keinen fremden Listener auf dem Windows-Host. Portticket bleibt in Arbeit. Nächster Schritt braucht einen Startprozess im selben Host/Netzwerk wie der Browser oder einen ausdrücklich vorhandenen Portweiterleitungsweg; fremde Prozesse nicht automatisch beenden und nicht auf Ersatzport ausweichen.
### Planungsmodus vereinfacht und UI-Phase eingefroren — 2026-10-31

Nach Nutzerfeedback wird die UI-Planung nicht weiter vorab ausgebaut. Die konzeptionelle Phase ist eingefroren; `docs/ui-wireframe.md` und SVGs bleiben passive Referenz und werden nur bei konkretem Umsetzungsbedarf nachgeführt. Aktive Arbeit wird auf genau den nächsten sichtbaren UI-Ausschnitt begrenzt: aktuellen Navigations-/Ticketziel-Stand im Browser abnehmen, danach jeweils ein kleines bestehendes Umsetzungspaket wählen. Die Produkt-Roadmap bleibt ein passiver Gesamtüberblick, keine UI-Vorbedingungsliste. Keine neuen heist-Tickets oder Relations wurden angelegt; bestehende Hierarchie bleibt erhalten.

### Ticketdetail: erster Bearbeitungsschritt implementiert — 2026-10-31

Der aktive kleine Ausschnitt des bestehenden Ticketdetail-Pakets ergänzt Bearbeiten für Titel, Beschreibung, gespeicherten Status und Priorität. Das Detail lädt Ticket plus Revision über `/api/tickets/:id/versioned`; `PATCH /api/tickets/:id` übergibt `expectedRevision` an den heist-Core. Konflikte werden als HTTP 409 geliefert, der Formulardraft bleibt erhalten und die aktuelle Version kann bewusst neu geladen werden. Der abgeleitete Arbeitsstand bleibt Anzeige und ist nicht editierbar. Keine Testsuite ausgeführt; `node --check`, Parsing des gerenderten Inline-Scripts, `git diff --check` und `heist validate` waren erfolgreich.

Live-Abgleich: Port 4000 liefert nach Reload aktuelle heist-Ticketdaten, aber noch die vorherige UI ohne Bearbeiten-Schaltfläche. Der laufende Serverprozess hat seinen UI-Modulcode vor dieser Änderung geladen; er wurde nicht beendet oder ersetzt. Deshalb ist die UI-Funktion im Browser noch nicht live abgenommen. Das bestehende Ticket „Ticketfelder und Projektstatus in der Bearbeitung berücksichtigen“ bleibt `in_progress`; nächster Schritt ist, den bereits laufenden heist-Server regulär mit dem aktuellen Quellstand neu zu starten und anschließend Speichern sowie Konfliktverhalten zu prüfen. Kein Portwechsel und kein zusätzlicher Server.

### Ticketbearbeitung live geprüft — 2026-10-31

Nach dem Neustart des lokalen Servers ist der erste Detailbearbeitungsschritt live erreichbar. Das Ticketformular öffnet explizit und zeigt beschriftete Eingaben für Titel, Beschreibung, konfigurierten Status und Priorität. Browseränderungen an Beschreibung sowie Status/Priorität wurden gespeichert und in Detail plus Liste aktualisiert. Ein parallel veralteter Entwurf erhielt HTTP 409; der Entwurf blieb erhalten, „Aktuelle Version laden“ zeigte den externen Stand. Alle für die Prüfung verwendeten Text-/Status-/Prioritätswerte wurden anschließend über die Oberfläche auf den Ausgangsstand zurückgesetzt. Das bestehende Ticket „Ticketfelder und Projektstatus in der Bearbeitung berücksichtigen“ steht auf `done`. Revisionsticket bleibt als separates Kind erhalten; Parent-/Relations wurden nicht verändert. Weitere Felder und Ticketaktionen bleiben passive Folgeschritte.


### Visual review of the Jira-like workspace — 2026-11-08

Checked in Chromium at 1366×820, 1300×850, 1920×1000 and iPhone 13, with a small sample project (nested header/cart tickets, a blocker, a goal) and an empty project. Views: projects, summary, board, list + detail, documents, search dropdown, relationship form, error states (500 injected per endpoint).

| Finding | Fix |
|---|---|
| Ticket detail squeezed next to the 300 px Details box when the list pane is open (text column ~200 px at 1300 px) | container query: detail switches to one column below 780 px pane width |
| `?view=list` / `?view=summary` showed an empty page | view aliases, unknown views fall back to Summary |
| "0 tickets updated in the last 7 days" although tickets had just been created | tree row projection now includes `updatedAt` |
| Child tickets in the detail had no key, type or priority | children use the same row pieces as the list (type icon, key, status lozenge, priority) |
| Document list entries were centered | left aligned |
| Failed project/tree loads looked like empty projects | explicit error states with "Try again" |
| Search hits showed only title + type | icon, key, status, parent, highlighted snippet, "similar meaning" |
| Tree chevrons, crosses and search icons were text glyphs/emoji | shared inline SVG set (docs/ui-icons.md) |

Contrast: body text 14.6:1; input borders `#8590a2` on white ≈ 3.2:1 (meets the 3:1 non-text minimum); primary button white on `#0c66e4` ≈ 5.2:1. Subtle grey buttons keep a visible text label and focus ring, as in Jira.

Open points (not blocking): board scoping is "all parents / one parent" plus "only work items" rather than strictly direct children; the projects page is reached via "Projects" because `/` opens the project `heist serve` was started in.
