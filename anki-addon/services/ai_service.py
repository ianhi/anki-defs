"""AI provider abstraction -- delegates to Claude, Gemini, or OpenRouter.

Uses urllib.request for HTTP calls. All streaming is done via chunked reads
in a daemon thread (see chat_routes.py).
"""

from . import claude_provider, gemini_provider, openrouter_provider
from .settings_service import get_settings


def get_provider_module():
    """Get the provider module based on current settings."""
    settings = get_settings()
    provider = settings.get("aiProvider", "claude")
    if provider == "claude":
        return claude_provider
    elif provider == "openrouter":
        return openrouter_provider
    else:
        return gemini_provider


def stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error):
    """Stream a completion. Callbacks: on_text(str), on_usage(dict), on_done(), on_error(str).

    This is called from a daemon thread for SSE streaming.
    """
    provider = get_provider_module()
    provider.stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error)


def get_completion(system_prompt, user_message):
    """Get a non-streaming completion. Returns the response text."""
    provider = get_provider_module()
    return provider.get_completion(system_prompt, user_message)


def get_system_prompts(transliteration):
    """Generate system prompts. Mirrors server/src/services/ai.ts getSystemPrompts."""
    translit = " ([transliteration])" if transliteration else ""
    translit_instr = (
        " Include romanized transliteration in parentheses after each Bangla word."
        if transliteration
        else " Do NOT include romanized transliteration/pronunciation."
    )

    lemma_rules = """
Bangla Lemmatization Rules (ALWAYS apply):
- Nouns: Remove case endings. \u09ac\u09be\u099c\u09be\u09b0\u09c7\u2192\u09ac\u09be\u099c\u09be\u09b0 (locative -\u098f/-\u09a4\u09c7), \u09ac\u09be\u099c\u09be\u09b0\u09c7\u09b0\u2192\u09ac\u09be\u099c\u09be\u09b0 (genitive -\u09b0/-\u098f\u09b0), \u09ac\u09be\u099c\u09be\u09b0\u0995\u09c7\u2192\u09ac\u09be\u099c\u09be\u09b0 (accusative/dative -\u0995\u09c7)
- Verbs: Convert to verbal noun (dictionary form), NOT infinitive -\u09a4\u09c7. \u0995\u09be\u0981\u09a6\u09a4\u09c7\u2192\u0995\u09be\u0981\u09a6\u09be, \u09af\u09be\u09ac\u2192\u09af\u09be\u0993\u09af\u09bc\u09be, \u0996\u09be\u099a\u09cd\u099b\u09bf\u2192\u0996\u09be\u0993\u09af\u09bc\u09be, \u0995\u09b0\u09c7\u099b\u09bf\u09b2\u2192\u0995\u09b0\u09be, \u0997\u09c7\u099b\u09c7\u2192\u09af\u09be\u0993\u09af\u09bc\u09be, \u0995\u09c7\u0981\u09aa\u09c7\u2192\u0995\u09be\u0981\u09aa\u09be
- Adjectives: Use base form. \u09ac\u09dc\u09cb\u2192\u09ac\u09dc

Spelling tolerance: Accept common confusions (\u09ac/\u09f0, \u09a3/\u09a8, \u09b6/\u09b7/\u09b8, missing/extra chandrabindu \u0981) and silently correct them."""

    return {
        "word": 'You are a Bangla language tutor. Define the word directly and concisely.{translit_instr}\n\n{lemma_rules}\n\nFormat:\n**[lemmatized dictionary form]**{translit} \u2014 [English meaning]\n\n*[part of speech]*\n\n**Examples:**\n1. [Bangla sentence using the word naturally] \u2014 [English translation]\n2. [Bangla sentence using the word naturally] \u2014 [English translation]\n\n**Notes:** [Brief usage notes, grammar, or cultural context if relevant]\n\nIf the word is derived from a useful root word, mention it: "From root: [root] \u2014 [meaning]"\n\nRules:\n- Be direct. No preamble like "Let\'s break down..." or "Absolutely!". Start with the word itself.\n- Definition: just the meaning, no grammar labels in parentheses. "to cry, to weep" not "to cry (verb, intransitive)"\n- Example sentences must be REAL sentences, not definitions or glosses.\n- Keep example sentences short (5-8 words) using common vocabulary.\n- For sentence translations, pick one natural translation. No he/she slashes.'.format(
            translit_instr=translit_instr, lemma_rules=lemma_rules, translit=translit
        ),
        "sentence": "You are a Bangla language tutor. Analyze the sentence with focus on morphology.{translit_instr}\n\n{lemma_rules}\n\nFormat:\n**Translation:** [one natural English translation \u2014 no he/she slashes, just pick one]\n\n**Word-by-word:**\n- **[word as it appears]**{translit} \u2014 [meaning]. From **[lemma/dictionary form]**. [Explain any suffixes, conjugations, or how it relates to other words.]\n[continue for each word]\n\nAt the end, list vocabulary worth learning as LEMMATIZED dictionary forms (not the inflected forms from the sentence):\n**Vocabulary:** [comma-separated list of lemmatized dictionary forms]\n\nSkip common particles that don't need learning.\n\nBe direct. No preamble. Focus on the specific morphology of each word.".format(
            translit_instr=translit_instr, lemma_rules=lemma_rules, translit=translit
        ),
        "focusedWords": "You are a Bangla language tutor. The user has pasted a sentence and highlighted specific words they want to learn.{translit_instr}\n\n{lemma_rules}\n\nFormat your response as:\n\n**Sentence Translation:** [one natural English translation \u2014 no he/she slashes]\n\nThen for EACH highlighted word, give the LEMMATIZED dictionary form as the heading:\n\n---\n**[lemma/dictionary form]**{translit} \u2014 [meaning, no grammar labels in parens]\n\n*[part of speech]*\n\nIn this sentence: [the inflected form used and why]\n\n**Example:** [one additional REAL example sentence, 5-8 words] \u2014 [translation]\n\n---\n\nBe direct. No preamble. Focus on the highlighted words in the context of the given sentence.".format(
            translit_instr=translit_instr, lemma_rules=lemma_rules, translit=translit
        ),
        "extractCard": 'Extract flashcard data from the conversation. Return ONLY valid JSON with this exact structure:\n{{\n  "word": "the Bangla word in LEMMATIZED dictionary form",\n  "definition": "concise English definition",\n  "exampleSentence": "one good example sentence in Bangla",\n  "sentenceTranslation": "English translation of the example"\n}}\n\n{lemma_rules}\n\nCard quality rules:\n- "word": MUST be lemmatized dictionary form.\n- "definition": Just the meaning, concise (under 10 words).\n- "exampleSentence": Must be a REAL Bangla sentence, NOT a definition or gloss. Keep it short (5-8 words).\n- "sentenceTranslation": One natural English translation. Pick one pronoun.'.format(
            lemma_rules=lemma_rules
        ),
        "define": 'You are a Bangla language expert. When given a Bangla word, return ONLY valid JSON:\n{{\n  "word": "the original word",\n  "lemma": "dictionary form if different",\n  "partOfSpeech": "noun/verb/adjective/etc",\n  "definition": "English definition \u2014 just the meaning, no grammar labels",\n  "examples": [\n    {{ "bangla": "real example sentence", "english": "translation" }}\n  ],\n  "notes": "any additional usage notes"\n}}\n\n{lemma_rules}\n\nExample sentences must be real sentences using the word naturally.\nFor translations, pick one natural rendering.'.format(
            lemma_rules=lemma_rules
        ),
        "analyze": 'You are a Bangla language expert. Analyze the given Bangla sentence and return ONLY valid JSON:\n{{\n  "translation": "English translation of the full sentence",\n  "words": [\n    {{\n      "word": "word as it appears in sentence",\n      "lemma": "dictionary form (lemmatized)",\n      "partOfSpeech": "noun/verb/etc",\n      "meaning": "English meaning"\n    }}\n  ],\n  "grammar": "any notable grammatical patterns"\n}}\n\n{lemma_rules}'.format(
            lemma_rules=lemma_rules
        ),
    }
