package com.word2anki.ai

import org.json.JSONObject

/**
 * Loads shared prompt templates from assets/prompts/ JSON files
 * and renders them with variable substitution.
 *
 * Mirrors the prompt loading logic in ankiconnect-server/src/services/ai.ts.
 */
class SharedPromptLoader(private val readAsset: (String) -> String) {

    private val variables: Variables by lazy {
        val json = JSONObject(readAsset("prompts/variables.json"))
        val translit = json.getJSONObject("transliteration")
        val instruction = translit.getJSONObject("instruction")
        val marker = translit.getJSONObject("marker")
        Variables(
            preamble = json.getString("preamble"),
            outputRules = json.getString("outputRules"),
            languageRules = json.getString("languageRules"),
            transliterationInstructionTrue = instruction.getString("true"),
            transliterationInstructionFalse = instruction.getString("false"),
            transliterationMarkerTrue = marker.getString("true"),
            transliterationMarkerFalse = marker.getString("false")
        )
    }

    private val templates: Map<String, PromptTemplate> by lazy {
        val names = listOf(
            "single-word", "focused-words", "relemmatize"
        )
        names.associateWith { name ->
            val json = JSONObject(readAsset("prompts/$name.json"))
            PromptTemplate(
                system = json.getString("system"),
                userTemplate = if (json.has("user_template")) json.getString("user_template") else null
            )
        }
    }

    private fun renderPrompt(template: String, transliteration: Boolean): String {
        val key = transliteration
        return template
            .replace("{{preamble}}", variables.preamble)
            .replace("{{outputRules}}", variables.outputRules)
            .replace("{{languageRules}}", variables.languageRules)
            .replace("{{transliterationInstruction}}",
                if (key) variables.transliterationInstructionTrue
                else variables.transliterationInstructionFalse)
            .replace("{{translitMarker}}",
                if (key) variables.transliterationMarkerTrue
                else variables.transliterationMarkerFalse)
    }

    /**
     * Get system prompts for the JSON-first card pipeline.
     */
    fun getSystemPrompts(transliteration: Boolean): SystemPrompts {
        return SystemPrompts(
            word = renderPrompt(templates.getValue("single-word").system, transliteration),
            focusedWords = renderPrompt(templates.getValue("focused-words").system, transliteration)
        )
    }

    /**
     * Get the relemmatize prompt with word/context substituted.
     */
    fun getRelemmatizePrompt(word: String, sentence: String? = null): String {
        val context = if (sentence != null) "\nContext sentence: $sentence" else ""
        return templates.getValue("relemmatize").system
            .replace("{{word}}", word)
            .replace("{{context}}", context)
    }

    /**
     * Get the single-word user template for building user messages.
     */
    fun getWordUserTemplate(word: String, userContext: String? = null): String {
        val template = templates.getValue("single-word").userTemplate
            ?: return word
        val contextStr = if (userContext != null) "\n\n(User note: $userContext)" else ""
        return template
            .replace("{{word}}", word)
            .replace("{{userContext}}", contextStr)
    }

    /**
     * Get the focused-words user template for building user messages.
     */
    fun getFocusedWordsUserTemplate(sentence: String, highlightedWords: String): String {
        val template = templates.getValue("focused-words").userTemplate
            ?: return "Sentence: $sentence\n\nFocus words: $highlightedWords"
        return template
            .replace("{{sentence}}", sentence)
            .replace("{{highlightedWords}}", highlightedWords)
    }
}

data class Variables(
    val preamble: String,
    val outputRules: String,
    val languageRules: String,
    val transliterationInstructionTrue: String,
    val transliterationInstructionFalse: String,
    val transliterationMarkerTrue: String,
    val transliterationMarkerFalse: String
)

data class PromptTemplate(
    val system: String,
    val userTemplate: String?
)

data class SystemPrompts(
    val word: String,
    val focusedWords: String
)
