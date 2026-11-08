# UI icon inventory

All icons are inline SVG in `src/ui.js`; nothing is loaded from outside. Each meaning has exactly one icon, and icons never carry meaning alone: status, priority and type always come with text or an accessible name.

| Meaning | Icon | Size | Where | Accessible name |
|---|---|---|---|---|
| Summary, Board, List, Documents, Design | 24×24 line icons (`nav-icon`) | 20 px | sidebar, mobile nav | visible text label next to it; icon `aria-hidden` |
| Search | magnifier (`search-icon`) | 20 px | top bar | input label "Search this project" |
| Ticket type: task / feature / bug | filled square with check / bookmark / dot (`typeIcon`) | 16 px | list, board, detail, search hits | `role="img"` + label "Task", "Feature", "Bug" |
| Priority: low / normal / high / urgent | chevron down / two bars / chevron up / double chevron (`priorityIcon`) | 16 px | list, board | label "Priority: High" etc. |
| Status | text lozenge (no icon) | – | everywhere | the status text itself |
| Expand / collapse branch | chevron right / chevron down (`uiIcon`) | 16 px | ticket tree | button label "Expand …" / "Collapse …" plus `aria-expanded` |
| Remove (filter chip, relationship) | cross (`uiIcon('close')`) | 16 px | filter chips, relationships | button label "Remove filter …" / "Remove relationship: …" |
| Comment | speech bubble (`uiIcon('comment')`) | 16 px | search hits | row label "Comment: …" |
| Goal / plan / decision document | page (`uiIcon('document')`) | 16 px | search hits | row label "Goal: …" etc. |
| Assignee | initials avatar | 24 px | list, board | agent name in the title |

Rules: 16 px for inline actions and rows, 20 px for navigation; one stroke style (1.5 px, round caps) for line icons; decorative icons are `aria-hidden`; icon-only buttons always have a persistent accessible name and a visible focus ring. No emoji as icons. There are no icons for epics, stories, sprints or story points, because pman has no such fields.
