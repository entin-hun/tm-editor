# Fair Food Data Editor (@fairfooddata/editor)

Edit NFTs for use with Fair Food Data

## Features

### Product Decomposition & External API Integration

The tm-editor now includes powerful product decomposition capabilities that automatically populate supply chain data from authoritative external sources:

- **OpenFoodFacts Integration**: Import food product data including ingredients, packaging, NOVA processing classification, and nutritional information
- **OpenLCA Nexus**: Access ~300,000 LCA datasets for industrial processes, quantified inputs, and environmental impacts
- **OSHWA**: Import open source hardware certifications, BOMs (Bills of Materials), and assembly documentation
- **WikiFab**: Import DIY manufacturing recipes, step-by-step instructions, and materials lists

### Key Capabilities

- **Automatic Data Population**: Reduce manual data entry time by 60-80% for common products
- **Recursive Decomposition**: Automatically break down products into components → processes → sub-components
- **Data Provenance**: Track which external source provided each field with confidence scores
- **Smart Caching**: 7-day cache TTL with IndexedDB storage for offline-first functionality
- **Manual Override**: All auto-populated data can be edited; manual edits take precedence
- **Import Wizard**: 5-step guided workflow for searching, previewing, and importing external data

### Using the Import Feature

1. Open FoodInstanceEditor or ProductInstanceEditor
2. Click "Import from External Sources" button
3. Select product type (Food, Hardware, General)
4. Search external databases by name, barcode, or identifier
5. Preview decomposition tree with expandable nodes
6. Accept to merge data into your product

## Install the dependencies

```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
quasar dev
```

### Lint the files

```bash
yarn lint
# or
npm run lint
```

### Format the files

```bash
yarn format
# or
npm run format
```

### Build the app for production

```bash
quasar build
```

### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
