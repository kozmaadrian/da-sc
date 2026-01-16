# Import Structured Content App

A DA Live fullscreen app for importing structured content with schema validation.

## Overview

This app allows you to import structured content into DA Live by providing:
- Page URL (where to save the content)
- Schema name
- JSON data

The content is saved in the DA Live format with proper schema metadata (storage format: code).

## Access

### Via DA Apps
Add this app to your site config at `https://da.live/config#/{{ORG}}/{{SITE}}/` in the apps sheet:

| title | description | image | path | ref |
|-------|-------------|-------|------|-----|
| Import Structured Content | Import structured content with schema validation | | https://da.live/app/{{ORG}}/{{SITE}}/tools/import-sc | |

### Direct URL
Access the app directly at:
```
https://da.live/app/{{ORG}}/{{SITE}}/tools/import-sc
```

### Local Development
Test locally with:
```
https://da.live/app/{{ORG}}/{{SITE}}/tools/import-sc?ref=local
```

Or with a specific branch:
```
https://da.live/app/{{ORG}}/{{SITE}}/tools/import-sc?ref={{branch-name}}
```

## Files

- **`/tools/import-sc/import-sc.html`** - Main app HTML (imports DA SDK)
- **`/tools/import-sc/import-sc.js`** - Application logic
- **`/tools/import-sc/import-sc.css`** - Styles

## Features

- ✅ JSON validation
- ✅ Content preview
- ✅ DA SDK integration
- ✅ Auto-populated org/site from context
- ✅ Responsive design

## Usage

1. **Open the app** via DA Apps or direct URL
2. **Fill in the form**:
   - Page URL: `/content/my-page`
   - Schema Name: `color-families`
   - JSON Data: Paste your JSON
3. **Validate** your JSON
4. **Import** to generate and download the HTML
5. **Upload** to DA Live

## Output Format

Generates HTML in DA Live structured content format:

```html
<body>
  <header></header>
  <main>
    <div>
      <div class="da-form">
        <div>
          <div>x-schema-name</div>
          <div>your-schema-name</div>
        </div>
        <div>
          <div>x-storage-format</div>
          <div>code</div>
        </div>
      </div>
      <pre><code>[your-json-data]</code></pre>
    </div>
  </main>
  <footer></footer>
</body>
```

## DA SDK Integration

The app uses the DA App SDK to:
- Get authenticated context (org, site, user)
- Access authentication token
- Pre-populate form fields
- Ensure secure content handling

```javascript
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const { context, token } = await DA_SDK;
// context: { org, site, ... }
// token: authentication token
```

## Development

### Local Testing
1. Start your local server: `npm start`
2. Access via: `http://localhost:3000/tools/import-sc/import-sc.html`
3. Or via DA with `?ref=local`

### Building
No build step required - pure vanilla JavaScript and CSS.

## Reference

- [DA Live Docs - Developing Apps & Plugins](https://docs.da.live/developers/guides/developing-apps-and-plugins)
- DA SDK: `https://da.live/nx/utils/sdk.js`

## License

See main project LICENSE file.
