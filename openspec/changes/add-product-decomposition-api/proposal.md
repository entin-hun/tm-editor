# Change: Add Product Decomposition API Integration

## Why

Currently, tm-editor requires manual input of product composition, processing steps, components, and supply chain data. For comprehensive traceability, we need to automatically populate FoodInstance, ProductInstance, and Process hierarchies from external data sources that provide:

- **Bill of Materials (BOM)** data for products
- **Processing steps** and industrial recipes
- **Component breakdowns** with quantified inputs
- **Recursive ingredient/component relationships**

This will enable users to:

1. Quickly populate NFT metadata from authoritative data sources
2. Ensure data completeness and accuracy
3. Build deep traceability chains automatically
4. Reduce manual data entry errors

## What Changes

- **Add API integration layer** for external product decomposition sources:

  - OpenFoodFacts (food/consumer goods): ingredients, processing levels (NOVA groups), packaging
  - OpenLCA Nexus (industrial/environmental): quantified material inputs, energy requirements, LCI data. Our gdt-server (openLCA 2.0.25) is running on https://lca.trace.market/
  - OSHWA API (hardware/electronics): BOMs, assembly instructions, component lists
  - WikiFab API (DIY/general): manufacturing steps, required materials

- **Implement recursive decomposition algorithm** that:

  - Queries external APIs based on product type
  - Maps API responses to tm-editor types (FoodInstance, ProductInstance, Process, InputInstance)
  - Recursively populates nested InputInstance structures with component data
  - Handles multiple API sources per product (e.g., environmental + ingredient data)

- **Create UI for API-assisted data entry**:

  - Product type/category selector to determine which APIs to query
  - Search/autocomplete for products in external databases
  - Preview decomposition tree before accepting
  - Manual override/edit capabilities for API-sourced data

- **New data models**:
  - `ExternalDataSource` interface to track data provenance
  - `DecompositionMetadata` to store API mappings and confidence scores
  - Extended `ProductInstance` with optional `externalSources: ExternalDataSource[]` field

## Impact

### Affected Specs

- **Product Instance Management** (new capability): create, validate, import product data
- **Process Management** (modification): add automatic process detection from API data
- **Data Import/Export** (new capability): integrate with external APIs, handle data mapping

### Affected Code

- **src/components/editors/**:
  - `FoodInstanceEditor.vue`: add "Import from OpenFoodFacts" button
  - `ProductInstanceEditor.vue`: add "Import Components" flow
  - New: `ProductDecompositionWizard.vue` (multi-step import wizard)
- **src/services/**:
  - New: `productDecomposition.ts` (orchestrates API calls, data mapping)
  - New: `apiClients/` directory:
    - `openFoodFactsClient.ts`
    - `openLCAClient.ts` (extend existing)
    - `oshwaClient.ts`
    - `wikiFabClient.ts`
- **src/stores/**:
  - New: `decomposition.ts` (Pinia store for decomposition state)
- **src/types/** (in `@trace.market/types` package):
  - New: `ExternalDataSource.ts`
  - New: `DecompositionMetadata.ts`

### Breaking Changes

None — this is additive functionality. Existing manual data entry workflows remain unchanged.

### Migration Path

No migration required. Users can opt-in to API-assisted data entry.

## Technical Considerations

### API Rate Limits & Caching

- OpenFoodFacts: no strict rate limits, but implement 1s debounce
- OpenLCA Nexus: requires account for full access; implement local cache
- OSHWA API: GitHub Pages static JSON, no rate limits
- WikiFab: MediaWiki API with standard throttling

### Data Mapping Complexity

- Each API returns different schemas requiring custom transformers
- Some APIs lack complete data (e.g., OpenFoodFacts has ingredients but not full process chains)
- Need confidence scoring system for automatically generated data vs. manually entered

### Type System Extensions

- `@trace.market/types` package must be updated first (separate PR/change)
- Consider making `externalSources` field optional to maintain backward compatibility

### Testing Strategy

- Mock API responses for unit tests
- Integration tests with live API calls (optional, controlled via env var)
- UI tests for wizard workflow
- Data transformation validation tests

### Performance

- Recursive API calls can be slow; implement parallel fetching where possible
- Cache API responses in IndexedDB for offline/repeat access
- Show loading states and progress indicators during decomposition

### Open Questions

1. Should we store raw API responses alongside transformed data for debugging?
2. How to handle conflicts when multiple APIs provide overlapping data?
3. Should users be able to configure API priorities/preferences?
4. Do we need a background sync mechanism for updating cached API data?
