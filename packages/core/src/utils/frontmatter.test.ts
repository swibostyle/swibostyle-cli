import { describe, test, expect } from 'bun:test';
import { readFrontmatter } from './frontmatter.js';

describe('readFrontmatter', () => {
  test('should parse basic frontmatter', async () => {
    const md = `---
title: Test Title
displayOrder: 5
---

# Content`;

    const fm = await readFrontmatter(md);
    expect(fm.title).toBe('Test Title');
    expect(fm.displayOrder).toBe(5);
  });

  test('should parse navigation flags', async () => {
    const md = `---
title: Chapter 1
isNavigationItem: true
isGuideItem: true
guideType: bodymatter
---

Content here`;

    const fm = await readFrontmatter(md);
    expect(fm.isNavigationItem).toBe(true);
    expect(fm.isGuideItem).toBe(true);
    expect(fm.guideType).toBe('bodymatter');
  });

  test('should parse build conditions', async () => {
    const md = `---
title: Print Only
includeIf: print
excludeIf: epub
---

Print content`;

    const fm = await readFrontmatter(md);
    expect(fm.includeIf).toBe('print');
    expect(fm.excludeIf).toBe('epub');
  });

  test('should parse viewport and class', async () => {
    const md = `---
title: Fixed Layout Page
viewport: width=1200, height=1600
htmlClass: fixed-layout horizontal
---

Content`;

    const fm = await readFrontmatter(md);
    expect(fm.viewport).toBe('width=1200, height=1600');
    expect(fm.htmlClass).toBe('fixed-layout horizontal');
  });

  test('should return empty object for no frontmatter', async () => {
    const md = `# Just a heading

No frontmatter here.`;

    const fm = await readFrontmatter(md);
    expect(fm).toEqual({});
  });

  test('should handle outputFileName', async () => {
    const md = `---
title: Custom Output
outputFileName: custom-name
---

Content`;

    const fm = await readFrontmatter(md);
    expect(fm.outputFileName).toBe('custom-name');
  });
});
