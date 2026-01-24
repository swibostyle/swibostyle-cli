import { describe, test, expect } from 'bun:test';
import type { ProjectOptions, TemplateType } from './types.js';

describe('ProjectOptions type', () => {
  test('should accept valid project options', () => {
    const options: ProjectOptions = {
      name: 'my-book',
      template: 'novel',
      lang: 'ja',
      pageDirection: 'rtl',
      writingMode: 'vertical-rl',
      packageManager: 'bun',
    };

    expect(options.name).toBe('my-book');
    expect(options.template).toBe('novel');
  });

  test('should accept all template types', () => {
    const templates: TemplateType[] = ['novel', 'manga', 'techbook', 'minimal'];

    for (const template of templates) {
      const options: ProjectOptions = {
        name: 'test',
        template,
        lang: 'en',
        pageDirection: 'ltr',
        writingMode: 'horizontal-tb',
        packageManager: 'npm',
      };
      expect(options.template).toBe(template);
    }
  });
});
