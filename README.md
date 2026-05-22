# everyweather

A daily record of weather observation, kept in place.

West River Watershed · Townshend, Vermont · Begun 13 May 2026

---

## What this is

A static site built with Eleventy, with Decap CMS providing an in-browser writing interface for the scribes. Entries live as markdown files in `src/content/entries/`. The historical companion corpus (Thoreau, etc.) lives in `src/_data/companion.js`.

## Local development

```bash
npm install
npm start
```

The site builds to `_site/` and serves at `http://localhost:8080`.

## Project structure

```
src/
  _data/
    site.js              # Site-wide config (title, watershed, nav)
    scribes.js           # Scribe roster
    companion.js         # Historical journal entries by month-day
  _includes/
    layouts/
      base.njk           # Masthead + nav + colophon
      entry.njk          # Single entry page layout
    partials/
      entry.njk          # Reusable entry rendering
  content/
    entries/             # Markdown observation files
      2026-05-13.md
      ...
  admin/
    index.html           # Decap CMS shell
    config.yml           # Decap CMS field definitions
  assets/
    css/styles.css
    images/uploads/      # CMS-uploaded images land here
  index.njk              # Home (today + calendar + recent)
  record.njk             # Full chronological archive
  about.njk
  scribes.njk
  for-the-future.njk
.eleventy.js             # Eleventy config (collections, filters, calendar shortcode)
netlify.toml             # Netlify build config
```

## Adding an entry by hand

Create a file in `src/content/entries/` named `YYYY-MM-DD.md` with this frontmatter:

```markdown
---
observed: 2026-05-19
observedTime: "20:30"
scribeName: Lucas Farrell
scribeId: lucas-farrell
watershed: West River Watershed
forecastHigh: 78
forecastConditions: "partly cloudy"
forecastSource: NWS
---

The observation goes here. One or more paragraphs of prose.
```

All forecast fields are optional. Photos can be added through the CMS.

## Adding an entry through the CMS

After deployment with Netlify Identity enabled, visit `/admin` and log in. The composer has fields for date, time, scribe, prose, optional forecast block, and photo uploads. Save and the entry publishes via a git commit.

## Deployment

1. Push this repo to GitHub.
2. Connect the repo to Netlify (already configured via `netlify.toml`).
3. In the Netlify dashboard:
   - Enable **Identity** (Site → Identity → Enable Identity)
   - Set Registration to **Invite only**
   - Enable **Git Gateway** (Identity → Services → Git Gateway)
   - Invite scribes by email
4. Point `everyweather.org` DNS at Netlify (CNAME or A record per Netlify's instructions).

## Adding to the companion corpus

`src/_data/companion.js` is keyed by `MM-DD`. To add a verified historical entry:

```javascript
"05-19": [
  {
    text: "...",
    author: "Henry David Thoreau",
    source: "Journal, Volume X, p. Y",
    year: 1857,
    location: "Concord, Massachusetts",
    citation_url: "https://www.walden.org/log-entry/..."
  }
]
```

Only include verified entries with citations. The companion is the project's claim that we are continuous with older records of attention — falsifying that claim by inventing quotes would corrupt the archive's integrity.

## License

The code is for everyweather's use. The entries are © their scribes.
