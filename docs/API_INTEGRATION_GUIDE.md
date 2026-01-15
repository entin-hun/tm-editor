# API Integration Guide

This guide explains how to use and configure the external API integrations for product decomposition in tm-editor.

## Overview

The product decomposition feature integrates with four external data sources to automatically populate supply chain data:

1. **OpenFoodFacts** - Food products and ingredients
2. **OpenLCA Nexus** - Life cycle assessment data for industrial processes
3. **OSHWA** - Open source hardware certifications and BOMs
4. **WikiFab** - DIY manufacturing tutorials and recipes

## Architecture

### Component Structure

```
src/
├── config/
│   └── apiConfig.ts          # API configurations and settings
├── types/
│   └── decomposition.ts      # TypeScript type definitions
├── services/
│   ├── api/
│   │   ├── BaseAPIClient.ts          # Abstract base client with caching & retry
│   │   ├── OpenFoodFactsClient.ts    # OpenFoodFacts API client
│   │   ├── OSHWAClient.ts            # OSHWA API client
│   │   └── WikiFabClient.ts          # WikiFab MediaWiki API client
│   ├── transformers/
│   │   ├── OpenFoodFactsTransformer.ts  # OFF → FoodInstance
│   │   ├── OSHWATransformer.ts          # OSHWA → ProductInstance
│   │   └── WikiFabTransformer.ts        # WikiFab → ProductInstance
│   └── DecompositionEngine.ts       # Recursive decomposition orchestration
├── stores/
│   └── decomposition.ts      # Pinia store for wizard state
└── components/
    └── decomposition/
        ├── ProductDecompositionWizard.vue  # Main import wizard
        ├── DecompositionTreeView.vue       # Tree visualization
        └── DataSourceBadge.vue             # Source indicator badges
```

## Configuration

### API Endpoints

Edit `src/config/apiConfig.ts` to configure API endpoints, timeouts, and rate limits:

```typescript
export const API_CONFIGS: Record<string, APIClientConfig> = {
  openFoodFacts: {
    baseUrl: 'https://world.openfoodfacts.org/api/v0',
    timeout: 10000, // 10 seconds
    rateLimit: 10, // requests per second
    cacheTtl: 604800, // 7 days in seconds
    requiresAuth: false,
  },
  openLCA: {
    baseUrl: 'https://lca.trace.market/api',
    timeout: 15000,
    rateLimit: 5,
    cacheTtl: 1209600, // 14 days
    requiresAuth: true,
    auth: {
      username: process.env.OPENLCA_USERNAME,
      password: process.env.OPENLCA_PASSWORD,
    },
  },
  // ... other configs
};
```

### Environment Variables

For APIs requiring authentication (e.g., OpenLCA), set environment variables:

```bash
# .env.local
OPENLCA_USERNAME=your_username
OPENLCA_PASSWORD=your_password
```

### Decomposition Settings

Configure decomposition behavior:

```typescript
export const DECOMPOSITION_CONFIG = {
  maxDepth: 3, // Maximum recursion depth
  maxParallelRequests: 5, // Parallel API calls limit
  decompositionTimeout: 60, // Total timeout in seconds
  minConfidenceThreshold: 0.1, // Minimum confidence to accept data
};
```

## Using the API Clients

### Direct API Client Usage

```typescript
import { openFoodFactsClient } from '@/services/api/OpenFoodFactsClient';

// Fetch product by barcode
const response = await openFoodFactsClient.fetchData('3017620422003');

if (response.success && response.data) {
  console.log('Product:', response.data.product.product_name);
  console.log('From cache:', response.fromCache);
}

// Search products
const searchResponse = await openFoodFactsClient.searchByName(
  'whole milk',
  1,
  20
);
```

### Using Transformers

```typescript
import { openFoodFactsTransformer } from '@/services/transformers/OpenFoodFactsTransformer';

const transformResult = openFoodFactsTransformer.transform(apiResponse);

console.log('Confidence:', transformResult.confidence);
console.log('FoodInstance:', transformResult.data);
console.log('Warnings:', transformResult.warnings);
```

### Using Decomposition Engine

```typescript
import { decompositionEngine } from '@/services/DecompositionEngine';

const tree = await decompositionEngine.decomposeProduct(
  '3017620422003', // identifier (barcode, UID, etc.)
  'Food', // product type
  {
    maxDepth: 3,
    parallel: true,
    forceRefresh: false,
    onProgress: (progress) => {
      console.log(
        `Processing: ${progress.message} (${progress.nodesProcessed}/${progress.totalNodes})`
      );
    },
  }
);

console.log('Decomposition tree:', tree);
```

## Data Flow

### Import Workflow

1. **User Interaction**

   - User clicks "Import from External Sources" button
   - Wizard opens (ProductDecompositionWizard component)

2. **Step 1: Select Product Type**

   - User chooses: Food, Hardware, or General
   - Store updates: `decompositionStore.setProductType(type)`

3. **Step 2: Search**

   - User enters search query
   - Store action: `decompositionStore.searchDatabases(query)`
   - Appropriate API client is called based on product type
   - Results displayed with confidence scores and source badges

4. **Step 3: Generate Preview**

   - User selects a search result
   - Store action: `decompositionStore.generatePreview()`
   - DecompositionEngine called: `decompositionEngine.decomposeProduct()`
   - Recursive fetching begins:
     - Fetch root product data
     - Transform to internal types
     - Extract inputs/components
     - Recursively fetch child products (up to max depth)
     - Build tree structure

5. **Step 4: Preview & Edit**

   - Tree visualization displayed (DecompositionTreeView component)
   - User can expand/collapse nodes
   - User can edit individual nodes
   - Manual edits marked with flag: `manuallyEdited: true`

6. **Step 5: Accept**
   - User accepts preview
   - Store action: `decompositionStore.acceptPreview()`
   - Data merged into editor's model
   - External sources metadata preserved

### Caching Strategy

**Cache Key Format**: `{source}:{type}:{identifier}`

Examples:

- `off:barcode:3017620422003`
- `oshwa:html:US000123`
- `wikifab:page:12345`

**Cache Storage**: IndexedDB via `CacheManager` class

**Cache Invalidation**:

- Automatic: After TTL expires (configurable per source)
- Manual: "Force refresh" option in wizard
- Global: `decompositionStore.clearCache()`

**Cache Hit Behavior**:

1. Check IndexedDB for matching key
2. Verify not expired (compare `cachedAt + ttl` vs. current time)
3. Verify version matches (for schema migrations)
4. Return cached data if valid
5. Otherwise, make fresh API request

## API-Specific Details

### OpenFoodFacts

**Base URL**: `https://world.openfoodfacts.org/api/v0`

**Endpoints Used**:

- `/product/{barcode}.json` - Get product by barcode
- `/cgi/search.pl?search_terms={query}` - Search products
- `/cgi/taxonomy_suggestions.pl?tagtype=categories&string={query}` - Autocomplete

**Data Transformed**:

- `product_name` → `type`
- `ingredients` → `ingredients` (array of InputInstance)
- `nova_group` → Process extraction (minimal/ultra-processed)
- `packaging`, `categories`, `brands` → Custom properties

**Confidence Scoring**:

- Base: 1.0
- -0.3 if missing product name
- -0.2 if missing ingredients
- -0.1 per missing optional field
- Multiplied by OFF's own `completeness` score
- -0.1 per year of data age

### OpenLCA Nexus

**Base URL**: `https://lca.trace.market/api` (proxy to OpenLCA)

**Authentication**: May require username/password for full access

**Data Transformed**:

- Quantified inputs (iron ore, coal, electricity) → InputInstance array
- Environmental impacts → Impact array
- Process metadata → ProcessInstance

**Note**: Already has existing integration in `src/services/openLCAClient.ts`. New decomposition feature extends this.

### OSHWA

**Base URL**: `https://certification.oshwa.org`

**API Status**: API endpoint (`/api/v1/projects/{uid}`) returns 404. Fallback to HTML scraping.

**Endpoints Used**:

- `/list.html` - Certification list (scraped)
- `/certification/{uid}` - Individual certification page

**Data Transformed**:

- `projectName` → `type`
- BOM components → InputInstance array
- Assembly process → ProcessInstance
- Documentation links → Stored in process metadata

**Confidence Scoring**:

- Base: 1.0
- -0.9 if missing BOM (BOM is crucial for hardware)
- -0.1 per missing optional field

### WikiFab

**Base URL**: `https://wikifab.org/w/api.php` (MediaWiki API)

**Endpoints Used**:

- `?action=query&list=search&srsearch={query}` - Search tutorials
- `?action=query&pageids={id}&prop=revisions|images` - Get page content

**Data Transformed**:

- Tutorial title → `type`
- Materials section → InputInstance array
- Tutorial steps → ProcessInstance array (sequential)
- Tools list → Stored as metadata

**Wikitext Parsing**:

- `{{Tuto Step|title=...|content=...}}` → Process steps
- `{{Tuto Materials|material=...}}` → Input materials
- `{{Tuto Tools|tool=...}}` → Tools list

## Error Handling

### API Errors

**Timeout**:

- Default: 10s for most APIs, 15s for OpenLCA
- Behavior: Request aborted via AbortController
- User sees: "API not responding" error message

**Rate Limiting (429)**:

- Behavior: Read `Retry-After` header, wait specified duration
- Retry: Up to 3 times with exponential backoff
- User sees: "Rate limit reached. Retrying in X seconds..."

**Not Found (404)**:

- Behavior: Return error response, no retry
- User sees: "Product not found in {source}"
- Fallback: Suggest alternative sources or manual entry

**Server Error (5xx)**:

- Behavior: Retry up to 3 times with exponential backoff (1s, 2s, 4s)
- User sees: "API error. Retrying..." or final error message

### Transformation Errors

**Missing Required Fields**:

- Behavior: Logged as error in `TransformResult.errors`
- User sees: Validation error in wizard, cannot proceed
- Example: "Missing product name"

**Invalid Data Types**:

- Behavior: Typia validation fails
- Confidence score: -0.5 penalty
- User sees: Warning in preview, field marked invalid

**Incomplete Data**:

- Behavior: Logged as warning in `TransformResult.warnings`
- Confidence score: Reduced based on missing fields
- User sees: Warning badge, lower confidence score
- Example: "No ingredients data available"

### Decomposition Errors

**Circular Dependency**:

- Detection: `visited` Set tracks processed product IDs
- Behavior: Node marked as truncated with reason `circular_dependency`
- User sees: "Circular" badge, node not expanded further

**Depth Limit**:

- Default: 3 levels
- Behavior: Node marked as truncated with reason `depth_limit`
- User sees: "Max depth" badge, "...more" indicator

**API Error During Decomposition**:

- Behavior: Node marked with error, decomposition continues for siblings
- User sees: "Error" badge, error message displayed
- Option: `stopOnError: true` to halt entire decomposition

## Extending the System

### Adding a New Data Source

1. **Create API Client** (`src/services/api/YourAPIClient.ts`):

```typescript
import { BaseAPIClient } from './BaseAPIClient';
import { API_CONFIGS } from '../../config/apiConfig';

export class YourAPIClient extends BaseAPIClient {
  constructor() {
    super(API_CONFIGS.yourApi, 'YourAPI');
  }

  async fetchData(identifier: string, forceRefresh = false) {
    return this.makeRequest(
      `/endpoint/${identifier}`,
      { method: 'GET' },
      `yourapi:${identifier}`,
      forceRefresh
    );
  }
}

export const yourApiClient = new YourAPIClient();
```

2. **Create Transformer** (`src/services/transformers/YourAPITransformer.ts`):

```typescript
export class YourAPITransformer {
  transform(
    response: YourAPIResponse
  ): TransformResult<ProductInstanceWithSources> {
    const confidence = this.calculateConfidence(response);

    const productInstance: ProductInstanceWithSources = {
      type: response.name,
      category: 'your_category',
      externalSources: [
        {
          source: 'YourAPI',
          id: response.id,
          url: response.url,
          confidence,
          fetchedAt: new Date().toISOString(),
        },
      ],
      decompositionMetadata: {
        autoGenerated: true,
        manuallyEdited: false,
        depth: 0,
        truncated: false,
      },
    };

    return { data: productInstance, confidence };
  }

  calculateConfidence(response: YourAPIResponse): number {
    // Implement confidence scoring logic
    return 0.8;
  }
}

export const yourApiTransformer = new YourAPITransformer();
```

3. **Update DecompositionEngine** (`src/services/DecompositionEngine.ts`):

```typescript
import { yourApiClient } from './api/YourAPIClient';
import { yourApiTransformer } from './transformers/YourAPITransformer';

// In fetchAndTransform method, add new case:
case 'YourProductType': {
  const response = await yourApiClient.fetchData(identifier, forceRefresh);
  const transformResult = yourApiTransformer.transform(response.data);
  data = transformResult.data;
  break;
}
```

4. **Update Config** (`src/config/apiConfig.ts`):

```typescript
export const API_CONFIGS = {
  // ... existing configs
  yourApi: {
    baseUrl: 'https://your-api.com',
    timeout: 10000,
    rateLimit: 10,
    cacheTtl: 604800,
    requiresAuth: false,
  },
};
```

5. **Update Store** (`src/stores/decomposition.ts`):

```typescript
import { yourApiClient } from '../services/api/YourAPIClient';

// In searchDatabases action, add new case:
case 'YourProductType': {
  const response = await yourApiClient.search(query);
  // Add results to searchResults array
  break;
}
```

## Performance Optimization

### Caching Best Practices

- **Cache hit rate**: Monitor IndexedDB hits vs. API calls
- **Cache size**: Default limit 50MB, purge oldest entries if exceeded
- **Cache warming**: Pre-fetch common products on app startup

### Parallel Fetching

- **Default**: 5 parallel requests (configurable via `DECOMPOSITION_CONFIG.maxParallelRequests`)
- **Trade-off**: Speed vs. API rate limits
- **Recommendation**: Increase for reliable APIs, decrease if hitting rate limits

### Lazy Loading

- **Tree nodes**: Only fetch children when user expands node
- **Implementation**: Set `expanded: false` by default, fetch on `toggleNodeExpansion`
- **Benefit**: Reduces initial load time, avoids unnecessary API calls

## Troubleshooting

### "API not responding" Error

**Cause**: API timeout (10-15s)

**Solutions**:

1. Check network connection
2. Verify API endpoint is accessible
3. Increase timeout in `apiConfig.ts`
4. Use cached data (disable "Force refresh")

### "No results found" Error

**Cause**: Search query doesn't match any products

**Solutions**:

1. Try different search terms (broader or more specific)
2. Try different product type
3. Check if API is accessible
4. Verify correct API endpoint in config

### "Rate limit reached" Error

**Cause**: Too many requests in short time

**Solutions**:

1. Wait for retry (automatic)
2. Reduce `rateLimit` in config to be more conservative
3. Enable aggressive caching
4. Reduce `maxParallelRequests`

### Cache Corruption

**Symptoms**: JSON parse errors, missing fields, undefined data

**Solutions**:

1. Clear cache: `decompositionStore.clearCache()`
2. Increment `CACHE_CONFIG.version` to invalidate all caches
3. Check browser console for IndexedDB errors
4. Try different browser (some have IndexedDB limits)

### Low Confidence Scores

**Cause**: Incomplete or low-quality external data

**Solutions**:

1. Try different data source for same product
2. Manually supplement missing fields
3. Adjust confidence penalties in `apiConfig.ts`
4. Accept with caution, verify data accuracy

## Security Considerations

### API Credentials

- **Storage**: Use environment variables, never commit credentials
- **Transmission**: HTTPS only for all API calls
- **Client-side**: Avoid exposing credentials in browser console/dev tools

### Data Validation

- **Input**: Validate all user inputs before API calls
- **Output**: All external data validated via Typia before acceptance
- **XSS**: HTML in external data is sanitized (relevant for WikiFab wikitext)

### Rate Limiting

- **Purpose**: Prevent abuse, respect API terms of service
- **Implementation**: Built into BaseAPIClient via RateLimiter class
- **Override**: Not recommended, may result in IP ban

## License & Attribution

When using data from external sources, respect their licenses and attribution requirements:

- **OpenFoodFacts**: ODbL (Open Database License) - requires attribution
- **OpenLCA**: Varies by dataset - check individual licenses
- **OSHWA**: Open source hardware - respect certification terms
- **WikiFab**: CC BY-SA - requires attribution and share-alike

Display source badges (DataSourceBadge component) and provide links to original data to satisfy attribution requirements.
