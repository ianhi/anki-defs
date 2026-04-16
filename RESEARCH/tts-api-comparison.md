# TTS API Comparison for Anki Flashcard Audio

**Date**: 2026-03-28
**Purpose**: Evaluate text-to-speech APIs for generating pronunciation audio on vocabulary
flashcards, primarily for Bangla/Bengali language learning.

**Assumptions**: Average word length ~5 Bengali characters. 1,000 flashcards = ~5,000
characters of TTS input. Some cards may include a short example sentence (~20 chars),
so we estimate ~10,000 characters per 1,000 flashcards as a realistic upper bound.

---

## Summary Table

| Provider                          | Bangla Support          | Price per 1M chars    | Est. cost / 1K cards | Free Tier           | Latency     | Quality (Bangla)    |
| --------------------------------- | ----------------------- | --------------------- | -------------------- | ------------------- | ----------- | ------------------- |
| **Google Cloud TTS (Chirp 3 HD)** | bn-IN (8 voices)        | $30                   | $0.30                | 0 (Chirp3)          | ~200-500ms  | High                |
| **Google Cloud TTS (WaveNet)**    | bn-IN (Standard only?)  | $4                    | $0.04                | 1M chars/mo         | ~200ms      | Medium              |
| **Google Gemini TTS (Flash)**     | Unconfirmed             | ~$10/1M output tokens | ~$0.05-0.15          | Free tier available | ~500ms+     | High (if supported) |
| **Amazon Polly**                  | Not supported           | $4-16                 | N/A                  | 5M chars/mo (12mo)  | ~100-200ms  | N/A                 |
| **Microsoft Azure TTS**           | bn-BD (NabanitaNeural+) | $16                   | $0.16                | 500K chars/mo       | ~200ms      | Good                |
| **ElevenLabs**                    | Yes (multilingual)      | $60-120               | $0.60-1.20           | 10K chars/mo        | ~75-300ms   | Very High           |
| **OpenAI TTS (gpt-4o-mini-tts)**  | Unconfirmed (50+ langs) | ~$15                  | $0.15                | None                | ~200-500ms  | High (if supported) |
| **Sarvam AI (Bulbul v3)**         | Yes (native)            | ~$1.80 (INR 15/10K)   | $0.018               | INR 1000 credits    | ~200ms      | High (Indic-native) |
| **Indic Parler-TTS (local)**      | Yes (20 Indic langs)    | Free (compute only)   | $0                   | N/A (self-hosted)   | ~1-5s (CPU) | Good                |
| **Piper TTS (local)**             | Limited/None            | Free (compute only)   | $0                   | N/A (self-hosted)   | ~50-200ms   | Low-Medium          |

---

## Detailed Analysis

### 1. Google Cloud Text-to-Speech

**Bangla support**: Yes. Bengali (bn-IN) is supported across multiple tiers:

- **Standard voices**: Basic quality, $4/1M chars
- **Chirp 3: HD voices**: 8 voices (4 male, 4 female), $30/1M chars. Voice format:
  `bn-IN-Chirp3-HD-<VoiceName>`

**Pricing**:
| Tier | Per 1M chars | Free tier |
|---|---|---|
| Standard | $4 | 4M chars/mo |
| WaveNet | $4 | 1M chars/mo |
| Neural2 | $16 | None listed |
| Chirp 3: HD | $30 | None listed |
| Studio | $160 | None listed |

**Cost for 1,000 cards** (10K chars):

- Standard/WaveNet: $0.04 (likely free under free tier)
- Chirp 3: HD: $0.30

**API format**: REST API, gRPC. Returns MP3, WAV, OGG Opus, LINEAR16.
**Latency**: ~200-500ms for short text.
**Notes**: $300 free credit for new GCP accounts. Chirp 3 HD quality is the best tier.
No custom pronunciation support for bn-IN in Chirp 3.

**Sources**:

- [Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Supported voices](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)
- [Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)

---

### 2. Google Gemini TTS

**Bangla support**: Unconfirmed. Gemini TTS supports 24 languages. Hindi is confirmed;
Bengali is not explicitly listed but may be included given Google's broad Indic support.
The Cloud TTS Gemini-TTS product does list bn-BD as generally available.

**Pricing** (token-based, ~4 chars = 1 token):

- Gemini 2.5 Flash TTS: $0.50/1M input tokens + $10.00/1M output tokens (audio)
- Gemini 2.5 Pro TTS: $1.00/1M input tokens + $20.00/1M output tokens (audio)
- Audio output: ~32 tokens per second of generated audio

**Cost for 1,000 cards**: Hard to estimate precisely. Input cost is negligible (~$0.001).
Output cost depends on audio duration. A 2-second word pronunciation = ~64 tokens.
1,000 words = ~64K output tokens. At Flash rate: $0.64. This is more expensive than
Cloud TTS for simple word pronunciations.

**API format**: REST via Gemini API. Returns audio as part of model response.
**Latency**: Higher than dedicated TTS (~500ms+), as it's an LLM generating audio.
**Notes**: Gemini TTS excels at expressive, context-aware speech with style control via
natural language prompts. Overkill for single-word pronunciations. Better suited for
sentences or contextual audio. Free tier exists for Gemini API generally.

**Sources**:

- [Gemini TTS docs](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini TTS pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Cloud Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)

---

### 3. Amazon Polly

**Bangla support**: NOT SUPPORTED. Amazon Polly does not list Bengali/Bangla among its
supported languages. Hindi (hi-IN) is supported, but Bengali is absent.

**Pricing**: $4/1M chars (Standard), $16/1M chars (Neural). Generous free tier of 5M
standard chars/month for 12 months.

**Verdict**: Eliminated due to no Bangla support.

**Sources**:

- [Supported languages](https://docs.aws.amazon.com/polly/latest/dg/supported-languages.html)
- [Pricing](https://aws.amazon.com/polly/pricing/)

---

### 4. Microsoft Azure TTS

**Bangla support**: Yes. Both bn-BD (Bangladesh) and bn-IN (India) are supported with
Neural voices. Known voices include:

- `bn-BD-NabanitaNeural` (female)
- Additional voices likely available (Azure has 500+ neural voices across 140+ languages)

**Pricing**: $16/1M chars for Neural voices (real-time synthesis).
Free tier: 500K chars/month.

**Cost for 1,000 cards**: $0.16 (likely free under free tier for moderate usage).

**API format**: REST API, SDKs (Python, JS, etc.). SSML support for pronunciation control.
Returns MP3, WAV, OGG, and other formats.
**Latency**: ~200ms typical.
**Notes**: SSML gives fine-grained pronunciation control. Azure has broad Indic language
coverage. SDK is well-documented.

**Sources**:

- [Language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)
- [Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)

---

### 5. ElevenLabs

**Bangla support**: Yes. ElevenLabs supports Bengali through its multilingual models
(Multilingual v2/v3). Regional accent adaptation is available.

**Pricing**:

- API: $0.06/1K chars (Flash) to $0.12/1K chars (Multilingual v2/v3)
- That's $60-120/1M chars -- significantly more expensive than Google/Azure
- Free tier: 10K chars/month
- Overages: $0.18-0.30/1K chars depending on plan

**Cost for 1,000 cards**: $0.60-1.20 (Flash vs Multilingual).

**API format**: REST API, WebSocket streaming. Returns MP3, PCM, u-law. Supports 192kbps
quality on higher tiers.
**Latency**: Flash v2.5 ~75ms, standard ~200-300ms.
**Notes**: Best-in-class voice quality and expressiveness. Voice cloning available.
However, 6-10x more expensive than Google Cloud TTS. The quality premium may not be
worth it for individual word pronunciations on flashcards.

**Sources**:

- [Bengali TTS](https://elevenlabs.io/text-to-speech/bengali)
- [API pricing](https://elevenlabs.io/pricing/api)

---

### 6. OpenAI TTS

**Bangla support**: Unconfirmed. OpenAI TTS supports 50+ languages via gpt-4o-mini-tts.
Bengali is not explicitly listed but may work given the model's multilingual training.
Quality for non-tier-1 languages can be inconsistent.

**Pricing**:

- tts-1: $15/1M chars
- tts-1-hd: $30/1M chars
- gpt-4o-mini-tts: $0.60/1M input tokens + $12/1M output tokens (~similar cost)

**Cost for 1,000 cards**: ~$0.15 (tts-1).

**API format**: REST API. Returns MP3, WAV, Opus, AAC, FLAC, PCM. Streaming supported.
**Latency**: tts-1 optimized for low latency (~200ms). tts-1-hd higher quality, slower.
**Notes**: Only 6 built-in voices (Alloy, Echo, Fable, Onyx, Nova, Shimmer) for tts-1/hd.
gpt-4o-mini-tts adds style instructions but same voice set. These voices are English-centric;
Bengali pronunciation quality is uncertain and likely inferior to providers with dedicated
Bangla voices.

**Sources**:

- [TTS guide](https://platform.openai.com/docs/guides/text-to-speech)
- [Pricing](https://costgoat.com/pricing/openai-tts)

---

### 7. Sarvam AI (India-focused)

**Bangla support**: Yes, native support. Bulbul v3 model supports 11 Indian languages
including Bengali with 25+ distinct speaker voices. Emotion-specific prompts supported
for Bengali.

**Pricing**: INR 15 per 10,000 characters (~$0.18/10K chars, or ~$18/1M chars at current
exchange rates). However, some sources list INR 30/10K chars for Bulbul v3.
All plans include INR 1,000 free credits (~65K-130K chars).

**Cost for 1,000 cards**: ~$0.018-0.036 (extremely cheap).

**API format**: REST API, WebSocket streaming. Returns audio (format details not fully
documented in search results).
**Latency**: Low-latency streaming available. ~200ms for REST.
**Notes**: Purpose-built for Indian languages. Likely the best Bangla pronunciation quality
among API providers since it's trained specifically on Indic languages. No credit card
required to start. The main risk is that Sarvam AI is a smaller company -- long-term
availability is less certain than Google/Microsoft/AWS.

**Sources**:

- [TTS API](https://www.sarvam.ai/apis/text-to-speech)
- [Pricing](https://www.sarvam.ai/api-pricing)

---

### 8. Open-Source / Self-Hosted Options

#### Indic Parler-TTS (AI4Bharat)

- **Bangla support**: Yes, 20 Indic languages including Bengali with emotion control
- **Quality**: Good. Research-grade model from IIT Madras
- **Cost**: Free (self-hosted). Compute cost only
- **Latency**: ~1-5s on CPU, ~200ms on GPU
- **Install**: `pip install git+https://github.com/huggingface/parler-tts.git`
- **Model**: ~600MB-1GB download from Hugging Face
- **Notes**: Best open-source option for Bangla. Emotion prompts supported. Requires
  GPU for real-time performance

#### IndicF5 (AI4Bharat)

- **Bangla support**: Yes, 11 Indian languages
- **Quality**: Near-human quality (trained on 1417 hours)
- **Cost**: Free (self-hosted)
- **Notes**: Newer than Indic Parler-TTS, may have better quality

#### Piper TTS

- **Bangla support**: Limited or none. Primarily focused on European languages
- **Quality**: Good for supported languages
- **Cost**: Free, very fast (~50ms on CPU)
- **Notes**: Project archived Oct 2025, continued under Open Home Foundation.
  Not recommended for Bangla

#### Coqui TTS / XTTS-v2

- **Bangla support**: No. Supports 17 languages but Bengali not included
- **Notes**: Coqui AI shut down Dec 2025. Code remains on GitHub but no active development

**Sources**:

- [Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts)
- [IndicF5](https://huggingface.co/ai4bharat/IndicF5)
- [Piper TTS](https://github.com/rhasspy/piper)

---

## Recommendation

### Primary: Google Cloud TTS (Chirp 3: HD)

**Why**: Best balance of quality, reliability, and cost for Bangla.

- 8 dedicated bn-IN voices at high quality
- $0.30 per 1,000 flashcards -- negligible for personal use
- $300 new-account credit covers ~10 million characters
- Well-documented REST/gRPC API, returns MP3/WAV/OGG
- Google is not going anywhere -- long-term reliability
- Already using Google APIs in the project (Gemini for definitions)

**Implementation**: Use the `google-cloud-texttospeech` Python package. Request MP3 at
a reasonable bitrate (48-64kbps is fine for speech) to keep file sizes small for Anki.

### Secondary / Fallback: Microsoft Azure TTS

**Why**: Good alternative if Google pricing or quality doesn't work out.

- Both bn-BD and bn-IN neural voices
- $16/1M chars with 500K chars/month free
- Excellent SSML support for pronunciation tuning
- Well-documented SDKs

### Budget Option: Sarvam AI

**Why**: Cheapest API option with native Bangla focus.

- ~$0.02 per 1,000 flashcards
- Purpose-built for Indian languages, likely excellent Bangla pronunciation
- Risk: smaller company, less certain long-term availability
- Good option if cost becomes a concern at scale

### Self-Hosted Option: Indic Parler-TTS / IndicF5

**Why**: Free, no API costs, privacy-preserving.

- Best open-source Bangla TTS available
- Requires GPU for real-time performance (or accept ~2-5s latency on CPU)
- Could be offered as an option for users who don't want API costs
- More complex to package and distribute

### Not Recommended

- **Amazon Polly**: No Bangla support at all
- **ElevenLabs**: Great quality but 6-10x more expensive; overkill for word pronunciations
- **OpenAI TTS**: Bangla support unconfirmed; English-centric voices unlikely to sound
  natural for Bangla
- **Gemini TTS**: Overkill (LLM-based), expensive for simple pronunciation, and Bangla
  support via this path is unclear
- **Piper/Coqui**: No Bangla support

---

## Implementation Notes

1. **Audio format**: Use MP3 at 48kbps. Anki supports MP3 natively. Keeps file size
   ~6KB per 1-second clip, manageable for sync.

2. **Caching**: Cache generated audio by (word, voice, provider) hash. Bengali words
   repeat across learners; no need to regenerate.

3. **Dual audio**: Consider generating audio for both the Bengali word AND an English
   pronunciation/translation for English-to-Bangla cards.

4. **Provider abstraction**: Implement a TTS provider interface so we can swap between
   Google Cloud TTS, Azure, Sarvam, or local models without changing card generation logic.

5. **Batch generation**: For bulk flashcard creation, batch API calls to reduce latency.
   Google Cloud TTS supports up to 5000 chars per request.

6. **Anki field**: Store audio as `[sound:word_bn_xxxx.mp3]` in a dedicated Audio field.
   Generate on the server side and return the audio file with the card data.
