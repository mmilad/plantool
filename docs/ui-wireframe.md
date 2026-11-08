# UI-Wireframe — festgelegte Arbeitsrichtung

Status: UI-Richtung festgelegt; Referenzdokument wird passiv gepflegt. Die Umsetzung läuft in kleinen, sichtbaren Ausschnitten; nur der unmittelbar nächste Ausschnitt ist aktive Arbeit. Entwürfe für spätere Bereiche sind keine Vorbedingungen.

**Stilrichtung:** fp.dev ist die schlichte, helle visuelle Referenz. Jira bleibt eine Orientierung für Planungsabläufe. Die konkrete Ausführung kann nach Nutzungsfeedback angepasst werden.

Dieses Bildschirmraster dokumentiert die geplante Oberfläche. Die vom Nutzer gezeigte fp.dev-Oberfläche ist die visuelle Referenz: kompakter Kopf mit Suche, Ticketliste links, ausgewähltes Detail rechts und zurückhaltende Trennlinien. Jira dient nur als Orientierung für Arbeitsabläufe. Heistman verwendet nur heist-Funktionen und vorhandene Daten; insbesondere wird kein Assignee-Feld erfunden. Die konkrete Ausführung kann nach Nutzungsfeedback geändert werden. Statische Entwürfe ergänzen das Raster: [Navigationsvergleich](ui-layout-options.svg), [FP-inspirierte Ticketarbeitsfläche](ui-fp-layout.svg), [mobiler Listen-/Detailwechsel](ui-fp-layout-mobile.svg), [Projektübersicht Desktop](ui-prototype-overview.svg), [Projektübersicht mobil](ui-prototype-overview-mobile.svg), [Projektübersicht bei 320px](ui-prototype-overview-320.svg), [leere Projektübersicht Desktop](ui-prototype-overview-empty.svg), [leere Projektübersicht mobil](ui-prototype-overview-empty-mobile.svg), [leere Projektübersicht bei 320px](ui-prototype-overview-empty-320.svg), [Desktop-Ticketdetail](ui-prototype.svg), [Ticketanlage Desktop](ui-ticket-create-desktop.svg), [Verwerfen ungespeicherter Tickets](ui-ticket-create-discard.svg), [Rückmeldungen bei Ticketanlage](ui-ticket-create-feedback.svg), [Ticketlabels](ui-ticket-labels.svg), [mobile Ticketliste bei 390px](ui-ticket-list-mobile.svg), [mobile Ticketliste bei 320px](ui-ticket-list-320.svg), [mobile Ticketanlage](ui-ticket-create-mobile.svg), [Unterticketformular bei 320px](ui-ticket-create-320.svg), [mobiles Ticketdetail](ui-prototype-mobile.svg), [Ticketdetail bei 320px](ui-ticket-detail-320.svg), [mobile Beziehungsansicht](ui-ticket-relations-mobile.svg), [globale Suche Desktop](ui-search-preview.svg), [globale Suche mobil](ui-search-preview-mobile.svg), [globale Suche bei 320px](ui-search-preview-320.svg), [mobile Planungsdokumente](ui-documents-mobile.svg), [Icon-Inventar](ui-icon-preview.svg), [optionales Status-Board](ui-board-preview.svg), [mobiles Status-Board bei 390px](ui-board-preview-mobile.svg) und [mobiles Status-Board bei 320px](ui-board-preview-320.svg). Die Symbolformen sind Platzhalter und legen noch kein finales Icon-System fest.

## Festgelegte UI-Richtung für den ersten Ausbau

Die visuelle Leitplanke und die zentralen Layout-/Ablaufentscheidungen sind als Arbeitsrichtung festgelegt. Die konkreten Detailverträge und Zuständigkeiten bleiben in den jeweils genannten heist-Tickets.

| Entscheidung | Festlegung für den ersten Ausbau | Zuständiges bestehendes Paket |
|---|---|---|
| Visuelle Referenz | Schlichte, helle Arbeitsfläche an fp.dev anlehnen; Jira-Optik/Marken nicht übernehmen. Nach Nutzungsfeedback gezielt änderbar. | UI-Richtung `01a189a9-42a4-7e89-8ab8-2f6a204818ed` |
| Einstieg ohne ausgewähltes Ticket | Projektübersicht als Startfläche; aus ihr direkt zu offener Arbeit, Blockern und Planungsdokumenten. | UI-Konzept `01a189ad-5c7c-7e68-b165-79fb9f674539` |
| Desktop-Grundraster | Kompakter Kopf mit Suche und „Ticket erstellen“, darunter Ticketliste links und Detail rechts; keine dauerhaft breite Navigation. | Navigation/Liste `01a189a9-42ad-7d98-bb63-7d9d4d25351d` |
| Standard für Ticketarbeit | Baum/Liste bleibt der vollständige Standardzugang für beliebige Tiefe. Status-Board bleibt optional und außerhalb des MVP-Rasters; keine Board-Implementierung in den ersten Ausbau einplanen. | Listen-/Boardplanung `01a189ad-de0c-75e1-80f2-b5f8e42d750c` unter Navigation |
| Mobilwechsel | Liste und Detail als fokussierte Zustände mit sichtbarem Rückweg; Query, aktives Ticket und Listenposition bleiben beim Wechsel erhalten. | Responsive-Unterticket `01a189b0-0f28-7715-8ac6-c689065acab1` |
| Icons | Lokale konsistente Inline-SVG-Zeichen, sichtbare Textlabels und keine erfundenen Tickettypen. | Icon-System `01a189a9-42a6-7a27-adb9-e30a8df78d54` |

**Aktiver Modus:** keine weitere Vorabplanung und keine vorsorgliche Ausweitung der Aufgabenliste. Den jeweils nächsten kleinen UI-Ausschnitt auswählen und umsetzen; spätere Detailverträge, SVG-Entwürfe und Roadmappunkte bleiben passive Referenz und werden nur bei konkretem Umsetzungsbedarf aktualisiert. Der erste Ticketbearbeitungsschritt umfasst Titel, Beschreibung, gespeicherten Status und Priorität mit revisionssicherem Speichern und verständlichem Konfliktverhalten. Die fachlichen Parents/Relations bleiben unverändert.
## Desktop — 1280 × 720

**Vorrangiger Desktopentwurf:** [FP-inspirierte Ticketarbeitsfläche](ui-fp-layout.svg). Sie visualisiert die festgelegte Richtung; die folgenden Raster bleiben Detailverträge für Navigation, Status, Beziehungen und responsive Zustände.

**Viewport-Hinweis:** Das SVG hat derzeit eine Zeichenfläche von 1280 × 800; die Konzeptabnahme nennt 1280 × 720. Der Kartenbereich reicht bis y=768 und die letzte Listenmetazeile bis y=729. Das SVG ist daher ein erweitertes Arbeitsraster, kein fertiger Screenshot für den 720px-Viewport. Die visuelle Abnahme soll bei 1280 × 720 eigens prüfen, welche Listenbereiche unterhalb der Falz liegen und ob Liste/Seite nachvollziehbar scrollen; das erweiterte 800px-Raster kann als Detailübersicht bestehen bleiben.

Zusätzliche [mobile Dokumentlink-Vorschau](ui-documents-links-mobile.svg) für den echten Review-Plan: Sie zeigt neben Ticketzielen auch das verknüpfte UI-Zieldokument und macht die doppelte Review-Ticket-ID als `2×` sichtbar. Das ist ein abstimmbarer Vorschlag zur sicheren Linkdarstellung, keine Bereinigung der kanonischen `.heist`-Daten.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Heistman / Projektname       [ Im Projekt suchen …                  ]  [ + Ticket ]       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ Übersicht       Tickets       Planungsdokumente                                                │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ TICKETS: Liste (ca. 300 px)                                │ TICKETDETAIL / ÜBERSICHT        │
│                                                            │                                 │
│ [ In Liste filtern … ] [ Filter ▾ ]                        │ Elternpfad / Bereich            │
│                                                            │ Dokumente und Übersicht        │
│ ▾ UI-Programm                   Offen · Normal             │ Status: Offen                   │
│   Abgeleiteter Arbeitsstand: In Arbeit                     │ Priorität: Normal               │
│   UI-Konzept festhalten         Offen · Normal             │ Bereitschaft: Blockiert         │
│   Dokumente und Übersicht      Offen · Normal              │                                 │
│     Bereitschaft: Blockiert (separat benannt)              │ Beschreibung                    │
│   …                                                        │ Untertickets · Beziehungen      │
│                                                            │ Kommentare                      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Kopf und Navigation:** Oben stehen Projektname, globale Suche und die primäre Aktion. Darunter wechseln Navigationseinträge mit Icon und dauerhaft sichtbarem Text zwischen Übersicht, Tickets und Planungsdokumenten. Der gemeinsame Dokumentbereich erhält ein neutrales `files`-Symbol; `target`, `clipboard` und `scale` bleiben den jeweiligen Dokumentarten Ziel, Plan und Entscheidung vorbehalten. Da heist ein Projekt pro Serverinstanz bindet, gibt es keinen Projektumschalter.

**Ticketarbeitsfläche:** In der Ticketansicht bleibt die linke Liste bei etwa 300 px; der Detailbereich nutzt den Rest. Zeilen sind kompakt, linksbündig und einzeilig. Status und Priorität stehen als lesbarer Text am rechten Rand; Blockerbereitschaft erhält ein eigenes, ausdrücklich benanntes Feld statt als Ticketstatus aufzutauchen. Das Beispiel „Dokumente und Übersicht“ hat im heist-Bestand den gespeicherten Wert `todo`/`normal`, ist aber wegen des offenen UI-Konzepts blockiert. Beim UI-Programm zeigt der Baumrollup `in_progress`, obwohl sein gespeicherter Status `todo` bleibt. Einrückung ist begrenzt. Filter beziehen sich auf vorhandene Felder und bleiben von der globalen Suche getrennt.

**Status-Board:** Der mobile Spaltenwähler bestimmt nur, welche Statusspalte sichtbar ist. Jede Karte zeigt Priorität als dauerhaft beschrifteten Text; Blockerbereitschaft bleibt davon getrennt und wird ebenfalls benannt. Der gespeicherte Status ergibt sich aus der ausgewählten konfigurierten Spalte. Jede Karte hat zusätzlich eine eigene, immer sichtbare Aktion „Status ändern“ mit den konfigurierten gespeicherten Statuswerten. Am Desktop ist Drag-and-drop eine ergänzende Möglichkeit; Tastatur, Screenreader und Touch können denselben Auswahlvorgang direkt auf der Karte nutzen. Auf Mobilgeräten wird kein Ziehen vorausgesetzt. Die [390px-Ansicht](ui-board-preview-mobile.svg) und die [320px-Prüfung](ui-board-preview-320.svg) zeigen dieselben echten Tickets und Statuswerte. Icons dürfen Textbeschriftungen nicht ersetzen.

**Projektstatus im Detail:** Statusoptionen kommen immer aus der Projektkonfiguration und senden den unveränderten gespeicherten Statuswert. Bekannte Werte erhalten einheitliche deutsche Labels; unbekannte benutzerdefinierte Werte bleiben sichtbar und werden beim Öffnen oder unveränderten Speichern nicht auf einen Standardstatus zurückgesetzt. Ein neu gelesener Status, der im aktuellen Katalog fehlt, braucht einen expliziten Erhalt-/Konfliktzustand statt einer still vorausgewählten ersten Option. Die aktuelle Projektkonfiguration nutzt nur die vier Standardwerte, daher ist dieser Kompatibilitätsfall hier noch nicht durch Live-Daten abgedeckt; die vorhandene Abnahme nutzt dafür eine isolierte Fixture. Zuständigkeit: Ticketfelder `01a189af-d766-703b-a961-52a10b86081f`, mit bestehender Blocks-Kante vom UI-Konzept und relates_to zur Responsive-/Feedbackarbeit.\n\n**Detail und Übersicht:** Ein ausgewähltes Ticket öffnet rechts zuerst im Lesemodus mit Elternpfad, gespeicherten Feldern und gruppierten Beziehungen/Kommentaren. Als Entwurf erhält die Desktopansicht eine kompakte Bereichsnavigation für Unteraufgaben, Beziehungen und Kommentare; mobil erscheinen dieselben Bereiche als getrennte, aufklappbare Abschnitte. Auswahl, Elternkontext und sichtbare Namen bleiben bei beiden Darstellungen erhalten. Interaktive Desktop-Bereiche und verlinkte Unteraufgaben erhalten mindestens 40px Bedienhöhe; mobil mindestens 44px. Bei umfangreichen Beziehungsgruppen zeigt die Detailansicht die Anzahl und eine eigene, mindestens 44px hohe Aktion zur vollständigen Liste; sichtbare Ticketziele bleiben eigenständige 44px-Navigationsziele. Der mobile Detailbereich scrollt vertikal, statt Beziehungen oder Kommentare aus Platzgründen unzugänglich zu lassen. Wenn nicht alle Unteraufgaben in den ersten Sichtbereich passen, bleibt eine klar beschriftete Möglichkeit zu den übrigen Einträgen sichtbar, statt die Ziele zu verkleinern. Ohne Auswahl erscheint rechts die Projektübersicht statt einer leeren Fläche. Sie zeigt einen begrenzten Arbeitsüberblick, offene Blocker, zuletzt geänderte Tickets und relevante Planungsdokumente; sie erfindet keine Zuweisungen oder Aktivitätsdaten.

Beziehungen bleiben vom Elternpfad getrennt. Die lesbare Anzeige kommt zuerst; sobald die separat geplante Pflege und API verfügbar sind, startet „Beziehung hinzufügen“ bewusst aus dem Ticketdetail. Jeder Eintrag nennt Richtung, Typ und Gegen-Ticket; Entfernen zielt auf genau diese Kante. Ein `blocks`-Zyklus bleibt als verständlicher Fehler im Beziehungsdialog stehen und wird nicht still in einen anderen Typ umgewandelt. Die Aktion darf nicht vor Verfügbarkeit der Route als scheinbar funktionierender Button erscheinen. Die [mobile Beziehungsansicht](ui-ticket-relations-mobile.svg) zeigt für das reale Vorschauticket alle vier aktuellen Kanten in ein- und ausgeklapptem Zustand; die Kurzfassung unterscheidet eingehende und ausgehende Blocker sowie allgemeine Verknüpfungen. Der Elternpfad bleibt separat. Das [Icon-Inventar](ui-icon-preview.svg) ergänzt einen unverbindlichen Link-Symbolkandidaten für diesen Detailbereich; das Symbol ersetzt weder Richtung noch Beziehungstyp und ist noch keine finale Auswahl.

**Planungsdokumente:** Der gleichrangige Bereich nutzt dasselbe Listen-/Leseflächenprinzip: links Ziele, Pläne und Entscheidungen; rechts das ausgewählte Dokument mit sicher dargestelltem Markdown und sichtbaren Ticketverknüpfungen. Kein rohes Markdown als dauerhafte Vorschau in der Ticketliste.

## Projektübersicht — Startfläche

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ÜBERSICHT                                                                                   │
│ Schlichte Heistman-Planungsoberfläche                                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ 10 direkte UI-Arbeitspakete     2 bereit          1 in Arbeit       7 blockiert               │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ WEITERARBEITEN                                │ ZULETZT GEÄNDERT                             │
│ UI-Richtung · Offen · Hoch · bereit           │ UI-Review · In Arbeit · UI-Programm         │
│ UI-Server · Offen · Hoch · bereit             │ UI-Konzept · Offen · UI-Richtung            │
│ Laufendes UI-Review · In Arbeit               │ Status/Bereitschaft · Offen · Ticketdetail  │
│ BLOCKIERT                                     │ PLANUNGSDOKUMENTE                           │
│ 7 Arbeitspakete warten auf Voraussetzungen    │ 2 Ziele · 2 Pläne · 0 Entscheidungen        │
│ Konzept als gemeinsamer Ausgangspunkt         │ [Alle Planungsdokumente öffnen]              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Die Zahlen sind eine Momentaufnahme vom 2026-10-31 und zählen ausschließlich die zehn direkten Kinder des UI-Programms, damit Ober- und Untertickets nicht doppelt gezählt werden. Zwei offene Arbeitspakete sind bereit: UI-Richtung und der hoch priorisierte feste Serverstart. Das Review ist als laufende Arbeit separat sichtbar; insgesamt haben damit drei direkte Kinder keine offenen Blocker. Sieben Pakete warten auf Voraussetzungen. Das Raster zeigt gespeicherten Status, Priorität und Bereitschaft getrennt; es bildet keine persönliche Zuweisung ab. Der Bereich „Zuletzt geändert“ zeigt drei eindeutige Tickets, absteigend nach `updatedAt`, mit Status und Elternkontext. Er ist kein Kommentar-/Aktivitätsfeed. Sortier-/Datenvertrag und Snapshot-Konsistenz bleiben bei der vorhandenen Projektübersichts-API-Aufgabe `01a189d9-4947-72a1-b472-becb5d135e79`.

## Planungsdokumente — Lesefläche

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLANUNGSDOKUMENTE                                                                          │
│ [ Ziele 2 ] [ Pläne 2 ] [ Entscheidungen 0 ]                                                │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ Dokumente                                    │ Oberfläche fortlaufend prüfen …       │
│                                              │ Ziel · Offen                                  │
│ Ziele                                        │                                               │
│  Eine klare, moderne Jira-inspirierte …      │ Review-Takt und Verbesserungsziele  │
│  Oberfläche fortlaufend prüfen …             │                                               │
│                                              │ Zugehörige Tickets                          │
│ Pläne                                        │ UI-Programm · UI-Konzept · Icon-System      │
│  UI-Plan: Schlichte Planungsoberfläche       │                                               │
│  Fortlaufender UI-Review …                   │                                               │
│                                              │ [Lesen]                                     │
│ Entscheidungen                               │                                               │
│ Noch keine Entscheidungen                    │                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Dies bleibt eine Lesefläche: der aktuelle heist-Bestand hat zwei Ziele, zwei Pläne und keine Entscheidungen. Zugehörige Tickets werden aus den vorhandenen Dokumentlinks abgeleitet. Es gibt keine Bearbeitungsaktion, solange die geplante revision-sichere Dokumentbearbeitung in der App noch nicht verfügbar ist. Auf Mobilgeräten führt die Dokumentliste zuerst zur Auswahl; der Leser zeigt eine klare Rückkehr zur Liste.

Die Beispielzeile „Eine klare, moderne Jira-inspirierte …“ ist der wörtlich gekürzte Titel des derzeit gespeicherten heist-Zieldokuments, kein Vorschlag für die visuelle Richtung. Nach der revisionssicheren Dokumentpflege über das bestehende Ticket `01a189f8-f7bf-7921-b4cf-b3269ac6239d` und der nachfolgenden Vorschaukonsolidierung `01a189ad-9320-7ba9-a8ad-4656341eb4e5` sind die daraus abgeleiteten Wireframe- und SVG-Beispiele gemeinsam zu aktualisieren.

Jede Dokumentart erhält ihren eigenen Leerzustand. Die bestehende Entscheidungsliste zeigt bei null Einträgen „Noch keine Entscheidungen“; sie darf nicht den Eindruck erwecken, es gebe überhaupt keine Planungsdokumente, solange Ziele oder Pläne vorhanden sind. Eine Aktion wie „Entscheidung erstellen“ erscheint dort erst, wenn der geplante Erstellungsfluss tatsächlich in der App verfügbar ist. Andernfalls bleibt der Zustand informativ und zugänglich, ohne eine noch nicht vorhandene Funktion anzudeuten. Dasselbe Muster gilt für Ziele und Pläne.

## Mobil — 390 × 844

```text
┌──────────────────────────────────────┐
│ Heistman                 [ + ]    │
│ [ Im Projekt suchen …              ] │
├──────────────────────────────────────┤
│ Übersicht   Tickets   Dokumente      │
├──────────────────────────────────────┤
│ TICKETS                               │
│ [ In Liste filtern … ] [ Filter ▾ ]  │
│                                      │
│ › UI-Konzept festhalten              │
│   Offen · Normal                     │
│ › Dokumente und Übersicht            │
│   Offen · Normal                     │
│   Blockiert (Bereitschaft)            │
│ …                                    │
└──────────────────────────────────────┘

Nach Auswahl:
┌──────────────────────────────────────┐
│ [‹ Zurück zur Ticketliste]           │
│ [Schlichte Planungsoberfläche …] ›   │
│ Dokumente und Übersicht              │
│ Status: Offen · Priorität: Normal    │
│ Bereitschaft: Blockiert              │
│ Beschreibung                         │
│ Untertickets · Beziehungen · Kommentare│
└──────────────────────────────────────┘
```

Auf schmalen Ansichten gibt es jeweils eine fokussierte Fläche: Liste oder Detail, mit klarer Rückkehr zur Liste. Die Auswahl soll nicht erst nach dem Scrollen durch sämtliche Tickets sichtbar werden. Sucheingabe, Suchkontext und Ticketziel bleiben beim Wechsel nachvollziehbar. Der Elternpfad zeigt die kanonischen Titel der Vorfahren als navigierbare Links; der aktuelle Ticketname bleibt die nicht verlinkte Überschrift. Lange Vorfahrennamen werden visuell gekürzt, behalten aber ihren vollständigen zugänglichen Namen. Links öffnen das jeweilige Ticket über dieselbe stabile URL-/Browserverlaufslogik wie die Navigation.

**Mobile Projektübersicht:** Die Startfläche zeigt den Arbeitsstand der zehn direkten Programmkinder, beide bereiten Einstiege (UI-Richtung und Serverstart), das laufende Review und die blockierten Pakete als getrennte, klar beschriftete Bereiche. Gespeicherter Ticketstatus und Blockerbereitschaft dürfen in der Zusammenfassung nicht zu einem Statusfeld vermischt werden. Planungsdokumente bleiben über einen mindestens 44px hohen Einstieg erreichbar; die Zahlen sind eine datierte heist-Momentaufnahme und keine persönliche Zuweisung oder Live-Aktualisierung. Die 390px-Ansicht nutzt einen 844px-Erstviewport mit vertikal scrollbarem Inhalt in [mobiler Projektübersicht](ui-prototype-overview-mobile.svg); der [320px-Entwurf](ui-prototype-overview-320.svg) prüft kontrollierte Umbrüche, ausreichenden Abstand zwischen Navigationsicons und Textlabels, beide bereiten Einstiege, einen in die nächste Zeile verschobenen Primärbutton und vertikales Scrollen.

**Mobiler Listen-/Detailwechsel nach fp.dev:** [Zwei mobile Zustände](ui-fp-layout-mobile.svg) zeigen dieselbe Ticketarbeit auf jeweils 390×844 CSS-Pixeln. Die Liste bleibt eigenständig scrollbar, Suche und Status-/Prioritätsfilter haben mindestens 44px Bedienhöhe; das ausgewählte Ticket öffnet als fokussierter Detailzustand mit 44px-Rückweg, sichtbarer Elternzugehörigkeit und getrennten Status-/Prioritätswerten. „Zurück zur Liste“ erhält Query, Filter, Ticketziel und Listenposition. Das konkretisiert das bestehende Responsive-Unterticket und ersetzt keine separate Mobile-Hauptnavigation.

**URL-Entwurf für Ticketziele:** Die App bleibt auf dem vorhandenen Serverpfad `/`; ein Ticket wird über `/?ticket=<ticket-id>` adressiert, ein optionaler Kommentar über `#comment=<comment-id>` ergänzt. Beispiel: `/?ticket=01a189…#comment=01a192…`. Das passt zum aktuellen Handler, der `GET /` beantwortet, während `/tickets/<id>` derzeit 404 liefert; der Fragmentteil wird nicht an den Server gesendet. Explizite Ticketwechsel schreiben einen Verlaufseintrag und `popstate` stellt die vorherige Auswahl wieder her. Der flüchtige Listenstand (Filter, Scrollposition) darf im History-State des Tabs liegen, aber nicht in die teilbare URL. Sucheingaben bleiben ebenfalls aus der URL. Dieser konkrete Vorschlag gehört zum bestehenden Navigation-Unterticket `01a189c1-79a0-74ae-b519-20b51b0aefa8` und ist noch nicht umgesetzt.

**Mobile Ticketliste:** Die [390px-Vorschau](ui-ticket-list-mobile.svg) und ihr [320px-Pendant](ui-ticket-list-320.svg) zeigen den aktuellen UI-Programmzweig mit den zehn echten direkten Arbeitspaketen. Jede Zeile zeigt gespeicherten Status und Priorität als Text in einer Metadatenzeile; die daraus getrennte Bereitschaft steht darunter. Auf 320px dürfen die Metadaten nicht abgeschnitten oder zu einem scheinbaren Statuswert verbunden werden. Ein 44px-Filtereinstieg öffnet die kombinierbaren vorhandenen Felder Status, Priorität, Labels und Hierarchiebereich; aktive Filter bleiben sichtbar und einzeln entfernbar. Sieben Einträge sind sichtbar, drei weitere werden per Scrollhinweis angekündigt. Ein Eintrag öffnet den fokussierten Detailzustand; der Rückweg soll Filter und Listenposition erhalten. Die Beispiele zeigen die derzeit gespeicherte Normalpriorität und sind statische Zustände, keine Live-Zähler.

**Ticketanlage Desktop:** Der [Desktopdialog](ui-ticket-create-desktop.svg) zeigt denselben Feldvertrag für Root- und Unterticketanlage als zwei getrennte Zustände. Root startet aus der Projektübersicht und bleibt ohne Eltern-Ticket; das Unterticket startet aus dem Detail und hält das Elternticket sichtbar. Beide erhalten dauerhaft beschriftete Felder, Projektstatus- und Prioritätsdefaults sowie klar getrennte Aktionen. Das Desktopoverlay ist ein echtes Modal: benannter Dialog (`role="dialog"`, `aria-modal="true"`, `aria-labelledby` auf den Dialogtitel), Fokus beim Öffnen in den Titel, Tab/Shift+Tab innerhalb des Dialogs, Hintergrund währenddessen inert und das Schließen-Symbol mit zugänglichem Namen „Dialog schließen“. Die undurchsichtige Dialogfläche muss den überdeckten Hintergrund vollständig abdecken; dahinterliegende Texte oder Konturen dürfen am Rand nicht hervortreten. Escape/Abbrechen schließt den Dialog und gibt den Fokus an den Einstieg zurück. Hat die Person schon etwas geändert, öffnet Schließen/Escape stattdessen die [Bestätigung zum Verwerfen](ui-ticket-create-discard.svg). „Weiter bearbeiten“ ist sicherer Standardfokus; Escape schließt nur die Bestätigung, nicht das Formular.

**Rückmeldungen bei Ticketanlage:** Die [Zustandsvorschau](ui-ticket-create-feedback.svg) trennt fehlenden Titel, bestätigte Validierungsablehnung, unklare Antwort nach einem POST und erfolgreichen Schreibvorgang mit fehlgeschlagenem Listenrefresh. Während der Anfrage ist erneutes Absenden gesperrt. Ein Feldfehler setzt `aria-invalid="true"`, verweist über `aria-describedby` auf die sichtbare Erklärung und erhält den Formulartext; allgemeine Servermeldungen werden assistiv angesagt. Bei unklarem POST-Ausgang darf die Oberfläche keine blinde Wiederholung anbieten: Die aktuelle API erzeugt die Ticket-ID serverseitig und hat keinen Idempotenzschlüssel. Eine sichere Wiederholung oder Statusprüfung braucht daher erst einen passenden API-Vertrag; bis dahin muss der unklare Zustand ehrlich bleiben. Nach bestätigtem Schreib-Erfolg wiederholt die Aktion „Liste aktualisieren“ nur den Abruf und legt kein zweites Ticket an. Der API-Vertrag und die Textzustände gehören zum bestehenden Rückmeldungsticket und sind mit beiden Anlageflüssen abgestimmt.

**Ungespeicherte Ticketentwürfe:** Bei Titel-, Beschreibungs-, Label- oder geänderten Status-/Prioritätswerten führt Schließen/X, Escape oder mobiler Zurückweg zunächst zur [Verwerfbestätigung](ui-ticket-create-discard.svg). Unveränderte Standardwerte und der feste Parent zählen nicht als Nutzeränderung; ein leeres/unverändertes Formular darf direkt schließen. Die Bestätigung nennt den Verlust und unterscheidet „Weiter bearbeiten“ von „Entwurf verwerfen“; Letzteres sendet keinen Request und stellt nach dem Schließen den Einstieg samt Fokus/Scrollposition wieder her. Als einzig aktives `alertdialog` hat sie `aria-modal="true"`, `aria-labelledby`/`aria-describedby`, eingeschlossene Tab-Reihenfolge und initialen Fokus auf „Weiter bearbeiten“; das dahinterliegende Formular ist währenddessen inert. Escape schließt nur die Bestätigung und stellt den Formularzustand wieder her. Während ein Create-POST läuft, sind Schließen und Verwerfen gesperrt; sein unklarer Ausgang folgt dem separaten API-/Feedbackvertrag.

**Mobile Ticketanlage:** Die mobile Detailansicht bietet bei Unteraufgaben eine sichtbare 44px-Aktion „Unterticket anlegen“ ([390px-Detail](ui-prototype-mobile.svg), [320px-Detail](ui-ticket-detail-320.svg)). Der [390px-Formularentwurf](ui-ticket-create-mobile.svg) trennt zwei Einstiege: ein Root-Ticket aus der Projektübersicht und ein direktes Unterticket aus dem geöffneten Elternticket. Für das Unterticket bleibt der Elternbezug sichtbar und nicht frei umwählbar; `parentId` folgt dem aktuellen Ticket. Die mobile Anlage ist eine fokussierte Vollbildansicht mit `main` und eigener `h1`, nicht ein Modal innerhalb der langen Navigation; beim Öffnen geht der Fokus in das Titelfeld und „Zurück“ stellt Einstiegskontext, Fokus und Listenposition wieder her. Die Felder heißen sichtbar Titel (Pflicht), Beschreibung (optional), Status, Priorität und Labels (optional); Der Status startet immer mit dem ersten Wert der Projektkonfiguration; im aktuellen Vorschauprojekt ist das `todo` („Offen“). Die Priorität startet mit `normal` („Normal“). Der [320px-Entwurf](ui-ticket-create-320.svg) prüft denselben Elternticket-Kontext und die Aktionsflächen bei schmalem Layout. Keine freie Properties-Eingabe, keine automatische Statuskaskade; Abbruch führt in den Ausgangskontext zurück, erfolgreiche Anlage ergänzt Rootliste bzw. Unterticketliste. Fehler lassen Eingaben bestehen; Erfolgsmeldung und anschließender Refresh folgen dem bestehenden Rückmeldungs-Ticket.

**Ticketlabels:** Die [Labelvorschau](ui-ticket-labels.svg) verwendet einen Freitext-Token-Eingang statt eines Katalogs: heist speichert `labels` als Stringliste; in den aktuellen 46 Tickets gibt es keine Werte oder Vorschlagsquelle. Enter oder „Hinzufügen“ fügt einen Wert hinzu; sichtbare Chips lassen sich einzeln entfernen. Rand-Whitespace wird bereinigt, leere Werte werden zurückgewiesen, Schreibweise bleibt erhalten und exakt gleiche bereinigte Werte werden nicht doppelt hinzugefügt. Kein Autocomplete, bis es tatsächlich Projektlabels zum Vorschlagen gibt. Desktop-Aktionen sind mindestens 40px, Mobilaktionen mindestens 44px. Beispielwerte in der Vorschau sind illustrativ; die spätere Prüfung nutzt eine isolierte Fixture, keine kanonischen Labels.

**Mobile globale Suche:** Die Query bleibt im Suchfeld sichtbar und lässt sich mit einem 44×44px-Button leeren. Das X-Zeichen erhält den zugänglichen Namen „Suche leeren“. Die aktuelle Stichwortsuche wird ausdrücklich als verfügbarer Modus gezeigt; semantische Suche bleibt später optional und darf erst bei bereitem Modell und Index aktiv sein. Die vorhandenen Typfilter erscheinen mobil als dauerhaft beschriftete native Auswahl mit mindestens 44px Bedienhöhe statt als gequetschte Chipreihe. Ergebnis-Karten unterscheiden Ticket, Kommentar und Dokument, zeigen Quelle und passende Vorschau; gespeicherter Status und Elternkontext erscheinen nur bei Tickets. Ein eigener 44px-Button lädt weitere Ergebnisse und erhält Query sowie Filter. Der abstimmbare Zielzustand steht in [mobiler Suchvorschau](ui-search-preview-mobile.svg); die Beispiele sind keine Live-Suchergebnisse.

**Mobile Planungsdokumente:** Die zwei Zustände in [mobiler Dokumentvorschau](ui-documents-mobile.svg) zeigen zuerst eine auswählbare Liste und danach einen getrennten Lesemodus mit 44px-Rückweg. Die Vorschau verwendet die echten vier Dokumenttitel, Arten und Statuswerte; der UI-Plan zeigt seine acht tatsächlichen Ticketlinks, davon drei direkt und fünf über einen klar benannten Einstieg. Dokumente bleiben lesbar, sicher dargestellt und unveränderbar, solange die API nur create/list/get anbietet. Der Filter benennt die Dokumentart; ein Typ ohne Einträge bekommt einen eigenen Leerzustand statt „keine Planungsdokumente“.

## Gemeinsame Gestaltungsregeln

- **Vorläufige Farbrollen:** Seitenfläche `#F6F7F9`, Inhaltsfläche `#FFFFFF`, neutrale Fläche `#F0F3F7`, Haupttext `#263445`, Sekundärtext `#5A687A`, Trennlinie `#D8DEE7`, interaktive Kontur `#768294`, Aktions-/Auswahlblau `#2457A7` mit heller Auswahlfläche `#EAF1FD`. Status und Fehler verwenden die bestehenden Paare aus dem Konzeptticket; Text und Symbol bleiben zusätzlich zur Farbe sichtbar. Die Kontur erreicht rechnerisch mindestens 3:1 auf den vorgesehenen Nachbarflächen. Werte bleiben Entwurf bis zur gemeinsamen Freigabe.
- Navigationszeichen werden in allen Desktop-/Mobilvorschauen einheitlich mit 20×20 px und 1,8 px Strich gezeigt; Aktionszeichen nutzen 16×16 px. Bei 320 CSS-Pixeln bleiben neben jedem Icon mindestens 6 px Labelabstand, und die aktive Unterstreichung umfasst Icon plus Text.
- Textlabels bleiben neben Icons sichtbar. Für Ticketarten wie Epic, Story oder Bug gibt es keine Symbole, weil heist kein solches Feld besitzt.
- Die Hauptnavigation verwendet die im [Icon-Inventar](ui-icon-preview.svg) gezeigten Zeichen für Übersicht, Tickets und den gemeinsamen Bereich Planungsdokumente; das Dokumentbereich-Symbol darf nicht mit dem Plansymbol verwechselt werden.
- Ziel- und Plandokumente verwenden in der mobilen Vorschau dieselben `target`- und `clipboard`-Kandidaten wie das [Icon-Inventar](ui-icon-preview.svg); sichtbare Textlabels bleiben erhalten. Die konkrete Symbolform bleibt bis zur Browserabnahme ein Kandidat.
- Gespeicherter Status, Priorität, Status der Unteraufgaben und Blockerbereitschaft werden getrennt angezeigt (Beispiel: „Offen · Unteraufgaben: In Arbeit“); Farbe allein trägt keine Bedeutung. Ein `in_progress`-Baumrollup macht aus dem gespeicherten `todo` keinen Status `in_progress`.
- Die Hauptfläche hat eine klare Überschriftenhierarchie ohne Ebenensprünge: eine `h1` für die aktuelle Arbeitsansicht, anschließend Abschnittsüberschriften in sinnvoller Reihenfolge. Der Browser-/Screenreader-Seitentitel benennt die aktive Ansicht und das konfigurierte Projekt; beim Wechsel von Übersicht zu Ticket oder Dokument aktualisieren sich Seitentitel und `h1` gemeinsam.
- Einspaltige Zeilen, die bestehenden 40–44-px-Ziele, sichtbare Tastaturfokusse und dauerhafte Feldlabels gelten für beide Ansichten.
- Leere Treffer, Laden, Fehler, veraltete Ergebnisse, Speicherkonflikte und leere Projekte erhalten jeweils einen eigenen verständlichen Zustand. Bei einem Konflikt bleibt der lokale Ticket-/Dokumententwurf erhalten; die Oberfläche zeigt den aktuellen Stand und bietet bewusstes Vergleichen oder Neuladen, nie stilles Überschreiben. Meldung und Fokusverhalten sind auch für Tastatur und Screenreader klar.
- Bestätigten Schreib-Erfolg von einem Fehler beim anschließenden Listen-/Detailrefresh unterscheiden. Nach bestätigter Ticketanlage bleiben Titel/ID des neuen Tickets und ein direkter Einstieg in dessen Detail neben „Liste aktualisieren“ verfügbar, auch wenn der Listenabruf fehlschlägt. „Erneut laden“ wiederholt nur den Abruf und legt nicht versehentlich ein zweites Ticket oder einen zweiten Kommentar an; eine Refreshwarnung darf den bereits gespeicherten Erfolg nicht verschleiern. Bei unklarem POST-Ergebnis bleibt die Wiederholung bis zu einer Idempotenz-/Statusprüfung gesperrt.
- Das optionale Board und die spätere semantische Suche sind keine Bestandteile des MVP-Rasters. Der geplante lokale Node.js-Pfad nutzt ONNX mit `all-MiniLM-L6-v2` und einen abgeleiteten, rebuildbaren SQLite-Vektorindex; `.heist`-Dateien bleiben die maßgeblichen Daten.
- Keyword-Suche bleibt immer verfügbar. Einen semantischen oder hybriden Suchmodus erst anbieten, wenn Modell und Index bereit sind; Modell-/Indexstatus, Aufbau oder Fehler verständlich anzeigen. Bei fehlender Runtime oder ungültigem Index die eingegebene Suche transparent im Keyword-Modus fortsetzen, statt leere Ergebnisse zu zeigen.
- Beide Modi verwenden denselben Ergebnis-, Trefferziel- und Navigationsvertrag. Suchtreffer behalten Titel, Originalausschnitt, Typ/Quelle sowie vorhandenen Ticketstatus und Elternkontext. Details und technische Abnahme bleiben in den bestehenden ONNX-/SQLite-/Such-API-Unteraufgaben.
- Nach bestätigter Ticketänderung, Ticketerstellung oder Kommentar-Anlage Query, Suchmodus, Typfilter, Paging und Auswahlzustand konsistent erhalten und Treffer für den aktualisierten Datenstand neu laden. Die aktive Query darf nicht sichtbar bleiben, während stattdessen der ungefilterte Ticketbaum angezeigt wird; neue passende Treffer dürfen nicht veraltet fehlen. Passt das bearbeitete Ticket danach nicht mehr zur Suche, Detail und Ergebnisliste mit dem bestehenden Ziel-/Stale-Vertrag synchron halten.
- Die globale Suche erhält zusätzlich einen Filter für vorhandene Ergebnistypen: Alle, Tickets, Kommentare, Ziele, Pläne und Entscheidungen. „Alle“ ist der Standard; die aktive Abfrage bleibt beim Filtern erhalten, Seitenstart wird zurückgesetzt und ein Typ ohne Treffer bietet einen klaren Rückweg zu „Alle“. Typfilter wirken in Keyword- und Semantikmodus gleich und werden mit der im Hybrid-API-Ticket geplanten Quelltyp-Auswahl umgesetzt; sie sind im aktuellen Live-UI noch nicht verfügbar.

## Festgelegte Entwurfsentscheidungen

Variante A aus dem [Layoutvergleich](ui-layout-options.svg) ist das Startlayout: kompakter Kopf mit Suche und Hauptaktion, darunter Ticketliste und Detail nebeneinander. Das passt am besten zur gezeigten fp.dev-Oberfläche und vermeidet eine dauerhaft breite Sidebar. Status- und Prioritätsfilter sind vorhandene heist-Felder; Assignee-Filter aus der Referenz werden nicht übernommen, weil Tickets kein Assignee-Feld haben.

1. **Variante A als Start verwenden.** Der Nutzer hat fp.dev als schlichte, später änderbare Stilreferenz bestätigt. Der [Layoutvergleich](ui-layout-options.svg) dokumentiert B und C als verworfene Alternativen; der beschlossene Entwurf ist [hier](ui-fp-layout.svg) gezeigt. Kompakter Kopf mit Suche und Ticketaktion, Ticketliste links, Detail rechts; keine dauerhaft breite Sidebar. Status, Priorität und Blockerbereitschaft bleiben getrennt. Eine spätere Änderung erfolgt auf Basis konkreten Nutzungsfeedbacks.
2. **Projektübersicht als Startfläche.** Sie ersetzt den derzeit leeren Detailbereich, wenn noch kein Ticket ausgewählt ist; Tickets, Blocker und Planungsdokumente bleiben von dort direkt erreichbar.
3. **Ticketzeile mit klarer Reihenfolge:** Titel, gespeicherter Status und Priorität. Blockerbereitschaft erhält bei Bedarf eine eigene, ausgeschriebene Kennzeichnung. Der abgeleitete Baumrollup wird nur an Hierarchieknoten zusätzlich angezeigt und nie als gespeicherter Ticketstatus ausgegeben.
4. **Mobil jeweils Liste oder Detail fokussieren.** Eine stets sichtbare Rückkehraktion bringt zur Liste zurück und erhält Suche, ausgewähltes Ticket und nachvollziehbare Position.
5. **Dokumente bleiben im Lesemodus.** Zugehörige Tickets erscheinen nur, wenn das Dokument sie tatsächlich verlinkt; die noch nicht vorhandenen Bearbeitungsaktionen kommen erst mit der revision-sicheren Dokumentfunktion.

Diese Festlegungen beruhen auf den aktuellen heist-Daten, UI-Befunden und den Maßvorgaben im Konzeptticket. Abweichungen sollen an konkrete Nutzungs- oder Datenbefunde geknüpft werden.

Das Raster ist ein Gesprächs- und Planungsartefakt. Es ersetzt weder die Detailanforderungen der bestehenden Untertickets noch eine spätere Prüfung der fertigen UI.

## Zusätzlicher Check bei 320 CSS-Pixeln

Die 390×844-Ansicht bleibt der primäre Mobilentwurf. Ergänzend wird bei 320 CSS-Pixeln ein schmaler Layout-Check geführt: Such- und Formularfelder dürfen keinen horizontalen Seitenüberstand erzeugen; dauerhafte Feldbeschriftungen, lesbare Ticketdetails und die geplanten Touch-Ziele bleiben erhalten. Die drei Navigationseinträge mit Icon und Text müssen ohne Überlappung in die verfügbare Breite passen; zwischen dem längsten vorangehenden Label und dem nächsten Icon bleibt ein sichtbarer Abstand. Im aktuellen Quell-CSS könnte `width:95%` plus 8px Padding und 1px Rand bei einem etwa 284px breiten Inhaltsbereich knapp überlaufen, falls das Control `content-box` verwendet. Das ist vor einer visuellen Entscheidung im Browser über berechnete Geometrie zu bestätigen. Konkrete Abnahmeregel und Zugehörigkeit stehen im Responsive-Ticket `01a189a9-42b2-70df-956e-b163f531de32`.

Der zusätzliche [320px-Ticketdetailentwurf](ui-ticket-detail-320.svg) zeigt am aktuellen Beispiel `01a189a9-42b1-7518-a6e0-89b4577b1270` einen sichtbaren Rückweg, UI-Programmpfad, Status und Priorität getrennt von der Bereitschaft, sechs Unteraufgaben sowie alle vier realen Beziehungen mit Richtung. Lange Zielnamen sind in den Beziehungskarten gekürzt; ihre vollständigen Ziele stehen im heist-Beziehungsbestand. Die Vorschau ist ein statischer Zielzustand und belegt weder eine erreichte Live-Darstellung noch die endgültige Benennung oder Bedienung. Eltern- und Relationszuordnung des Tickets werden nicht verändert.

Die 320px-Ticketliste verwendet dieselben direkten heist-Tickets und Status-/Bereitschaftswerte wie die 390px-Liste. Lange Titel dürfen umbrechen, ohne die Statuszeile oder 44px-Bedienziele zu verdrängen; horizontales Scrollen ist kein Ausweichverhalten. Die tatsächliche Liste muss danach bei 320px im Browser mit Tastatur, Touch und Rückkehr aus dem Detail geprüft werden.

Die zusätzliche [Suchvorschau bei 320px](ui-search-preview-320.svg) hält die verfügbare Keyword-Suche aktiv und stellt Semantik als spätere Stufe mit `all-MiniLM-L6-v2`/ONNX und SQLite-Vektorindex dar. Die 320px- und 390px-Ansichten verwenden dieselben realen Ticket-, Kommentar- und Zielbeispiele. Beim Kommentar steht der relevante Textauszug im Vordergrund; der zugehörige Ticketname und die Navigation zum Kommentar bleiben sichtbar, statt einen technischen `Comment on <UUID>`-Titel als Nutztext zu übernehmen. Suchfeld, Modusanzeige, Typfilter und „Weitere Treffer laden“ erhalten eigene 44px-Flächen; die künftige Semantikoption bleibt sichtbar als noch nicht verfügbar gekennzeichnet. Die Vorschauen bleiben illustrative Zielbilder; die Keyword- und Semantikzustände müssen später gegen die tatsächliche API-Bereitschaft und denselben Kommentar-Fokusvertrag wie Ticketnavigation geprüft werden.

### Leeres Projekt — erste Aktion statt leerer Arbeitsfläche

Die [Desktop-Vorschau](ui-prototype-overview-empty.svg), [390px-Ansicht](ui-prototype-overview-empty-mobile.svg) und [320px-Ansicht](ui-prototype-overview-empty-320.svg) zeigen den Null-Ticket-/Null-Dokument-Zustand. Es erscheinen keine irreführenden Zähler, Bereitschafts- oder Aktivitätsangaben. Eine primäre Aktion führt zum vorhandenen Erstellen-eines-Tickets-Ablauf; Planungsdokumente bleiben erreichbar und werden ehrlich als noch nicht vorhanden benannt. Das ist ein Planungsentwurf für die bestehende Startseitenaufgabe, kein neuer Datenvertrag.

## Festgelegte UI-Entscheidungen — 2026-10-31

Diese Entscheidungen sind die Arbeitsbasis für das bestehende UI-Konzept und dessen Untertickets. Sie schließen die bisher offenen Layoutfragen; neue Gegenbefunde oder konkrete Nutzerwünsche können sie später gezielt ändern.

1. **Start und Desktoplayout:** Die Projektübersicht ist die Startfläche. Auf breiten Ansichten steht eine kompakte horizontale Navigation oben; im Ticketbereich folgen eine schmale, eigenständig scrollbar gehaltene Liste links und das Detail rechts. Keine dauerhaft breite Sidebar. Das folgt dem schlichten fp.dev-Eindruck und nutzt die bisher leere Detailfläche sinnvoll.
2. **Navigation und Suche:** Globale Suche bleibt jederzeit im Kopf erreichbar. Die Hauptbereiche heißen Übersicht, Tickets und Planungsdokumente. Auf schmalen Displays wird die Hauptnavigation als untere Navigation gezeigt; Ticketarbeit wechselt zwischen fokussierter Liste und fokussiertem Detail mit dauerhaft sichtbarem Rückweg. Query, Filter, Auswahl und Listenposition bleiben beim Hin- und Zurückwechseln erhalten.
3. **Ticketliste und Detail:** Kompakte, linksbündige Zeilen zeigen Titel, gespeicherten Status und Priorität. Detail startet im Lesemodus; Bearbeitung wird ausdrücklich begonnen. Elternpfad, Untertickets, Beziehungen und Kommentare sind sichtbare, navigierbare Abschnitte. Status, Priorität, abgeleiteter Arbeitsstand und Blockerbereitschaft bleiben getrennte Angaben.
4. **Projektübersicht:** Zeige gespeicherte Statuszahlen getrennt von Bereitschaft/Blockern, dazu eine kurze Liste der nächsten bereiten Tickets, offene Blocker mit Ursache und zuletzt geänderte Tickets. Jede Ticket-ID zählt in einer gespeicherten Statusgruppe genau einmal; Elternrollups werden nicht als zusätzliche Tickets summiert. Bei Nullbestand gibt es keine erfundenen Kennzahlen und genau eine primäre Aktion: „Erstes Ticket erstellen“.
5. **Planungsdokumente:** Dokumente erhalten einen eigenen Bereich mit auswählbarer Liste und Lesefläche. Bis eine revision-sichere Update-API geplant und vorhanden ist, bleibt die UI im Lesemodus; keine Bearbeiten-/Löschen-Aktion vortäuschen. Ticketverknüpfungen werden nur aus echten `links` gezeigt.
6. **Visuelle Sprache und Icons:** Helle, ruhige Flächen mit den bereits notierten neutralen Farben und einem einzelnen Blau für primäre Aktionen. Keine Jira-Marken und keine visuellen Jira-Klone. Ein lokales, einheitliches Inline-SVG-Strichsystem mit sichtbaren Textlabels; keine Epic-/Story-/Bug-Symbole ohne Tickettyp-Feld. Status oder Beziehung werden nie allein über Farbe/Icon erklärt.
7. **Umfang:** MVP umfasst Übersicht, Ticketliste/-detail, Suche, Dokumentlesen, Ticketanlage/-bearbeitung und responsive Bedienung. Board und semantische Suche sind spätere Ausbaustufen. Keyword-Suche bleibt immer verfügbar; ONNX mit `all-MiniLM-L6-v2` und SQLite-Vektorindex wird erst angeboten, wenn Modell und Index tatsächlich bereit sind.
8. **Abnahme:** Für Desktop, 390px und 320px werden mindestens Projekt leer/gefüllt, lange Hierarchie, Suche/Filter, Ticketdetail, Dokumentlesen, Lade-/Fehler-/Konfliktzustände und Tastaturbedienung geprüft. Visuelle Live-Abnahme beginnt erst, wenn der vorhandene Server unter `127.0.0.1:4000` stabil startet; das Portticket bleibt dafür Voraussetzung.

Die vorhandenen Detailabschnitte und Vorschauen konkretisieren diese Entscheidungen. Zuständigkeiten bleiben bei ihren aktuellen Tickets; keine neue Aufgabe oder Beziehung wird dafür benötigt.
