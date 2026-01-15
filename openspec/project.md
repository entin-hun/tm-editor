# Project Context

## Purpose

**Trace.Market Editor (@fairfooddata/tm-editor)** is a supply chain traceability dapp that enables users to create, edit, and mint NFTs representing food products and their journey through the supply chain. The application provides a visual editor for creating "Pokedex" NFTs that contain detailed metadata about food instances, including:

- Product type, description, and nutritional information
- Processing history (milling, blending, freeze-drying, harvesting, etc.)
- Transport and logistics data
- Environmental impact metrics (carbon, water)
- Ownership and certification data
- Pricing and marketplace listing capabilities

The goal is to create transparent, immutable records of food products from source to consumer, enabling traceability and trust in the supply chain.

## Tech Stack

- **Frontend Framework**: Vue 3 (Composition API with `<script setup>`)
- **UI Framework**: Quasar v2 (Vite-based build)
- **Language**: TypeScript 5.1.6
- **State Management**: Pinia
- **Web3/Blockchain**: Thirdweb v5 (wallet connection, NFT minting, marketplace)
- **HTTP Client**: Axios
- **Mapping**: Mapbox GL + Geocoder
- **Build Tool**: Quasar CLI with Vite
- **Styling**: SCSS with Quasar variables
- **Type System**: Typia for runtime type validation
- **Node**: v16/18/20/21

## Project Conventions

### Code Style

- **Formatting**: Prettier with single quotes and semicolons
- **Linting**: ESLint with TypeScript and Vue 3 essential rules
- **Component Style**:
  - Vue 3 `<script setup>` with TypeScript
  - PascalCase for component names (e.g., `FoodInstanceEditor.vue`)
  - camelCase for variables, functions, and props
  - Ref variables named as `value` for editor components
- **Import Paths**: Use `src/` alias (e.g., `import { ... } from 'src/components/...'`)
- **File Organization**:
  - Components in `src/components/`
  - Specialized editors in `src/components/editors/`
  - Process editors in `src/components/editors/processes/`
  - Impact editors in `src/components/editors/impacts/`
  - Stores in `src/stores/`
  - Services in `src/services/`

### Architecture Patterns

- **Reactive Forms**: Each editor component uses `ref<T>()` for internal state and emits `update:modelValue` on deep changes
- **Bidirectional Sync**: Watch both internal `value` and incoming `props.modelValue` to ensure form ↔ JSON editor stay synchronized
- **Type-Driven UI**: All data structures defined in `@trace.market/types` package; UI auto-generates based on TypeScript interfaces
- **Clone Pattern**: Use `clone()` helper from `defaults.ts` to deep-clone default objects when initializing state
- **Composition API**: Prefer `<script setup>` with explicit `defineProps`, `defineEmits`, `ref`, `watch`
- **Quasar Components**: Use q-input, q-select, q-checkbox, q-btn, q-card, q-expansion-item, etc.
- **Split Pane Layout**: Main editor uses `q-splitter` with form on left, JSON/list panel on right, vertical tabs
- **Wallet Integration**: Thirdweb wallet dropdown in top action row; Mint button triggers wallet connection if disconnected

### Testing Strategy

- Currently no automated tests (script exits 0)
- Manual testing via `quasar dev` with hot-reload
- Future: Consider Vitest or Quasar testing utilities

### Git Workflow

- No specific branching strategy documented
- Use Prettier and ESLint before commits
- Scripts: `npm run lint`, `npm run format`

## Domain Context

**Supply Chain Traceability & NFT Metadata**:

- **Pokedex**: Root NFT object containing contract address, token ID, feedchain version, and a `ProductInstance`
- **ProductInstance**: Core entity representing a food product with type (via OpenFoodFacts), title, description, nutrients, process history, and impacts
- **Processes**: Detailed transformation steps (printing, milling, freeze-drying, blending, harvesting) with inputs, outputs, locations, and environmental data
- **Impacts**: Environmental metrics (carbon emissions, water usage) linked to processes
- **Inputs**: Upstream ingredients or materials (local, transported, generic, cartridge) with their own instances and impacts
- **Transport**: Logistics details (distance, mode, carrier) for tracing product movement
- **Marketplace**: Integration with Thirdweb marketplace for creating/canceling listings and minting NFTs

**Key Type Patterns**:

- Union types for polymorphic entities (e.g., `Process = PrintingProcess | MillingProcess | ...`)
- Nested recursive structures (e.g., `InputInstance` can contain another `ProductInstance`)
- Optional fields for flexibility in data collection

**External Integrations**:

- **OpenFoodFacts API**: Autocomplete for product types (`/api/v3/taxonomy_suggestions?tagtype=categories`)
- **OpenLCA**: Optional LCA data import (see `openLCAClient.ts`, `openLCATransformer.ts`)
- **Mapbox**: Geocoding and map visualization for location fields

## Important Constraints

- **Web3 Dependency**: Requires user to connect a Web3 wallet (e.g., MetaMask, WalletConnect) to mint NFTs
- **Type Package**: Core types defined in external `@trace.market/types` package (dev dependency)
- **No Backend**: Pure client-side app; all data stored on-chain or in local state
- **Browser Target**: Modern browsers with Web3 support
- **CORS**: OpenFoodFacts API may have rate limits or timeout issues (10s timeout configured)
- **Performance**: Large nested objects can cause reactivity overhead; use `{ deep: true }` watchers carefully

## External Dependencies

- **OpenFoodFacts API**: `https://world.openfoodfacts.org/api/v3/taxonomy_suggestions` for food category autocomplete
- **Thirdweb SDK**: Wallet connection, NFT minting (`mintTo`), marketplace extensions (`createListing`, `cancelListing`, `getAllListings`)
- **Mapbox GL**: Maps and geocoding (requires API key in `.env`)
- **@trace.market/types**: TypeScript type definitions for all domain entities (Pokedex, ProductInstance, Process, Impact, etc.)
- **OpenLCA API** (optional): For importing life cycle assessment data
