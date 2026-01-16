/**
 * Utility functions for structured content import
 */

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Validates JSON string
 * @param {string} jsonString - JSON string to validate
 * @returns {{ valid: boolean, error?: string, data?: any }}
 */
export function validateJSON(jsonString) {
  if (!jsonString || !jsonString.trim()) {
    return { valid: false, error: 'JSON data is required' };
  }

  try {
    const data = JSON.parse(jsonString);
    return { valid: true, data };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Generates structured content HTML from form data and JSON
 * @param {string} schemaName - Schema name
 * @param {object} jsonData - JSON data object
 * @returns {string} HTML content
 */
export function generateStructuredHTML(schemaName, jsonData) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Structured Content</title>
  <meta name="x-structured-content" content="code">
</head>
<body>
  <div>
    <div>x-schema-name</div>
    <div>${escapeHtml(schemaName)}</div>
  </div>
  <div>
    <div>x-structured-content</div>
    <div><pre><code>${escapeHtml(JSON.stringify(jsonData, null, 2))}</code></pre></div>
  </div>
</body>
</html>`;
}

/**
 * Loads schemas from DA API
 * @param {string} org - Organization name
 * @param {string} site - Site name
 * @param {string} token - Authorization token
 * @returns {Promise<{ success: boolean, schemas?: object, error?: string }>}
 */
export async function loadSchemas(org, site, token) {
  if (!org) {
    return { success: false, error: 'Organization is required' };
  }

  try {
    const prefix = site ? `/${org}/${site}` : `/${org}`;
    const schemasUrl = `https://admin.da.page/list${prefix}/.da/schemas`;

    const response = await fetch(schemasUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to load schemas: ${response.status}`);
    }

    const data = await response.json();
    const schemas = {};

    if (data.children && Array.isArray(data.children)) {
      data.children.forEach(child => {
        if (child.name && child.name.endsWith('.json')) {
          const schemaName = child.name.replace('.json', '');
          schemas[schemaName] = {
            name: schemaName,
            path: child.path,
            modified: child.modified,
          };
        }
      });
    }

    return { success: true, schemas };
  } catch (error) {
    console.error('Error loading schemas:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Imports content to DA via API
 * @param {string} org - Organization name
 * @param {string} site - Site name
 * @param {string} pageUrl - Page URL path
 * @param {string} htmlContent - HTML content to import
 * @param {string} token - Authorization token
 * @returns {Promise<{ success: boolean, url?: string, error?: string }>}
 */
export async function importToDA(org, site, pageUrl, htmlContent, token) {
  try {
    const fullPath = pageUrl.endsWith('.html') ? pageUrl : `${pageUrl}.html`;
    const apiUrl = `https://admin.da.page/source/${org}/${site}${fullPath}`;

    const formData = new FormData();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    formData.append('data', blob, 'content.html');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return {
      success: true,
      url: `https://da.live/edit#/${org}/${site}${pageUrl}`,
    };
  } catch (error) {
    console.error('Import error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Normalizes form field value
 * @param {string} value - Field value
 * @returns {string} Trimmed value
 */
export function normalizeFieldValue(value) {
  return value?.trim() || '';
}

/**
 * Checks if all required form fields are filled
 * @param {object} fields - Object with field values
 * @returns {boolean}
 */
export function areRequiredFieldsFilled(fields) {
  const requiredFields = ['org', 'site', 'pageUrl', 'schemaName'];
  return requiredFields.every(field => normalizeFieldValue(fields[field]));
}
