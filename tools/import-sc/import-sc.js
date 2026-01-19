import { html, LitElement } from 'https://da.live/nx/deps/lit/lit-core.min.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import getStyle from 'https://da.live/nx/utils/styles.js';
import { debounce } from './utils/helpers.js';
import { validateAgainstSchema } from './utils/validators.js';
import { generateStructuredHTML } from './utils/html-generator.js';
import { loadSchemas, fetchSchema, importToDA } from './utils/api.js';

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
    _org: { state: true },
    _site: { state: true },
    _documentPath: { state: true },
    _schemaName: { state: true },
  };

  constructor() {
    super();
    this._schemas = {};
    this._alert = null;
    this._editor = null;
    this._org = '';
    this._site = '';
    this._documentPath = '';
    this._schemaName = '';

    // Create debounced schema loader (500ms delay)
    this.debouncedLoadSchemas = debounce(() => this.loadSchemas(), 500);
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
    if (!this._org || !this._site) return;

    const result = await loadSchemas(this._org, this._site, this._token);

    if (result.success) {
      this._schemas = result.schemas;
      if (Object.keys(this._schemas).length === 0) {
        this._alert = { type: 'warning', message: 'No schemas found' };
      }
    } else {
      this._alert = { type: 'error', message: result.error };
    }
  }

  /**
   * Handles input field changes
   * @param {string} field - Field name
   * @param {string} value - Field value
   */
  handleFieldChange(field, value) {
    this[`_${field}`] = value;

    // Reload schemas if org or site changes (debounced)
    if (field === 'org' || field === 'site') {
      this.debouncedLoadSchemas();
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
   * Formats validation errors for display
   */
  formatValidationErrors(errors) {
    return errors.map(err => ({
      path: err.path && err.path !== '#' ? err.path : 'Root',
      message: err.message
    }));
  }

  /**
   * Validates JSON against selected schema
   * @returns {Promise<{valid: boolean, data?: object, errors?: array}>}
   */
  async performValidation() {
    if (!this._schemaName) {
      return { valid: false, error: 'Please select a schema first' };
    }

    const schema = this._schemas[this._schemaName];
    if (!schema) {
      return { valid: false, error: 'Selected schema not found' };
    }

    const schemaResult = await fetchSchema(schema.path, this._token);
    if (!schemaResult.success) {
      return { valid: false, error: `Failed to load schema: ${schemaResult.error}` };
    }

    const jsonData = this.getEditorContent();
    const validationResult = validateAgainstSchema(jsonData, schemaResult.schema);

    if (!validationResult.valid) {
      if (validationResult.errors) {
        return {
          valid: false,
          errors: this.formatValidationErrors(validationResult.errors)
        };
      }
      return { valid: false, error: validationResult.error };
    }

    return { valid: true, data: validationResult.data };
  }

  /**
   * Handles validate button click
   * Validates JSON against schema without importing
   */
  async handleValidate() {
    this._alert = { type: 'info', message: 'Validating against schema...' };
    const validation = await this.performValidation();

    if (validation.valid) {
      this._alert = { type: 'success', message: `JSON is valid and matches the "${this._schemaName}" schema!` };
    } else if (validation.errors) {
      this._alert = {
        type: 'error',
        message: `JSON validation failed against the "${this._schemaName}" schema:`,
        errors: validation.errors,
        link: {
          url: `https://da.live/apps/schema#/${this._org}/${this._site}/.da/forms/schemas/${this._schemaName}`,
          text: 'Edit Schema'
        }
      };
    } else {
      this._alert = { type: 'error', message: validation.error };
    }
  }

  /**
   * Handles form submission
   * Validates JSON against schema, generates HTML, and imports to DA
   * @param {Event} event - Form submit event
   */
  async handleSubmit(event) {
    event.preventDefault();

    this._alert = { type: 'info', message: 'Validating against schema...' };
    const validation = await this.performValidation();

    if (!validation.valid) {
      if (validation.errors) {
        this._alert = {
          type: 'error',
          message: `JSON validation failed against the "${this._schemaName}" schema:`,
          errors: validation.errors,
          link: {
            url: `https://da.live/apps/schema#/${this._org}/${this._site}/.da/forms/schemas/${this._schemaName}`,
            text: 'Edit Schema'
          }
        };
      } else {
        this._alert = { type: 'error', message: validation.error };
      }
      return;
    }

    this._alert = { type: 'info', message: 'Importing content...' };

    const htmlContent = generateStructuredHTML(this._schemaName, validation.data);
    const result = await importToDA(this._org, this._site, this._documentPath, htmlContent, this._token);

    if (result.success) {
      this._alert = {
        type: 'success',
        message: 'Content imported successfully! ',
        link: { url: result.url, text: 'View in Editor' }
      };
    } else {
      this._alert = { type: 'error', message: `Import failed: ${result.error}` };
    }
  }


  /**
   * Determines if validate button should be enabled
   */
  get canValidate() {
    return Object.keys(this._schemas).length > 0
      && this._org?.trim()
      && this._site?.trim()
      && this._documentPath?.trim()
      && this._schemaName?.trim()
      && this.getEditorContent()?.trim();
  }

  /**
   * Determines if import button should be enabled
   */
  get canImport() {
    if (!this.canValidate) return false;

    // Import requires valid JSON syntax
    try {
      JSON.parse(this.getEditorContent());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Renders alert message
   * @returns {TemplateResult|string} Alert template or empty string
   */
  renderAlert() {
    if (!this._alert) return '';

    const { type, message, errors, link } = this._alert;

    return html`
      <div class="alert alert-${type}">
        <div class="alert-content">
          ${message}
          ${errors ? html`
            <div style="margin-top: 8px;">
              ${errors.map(err => html`
                <div><strong>${err.path}:</strong> ${err.message}</div>
              `)}
            </div>
          ` : ''}
          ${link ? html`<a href="${link.url}" target="_blank">${link.text}</a>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Renders a form input field
   */
  renderInput(id, label, value, placeholder = '', hint = '') {
    return html`
      <div class="form-group">
        <label for="${id}">${label}</label>
        <input 
          type="text" 
          id="${id}" 
          name="${id}"
          .value=${value}
          placeholder="${placeholder}"
          @input=${(e) => this.handleFieldChange(id, e.target.value)}
          required 
        />
        ${hint ? html`<span class="label-hint">${hint}</span>` : ''}
      </div>
    `;
  }

  /**
   * Renders schema select dropdown
   */
  renderSchemaSelect() {
    const schemaNames = Object.keys(this._schemas).sort();
    const hasSchemas = schemaNames.length > 0;
    const schemaEditorUrl = `https://da.live/apps/schema#/${this._org}/${this._site}/.da/forms/schemas`;
    const hint = hasSchemas
      ? html`${schemaNames.length} schema${schemaNames.length > 1 ? 's' : ''} available. <a href="${schemaEditorUrl}" target="_blank">Manage schemas</a>`
      : html`No schemas found. Verify that the Organization and Site are correct, or <a href="https://da.live/apps/schema" target="_blank">create a schema</a> first.`;

    return html`
      <div class="form-group">
        <label for="schema-name">Schema Name</label>
        <select 
          id="schema-name" 
          name="schemaName"
          .value=${this._schemaName}
          @change=${(e) => this.handleFieldChange('schemaName', e.target.value)}
          ?disabled=${!hasSchemas}
          required
        >
          ${hasSchemas
        ? html`
                <option value="">Select a schema...</option>
                ${schemaNames.map(name => html`<option value="${name}">${name}</option>`)}
              `
        : html`<option value="">No schemas available</option>`
      }
        </select>
        <span class="label-hint ${hasSchemas ? '' : 'hint-warning'}">${hint}</span>
      </div>
    `;
  }

  /**
   * Renders the main component template
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
              ${this.renderInput('org', 'Organization', this._org, 'name-of-organization', 'Target organization')}
              ${this.renderInput('site', 'Site', this._site, 'name-of-site', 'Target site')}
            </div>

            <div class="form-row">
              ${this.renderSchemaSelect()}
              ${this.renderInput('documentPath', 'Document Path', this._documentPath, '/forms/my-content', 'Path where the content will be saved')}
            </div>

            <div class="form-group">
              <label for="json-data">JSON Data</label>
              <div class="json-editor"></div>
              <span class="label-hint">Paste your JSON content here</span>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click=${this.handleValidate} ?disabled=${!this.canValidate}>Validate</button>
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
