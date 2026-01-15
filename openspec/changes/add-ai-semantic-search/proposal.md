# Change: Add AI-Based Semantic Search for Product Decomposition

## Why

The current product decomposition feature relies on keyword-based search across external APIs (OpenFoodFacts, OSHWA, WikiFab). This has limitations:

- **Exact match requirement**: "organic whole milk" won't find "fresh full-fat milk"
- **Terminology mismatches**: Industrial vs. consumer product naming
- **Language variations**: Regional product names, abbreviations, technical terms
- **Poor ranking**: Results sorted by API default order, not relevance to user intent

AI-powered semantic similarity search can:

1. Find products based on meaning, not just keywords
2. Handle typos, synonyms, and conceptual similarity
3. Rank results by semantic relevance to user query
4. Improve search success rates, especially for uncommon products

This enhancement is **optional** and **privacy-conscious**: only activates when user explicitly configures an AI API key (Gemini/Groq/OpenRouter).

## What Changes

### New Components

- **AI Configuration UI** (`src/components/settings/AISettingsPanel.vue`):

  - API provider selector: Gemini, Groq, OpenRouter
  - Secure API key input (masked, stored in localStorage)
  - Model selector per provider
  - Enable/disable toggle for semantic search
  - Test connection button

- **Embedding Service** (`src/services/ai/EmbeddingService.ts`):

  - Abstract base class for embedding generation
  - Provider implementations:
    - `GeminiEmbeddingProvider.ts` (text-embedding-004, 768 dimensions)
    - `GroqEmbeddingProvider.ts` (via chat completion + pooling)
    - `OpenRouterEmbeddingProvider.ts` (configurable embedding models)
  - Cosine similarity calculation
  - Batch embedding for efficiency

- **Semantic Search Engine** (`src/services/SemanticSearchEngine.ts`):
  - Generates query embedding
  - Generates embeddings for all search results
  - Re-ranks results by cosine similarity
  - Caches embeddings in IndexedDB (keyed by product name + provider)
  - Falls back to keyword search if AI fails

### Modified Components

- **Decomposition Store** (`src/stores/decomposition.ts`):

  - Check if AI is configured before calling semantic search
  - Enhanced `searchDatabases` action:
    1. Perform keyword search (existing)
    2. If AI configured: generate embeddings and re-rank
    3. Otherwise: use keyword search results as-is
  - Add `useSemanticSearch` getter (checks AI config)

- **Product Decomposition Wizard** (`src/components/decomposition/ProductDecompositionWizard.vue`):

  - Show "AI Semantic Search" badge when active
  - Display similarity scores alongside confidence scores
  - Add tooltip explaining semantic search vs. keyword search

- **Settings** (`src/components/Settings.vue` or new settings page):
  - Add AI configuration section
  - Link to AISettingsPanel component

### New Data Models

```typescript
// src/types/ai.ts
export interface AIConfig {
  provider: 'gemini' | 'groq' | 'openrouter';
  apiKey: string; // stored securely
  model: string; // provider-specific model name
  enabled: boolean;
}

export interface EmbeddingResult {
  embedding: number[]; // vector of floats
  model: string;
  provider: string;
}

export interface SemanticSearchResult extends SearchResult {
  similarityScore: number; // 0.0-1.0 cosine similarity
  embeddingCached: boolean;
}
```

### Configuration Changes

Add to `src/config/aiConfig.ts`:

```typescript
export const AI_MODELS = {
  gemini: [{ name: 'text-embedding-004', dimensions: 768, maxTokens: 2048 }],
  groq: [
    { name: 'llama-3.3-70b-versatile', type: 'chat' }, // pooling-based embeddings
  ],
  openrouter: [
    { name: 'text-embedding-3-small', dimensions: 1536, maxTokens: 8191 },
    { name: 'text-embedding-3-large', dimensions: 3072, maxTokens: 8191 },
  ],
};

export const EMBEDDING_CONFIG = {
  cacheEnabled: true,
  cacheTtl: 2592000, // 30 days (embeddings are deterministic)
  batchSize: 10, // embed multiple results in single API call
  similarityThreshold: 0.5, // minimum cosine similarity to include result
};
```

## Impact

### Affected Specs

- **Product Instance Management** (enhancement): improved search with semantic understanding
- **Data Import/Export** (modification): add AI-powered ranking to import workflow

### Affected Code

- **New Files** (7):

  - `src/components/settings/AISettingsPanel.vue` (100 lines)
  - `src/services/ai/EmbeddingService.ts` (200 lines)
  - `src/services/ai/GeminiEmbeddingProvider.ts` (80 lines)
  - `src/services/ai/GroqEmbeddingProvider.ts` (100 lines, chat-based)
  - `src/services/ai/OpenRouterEmbeddingProvider.ts` (80 lines)
  - `src/services/SemanticSearchEngine.ts` (150 lines)
  - `src/types/ai.ts` (50 lines)
  - `src/config/aiConfig.ts` (80 lines)

- **Modified Files** (3):
  - `src/stores/decomposition.ts`: Enhanced `searchDatabases`, new getter `useSemanticSearch`
  - `src/components/decomposition/ProductDecompositionWizard.vue`: AI badge, similarity scores
  - `src/components/decomposition/DataSourceBadge.vue`: Optional similarity score display

### Breaking Changes

None — AI search is opt-in via configuration. Default behavior unchanged.

### Migration Path

No migration needed. Users can optionally enable AI search by:

1. Opening settings
2. Configuring AI provider + API key
3. Enabling semantic search toggle

## Technical Considerations

### API Provider Selection

**Gemini (Recommended for this use case)**:

- ✅ Native embedding model (`text-embedding-004`)
- ✅ High quality, 768 dimensions
- ✅ Generous free tier (1500 requests/day)
- ✅ Low latency
- ❌ Requires Google API key

**Groq**:

- ⚠️ No native embedding API
- ✅ Ultra-fast inference (300+ tokens/sec)
- ✅ Can use chat completion with mean pooling on hidden states
- ⚠️ Workaround: prompt model to generate representative text, hash/embed that
- ❌ Less accurate than native embeddings

**OpenRouter**:

- ✅ Access to OpenAI embedding models (text-embedding-3-small/large)
- ✅ Multiple providers, model flexibility
- ✅ Pay-as-you-go pricing
- ❌ Requires payment setup
- ❌ Higher latency (proxy overhead)

**Recommendation**: Default to Gemini, fallback to OpenRouter. Groq only if user specifically wants ultra-low latency and accepts lower accuracy.

### Security & Privacy

- **API Key Storage**: localStorage with basic obfuscation (NOT plain text)
- **Never send API keys to backend**: All AI calls client-side only
- **User consent**: Explicit opt-in required, show privacy notice
- **Data sent to AI**: Only product names/descriptions, not sensitive user data
- **Caching**: Embeddings cached locally (IndexedDB), never sent to server

### Performance Optimization

- **Batch embedding**: Embed multiple search results in single API call (10 per batch)
- **Caching strategy**: Cache embeddings by `{provider}:{model}:{text}` key, 30-day TTL
- **Lazy loading**: Only embed results when AI is enabled and user searches
- **Parallel processing**: Generate query embedding and result embeddings in parallel
- **Timeout**: 5s per embedding call, fallback to keyword search if timeout

### Error Handling

- **API key invalid**: Show error in settings, disable semantic search
- **Rate limit exceeded**: Fallback to keyword search, notify user
- **Network error**: Fallback to keyword search, retry on next search
- **Embedding dimension mismatch**: Re-generate embeddings with correct model
- **Zero results after filtering**: Lower similarity threshold dynamically

### Testing Strategy

- **Unit tests**: Mock AI API responses, test cosine similarity calculation
- **Integration tests**: Test with real API keys (Gemini free tier), verify ranking
- **UI tests**: Settings panel, API key validation, enable/disable toggle
- **Performance tests**: Measure embedding generation time, cache hit rate
- **Fallback tests**: Verify graceful degradation when AI unavailable

### Cost Considerations

| Provider   | Cost per 1M tokens    | Typical search (10 results) | Free tier     |
| ---------- | --------------------- | --------------------------- | ------------- |
| Gemini     | Free (up to limit)    | ~$0.000                     | 1500 req/day  |
| Groq       | Free (chat model)     | ~$0.000 (inference only)    | Very generous |
| OpenRouter | $0.020-0.100 (varies) | ~$0.0001                    | Pay-as-you-go |

**Recommendation**: Gemini for free tier, OpenRouter for heavy users willing to pay.

## Open Questions

1. Should we support local embedding models (e.g., ONNX runtime in browser)?
   - **Pro**: No API costs, offline support, privacy
   - **Con**: Large model downloads (50-200MB), slower inference
2. How to handle multilingual product names?
   - Option 1: Use multilingual embedding models (Gemini supports 100+ languages)
   - Option 2: Translate query to English first
3. Should we cache negative results (no similar products found)?
   - **Pro**: Avoid repeated failed searches
   - **Con**: Product databases change, need cache invalidation strategy
4. Hybrid search: combine keyword + semantic scores?

   - Formula: `final_score = 0.3 * keyword_rank + 0.7 * semantic_similarity`
   - May improve ranking accuracy

5. Should we show users which provider/model was used for each search?
   - **Pro**: Transparency, debugging
   - **Con**: UI complexity
