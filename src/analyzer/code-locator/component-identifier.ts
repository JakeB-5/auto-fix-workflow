/**
 * @module analyzer/code-locator/component-identifier
 * @description Component and label identification from file paths
 */

import path from 'node:path';

/**
 * Identify component from file path
 *
 * @param filePath - File path
 * @returns Component name/identifier
 */
export function identifyComponent(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  // Remove filename
  parts.pop();

  // Find component boundaries
  const srcIndex = parts.findIndex(p => p === 'src' || p === 'lib');
  if (srcIndex !== -1 && parts.length > srcIndex + 1) {
    // Return first directory after src/lib
    return parts[srcIndex + 1] ?? 'unknown';
  }

  // If no src/lib, use parent directory
  if (parts.length > 0) {
    return parts[parts.length - 1] ?? 'unknown';
  }

  return 'unknown';
}

/**
 * Identify multiple components from file paths
 *
 * @param filePaths - Array of file paths
 * @returns Array of unique component names
 */
export function identifyComponents(filePaths: string[]): string[] {
  const components = new Set<string>();

  for (const filePath of filePaths) {
    const component = identifyComponent(filePath);
    components.add(component);
  }

  return Array.from(components).sort();
}

/**
 * Infer labels from components
 *
 * @param components - Array of component names
 * @returns Array of suggested labels
 */
export function inferLabels(components: string[]): string[] {
  const labels = new Set<string>();

  for (const component of components) {
    // Add component as label
    labels.add(component);

    // Add category labels based on common patterns
    const categoryLabels = categorizComponent(component);
    categoryLabels.forEach(label => labels.add(label));
  }

  return Array.from(labels).sort();
}

/**
 * Categorize component into labels
 *
 * @param component - Component name
 * @returns Array of category labels
 */
function categorizComponent(component: string): string[] {
  const labels: string[] = [];
  const lower = component.toLowerCase();

  // Frontend/UI labels
  if (/^(ui|components?|views?|pages?)$/.test(lower)) {
    labels.push('frontend', 'ui');
  }

  // Backend/API labels
  if (/^(api|controllers?|routes?|handlers?)$/.test(lower)) {
    labels.push('backend', 'api');
  }

  // Database labels
  if (/^(db|database|models?|entities|repositories)$/.test(lower)) {
    labels.push('database', 'backend');
  }

  // Authentication/Security
  if (/^(auth|authentication|security|permissions?)$/.test(lower)) {
    labels.push('security', 'auth');
  }

  // Testing
  if (/^(tests?|testing|spec|e2e|integration)$/.test(lower)) {
    labels.push('testing');
  }

  // Documentation
  if (/^(docs?|documentation)$/.test(lower)) {
    labels.push('documentation');
  }

  // Configuration
  if (/^(config|configuration|settings?)$/.test(lower)) {
    labels.push('config');
  }

  // Utilities
  if (/^(utils?|utilities|helpers?|common)$/.test(lower)) {
    labels.push('utilities');
  }

  // Services
  if (/^(services?|providers?)$/.test(lower)) {
    labels.push('services', 'backend');
  }

  // CLI/Commands
  if (/^(cli|commands?|scripts?)$/.test(lower)) {
    labels.push('cli');
  }

  return labels;
}

/**
 * Infer labels from file paths
 *
 * @param filePaths - Array of file paths
 * @returns Array of suggested labels
 */
export function inferLabelsFromPaths(filePaths: string[]): string[] {
  const labels = new Set<string>();

  for (const filePath of filePaths) {
    const fileLabels = inferLabelsFromPath(filePath);
    fileLabels.forEach(label => labels.add(label));
  }

  return Array.from(labels).sort();
}

/**
 * Infer labels from a single file path
 *
 * @param filePath - File path
 * @returns Array of labels
 */
function inferLabelsFromPath(filePath: string): string[] {
  const labels: string[] = [];
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath, ext).toLowerCase();

  // Language-specific labels
  if (['.ts', '.tsx'].includes(ext)) {
    labels.push('typescript');
  } else if (['.js', '.jsx'].includes(ext)) {
    labels.push('javascript');
  } else if (ext === '.py') {
    labels.push('python');
  } else if (ext === '.java') {
    labels.push('java');
  } else if (ext === '.go') {
    labels.push('golang');
  }

  // Framework-specific labels
  if (normalized.includes('/react/') || fileName.includes('react')) {
    labels.push('react');
  }
  if (normalized.includes('/vue/') || fileName.includes('vue')) {
    labels.push('vue');
  }
  if (normalized.includes('/angular/') || fileName.includes('angular')) {
    labels.push('angular');
  }

  // Test files
  if (fileName.includes('test') || fileName.includes('spec')) {
    labels.push('tests');
  }

  // Configuration files
  if (fileName.includes('config') || fileName.includes('settings')) {
    labels.push('config');
  }

  return labels;
}

/**
 * Get primary component (most likely main component)
 *
 * @param components - Array of components
 * @returns Primary component name
 */
export function getPrimaryComponent(components: string[]): string | undefined {
  if (components.length === 0) {
    return undefined;
  }

  // Priority order for primary component
  const priorities = [
    'api',
    'auth',
    'database',
    'services',
    'controllers',
    'models',
    'components',
    'ui',
    'utils',
  ];

  for (const priority of priorities) {
    const match = components.find(c => c.toLowerCase() === priority);
    if (match) {
      return match;
    }
  }

  // Return first component if no priority match
  return components[0];
}
