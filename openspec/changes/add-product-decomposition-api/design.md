# Design Document: Product Decomposition API Integration

## Context

Supply chain traceability requires detailed knowledge of:

- What components make up a product
- How those components are processed/transformed
- Where each component comes from (recursively)
- Environmental impacts at each stage

Currently, tm-editor requires users to manually enter this data, which is:

- Time-consuming and error-prone
- Difficult to keep consistent across products
- Incomplete for complex supply chains
- Hard to verify for accuracy

Multiple public APIs provide structured data about products, processes, and components, but each has a different focus and data model.

### Stakeholders

- **End users**: Food producers, supply chain managers, sustainability analysts
- **Data contributors**: Users entering NFT metadata
- **Data consumers**: Consumers scanning products, auditors, researchers
- **External data providers**: OpenFoodFacts, OpenLCA, OSHWA, WikiFab

## Goals / Non-Goals

### Goals

1. **Automate data population** from authoritative external sources
2. **Reduce data entry time** by 60-80% for common products
3. **Improve data completeness** by auto-filling missing fields
4. **Enable recursive decomposition** to build full supply chain trees
5. **Maintain data provenance** by tracking which APIs provided which data

### Non-Goals

1. **Replace manual entry** — users should always be able to override/edit
2. **Real-time synchronization** — cached data is acceptable (7-day TTL)
3. **Support proprietary APIs** — focus on free/open data sources only
4. **Generate entirely new product data** — only map existing external data
5. **Guarantee 100% accuracy** — confidence scores acknowledge uncertainty

## Decisions

### Data Source Selection

**Decision**: Support four initial data sources, each for a specific domain:

| Source            | Domain                   | Data Provided                      | API Availability                             |
| ----------------- | ------------------------ | ---------------------------------- | -------------------------------------------- |
| **OpenFoodFacts** | Food/Beauty              | Ingredients, packaging, NOVA group | ✅ Free, no auth                             |
| **OpenLCA Nexus** | Industrial/Environmental | Quantified inputs, energy, impacts | ⚠️ Requires account for full access          |
| **OSHWA**         | Hardware/Electronics     | BOMs, assembly docs                | ⚠️ API endpoint not found, may need scraping |
| **WikiFab**       | DIY/General              | Manufacturing steps, materials     | ✅ MediaWiki API available                   |

**Rationale**:

- These cover the main product categories in tm-editor (Food, Product, Machine)
- All provide structured, machine-readable data
- All are open/free (or low-cost for OpenLCA)
- Together they enable recursive decomposition (e.g., food → ingredients → agricultural processes → energy inputs)

**Alternatives considered**:

- **ecoinvent database**: Most comprehensive LCA data, but requires expensive license ($$$)
- **USDA FoodData Central**: Nutritional data, but lacks supply chain/process info
- **GitHub repos for hardware**: Too unstructured, no standard BOM format

### API Client Architecture

**Decision**: Implement an abstract `BaseAPIClient` class with these responsibilities:

- HTTP request/response handling (axios)
- Error handling & retry logic (exponential backoff, max 3 retries)
- Response caching (IndexedDB for large responses, localStorage for metadata)
- Rate limiting (per-source configuration)

Each source gets a concrete client class extending `BaseAPIClient`:

```typescript
abstract class BaseAPIClient {
  protected cache: CacheInterface;
  protected rateLimit: RateLimiter;

  abstract fetchData(identifier: string): Promise<APIResponse>;

  protected async makeRequest(url: string, config: AxiosConfig): Promise<any> {
    // Implements caching, retry, error handling
  }
}

class OpenFoodFactsClient extends BaseAPIClient {
  async fetchData(barcode: string): Promise<OFFProductResponse> {
    return this.makeRequest(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
  }
}
```

**Rationale**:

- DRY: Common logic (caching, errors) implemented once
- Extensibility: Easy to add new data sources
- Testability: Mock `BaseAPIClient` for unit tests
- Separation of concerns: API communication vs. data transformation

### Data Transformation Strategy

**Decision**: Use the **Transformer Pattern** with dedicated transformer modules per API:

```typescript
interface Transformer<TInput, TOutput> {
  transform(input: TInput): TOutput;
  confidence(input: TInput): number; // 0-1 score
}

class OpenFoodFactsTransformer
  implements Transformer<OFFProductResponse, FoodInstance>
{
  transform(input: OFFProductResponse): FoodInstance {
    return {
      type: input.product.product_name,
      ingredients: input.product.ingredients?.map((i) =>
        this.toInputInstance(i)
      ),
      // ... map other fields
      externalSources: [
        {
          source: 'OpenFoodFacts',
          id: input.code,
          url: `https://world.openfoodfacts.org/product/${input.code}`,
          confidence: this.confidence(input),
          fetchedAt: new Date().toISOString(),
        },
      ],
    };
  }

  confidence(input: OFFProductResponse): number {
    // Lower confidence if fields are missing/incomplete
    let score = 1.0;
    if (!input.product.ingredients) score -= 0.3;
    if (!input.product.categories) score -= 0.2;
    return Math.max(score, 0.1);
  }
}
```

**Rationale**:

- **Isolation**: Each transformer is independent, easy to test/debug
- **Confidence scoring**: Acknowledges incomplete/unreliable external data
- **Extensibility**: New transformers don't affect existing ones
- **Type safety**: TypeScript enforces input/output contracts

**Alternatives considered**:

- **Direct mapping in API clients**: Tightly couples API structure to internal types
- **Single monolithic transformer**: Hard to maintain as more sources are added
- **No confidence scoring**: Users can't tell which data is reliable

### Recursive Decomposition Algorithm

**Decision**: Implement depth-first recursive decomposition with these safeguards:

- **Depth limit**: Default 3 levels (configurable)
- **Circular dependency detection**: Track visited product IDs
- **Parallel fetching**: Fetch sibling components concurrently
- **Lazy evaluation**: Only decompose expanded tree nodes

```typescript
async function decomposeProduct(
  identifier: string,
  productType: ProductType,
  depth: number = 0,
  visited: Set<string> = new Set()
): Promise<DecompositionNode> {
  if (depth >= MAX_DEPTH || visited.has(identifier)) {
    return { identifier, children: [], truncated: true };
  }

  visited.add(identifier);

  const sources = selectDataSources(productType);
  const responses = await Promise.all(
    sources.map((s) => s.fetchData(identifier))
  );

  const merged = mergeResponses(responses);
  const transformed = transformToProductInstance(merged);

  // Recursively decompose inputs/components
  const children = await Promise.all(
    transformed.inputs?.map((input) =>
      decomposeProduct(input.identifier, input.type, depth + 1, visited)
    ) ?? []
  );

  return { data: transformed, children };
}
```

**Rationale**:

- **Depth limit**: Prevents runaway recursion (e.g., circular supply chains)
- **Visited set**: Prevents infinite loops from circular dependencies
- **Parallel fetching**: Faster than sequential for deep trees
- **Lazy evaluation**: Reduces unnecessary API calls (user may not expand all nodes)

### Conflict Resolution for Multiple Sources

**Decision**: Use a **priority-based merging** strategy:

1. **User-entered data** always wins (never overwrite manual edits)
2. **Source-specific data** beats generic data (e.g., OpenLCA for energy > generic estimate)
3. **Higher confidence** wins ties
4. **Most recent** data wins if confidence is equal

```typescript
function mergeData(
  userData: Partial<ProductInstance>,
  apiData: ProductInstance[]
): ProductInstance {
  const merged = {};

  for (const field of FIELDS) {
    if (userData[field] !== undefined) {
      merged[field] = userData[field]; // User data always wins
    } else {
      const candidates = apiData
        .map((d) => ({ value: d[field], confidence: d.confidence }))
        .filter((c) => c.value !== undefined)
        .sort((a, b) => b.confidence - a.confidence); // Highest confidence first

      merged[field] = candidates[0]?.value;
    }
  }

  return merged;
}
```

**Rationale**:

- Respects user input (no silent overwrites)
- Leverages specialized sources (OpenLCA for LCA data, OFF for food)
- Transparent: Users can see which source provided which field

**Alternatives considered**:

- **Last-write-wins**: Simple but unpredictable
- **Ask user for every conflict**: Too interruptive
- **Weighted averaging**: Doesn't make sense for categorical fields (e.g., product name)

### UI/UX Flow

**Decision**: Implement a **multi-step wizard** rather than inline autocomplete:

1. **Trigger**: "Import from External Sources" button in editor
2. **Step 1**: Select product type (Food, Hardware, General)
3. **Step 2**: Search external databases (unified search box)
4. **Step 3**: Preview decomposition tree (expandable, editable)
5. **Step 4**: Accept/Reject (merge into editor or discard)

**Rationale**:

- **Visibility**: Users see what data will be imported before accepting
- **Control**: Users can edit/override fields before acceptance
- **Education**: Tree view helps users understand product composition
- **Non-destructive**: Can cancel without losing manual work

**Alternatives considered**:

- **Inline autocomplete** (like current type field): Hidden, hard to review bulk changes
- **Background sync**: Confusing if data changes unexpectedly
- **Separate import page**: Adds navigation complexity

## Risks / Trade-offs

### Risk: External API Reliability

**Description**: External APIs may be slow, rate-limited, or unavailable.

**Impact**: Decomposition fails or times out, poor user experience.

**Mitigation**:

- Implement aggressive caching (7-day TTL, offline-first)
- Show progress indicators ("Fetching ingredients... 2/5")
- Graceful degradation (partial results if some APIs fail)
- Fallback to manual entry if all APIs fail

**Trade-off**: Cached data may be stale, but eliminates dependency on live APIs.

### Risk: Data Quality/Completeness

**Description**: External APIs may have incomplete, incorrect, or outdated data.

**Impact**: Auto-generated metadata is wrong, NFTs contain false information.

**Mitigation**:

- Display confidence scores prominently
- Allow users to override any field
- Tag auto-generated data with `autoGenerated: true` flag
- Link to source URLs for verification

**Trade-off**: Confidence scores add complexity, but make data provenance transparent.

### Risk: API Schema Changes

**Description**: External APIs may change response formats, breaking transformers.

**Impact**: Decomposition fails silently or produces garbage data.

**Mitigation**:

- Version transformers (e.g., `OFFTransformerV1`, `OFFTransformerV2`)
- Comprehensive unit tests with real API responses
- Fallback to raw response if transformation fails
- Monitor API changelogs (RSS feeds, GitHub repos)

**Trade-off**: Versioning adds maintenance burden, but prevents silent failures.

### Risk: Circular Dependencies

**Description**: Supply chains may have circular relationships (e.g., waste → compost → fertilizer → food → waste).

**Impact**: Infinite recursion, browser crash.

**Mitigation**:

- Track visited product IDs in decomposition algorithm
- Hard depth limit (3 levels default, configurable)
- UI indicator when tree is truncated ("...more")

**Trade-off**: May miss deep supply chain relationships, but prevents crashes.

### Risk: Performance

**Description**: Recursive API calls can be slow (10+ seconds for deep trees).

**Impact**: Users abandon wizard, poor experience.

**Mitigation**:

- Parallel fetching (fetch siblings concurrently)
- Lazy evaluation (only fetch expanded nodes)
- Progress indicators & cancellation
- Cache aggressively

**Trade-off**: Lazy evaluation means tree isn't fully populated initially, but much faster.

## Migration Plan

**Not applicable** — this is a new additive feature with no breaking changes.

### Rollout Steps

1. Deploy type system changes (`@trace.market/types` package update)
2. Deploy API clients & transformers (backend logic)
3. Deploy wizard UI (optional feature, hidden behind flag initially)
4. Enable for beta testers
5. Monitor for errors, collect feedback
6. Full rollout

### Rollback Plan

If decomposition feature causes issues:

1. Disable wizard UI (remove "Import" button)
2. Users revert to manual entry
3. No data loss (manual entries unaffected)

## Open Questions

1. **Should we store raw API responses alongside transformed data?**

   - Pros: Debugging, re-transformation if logic improves
   - Cons: Bloats database, privacy concerns (raw data may contain more than needed)
   - **Recommendation**: Store only for 24 hours, then purge

2. **How to handle conflicts when multiple APIs provide overlapping data?**

   - **Answered**: Priority-based merging (see Conflict Resolution section)

3. **Should users be able to configure API priorities/preferences?**

   - Pros: Power users can customize
   - Cons: Complexity, most users won't care
   - **Recommendation**: Use sensible defaults, add settings later if requested

4. **Do we need a background sync mechanism for updating cached API data?**

   - Pros: Data stays fresh
   - Cons: Unexpected changes, battery drain on mobile
   - **Recommendation**: No auto-sync, but add "Refresh from source" button in wizard

5. **How to handle OSHWA API unavailability?**
   - Options: (a) scrape HTML certification list, (b) wait for API fix, (c) skip OSHWA entirely
   - **Recommendation**: Implement HTML scraper as fallback, monitor for API restoration

## Performance Benchmarks

### Target Metrics (based on user research)

- **Cold start** (no cache): < 5 seconds for 1-level decomposition
- **Cached**: < 500ms for any decomposition
- **Deep tree** (3 levels): < 15 seconds with parallel fetching
- **Memory**: < 50MB for typical decomposition tree

### Load Testing Plan

- Test with 10+ products from each category
- Measure API latency (p50, p95, p99)
- Measure transformation time
- Measure UI render time for large trees
- Test concurrent decompositions (5+ tabs open)
