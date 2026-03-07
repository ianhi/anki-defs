# Prompt Design: Language-Specific Rules

## Current State
word2anki has a generic prompt in `PromptTemplates.getUnifiedSystemPrompt()` that says "You are a language tutor" with basic formatting guidelines. No language-specific rules.

## Inspiration: anki-defs Prompt Quality
anki-defs has extensive Bangla-specific rules that dramatically improve card quality:

### Bangla Rules to Port
1. **Lemmatization rules**:
   - Nouns: Remove case endings (e.g. bajaare → bajaar)
   - Verbs: Convert to verbal noun, NOT infinitive (e.g. kaadte → kaada, jaabo → jaowa)
   - Adjectives: Base form (e.g. boro → bor)

2. **Spelling tolerance**: Accept common confusions (bo/ro, No/no, sho/Sho/so, chandrabindu)

3. **Example sentence quality**:
   - Must be real sentences, not definitions
   - Short (5-8 words), using common vocabulary
   - Natural pronoun choice (no "he/she" slashes)

4. **Definition quality**:
   - Concise: 2-5 words ideal for flashcards
   - No grammar labels in parentheses

5. **Transliteration**: Optional romanized pronunciation in parentheses after Bangla words

6. **Root words**: Mention useful root word derivations when relevant

## New Prompt Structure

### Base System Prompt (all languages)
Generic language tutor instructions + formatting rules (similar to current).

### Language-Specific Addendum
Appended when targetLanguage is set. Initially only Bangla has specific rules; other languages get generic rules.

### Transliteration Instruction
Conditional block added when `showTransliteration = true`.

## Implementation: PromptTemplates.kt Changes

```kotlin
fun getUnifiedSystemPrompt(
    targetLanguage: String = "Bangla",
    showTransliteration: Boolean = false
): String {
    val base = """
You are a vocabulary tutor helping users learn $targetLanguage.
...base instructions...
    """

    val langRules = getLanguageRules(targetLanguage)
    val transliteration = if (showTransliteration) {
        "Include romanized transliteration in parentheses after $targetLanguage words."
    } else ""

    return "$base\n$langRules\n$transliteration".trimIndent()
}

private fun getLanguageRules(language: String): String = when (language) {
    "Bangla" -> BANGLA_RULES
    else -> ""  // Other languages use generic rules for now
}
```

## Card Extraction Prompt Update
The extraction prompt should also be language-aware:
- Word field = target language word (lemmatized)
- Definition field = English definition
- Example = target language sentence
- Translation = English translation

## Note Model Field Names
Current: English, Bangla, ExampleSentence, SentenceTranslation
These are Bangla-specific. For now we keep these field names (the model is called "word2anki") but the prompts should produce content appropriate for any target language.

Future consideration: Create language-specific models or rename fields generically (Word, Definition, Example, Translation).
