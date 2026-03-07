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
            lemmaRules = json.getString("lemmaRules"),
            transliterationInstructionTrue = instruction.getString("true"),
            transliterationInstructionFalse = instruction.getString("false"),
            transliterationMarkerTrue = marker.getString("true"),
            transliterationMarkerFalse = marker.getString("false")
        )
    }

    private val templates: Map<String, PromptTemplate> by lazy {
        val names = listOf(
            "single-word", "sentence", "focused-words",
            "card-extraction", "define", "analyze", "relemmatize"
        )
        names.associateWith { name ->
            val json = JSONObject(readAsset("prompts/$name.json"))
            PromptTemplate(
                system = json.getString("system"),
                userTemplate = json.optString("user_template", null)
            )
        }
    }

    private fun renderPrompt(template: String, transliteration: Boolean): String {
        val key = transliteration
        return template
            .replace("{{transliterationInstruction}}",
                if (key) variables.transliterationInstructionTrue
                else variables.transliterationInstructionFalse)
            .replace("{{translitMarker}}",
                if (key) variables.transliterationMarkerTrue
                else variables.transliterationMarkerFalse)
            .replace("{{lemmaRules}}", variables.lemmaRules)
    }

    /**
     * Get all system prompts for conversation endpoints, with transliteration setting applied.
     */
    fun getSystemPrompts(transliteration: Boolean): SystemPrompts {
        return SystemPrompts(
            word = renderPrompt(templates.getValue("single-word").system, transliteration),
            sentence = renderPrompt(templates.getValue("sentence").system, transliteration),
            focusedWords = renderPrompt(templates.getValue("focused-words").system, transliteration),
            extractCard = renderPrompt(templates.getValue("card-extraction").system, transliteration),
            define = renderPrompt(templates.getValue("define").system, transliteration),
            analyze = renderPrompt(templates.getValue("analyze").system, transliteration)
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
    val lemmaRules: String,
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
    val sentence: String,
    val focusedWords: String,
    val extractCard: String,
    val define: String,
    val analyze: String
)
