package com.word2anki.ai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class CardExtractorTest {

    @Test
    fun `parseCardJson extracts valid JSON`() {
        val json = """
            {
                "word": "hello",
                "definition": "a greeting",
                "exampleSentence": "Hello, world!",
                "sentenceTranslation": "A common greeting"
            }
        """.trimIndent()

        val card = CardExtractor.parseCardJson(json)

        assertNotNull(card)
        assertEquals("hello", card?.word)
        assertEquals("a greeting", card?.definition)
        assertEquals("Hello, world!", card?.exampleSentence)
        assertEquals("A common greeting", card?.sentenceTranslation)
    }

    @Test
    fun `parseCardJson handles JSON with markdown code blocks`() {
        val json = """
            ```json
            {
                "word": "test",
                "definition": "an examination",
                "exampleSentence": "This is a test.",
                "sentenceTranslation": "An example sentence"
            }
            ```
        """.trimIndent()

        val card = CardExtractor.parseCardJson(json)

        assertNotNull(card)
        assertEquals("test", card?.word)
        assertEquals("an examination", card?.definition)
    }

    @Test
    fun `parseCardJson returns null for invalid JSON`() {
        val invalidJson = "not valid json"

        val card = CardExtractor.parseCardJson(invalidJson)

        assertNull(card)
    }

    @Test
    fun `parseCardJson handles missing fields`() {
        val json = """
            {
                "word": "partial"
            }
        """.trimIndent()

        val card = CardExtractor.parseCardJson(json)

        assertNotNull(card)
        assertEquals("partial", card?.word)
        assertEquals("", card?.definition)
        assertEquals("", card?.exampleSentence)
    }

    @Test
    fun `extractFromResponse extracts word and definition from formatted response`() {
        val userInput = "hello"
        val aiResponse = """
            **hello** (hel-oh) - a greeting used when meeting someone

            *noun*

            **Examples:**
            1. Hello, how are you? — A common greeting
            2. She said hello to everyone. — Another example

            **Notes:** Informal greeting
        """.trimIndent()

        val card = CardExtractor.extractFromResponse(userInput, aiResponse)

        assertNotNull(card)
        assertEquals("hello", card?.word)
        assertEquals("a greeting used when meeting someone", card?.definition)
    }

    @Test
    fun `extractFromResponse extracts example sentence`() {
        val userInput = "test"
        val aiResponse = """
            **test** - an examination

            **Examples:**
            1. This is a test sentence. — Translation here
        """.trimIndent()

        val card = CardExtractor.extractFromResponse(userInput, aiResponse)

        assertNotNull(card)
        assertEquals("This is a test sentence.", card?.exampleSentence)
        assertEquals("Translation here", card?.sentenceTranslation)
    }

    @Test
    fun `extractFromResponse returns null for unstructured response`() {
        val userInput = "test"
        val aiResponse = "Some unstructured text without proper formatting"

        val card = CardExtractor.extractFromResponse(userInput, aiResponse)

        // Unstructured text has no "word - definition" pattern, so extraction returns null
        assertNull(card)
    }

    @Test
    fun `extractFromResponse handles bullet points with dash`() {
        val userInput = "word"
        val aiResponse = """
            **word** - a unit of language

            **Examples:**
            - Example sentence here — Translation of example
        """.trimIndent()

        val card = CardExtractor.extractFromResponse(userInput, aiResponse)

        assertNotNull(card)
        assertEquals("Example sentence here", card?.exampleSentence)
    }

    @Test
    fun `buildExtractionPrompt includes user input and AI response`() {
        val userInput = "hello"
        val aiResponse = "This is a response"

        val prompt = CardExtractor.buildExtractionPrompt(userInput, aiResponse)

        assert(prompt.contains("hello"))
        assert(prompt.contains("This is a response"))
        assert(prompt.contains("Extract flashcard data"))
    }

    @Test
    fun `extractFromResponse handles em-dash definition pattern`() {
        val userInput = "সুন্দর"
        val aiResponse = "**সুন্দর** (shundor) — Beautiful, pretty, nice\n\n*Adjective*\n\n**Examples:**\n1. এই ফুলটি খুব সুন্দর। — This flower is very beautiful."

        val card = CardExtractor.extractFromResponse(userInput, aiResponse)

        assertNotNull(card)
        assertEquals("সুন্দর", card?.word)
        assertEquals("Beautiful, pretty, nice", card?.definition)
        assertEquals("এই ফুলটি খুব সুন্দর।", card?.exampleSentence)
        assertEquals("This flower is very beautiful.", card?.sentenceTranslation)
    }

    @Test
    fun `extractFromResponse handles en-dash definition pattern`() {
        val userInput = "ভালো"
        val aiResponse = "**ভালো** – Good, nice\n\n1. তুমি ভালো আছো? – Are you okay?"

        val card = CardExtractor.extractFromResponse(userInput, aiResponse)

        assertNotNull(card)
        assertEquals("ভালো", card?.word)
        assertEquals("Good, nice", card?.definition)
    }

    @Test
    fun `extractFromResponse handles definition without examples`() {
        val aiResponse = "**হ্যাঁ** — Yes"
        val card = CardExtractor.extractFromResponse("হ্যাঁ", aiResponse)

        assertNotNull(card)
        assertEquals("হ্যাঁ", card?.word)
        assertEquals("Yes", card?.definition)
        assertEquals("", card?.exampleSentence)
    }

    @Test
    fun `extractFromResponse returns null for empty response`() {
        assertNull(CardExtractor.extractFromResponse("hello", ""))
    }

    @Test
    fun `extractFromResponse uses bold word from response when input is empty`() {
        val card = CardExtractor.extractFromResponse("", "**hello** - a greeting")
        assertNotNull(card)
        assertEquals("hello", card?.word)
    }

    @Test
    fun `parseCardJson handles empty JSON object`() {
        val card = CardExtractor.parseCardJson("{}")
        assertNotNull(card)
        assertEquals("", card?.word)
        assertEquals("", card?.definition)
    }

    @Test
    fun `extractFromResponse removes asterisks from extracted text`() {
        val userInput = "test"
        val aiResponse = """
            **test** - a *simple* definition

            **Examples:**
            1. **Bold** example — Translation
        """.trimIndent()

        val card = CardExtractor.extractFromResponse(userInput, aiResponse)

        assertNotNull(card)
        // Word should not contain asterisks
        assertEquals("test", card?.word)
    }
}
