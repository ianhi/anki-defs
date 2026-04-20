// PDF parsing — structural extraction via pdfjs.
//
// Responsibilities:
//   - Load a PDF from a File object
//   - Extract a list of PdfSection (heading, page range, body snippet, font profile)
//   - Extract full text for a section on demand (for extract-time POST)
//
// Semantic classification of sections (contentType, tags, relatedTo) lives in
// the server scout prompt, not here.

import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import type { PdfChapter, PdfFontProfile, PdfSection } from '../../../shared/types';

// Point pdfjs at its bundled worker. Vite's `?url` import resolves to a URL
// the worker can be loaded from at runtime.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface LoadedPdf {
  doc: PDFDocumentProxy;
  numPages: number;
}

export async function loadPdf(file: File): Promise<LoadedPdf> {
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  return { doc, numPages: doc.numPages };
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
}

async function pageItems(page: PDFPageProxy): Promise<PositionedItem[]> {
  const content = await page.getTextContent();
  const items: PositionedItem[] = [];
  for (const raw of content.items) {
    const it = raw as TextItem;
    if (!('str' in it) || !it.str) continue;
    // transform = [a, b, c, d, e, f]; e = x, f = y; font size ≈ sqrt(a^2+b^2)
    const [a, b, , , e, f] = it.transform;
    items.push({
      str: it.str,
      x: e,
      y: f,
      fontSize: Math.hypot(a, b),
      fontName: it.fontName ?? '',
    });
  }
  return items;
}

// Group items by y-band into lines (preserves columns when combined with x-sort).
function itemsToLines(items: PositionedItem[]): Array<{
  y: number;
  items: PositionedItem[];
  text: string;
  medianFontSize: number;
}> {
  const sorted = [...items].sort((p, q) => q.y - p.y || p.x - q.x);
  const lines: Array<{ y: number; items: PositionedItem[] }> = [];
  const Y_TOLERANCE = 2; // pts
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Y_TOLERANCE) {
      last.items.push(it);
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  return lines.map((l) => {
    const sortedX = [...l.items].sort((p, q) => p.x - q.x);
    const sizes = sortedX.map((i) => i.fontSize).sort((a, b) => a - b);
    return {
      y: l.y,
      items: sortedX,
      text: sortedX
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      medianFontSize: sizes[Math.floor(sizes.length / 2)] ?? 0,
    };
  });
}

// Detect header/footer lines that recur at the same y on many pages — drop them.
function findRunningHeaderFooterTexts(
  pages: PageData[],
  pageHeight: number
): Set<string> {
  const topCounts = new Map<string, number>();
  const bottomCounts = new Map<string, number>();
  for (const page of pages) {
    for (const line of page.lines) {
      const key = line.text.trim();
      if (!key || key.length < 3) continue;
      if (line.y > pageHeight * 0.9) {
        topCounts.set(key, (topCounts.get(key) ?? 0) + 1);
      } else if (line.y < pageHeight * 0.1) {
        bottomCounts.set(key, (bottomCounts.get(key) ?? 0) + 1);
      }
    }
  }
  const drop = new Set<string>();
  const threshold = Math.max(3, Math.floor(pages.length * 0.3));
  for (const [k, c] of topCounts) if (c >= threshold) drop.add(k);
  for (const [k, c] of bottomCounts) if (c >= threshold) drop.add(k);
  return drop;
}

// Text preprocessing applied to every line before we use it.
export function normalizeLine(s: string): string {
  return (
    s
      // soft hyphen at end of line → rejoin (drop the soft hyphen)
      .replace(/\u00AD/g, '')
      // collapse `1.\t` / `1)\t` list markers to `1. `
      .replace(/^(\d+)[.)]\s*\t\s*/, '$1. ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

interface PageData {
  pageIndex: number; // 0-based
  lines: Array<{ y: number; text: string; medianFontSize: number }>;
  pageHeight: number;
}

async function collectPages(doc: PDFDocumentProxy): Promise<PageData[]> {
  // pdfjs runs pages through a worker, so concurrent requests are cheap.
  return Promise.all(
    Array.from({ length: doc.numPages }, async (_, i) => {
      const page = await doc.getPage(i + 1);
      const items = await pageItems(page);
      const viewport = page.getViewport({ scale: 1 });
      const rawLines = itemsToLines(items);
      return {
        pageIndex: i,
        lines: rawLines.map((l) => ({ y: l.y, text: l.text, medianFontSize: l.medianFontSize })),
        pageHeight: viewport.height,
      };
    })
  );
}

// Heading heuristic: a line is a heading if its font size is notably larger
// than the body median on the page and its length is short.
function isHeading(
  line: { text: string; medianFontSize: number },
  bodyMedianFontSize: number
): boolean {
  if (!line.text) return false;
  if (line.text.length > 120) return false;
  return line.medianFontSize >= bodyMedianFontSize * 1.15;
}

function pageBodyMedianFontSize(lines: PageData['lines']): number {
  const sizes = lines
    .map((l) => l.medianFontSize)
    .filter((s) => s > 0)
    .sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)] ?? 10;
}

// Tree node from pdfjs outline, with resolved page index.
interface OutlineNode {
  title: string;
  pageIndex: number; // 0-based
  children: OutlineNode[];
}

async function embeddedOutlineTree(doc: PDFDocumentProxy): Promise<OutlineNode[]> {
  const outline = await doc.getOutline();
  if (!outline) return [];
  async function resolve(
    nodes: NonNullable<typeof outline>,
  ): Promise<OutlineNode[]> {
    const result: OutlineNode[] = [];
    for (const node of nodes) {
      try {
        const dest =
          typeof node.dest === 'string' ? await doc.getDestination(node.dest) : node.dest;
        if (dest && Array.isArray(dest) && dest[0]) {
          const pageIndex = await doc.getPageIndex(dest[0]);
          const children = node.items?.length ? await resolve(node.items) : [];
          result.push({ title: node.title.trim(), pageIndex, children });
        }
      } catch {
        // unresolvable dest — skip
      }
    }
    return result;
  }
  return resolve(outline);
}

type RawSection = { id: string; heading: string; pageStart: number; pageEnd: number };

// Flatten a tree node and all descendants into sections. Returns the list and
// the global counter so IDs are unique across the whole outline.
function flattenNode(
  node: OutlineNode,
  nextSiblingPage: number, // 1-indexed page of the next sibling (or last page + 1)
  counter: { n: number },
): RawSection[] {
  const sections: RawSection[] = [];
  const allNodes: Array<{ node: OutlineNode; nextPage: number }> = [];

  // Collect this node's children with their "next" boundaries
  if (node.children.length > 0) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const nextChild = node.children[i + 1];
      const nextPage = nextChild ? nextChild.pageIndex + 1 : nextSiblingPage;
      allNodes.push({ node: child, nextPage });
    }
  }

  // If no children, this node is itself a leaf section
  if (allNodes.length === 0) {
    const pageStart = node.pageIndex + 1;
    sections.push({
      id: `s${counter.n++}`,
      heading: node.title,
      pageStart,
      pageEnd: Math.max(pageStart, nextSiblingPage - 1),
    });
  } else {
    // Recurse into children
    for (const { node: child, nextPage } of allNodes) {
      sections.push(...flattenNode(child, nextPage, counter));
    }
  }
  return sections;
}

// Build sections + chapters from embedded bookmarks (tree-aware).
// "Chapters" are the meaningful grouping level the user picks from.
// Strategy: top-level nodes that have children become chapters; their
// descendants become sections. Top-level leaves become single-section chapters.
function sectionsAndChaptersFromBookmarks(
  tree: OutlineNode[],
  numPages: number,
): { sections: RawSection[]; chapters: PdfChapter[] } {
  const sections: RawSection[] = [];
  const chapters: PdfChapter[] = [];
  const counter = { n: 0 };

  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]!;
    const nextNode = tree[i + 1];
    const nextSiblingPage = nextNode ? nextNode.pageIndex + 1 : numPages + 1;

    const chapterSections = flattenNode(node, nextSiblingPage, counter);
    sections.push(...chapterSections);

    const pageStart = node.pageIndex + 1;
    chapters.push({
      id: `ch${i}`,
      title: node.title,
      pageStart,
      pageEnd: Math.max(pageStart, nextSiblingPage - 1),
      sectionIds: chapterSections.map((s) => s.id),
    });
  }
  return { sections, chapters };
}

// For heading-heuristic PDFs (no bookmarks), each heading becomes both a
// section and a chapter — no tree structure to leverage.
function sectionsAndChaptersFromHeadings(
  pages: PageData[],
  drop: Set<string>,
): { sections: RawSection[]; chapters: PdfChapter[] } {
  type Seed = { heading: string; pageIndex: number };
  const seeds: Seed[] = [];
  for (const page of pages) {
    const bodyMedian = pageBodyMedianFontSize(page.lines);
    for (const line of page.lines) {
      const text = normalizeLine(line.text);
      if (drop.has(text)) continue;
      if (isHeading({ text, medianFontSize: line.medianFontSize }, bodyMedian)) {
        seeds.push({ heading: text, pageIndex: page.pageIndex });
      }
    }
  }
  const filtered: Seed[] = [];
  for (const s of seeds) {
    const prev = filtered[filtered.length - 1];
    if (!prev || prev.heading !== s.heading) filtered.push(s);
  }
  const sections: RawSection[] = filtered.map((s, i) => {
    const next = filtered[i + 1];
    const pageEnd = next ? Math.max(s.pageIndex, next.pageIndex - 1) : pages.length - 1;
    return {
      id: `h${i}`,
      heading: s.heading,
      pageStart: s.pageIndex + 1,
      pageEnd: pageEnd + 1,
    };
  });
  const chapters: PdfChapter[] = sections.map((s) => ({
    id: `c${s.id}`,
    title: s.heading,
    pageStart: s.pageStart,
    pageEnd: s.pageEnd,
    sectionIds: [s.id],
  }));
  return { sections, chapters };
}

function sectionText(
  pages: PageData[],
  pageStart1: number,
  pageEnd1: number,
  drop: Set<string>,
  options: { limitLines?: number } = {}
): string {
  const out: string[] = [];
  for (let p = pageStart1 - 1; p <= pageEnd1 - 1 && p < pages.length; p++) {
    const page = pages[p]!;
    for (const line of page.lines) {
      const text = normalizeLine(line.text);
      if (!text) continue;
      if (drop.has(text)) continue;
      out.push(text);
      if (options.limitLines && out.length >= options.limitLines) return out.join('\n');
    }
  }
  return out.join('\n');
}

function fontProfileFor(pages: PageData[], pageStart1: number, pageEnd1: number): PdfFontProfile {
  const sizes: number[] = [];
  for (let p = pageStart1 - 1; p <= pageEnd1 - 1 && p < pages.length; p++) {
    const page = pages[p]!;
    for (const line of page.lines) if (line.medianFontSize > 0) sizes.push(line.medianFontSize);
  }
  sizes.sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] ?? 10;
  // Column detection: not trivial without x-coord replay; mark 1 by default.
  // A follow-up pass could cluster x-coords; skipped for first cut.
  return { sizePt: Math.round(median * 10) / 10, bold: false, indentPt: 0, columns: 1 };
}

export interface ExtractedOutline {
  sections: PdfSection[];
  chapters: PdfChapter[];
  pages: PageData[];
  dropLines: Set<string>;
}

export async function extractOutline(loaded: LoadedPdf): Promise<ExtractedOutline> {
  const pages = await collectPages(loaded.doc);
  const pageHeight = pages[0]?.pageHeight ?? 792;
  const drop = findRunningHeaderFooterTexts(pages, pageHeight);

  const tree = await embeddedOutlineTree(loaded.doc);
  const { sections: raw, chapters } = tree.length
    ? sectionsAndChaptersFromBookmarks(tree, pages.length)
    : sectionsAndChaptersFromHeadings(pages, drop);

  const sections: PdfSection[] = raw.map((r) => ({
    id: r.id,
    heading: r.heading,
    pageStart: r.pageStart,
    pageEnd: r.pageEnd,
    bodySnippet: sectionText(pages, r.pageStart, r.pageEnd, drop, { limitLines: 10 }),
    fontProfile: fontProfileFor(pages, r.pageStart, r.pageEnd),
  }));

  return { sections, chapters, pages, dropLines: drop };
}

// Full text for a section — used at extract time.
export function getSectionText(outline: ExtractedOutline, sectionId: string): string {
  const section = outline.sections.find((s) => s.id === sectionId);
  if (!section) return '';
  return sectionText(outline.pages, section.pageStart, section.pageEnd, outline.dropLines);
}
