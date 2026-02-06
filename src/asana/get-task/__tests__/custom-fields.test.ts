/**
 * @module asana/get-task/__tests__/custom-fields
 * @description Tests for custom field conversion utilities
 */

import { describe, it, expect } from 'vitest';
import {
  convertCustomFields,
  getCustomFieldByName,
  getCustomFieldValue,
  getCustomFieldDisplayValue,
  customFieldsToMap,
  customFieldsToObject,
  formatCustomFieldsAsMarkdown,
  isHighPriority,
  type RawCustomField,
  type CustomFieldValue,
} from '../custom-fields.js';

describe('asana/get-task/custom-fields', () => {
  describe('convertCustomFields', () => {
    it('should convert text field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Status',
          type: 'text',
          displayValue: 'In Progress',
          enumValue: null,
          numberValue: null,
          textValue: 'In Progress',
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        gid: 'cf1',
        name: 'Status',
        type: 'text',
        value: 'In Progress',
        displayValue: 'In Progress',
      });
    });

    it('should convert number field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Story Points',
          type: 'number',
          displayValue: '5',
          enumValue: null,
          numberValue: 5,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].type).toBe('number');
      expect(result[0].value).toBe(5);
      expect(result[0].displayValue).toBe('5');
    });

    it('should convert enum field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          displayValue: 'High',
          enumValue: { gid: 'enum1', name: 'High' },
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].type).toBe('enum');
      expect(result[0].value).toBe('High');
      expect(result[0].displayValue).toBe('High');
    });

    it('should handle enum field with null value', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          displayValue: null,
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].value).toBeNull();
      expect(result[0].displayValue).toBe('');
    });

    it('should convert multi_enum field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Tags',
          type: 'multi_enum',
          displayValue: 'frontend, urgent, review',
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].type).toBe('multi_enum');
      expect(result[0].value).toEqual(['frontend', 'urgent', 'review']);
      expect(result[0].displayValue).toBe('frontend, urgent, review');
    });

    it('should handle multi_enum with null displayValue', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Tags',
          type: 'multi_enum',
          displayValue: null,
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].value).toBeNull();
    });

    it('should convert date field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Launch Date',
          type: 'date',
          displayValue: '2024-12-31',
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].type).toBe('date');
      expect(result[0].value).toBe('2024-12-31');
    });

    it('should convert people field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Reviewer',
          type: 'people',
          displayValue: 'John Doe',
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].type).toBe('people');
      expect(result[0].value).toBe('John Doe');
    });

    it('should convert formula field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Calculated Value',
          type: 'formula',
          displayValue: '42',
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].type).toBe('formula');
      expect(result[0].value).toBe('42');
    });

    it('should handle unknown field type', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Custom Type',
          type: 'future_type',
          displayValue: 'Some value',
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].type).toBe('unknown');
      expect(result[0].value).toBe('Some value');
    });

    it('should handle null textValue for text field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Notes',
          type: 'text',
          displayValue: null,
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].value).toBeNull();
      expect(result[0].displayValue).toBe('');
    });

    it('should handle null numberValue for number field', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Points',
          type: 'number',
          displayValue: null,
          enumValue: null,
          numberValue: null,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result[0].value).toBeNull();
      expect(result[0].displayValue).toBe('');
    });

    it('should convert multiple fields', () => {
      const rawFields: RawCustomField[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          displayValue: 'High',
          enumValue: { gid: 'e1', name: 'High' },
          numberValue: null,
          textValue: null,
        },
        {
          gid: 'cf2',
          name: 'Points',
          type: 'number',
          displayValue: '8',
          enumValue: null,
          numberValue: 8,
          textValue: null,
        },
      ];

      const result = convertCustomFields(rawFields);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Priority');
      expect(result[1].name).toBe('Points');
    });
  });

  describe('getCustomFieldByName', () => {
    const fields: CustomFieldValue[] = [
      {
        gid: 'cf1',
        name: 'Priority',
        type: 'enum',
        value: 'High',
        displayValue: 'High',
      },
      {
        gid: 'cf2',
        name: 'Story Points',
        type: 'number',
        value: 5,
        displayValue: '5',
      },
    ];

    it('should find field by exact name', () => {
      const result = getCustomFieldByName(fields, 'Priority');
      expect(result?.name).toBe('Priority');
    });

    it('should find field case-insensitively', () => {
      const result = getCustomFieldByName(fields, 'priority');
      expect(result?.name).toBe('Priority');
    });

    it('should find field with different case', () => {
      const result = getCustomFieldByName(fields, 'STORY POINTS');
      expect(result?.name).toBe('Story Points');
    });

    it('should return null for non-existent field', () => {
      const result = getCustomFieldByName(fields, 'NonExistent');
      expect(result).toBeNull();
    });

    it('should handle empty fields array', () => {
      const result = getCustomFieldByName([], 'Priority');
      expect(result).toBeNull();
    });
  });

  describe('getCustomFieldValue', () => {
    const fields: CustomFieldValue[] = [
      {
        gid: 'cf1',
        name: 'Priority',
        type: 'enum',
        value: 'High',
        displayValue: 'High',
      },
      {
        gid: 'cf2',
        name: 'Points',
        type: 'number',
        value: 5,
        displayValue: '5',
      },
    ];

    it('should get field value', () => {
      const result = getCustomFieldValue(fields, 'Priority');
      expect(result).toBe('High');
    });

    it('should get number value', () => {
      const result = getCustomFieldValue(fields, 'Points');
      expect(result).toBe(5);
    });

    it('should return null for non-existent field', () => {
      const result = getCustomFieldValue(fields, 'NonExistent');
      expect(result).toBeNull();
    });
  });

  describe('getCustomFieldDisplayValue', () => {
    const fields: CustomFieldValue[] = [
      {
        gid: 'cf1',
        name: 'Priority',
        type: 'enum',
        value: 'High',
        displayValue: 'High Priority',
      },
    ];

    it('should get display value', () => {
      const result = getCustomFieldDisplayValue(fields, 'Priority');
      expect(result).toBe('High Priority');
    });

    it('should return empty string for non-existent field', () => {
      const result = getCustomFieldDisplayValue(fields, 'NonExistent');
      expect(result).toBe('');
    });
  });

  describe('customFieldsToMap', () => {
    it('should convert fields to map', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'High',
          displayValue: 'High',
        },
        {
          gid: 'cf2',
          name: 'Points',
          type: 'number',
          value: 5,
          displayValue: '5',
        },
      ];

      const result = customFieldsToMap(fields);

      expect(result).toBeInstanceOf(Map);
      expect(result.get('Priority')).toBe('High');
      expect(result.get('Points')).toBe(5);
      expect(result.size).toBe(2);
    });

    it('should handle empty fields', () => {
      const result = customFieldsToMap([]);
      expect(result.size).toBe(0);
    });
  });

  describe('customFieldsToObject', () => {
    it('should convert fields to object', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'High',
          displayValue: 'High',
        },
        {
          gid: 'cf2',
          name: 'Points',
          type: 'number',
          value: 5,
          displayValue: '5',
        },
      ];

      const result = customFieldsToObject(fields);

      expect(result).toEqual({
        Priority: 'High',
        Points: 5,
      });
    });

    it('should handle empty fields', () => {
      const result = customFieldsToObject([]);
      expect(result).toEqual({});
    });
  });

  describe('formatCustomFieldsAsMarkdown', () => {
    it('should format fields as markdown table', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'High',
          displayValue: 'High',
        },
        {
          gid: 'cf2',
          name: 'Points',
          type: 'number',
          value: 5,
          displayValue: '5',
        },
      ];

      const result = formatCustomFieldsAsMarkdown(fields);

      expect(result).toContain('| Field | Value |');
      expect(result).toContain('|-------|-------|');
      expect(result).toContain('| Priority | High |');
      expect(result).toContain('| Points | 5 |');
    });

    it('should handle empty fields', () => {
      const result = formatCustomFieldsAsMarkdown([]);
      expect(result).toBe('_No custom fields_');
    });

    it('should escape markdown characters', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Test|Field',
          type: 'text',
          value: 'Value with *stars* and [brackets]',
          displayValue: 'Value with *stars* and [brackets]',
        },
      ];

      const result = formatCustomFieldsAsMarkdown(fields);

      expect(result).toContain('\\|');
      expect(result).toContain('\\*');
      expect(result).toContain('\\[');
    });

    it('should handle fields with empty display value', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Empty',
          type: 'text',
          value: null,
          displayValue: '',
        },
      ];

      const result = formatCustomFieldsAsMarkdown(fields);

      expect(result).toContain('| Empty | \\- |');
    });
  });

  describe('isHighPriority', () => {
    it('should detect high priority', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'High',
          displayValue: 'High',
        },
      ];

      expect(isHighPriority(fields)).toBe(true);
    });

    it('should detect critical priority', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'Critical',
          displayValue: 'Critical',
        },
      ];

      expect(isHighPriority(fields)).toBe(true);
    });

    it('should detect urgent priority', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'Urgent',
          displayValue: 'Urgent',
        },
      ];

      expect(isHighPriority(fields)).toBe(true);
    });

    it('should detect P0 priority', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'P0',
          displayValue: 'P0',
        },
      ];

      expect(isHighPriority(fields)).toBe(true);
    });

    it('should detect P1 priority', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'P1',
          displayValue: 'P1',
        },
      ];

      expect(isHighPriority(fields)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'high',
          displayValue: 'high',
        },
      ];

      expect(isHighPriority(fields)).toBe(true);
    });

    it('should return false for low priority', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'Low',
          displayValue: 'Low',
        },
      ];

      expect(isHighPriority(fields)).toBe(false);
    });

    it('should return false when priority field missing', () => {
      const fields: CustomFieldValue[] = [];
      expect(isHighPriority(fields)).toBe(false);
    });

    it('should use custom field name', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Severity',
          type: 'enum',
          value: 'High',
          displayValue: 'High',
        },
      ];

      expect(isHighPriority(fields, 'Severity')).toBe(true);
    });

    it('should use custom high priority values', () => {
      const fields: CustomFieldValue[] = [
        {
          gid: 'cf1',
          name: 'Priority',
          type: 'enum',
          value: 'Blocker',
          displayValue: 'Blocker',
        },
      ];

      expect(isHighPriority(fields, 'Priority', ['Blocker', 'Showstopper'])).toBe(true);
    });
  });
});
