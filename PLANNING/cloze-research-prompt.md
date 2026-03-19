# Cloze Deletion Research

## Status: RESEARCH COMPLETE — findings incorporated into plan

The deep research prompt below was used; findings are summarized in the plan.
Key papers: Barcroft 2004 (TOPRA), Mondria 1991 (context paradox), Rodriguez 2005
(3 options optimal), Bitew 2023 (~50% AI distractor usability), Karpicke & Roediger
2008 (testing effect). See the plan file for the full synthesis.

## Original Research Prompt

Give this to a deep research agent (Claude with web search, Gemini Deep Research, Perplexity, etc.)

---

I'm building an AI-powered Anki flashcard generator for language learning (primarily South Asian languages like Bangla, but designed to be language-agnostic). The app currently generates vocabulary cards (word + definition + example sentence + translation). I want to add two types of cloze deletion cards:

1. **Open cloze** — sentence with a word deleted, user must recall it
2. **Multiple choice cloze** — sentence with a word deleted, user picks from 4 options

## What I need researched

### 1. Optimal cloze deletion patterns for L2 vocabulary acquisition

- What does SLA (Second Language Acquisition) research say about cloze testing effectiveness compared to definition recall cards?
- How should cloze items be constructed to maximize retention?
- Are there studies comparing sentence-context cloze vs. isolated word recall?
- What makes a BAD cloze item? (e.g. answer inferable from grammar/syntax alone)
- Should the deleted word be the dictionary form (lemma) or the inflected form as it appears in the sentence?

### 2. Multiple choice cloze design — distractor quality is critical

The key challenge is generating distractors (wrong answers) that are:

- **Plausible** — they could fit grammatically or semantically in some context
- **Clearly wrong** — in THIS specific sentence context, only the correct answer works

Good distractor patterns for language learning:

- **Wrong word, right form**: A different word conjugated/declined the same way as the correct answer (tests vocabulary, not grammar)
- **Right word, wrong form**: The correct verb/noun but with wrong conjugation/declension/case (tests grammar)
- **Mixed**: Two different verbs, each shown in two different conjugations — one correct combination, three wrong
- **Semantic near-misses**: Words from the same category but wrong meaning (e.g. for "market" → "shop", "road", "house")

Research questions:

- What makes an effective distractor in language learning MC items?
- Optimal number of choices (3 vs 4 vs 5)?
- Should distractors be consistent in type (all verbs, all nouns) or mixed?
- Any research on AI-generated distractors vs human-created ones?
- How to avoid distractors that are accidentally also correct?

### 3. AI/LLM prompt patterns for generating cloze items

Find any existing prompts, papers, or tools that use LLMs to:

- Generate contextually appropriate example sentences for cloze
- Select which word to delete (not always the most obvious one)
- Generate plausible-but-wrong distractors
- Avoid cloze items where the answer is trivially inferable
- Handle morphologically rich languages (where a word has many forms)

### 4. Anki note type design

- What note type field structures work best for cloze + MC?
- How do existing Anki addons handle this? (Flexible Cloze, Enhanced Cloze, anki-mc, Multiple Choice Note Type)
- Best way to store MC choices in Anki fields?
- Can a single note type support both open cloze and MC cloze?

### 5. Progressive difficulty

- Is there research on starting with MC-cloze (recognition) and graduating to open cloze (recall) as the learner improves?
- How would this work with Anki's scheduling algorithm?
- Any Anki addons that support this progression?

## Context about the app

- Uses Gemini/Claude/OpenRouter API to generate card content
- Currently generates: word, English definition, target language definition, example sentence (with the word bolded), sentence translation
- The example sentence already contains the target word marked with **bold** — this naturally maps to a cloze deletion
- Cards are added to Anki via AnkiConnect API or directly via an Anki addon
- The user already has two cloze note types in Anki (basic cloze and MC cloze)
