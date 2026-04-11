import { describe, it, expect } from 'vitest';
import { markdownBoldToHtml, sentenceToCloze } from './utils';

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

describe('sentenceToCloze', () => {
  it('wraps bold markers in cloze syntax', () => {
    const { text, count } = sentenceToCloze('I am **going** to the **market**.');
    expect(text).toBe('I am {{c1::going}} to the {{c2::market}}.');
    expect(count).toBe(2);
  });

  it('returns text unchanged when there are no markers', () => {
    const { text, count } = sentenceToCloze('plain text');
    expect(text).toBe('plain text');
    expect(count).toBe(0);
  });
});
