/**
 * @module asana/get-task/custom-fields
 * @description Custom field conversion utilities
 */

/** Raw custom field from API */
export interface RawCustomField {
  readonly gid: string;
  readonly name: string;
  readonly type: string;
  readonly displayValue: string | null;
  readonly enumValue: { gid: string; name: string } | null;
  readonly numberValue: number | null;
  readonly textValue: string | null;
}

/** Normalized custom field value */
export interface CustomFieldValue {
  readonly gid: string;
  readonly name: string;
  readonly type: CustomFieldType;
  readonly value: string | number | boolean | string[] | null;
  readonly displayValue: string;
}

/** Custom field types */
export type CustomFieldType =
  | 'text'
  | 'number'
  | 'enum'
  | 'multi_enum'
  | 'date'
  | 'people'
  | 'formula'
  | 'unknown';

/**
 * Convert raw custom fields to normalized format
 *
 * @param rawFields - Raw custom fields from API
 * @returns Normalized custom field values
 */
export function convertCustomFields(
  rawFields: readonly RawCustomField[]
): CustomFieldValue[] {
  return rawFields.map(convertSingleField);
}

/**
 * Convert a single custom field
 */
function convertSingleField(field: RawCustomField): CustomFieldValue {
  const type = mapFieldType(field.type);

  let value: string | number | boolean | string[] | null = null;
  let displayValue = field.displayValue ?? '';

  switch (type) {
    case 'text':
      value = field.textValue;
      displayValue = field.textValue ?? '';
      break;

    case 'number':
      value = field.numberValue;
      displayValue = field.numberValue?.toString() ?? '';
      break;

    case 'enum':
      value = field.enumValue?.name ?? null;
      displayValue = field.enumValue?.name ?? '';
      break;

    case 'multi_enum':
      // multi_enum would need to be handled differently in API response
      // For now, use display value
      value = field.displayValue?.split(', ') ?? null;
      break;

    case 'date':
      value = field.displayValue;
      break;

    case 'people':
      value = field.displayValue;
      break;

    case 'formula':
      value = field.displayValue;
      break;

    default:
      value = field.displayValue;
  }

  return {
    gid: field.gid,
    name: field.name,
    type,
    value,
    displayValue,
  };
}

/**
 * Map Asana field type to our type
 */
function mapFieldType(asanaType: string): CustomFieldType {
  switch (asanaType) {
    case 'text':
      return 'text';
    case 'number':
      return 'number';
    case 'enum':
      return 'enum';
    case 'multi_enum':
      return 'multi_enum';
    case 'date':
      return 'date';
    case 'people':
      return 'people';
    case 'formula':
      return 'formula';
    default:
      return 'unknown';
  }
}

/**
 * Get custom field by name
 *
 * @param fields - Custom field values
 * @param name - Field name (case-insensitive)
 * @returns Field value or null
 */
export function getCustomFieldByName(
  fields: readonly CustomFieldValue[],
  name: string
): CustomFieldValue | null {
  return (
    fields.find((f) => f.name.toLowerCase() === name.toLowerCase()) ?? null
  );
}

/**
 * Get custom field value by name
 *
 * @param fields - Custom field values
 * @param name - Field name (case-insensitive)
 * @returns Field value or null
 */
export function getCustomFieldValue(
  fields: readonly CustomFieldValue[],
  name: string
): string | number | boolean | string[] | null {
  const field = getCustomFieldByName(fields, name);
  return field?.value ?? null;
}

/**
 * Get custom field display value by name
 *
 * @param fields - Custom field values
 * @param name - Field name (case-insensitive)
 * @returns Display value or empty string
 */
export function getCustomFieldDisplayValue(
  fields: readonly CustomFieldValue[],
  name: string
): string {
  const field = getCustomFieldByName(fields, name);
  return field?.displayValue ?? '';
}

/**
 * Convert custom fields to key-value map
 *
 * @param fields - Custom field values
 * @returns Map of field name to value
 */
export function customFieldsToMap(
  fields: readonly CustomFieldValue[]
): Map<string, CustomFieldValue['value']> {
  const map = new Map<string, CustomFieldValue['value']>();
  for (const field of fields) {
    map.set(field.name, field.value);
  }
  return map;
}

/**
 * Convert custom fields to plain object
 *
 * @param fields - Custom field values
 * @returns Object with field names as keys
 */
export function customFieldsToObject(
  fields: readonly CustomFieldValue[]
): Record<string, CustomFieldValue['value']> {
  const obj: Record<string, CustomFieldValue['value']> = {};
  for (const field of fields) {
    obj[field.name] = field.value;
  }
  return obj;
}

/**
 * Format custom fields as Markdown
 *
 * @param fields - Custom field values
 * @returns Markdown table
 */
export function formatCustomFieldsAsMarkdown(
  fields: readonly CustomFieldValue[]
): string {
  if (fields.length === 0) {
    return '_No custom fields_';
  }

  const lines = [
    '| Field | Value |',
    '|-------|-------|',
  ];

  for (const field of fields) {
    const value = escapeMarkdown(field.displayValue || '-');
    const name = escapeMarkdown(field.name);
    lines.push(`| ${name} | ${value} |`);
  }

  return lines.join('\n');
}

/**
 * Escape Markdown special characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[|\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

/**
 * Check if a custom field indicates high priority
 *
 * @param fields - Custom field values
 * @param priorityFieldName - Name of priority field
 * @param highPriorityValues - Values considered high priority
 * @returns True if high priority
 */
export function isHighPriority(
  fields: readonly CustomFieldValue[],
  priorityFieldName: string = 'Priority',
  highPriorityValues: readonly string[] = ['High', 'Critical', 'Urgent', 'P0', 'P1']
): boolean {
  const priorityField = getCustomFieldByName(fields, priorityFieldName);
  if (!priorityField) return false;

  const value = priorityField.displayValue.toLowerCase();
  return highPriorityValues.some((v) => value.includes(v.toLowerCase()));
}
