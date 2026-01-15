# Product Decomposition API Integration - Summary

## ✅ Status: Complete and Validated

The OpenSpec change proposal for automatic product decomposition via external APIs is now complete and passes validation.

## 📁 Files Created

### Core Proposal Documents

- **[proposal.md](proposal.md)** - Why this change is needed, what changes, impact analysis, technical considerations
- **[tasks.md](tasks.md)** - Detailed 12-phase implementation plan (18-25 days effort)
- **[design.md](design.md)** - Architecture decisions, data sources, algorithms, risks/trade-offs

### Spec Deltas (Required Changes to Existing Capabilities)

- **[specs/product-instance-management/spec.md](specs/product-instance-management/spec.md)**
  - 5 ADDED requirements (import, provenance, override, validation, create/edit)
  - 2 MODIFIED requirements (create and edit with import capability)
- **[specs/process-management/spec.md](specs/process-management/spec.md)**
  - 3 ADDED requirements (auto-detect, link external, recursive decomposition)
  - 2 MODIFIED requirements (create and edit with auto-generation)
- **[specs/data-import-export/spec.md](specs/data-import-export/spec.md)**
  - 8 NEW requirements covering:
    - OpenFoodFacts integration
    - OpenLCA Nexus integration
    - OSHWA integration (with fallback for broken API)
    - WikiFab/Wikifactory integration
    - Caching strategy (7-day TTL)
    - Rate limiting
    - Data transformation & confidence scoring
    - Export functionality (JSON, CSV, LCA formats)

## 🎯 Key Features

### 1. Multi-Source API Integration

- **OpenFoodFacts**: Food products, ingredients, NOVA processing classification
- **OpenLCA Nexus**: Industrial LCA data, quantified inputs, environmental impacts
- **OSHWA**: Open source hardware BOMs and assembly docs
- **WikiFab/Wikifactory**: DIY manufacturing recipes and collaborative hardware

### 2. Recursive Decomposition

- Break down products into components → processes → sub-components
- Depth limit (3 levels default) with circular dependency detection
- Lazy evaluation (only expand what user views)
- Parallel fetching for performance

### 3. Data Provenance & Quality

- Track which API provided each field
- Confidence scores (0.1-1.0) based on data completeness
- Visual badges showing data sources
- Allow manual override (user edits always win)

### 4. User Experience

- Multi-step import wizard (search → preview → accept/reject)
- Tree view for nested decomposition
- Non-destructive (can cancel without losing work)
- Refresh capability for updating cached data

## 🏗️ Implementation Plan (from tasks.md)

1. **Type System Extensions** (3-4 days)

   - Add `ExternalDataSource`, `DecompositionMetadata` interfaces
   - Extend existing types with optional external source fields

2. **API Clients** (4-6 days)

   - Base client with caching, retry, rate limiting
   - 4 concrete clients (OFF, OpenLCA, OSHWA, WikiFab)

3. **Data Transformers** (3-4 days)

   - One transformer per API
   - Confidence scoring algorithm
   - Conflict resolution logic

4. **Decomposition Engine** (2-3 days)

   - Recursive tree building
   - Circular dependency detection
   - Progress tracking

5. **Pinia Store** (1-2 days)

   - State management for decomposition workflow

6. **UI Components** (4-5 days)

   - ProductDecompositionWizard (5-step flow)
   - DecompositionTreeView
   - DataSourceBadge

7. **Testing** (2-3 days)
   - Unit tests for transformers
   - Integration tests with mock APIs
   - E2E tests for wizard flow

8-12. Documentation, Configuration, Error Handling, Performance, Validation

**Total Estimated Effort**: 18-25 days (3-5 weeks)

## 🔍 Validation Results

```bash
$ openspec validate add-product-decomposition-api --strict
✅ Change 'add-product-decomposition-api' is valid
```

All requirements follow OpenSpec format:

- Each requirement has a MUST/SHALL statement
- Each requirement has at least one Scenario with GIVEN/WHEN/THEN structure
- Spec deltas use proper headers (## ADDED/MODIFIED Requirements)

## 🚀 Next Steps

1. **Review**: Share proposal with stakeholders for approval
2. **Prioritize**: Decide which API integrations to implement first
3. **Type System**: Start with extending `@trace.market/types` package
4. **Prototype**: Build OpenFoodFacts client + transformer as proof-of-concept
5. **Iterate**: Get user feedback on wizard UX before building remaining APIs

## ⚠️ Key Risks & Mitigations

| Risk                                  | Mitigation                                                        |
| ------------------------------------- | ----------------------------------------------------------------- |
| External API reliability              | Aggressive caching (7-day TTL), graceful degradation              |
| Data quality issues                   | Confidence scores, manual override, source links for verification |
| API schema changes                    | Versioned transformers, comprehensive tests, monitor changelogs   |
| Performance (slow recursive fetching) | Parallel fetching, lazy evaluation, progress indicators           |
| OSHWA API 404 error                   | HTML scraper fallback for certification list                      |

## 📊 Expected Impact

- **Reduce data entry time** by 60-80% for common products
- **Improve data completeness** through automatic field population
- **Enable full supply chain traceability** via recursive decomposition
- **Increase user trust** through data provenance & confidence scores
- **No breaking changes** - entirely additive feature with opt-in workflow

## 📚 Reference Documents

- [OpenSpec AGENTS.md](/Users/mac-pro/dev_projects/trace market/tm-editor/openspec/AGENTS.md) - Workflow guidance
- [Project README](/Users/mac-pro/dev_projects/trace market/tm-editor/README.md) - Project overview
- [OpenFoodFacts API Docs](https://world.openfoodfacts.org/data)
- [OpenLCA Nexus](https://nexus.openlca.org/)
- [OSHWA Certification List](https://certification.oshwa.org/list.html)
- [WikiFab](https://wikifactory.com/) & [Wikifactory](https://wikifactory.com/)
