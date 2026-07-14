# MTF Backup-Kontrolle

Webbasiertes Monitoring-Tool zur täglichen Kontrolle von Backup-Jobs für MTF-Kunden. Zeigt den Status aller Backups pro Kunde, Job und Tag in einer Kalendermatrix — mit Filterung, PDF-Export, Notizen und vollständigem Audit-Log.

---

## Inhaltsverzeichnis

- [Systemübersicht](#systemübersicht)
- [Verzeichnisstruktur](#verzeichnisstruktur)
- [Datendateien](#datendateien)
- [API-Endpunkte](#api-endpunkte)
- [Benutzerverwaltung & Rollen](#benutzerverwaltung--rollen)
- [Frontend (Lesezugriff)](#frontend-lesezugriff)
- [Backend (Verwaltung)](#backend-verwaltung)
- [Status-Werte](#status-werte)
- [Deployment](#deployment)

---

## Systemübersicht

```
Browser (Lesezugriff)          Browser (Backend)
        ↓                              ↓
    index.php                   backend/index.php
        ↓                              ↓
    assets/js/frontend.js       assets/js/backend-*.js
        ↓                              ↓
              api.php (zentraler Router)
                      ↓
         includes/actions/*.php
                      ↓
              data/backup_YYYY.json
```

**Technologie-Stack:**
- PHP (Flat-File, kein Datenbank-Server)
- Vanilla JS, aufgeteilt in Modulfiles
- JSON als Datenspeicher
- jsPDF + AutoTable für PDF-Export
- Plesk Shared Hosting kompatibel

---

## Verzeichnisstruktur

```
mtf-backupkontrolle/
│
├── index.php                       # Frontend — Lesezugriff (kein Login)
├── api.php                         # Zentraler API-Router
├── logtest.php                     # Debug-Hilfsmittel
├── debug.php                       # Debug-Ausgaben
├── .htaccess                       # Zugriffsschutz
│
├── backend/
│   ├── index.php                   # Backend-SPA (Login erforderlich)
│   └── .htaccess                   # Zugriffsschutz Backend
│
├── assets/
│   ├── css/
│   │   ├── theme.css               # Dark/Light-Theme, CSS-Variablen
│   │   ├── layout.css              # Header, Grid, responsive Layout
│   │   ├── table.css               # Kalendermatrix-Styles
│   │   └── backend.css             # Backend-spezifische Styles
│   └── js/
│       ├── frontend.js             # Frontend-Logik (Ansicht, Filter, Suche)
│       ├── api.js                  # fetch()-Wrapper für alle API-Calls
│       ├── backend-app.js          # Backend-Hauptlogik, State, Navigation
│       ├── backend-crud.js         # Kunde/Job/Jahr CRUD, Bulk-Edit
│       ├── backend-keyboard.js     # Tastaturnavigation in der Matrix
│       ├── backend-notes.js        # Notizen-Feature
│       ├── backend-pdf.js          # PDF-Export via jsPDF
│       └── theme.js                # Dark/Light-Toggle, Persistenz
│
├── includes/
│   ├── helpers.php                 # Konstanten, JSON I/O, Auth-Helper, Changelog
│   ├── asset_versions.php          # Cache-Busting Versionshashes
│   └── actions/
│       ├── auth.php                # Login, Logout, Whoami
│       ├── data_read.php           # Jahre, Monate, Meta, Log lesen
│       ├── data_write.php          # Zellen, Kunden, Jobs, Jahre schreiben
│       ├── users.php               # Benutzerverwaltung (Admin)
│       └── notes.php               # Notizen lesen/schreiben
│
└── data/
    ├── years.json                  # Liste verfügbarer Jahre
    ├── backup_YYYY.json            # Backup-Daten pro Jahr
    ├── users.json                  # Benutzerdaten (SHA-256 Hashes)
    ├── notes.json                  # Notizen pro Monat
    └── changelog.json             # Audit-Log aller Änderungen
```

---

## Datendateien

### `data/backup_YYYY.json` — Backup-Matrix

```json
{
  "year": 2026,
  "months": {
    "Januar 2026": {
      "dates": ["2026-01-01", "2026-01-02", "..."],
      "customers": [
        {
          "name": "Kundenname AG",
          "jobs": [
            {
              "name": "Jobbezeichnung (z. B. 32 Tage on Disk)",
              "status": {
                "2026-01-01": "OK",
                "2026-01-02": "WARN",
                "2026-01-03": "ERR",
                "2026-01-04": "MTF CLOUD"
              }
            }
          ]
        }
      ]
    }
  }
}
```

### `data/years.json`

```json
{ "years": [2024, 2025, 2026] }
```

### `data/notes.json` — Notizen pro Monat

```json
{
  "Januar 2026": "Servermigrationen geplant KW3.",
  "Februar 2026": ""
}
```

### `data/changelog.json` — Audit-Log

```json
[
  {
    "ts": "2026-03-17T08:30:00+01:00",
    "user": { "username": "martin", "display_name": "Martin L." },
    "action": "set_cell",
    "context": {
      "cust": "Kundenname AG",
      "job": "Job XY",
      "date": "2026-03-17",
      "old": "WARN",
      "new": "OK"
    }
  }
]
```

---

## API-Endpunkte

Alle Requests gehen an `api.php?action=...`.

### Lesen (kein Login erforderlich)

| Action | Parameter | Beschreibung |
|--------|-----------|--------------|
| `get_years` | — | Verfügbare Jahre |
| `get_month` | `year`, `month` | Monats-Daten (Kunden, Jobs, Status) |
| `get_year_meta` | `year` | Jahres-Übersicht (Monate, Zählungen) |
| `get_log` | `year`, optional `customer`, `job` | Changelog-Einträge |
| `log_csv` | `year` | Changelog als CSV-Download |

### Schreiben (Login: `editor` oder `admin`)

| Action | Parameter | Beschreibung |
|--------|-----------|--------------|
| `set_cell` | `year`, `month`, `customer`, `job`, `date`, `value` | Einzelne Zelle setzen |
| `set_cells_bulk` | `year`, `month`, `cells[]` | Mehrere Zellen auf einmal |
| `add_customer` | `year`, `month`, `name` | Neuen Kunden anlegen |
| `rename_customer` | `year`, `month`, `old_name`, `new_name` | Kunden umbenennen |
| `delete_customer` | `year`, `month`, `name` | Kunden löschen |
| `add_job` | `year`, `month`, `customer`, `name` | Job zu Kunden hinzufügen |
| `rename_job` | `year`, `month`, `customer`, `old_name`, `new_name` | Job umbenennen |
| `delete_job` | `year`, `month`, `customer`, `name` | Job löschen |
| `create_year` | `year` | Neues Jahr initialisieren |

### Notizen (Login erforderlich)

| Action | Parameter | Beschreibung |
|--------|-----------|--------------|
| `get_notes` | `year` | Alle Notizen des Jahres |
| `set_note` | `year`, `month`, `text` | Notiz setzen/überschreiben |

### Benutzerverwaltung (Login: `admin`)

| Action | Parameter | Beschreibung |
|--------|-----------|--------------|
| `get_users` | — | Alle Benutzer |
| `add_user` | `username`, `password`, `display_name`, `role` | Neuen Benutzer anlegen |
| `update_user` | `id`, felder… | Benutzer bearbeiten |
| `delete_user` | `id` | Benutzer löschen |

### Auth

| Action | Beschreibung |
|--------|--------------|
| `login` | Anmelden |
| `logout` | Abmelden |
| `whoami` | Aktuelle Session-Info |

---

## Benutzerverwaltung & Rollen

Benutzer werden in `data/users.json` gespeichert (SHA-256 Passwort-Hashes).

| Rolle | Rechte |
|-------|--------|
| `viewer` | Nur Lesezugriff (wie Frontend) |
| `editor` | Zellen bearbeiten, Kunden/Jobs verwalten |
| `admin` | Zusätzlich Benutzerverwaltung, Log-Zugriff, Jahr erstellen |

---

## Frontend (Lesezugriff)

URL: `https://[domain]/backup-kontrolle/`

- Kein Login erforderlich
- Jahres- und Monatsauswahl per Navigationsleiste
- Kalendermatrix: Zeilen = Kunden/Jobs, Spalten = Tage
- Suchfeld filtert nach Kunde oder Job
- Statusfilter: Alle / ⚠ Fehler / ⚡ Warnung
- Dark/Light-Theme per Toggle (Persistenz via `localStorage`)
- Vergangene Monate werden dezent ausgegraut

---

## Backend (Verwaltung)

URL: `https://[domain]/backup-kontrolle/backend/`

**Features:**
- Login mit Benutzername und Passwort
- Inline-Bearbeitung der Status-Zellen per Klick (Dropdown)
- Bulk-Edit: mehrere Zellen mit Shift+Klick markieren, gemeinsam setzen
- Tastaturnavigation: Pfeiltasten, Enter, Escape
- Kunden und Jobs hinzufügen, umbenennen, löschen
- Notizen pro Monat
- Dashboard-Übersicht mit Fehler-/Warnungs-Statistik
- PDF-Export: aktueller Monat, mit MTF-Branding, via jsPDF
- Changelog-Ansicht mit Filter nach Benutzer/Aktion
- Benutzerverwaltung (nur Admin)
- Dark/Light-Theme

---

## Status-Werte

| Wert | Bedeutung | Darstellung |
|------|-----------|-------------|
| `OK` | Backup erfolgreich | Grün |
| `WARN` | Mit Warnung abgeschlossen | Gelb/Orange |
| `ERR` | Fehler / nicht gelaufen | Rot |
| `MTF CLOUD` | Cloud-Backup (kein lokales Backup) | Blau |
| *(leer)* | Noch nicht kontrolliert / Wochenende | Grau |

---

## Deployment

### Voraussetzungen

- PHP 8.0+
- Schreibrechte auf `data/`

### Schreibrechte

```
data/    → PHP muss schreiben können
```

### Neues Jahr anlegen

Im Backend: Einstellungen → „Neues Jahr erstellen" → Jahr eingeben. Die bestehende Kunden-/Job-Struktur des Vorjahres wird optional übernommen.

### Asset-Cache-Busting

Versionshashes in `includes/asset_versions.php` nach CSS/JS-Änderungen aktualisieren, damit Browser neue Dateien laden.

---

*MTF Solutions AG — All around business IT*
