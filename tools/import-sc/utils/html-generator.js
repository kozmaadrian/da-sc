/**
 * HTML generation for structured content
 */

import { escapeHtml } from './helpers.js';

/**
 * Generates structured content HTML
 */
export function generateStructuredHTML(schemaName, jsonData) {
  return `<body>
  <header></header>
  <main>
    <div>
      <div class="da-form">
        <div>
          <div>x-schema-name</div>
          <div>${escapeHtml(schemaName)}</div>
        </div>
        <div>
          <div>x-storage-format</div>
          <div>code</div>
        </div>
      </div>
      <pre><code>${escapeHtml(JSON.stringify(jsonData, null, 2))}</code></pre>
    </div>
  </main>
  <footer></footer>
</body>`;
}
