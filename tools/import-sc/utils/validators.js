/**
 * JSON validation functions
 */

import { Validator } from 'https://esm.sh/@cfworker/json-schema@4';

/**
 * Validates JSON string against schema
 */
export function validateAgainstSchema(jsonString, schema) {
  if (!jsonString?.trim()) {
    return { valid: false, error: 'JSON data is required' };
  }

  let jsonData;
  try {
    jsonData = JSON.parse(jsonString);
  } catch (error) {
    return { valid: false, error: `Invalid JSON: ${error.message}` };
  }

  try {
    const validator = new Validator(schema);
    const result = validator.validate(jsonData);

    return result.valid
      ? { valid: true, data: jsonData }
      : {
        valid: false,
        errors: result.errors.map(err => ({
          message: err.error,
          path: err.instanceLocation,
        }))
      };
  } catch (error) {
    return { valid: false, errors: [{ message: error.message, path: '' }] };
  }
}
