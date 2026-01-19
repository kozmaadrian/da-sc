/**
 * DA API integration
 */

const API_BASE_URL = 'https://admin.da.page';
const PREVIEW_BASE_URL = 'https://da-sc--da-live--adobe.aem.live';
const SCHEMA_PATH = '/.da/forms/schemas';

/**
 * Loads schemas from DA API
 */
export async function loadSchemas(org, site, token) {
  if (!org) return { success: false, error: 'Organization is required' };

  try {
    const schemasUrl = `${API_BASE_URL}/list/${org}/${site}${SCHEMA_PATH}`;
    console.log('Loading schemas from:', schemasUrl);

    const response = await fetch(schemasUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) throw new Error(`Failed to load schemas: ${response.status}`);

    const data = await response.json();
    const schemas = {};

    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.name && item.ext === 'html') {
          schemas[item.name] = { name: item.name, path: item.path, modified: item.lastModified };
        }
      });
    }

    console.log('Loaded schemas:', schemas);
    return { success: true, schemas };
  } catch (error) {
    console.error('Error loading schemas:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches schema definition from DA
 */
export async function fetchSchema(schemaPath, token) {
  try {
    const apiUrl = `${API_BASE_URL}/source${schemaPath}`;
    console.log('Fetching schema from:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) throw new Error(`Failed to fetch schema: ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const schemaElement = doc.querySelector('pre code');

    if (!schemaElement) throw new Error('Schema definition not found in HTML');

    const schema = JSON.parse(schemaElement.textContent);
    console.log('Loaded schema:', schema);

    return { success: true, schema };
  } catch (error) {
    console.error('Error fetching schema:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Imports content to DA via API
 */
export async function importToDA(org, site, documentPath, htmlContent, token) {
  try {
    const fullPath = documentPath.endsWith('.html') ? documentPath : `${documentPath}.html`;
    const apiUrl = `${API_BASE_URL}/source/${org}/${site}${fullPath}`;

    const formData = new FormData();
    formData.append('data', new Blob([htmlContent], { type: 'text/html' }), 'content.html');

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
      url: `${PREVIEW_BASE_URL}/form#/${org}/${site}${documentPath}`,
    };
  } catch (error) {
    console.error('Import error:', error);
    return { success: false, error: error.message };
  }
}
