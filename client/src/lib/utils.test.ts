import { describe, it, expect } from 'vitest';
import { markdownBoldToHtml, buildNoteFields } from './utils';

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

describe('buildNoteFields', () => {
  const card = {
    word: 'বাজার',
    definition: 'market',
    banglaDefinition: 'হাট',
    exampleSentence: 'আমি **বাজারে** যাচ্ছি।',
    sentenceTranslation: 'I am going to the market.',
  };

  it('maps all fields correctly', () => {
    const fields = buildNoteFields(card);
    expect(fields.Word).toBe('বাজার');
    expect(fields.Definition).toBe('market');
    expect(fields.BanglaDefinition).toBe('হাট');
    expect(fields.Example).toBe('আমি <b>বাজারে</b> যাচ্ছি।');
    expect(fields.Translation).toBe('I am going to the market.');
  });

  it('applies word and definition overrides', () => {
    const fields = buildNoteFields(card, { word: 'বাজারে', definition: 'in the market' });
    expect(fields.Word).toBe('বাজারে');
    expect(fields.Definition).toBe('in the market');
    expect(fields.BanglaDefinition).toBe('হাট');
  });

  it('converts bold markdown to HTML in Example field', () => {
    const fields = buildNoteFields(card);
    expect(fields.Example).toContain('<b>');
    expect(fields.Example).not.toContain('**');
  });
});
