import { describe, it, expect } from 'vitest';
import { markdownBoldToHtml } from './utils';

describe('markdownBoldToHtml', () => {
  it('converts single bold marker to HTML', () => {
    expect(markdownBoldToHtml('hello **world** there')).toBe('hello <b>world</b> there');
  });

  it('converts multiple bold markers to HTML', () => {
    expect(markdownBoldToHtml('**a** and **b**')).toBe('<b>a</b> and <b>b</b>');
  });

  it('returns plain text when no bold markers', () => {
    expect(markdownBoldToHtml('hello world')).toBe('hello world');
  });

  it('escapes HTML in non-bold parts', () => {
    expect(markdownBoldToHtml('<script> **word**')).toBe('&lt;script&gt; <b>word</b>');
  });

  it('works with Bangla text', () => {
    expect(markdownBoldToHtml('মেয়েটা **কাঁদছে**।')).toBe('মেয়েটা <b>কাঁদছে</b>।');
  });
});
