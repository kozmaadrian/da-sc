import { html, LitElement } from 'https://da.live/nx/deps/lit/lit-core.min.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import getStyle from 'https://da.live/nx/utils/styles.js';
import {
  validateJSON,
  generateStructuredHTML,
  loadSchemas,
  importToDA,
  areRequiredFieldsFilled,
} from './utils.js';

// Import CodeMirror
import { EditorState } from 'https://esm.sh/@codemirror/state@6';
import { EditorView, keymap, lineNumbers } from 'https://esm.sh/@codemirror/view@6';
import { defaultKeymap, history, historyKeymap } from 'https://esm.sh/@codemirror/commands@6';
import { json, jsonParseLinter } from 'https://esm.sh/@codemirror/lang-json@6';
import { linter, lintGutter } from 'https://esm.sh/@codemirror/lint@6';
import { syntaxHighlighting, defaultHighlightStyle } from 'https://esm.sh/@codemirror/language@6';

// Component constants
const EL_NAME = 'import-sc';
const styles = await getStyle(import.meta.url);

/**
 * Import Structured Content Web Component
 */
class ImportStructuredContent extends LitElement {
  static properties = {
    _context: { state: true },
    _token: { state: true },
    _schemas: { state: true },
    _alert: { state: true },
    _editor: { state: true },
  };

  constructor() {
    super();
    this._schemas = {};
    this._alert = null;
    this._editor = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [styles];
  }

  /**
   * Lifecycle method called after first render
   * Initializes schemas and CodeMirror editor
   */
  async firstUpdated() {
    await this.loadSchemas();
    this.initCodeMirror();
  }

  /**
   * Loads available schemas from DA API
   * Updates component state with schemas or error message
   */
  async loadSchemas() {
    const org = this._context?.org;
    const site = this._context?.repo;

    const result = await loadSchemas(org, site, this._token);

    if (result.success) {
      this._schemas = result.schemas;
      if (Object.keys(this._schemas).length === 0) {
        this._alert = { type: 'warning', message: 'No schemas found' };
      }
    } else {
      this._alert = { type: 'error', message: result.error || 'Failed to load schemas' };
    }
  }

  /**
   * Returns CodeMirror editor extensions configuration
   * @returns {Array} Array of CodeMirror extensions
   */
  getCodeMirrorExtensions() {
    return [
      lineNumbers(),
      lintGutter(),
      history(),
      json(),
      linter(jsonParseLinter()),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this._alert = null;
          this.requestUpdate();
        }
      }),
    ];
  }

  /**
   * Initializes CodeMirror editor with JSON support
   */
  initCodeMirror() {
    const editorElement = this.shadowRoot.querySelector('.json-editor');
    if (!editorElement) return;

    this._editor = new EditorView({
      state: EditorState.create({
        doc: '{}',
        extensions: this.getCodeMirrorExtensions(),
      }),
      parent: editorElement,
    });
  }

  /**
   * Gets current content from CodeMirror editor
   * @returns {string} Editor content
   */
  getEditorContent() {
    return this._editor?.state.doc.toString() || '';
  }

  /**
   * Validates JSON content and displays result
   */
  validateJSON() {
    const jsonData = this.getEditorContent();
    const result = validateJSON(jsonData);

    if (result.valid) {
      this._alert = { type: 'success', message: 'JSON is valid!' };
    } else {
      this._alert = { type: 'error', message: `Invalid JSON: ${result.error}` };
    }
  }

  /**
   * Handles form submission
   * Validates JSON, generates HTML, and imports to DA
   * @param {Event} event - Form submit event
   */
  async handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const jsonDataText = this.getEditorContent();

    // Validate JSON
    const jsonValidation = validateJSON(jsonDataText);
    if (!jsonValidation.valid) {
      this._alert = { type: 'error', message: `Invalid JSON: ${jsonValidation.error}` };
      return;
    }

    this._alert = { type: 'info', message: 'Processing import...' };

    // Generate HTML content
    const schemaName = formData.get('schemaName');
    const htmlContent = generateStructuredHTML(schemaName, jsonValidation.data);

    // Import to DA
    const org = formData.get('org');
    const site = formData.get('site');
    const pageUrl = formData.get('pageUrl');

    const result = await importToDA(org, site, pageUrl, htmlContent, this._token);

    if (result.success) {
      this._alert = {
        type: 'success',
        message: `Content imported successfully! <a href="${result.url}" target="_blank">View it</a>`
      };
    } else {
      this._alert = { type: 'error', message: `Import failed: ${result.error}` };
    }
  }


  /**
   * Determines if import button should be enabled
   * Checks schemas availability, form fields, and JSON validity
   * @returns {boolean} True if import is allowed
   */
  get canImport() {
    // Check schemas are available
    if (Object.keys(this._schemas).length === 0) return false;

    // Get form field values
    const form = this.shadowRoot?.querySelector('form');
    if (!form) return false;

    const fields = {
      org: form.querySelector('#org')?.value,
      site: form.querySelector('#site')?.value,
      pageUrl: form.querySelector('#page-url')?.value,
      schemaName: form.querySelector('#schema-name')?.value,
    };

    // Check all required fields are filled
    if (!areRequiredFieldsFilled(fields)) return false;

    // Validate JSON content
    const jsonContent = this.getEditorContent();
    return validateJSON(jsonContent).valid;
  }

  /**
   * Renders alert message
   * @returns {TemplateResult|string} Alert template or empty string
   */
  renderAlert() {
    if (!this._alert) return '';

    const { type, message } = this._alert;
    return html`
      <div class="alert alert-${type}">
        <div class="alert-content">${message}</div>
      </div>
    `;
  }

  /**
   * Renders schema dropdown options
   * @param {Array<string>} schemaNames - Array of schema names
   * @returns {Array<TemplateResult>} Array of option templates
   */
  renderSchemaOptions(schemaNames) {
    return schemaNames.map(name => html`<option value="${name}">${name}</option>`);
  }

  /**
   * Renders schema hint message based on count
   * @param {number} count - Number of available schemas
   * @returns {TemplateResult} Hint template
   */
  renderSchemaHint(count) {
    if (count === 0) {
      return html`
        <span class="label-hint hint-warning">
          No schemas found. Please <a href="https://da.live/apps/schema" target="_blank">create a schema</a> first.
        </span>
      `;
    }

    return html`
      <span class="label-hint">${count} schema${count > 1 ? 's' : ''} available</span>
    `;
  }

  /**
   * Renders complete schema select component
   * @returns {TemplateResult} Schema select template
   */
  renderSchemaSelect() {
    const schemaNames = Object.keys(this._schemas).sort();
    const hasSchemas = schemaNames.length > 0;

    return html`
      <select 
        id="schema-name" 
        name="schemaName" 
        @change=${() => this.requestUpdate()}
        ?disabled=${!hasSchemas}
        required
      >
        ${hasSchemas
        ? this.renderSchemaOptions(schemaNames)
        : html`<option value="">No schemas available</option>`
      }
      </select>
      ${this.renderSchemaHint(schemaNames.length)}
    `;
  }

  /**
   * Renders the main component template
   * @returns {TemplateResult} Main template
   */
  render() {
    return html`
      <div class="container">
        <header>
          <h1>Import Structured Content</h1>
        </header>

        <main>
          <form @submit=${this.handleSubmit}>
            <div class="form-row">
              <div class="form-group">
                <label for="org">Organization</label>
                <input 
                  type="text" 
                  id="org" 
                  name="org" 
                  @input=${() => this.requestUpdate()}
                  required 
                />
                <span class="label-hint">Target organization</span>
              </div>

              <div class="form-group">
                <label for="site">Site</label>
                <input 
                  type="text" 
                  id="site" 
                  name="site" 
                  @input=${() => this.requestUpdate()}
                  required 
                />
                <span class="label-hint">Target site</span>
              </div>
            </div>

            <div class="form-group">
              <label for="page-url">Page URL</label>
              <input 
                type="text" 
                id="page-url" 
                name="pageUrl" 
                placeholder="/forms/my-content" 
                @input=${() => this.requestUpdate()}
                required 
              />
              <span class="label-hint">Path where the content will be saved</span>
            </div>

            <div class="form-group">
              <label for="schema-name">Schema Name</label>
              ${this.renderSchemaSelect()}
            </div>

            <div class="form-group">
              <label for="json-data">JSON Data</label>
              <div class="json-editor"></div>
              <span class="label-hint">Paste your JSON content here</span>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click=${this.validateJSON}>Validate JSON</button>
              <button type="submit" class="btn btn-primary" ?disabled=${!this.canImport}>Import</button>
            </div>

            ${this.renderAlert()}
          </form>
        </main>
      </div>
    `;
  }
}

customElements.define(EL_NAME, ImportStructuredContent);

/**
 * Initializes the Import Structured Content component
 * @param {HTMLElement} el - Container element to mount component
 */
export default async function init(el) {
  el.replaceChildren();
  const { context, token } = await DA_SDK;

  let cmp = el.querySelector(EL_NAME);
  if (!cmp) {
    cmp = document.createElement(EL_NAME);
    cmp._context = context;
    cmp._token = token;
    el.append(cmp);
  }
}

// Auto-initialize when script loads
(async () => {
  try {
    const main = document.querySelector('main');
    if (main) {
      await init(main);
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
})();
