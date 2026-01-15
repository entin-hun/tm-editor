# Capability: Data Import/Export

> **Change Type**: ADDED (New capability)
>
> **Capability ID**: data-import-export
>
> **Description**: This capability enables users to import product and process data from external authoritative APIs, and export tm-editor data for use in other systems.

---

## ADDED Requirements

### Requirement: Integrate with OpenFoodFacts API

**Unique ID**: `data-import-off-1`

The system MUST provide a client for querying OpenFoodFacts (OFF) API by barcode or product name.

#### Scenario: Search OpenFoodFacts by barcode

**GIVEN** the user enters a product barcode "3017620422003" in the import wizard
**AND** selects "Food" as the product category
**WHEN** the system queries the OFF API at `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
**THEN** the system receives a JSON response with product data
**AND** extracts relevant fields (product_name, ingredients, packaging, nova_group, categories)
**AND** transforms the response into a FoodInstance object
**AND** displays the result in the import preview with confidence score

#### Scenario: Handle OpenFoodFacts timeout

**GIVEN** the user searches for a product by barcode
**WHEN** the OFF API does not respond within 10 seconds
**THEN** the system cancels the request (using AbortController)
**AND** displays an error message "OpenFoodFacts is not responding. Please try again later."
**AND** logs the error with timestamp and barcode
**AND** allows the user to retry or switch to manual entry

#### Scenario: Handle product not found in OpenFoodFacts

**GIVEN** the user searches for a barcode that doesn't exist in OFF database
**WHEN** the OFF API returns status code 404 or `"status": 0` in JSON
**THEN** the system displays "Product not found in OpenFoodFacts"
**AND** suggests alternative sources (manual entry, other APIs if product type allows)
**AND** does NOT crash or show a raw error

---

### Requirement: Integrate with OpenLCA Nexus API

**Unique ID**: `data-import-lca-1`

The system MUST provide a client for querying OpenLCA Nexus for life cycle assessment data.

#### Scenario: Search OpenLCA by product name

**GIVEN** the user enters "steel production" in the import wizard
**AND** selects "Industrial" as the product category
**WHEN** the system queries OpenLCA Nexus search API
**THEN** the system retrieves a list of matching datasets (e.g., "Steel, converter, unalloyed", "Steel, electric, alloyed")
**AND** displays the results with metadata (geography, time period, data source)
**AND** allows the user to select the most relevant dataset

#### Scenario: Fetch quantified inputs from OpenLCA dataset

**GIVEN** the user selects an OpenLCA dataset for "Steel production"
**WHEN** the system fetches detailed data for that dataset
**THEN** the system extracts quantified inputs (iron ore: 1620kg, coal: 450kg, electricity: 500kWh)
**AND** creates InputInstance objects for each input
**AND** assigns units and quantities based on OpenLCA data
**AND** stores the OpenLCA dataset UUID in `externalSources` metadata

#### Scenario: Handle OpenLCA authentication requirement

**GIVEN** the user attempts to access OpenLCA Nexus
**AND** the requested dataset requires authentication (paid tier)
**WHEN** the system detects a 401/403 status code
**THEN** the system displays "This dataset requires an OpenLCA account. Please configure credentials in Settings."
**AND** provides a link to OpenLCA settings page
**AND** does NOT expose raw authentication errors to the user

---

### Requirement: Integrate with OSHWA certification API/list

**Unique ID**: `data-import-oshwa-1`

The system MUST provide a client for retrieving Open Source Hardware Association (OSHWA) certification data.

#### Scenario: Search OSHWA by certification UID

**GIVEN** the user enters an OSHWA UID "US000123"
**AND** selects "Hardware" as the product category
**WHEN** the system queries the OSHWA certification list (HTML or API if available)
**THEN** the system extracts project name, certification type, and certification date
**AND** if available, retrieves linked BOM (bill of materials) from project documentation
**AND** transforms BOM entries into InputInstance objects

#### Scenario: Fallback to HTML scraping if OSHWA API is unavailable

**GIVEN** the OSHWA API endpoint returns 404 or times out
**WHEN** the system attempts to fetch certification data
**THEN** the system falls back to scraping the HTML certification list at `https://certification.oshwa.org/list.html`
**AND** parses the table structure to extract project information
**AND** displays a warning "OSHWA API unavailable, using cached certification list"
**AND** logs the fallback event for monitoring

---

### Requirement: Integrate with WikiFab/Wikifactory APIs

**Unique ID**: `data-import-wiki-1`

The system MUST provide a client for querying WikiFab or Wikifactory for DIY/collaborative hardware projects.

#### Scenario: Search WikiFab by project name

**GIVEN** the user searches for "homemade soap" in the import wizard
**AND** selects "General" as the product category
**WHEN** the system queries WikiFab MediaWiki API
**THEN** the system retrieves matching tutorial pages
**AND** extracts structured steps (Step 1: Gather materials, Step 2: Mix oils, etc.)
**AND** transforms steps into Process objects with inputs listed in materials section

#### Scenario: Extract materials list from WikiFab tutorial

**GIVEN** the user selects a WikiFab tutorial "DIY Hand Soap"
**WHEN** the system parses the tutorial page
**THEN** the system extracts the "Materials" or "Tools" section
**AND** creates InputInstance objects for each listed material (e.g., "Olive oil: 500ml", "Lye: 100g")
**AND** assigns quantities and units based on the tutorial text (using regex parsing)
**AND** handles unstructured text gracefully (e.g., "a few tablespoons" → quantity=null, note="approximately 2-3 tablespoons")

---

### Requirement: Cache external API responses

**Unique ID**: `data-import-cache-1`

The system MUST cache responses from external APIs to reduce latency and avoid rate limits.

#### Scenario: Cache OpenFoodFacts response

**GIVEN** the user searches for barcode "3017620422003"
**WHEN** the system queries OpenFoodFacts and receives a response
**THEN** the system stores the response in IndexedDB with:

- Key: `off:{barcode}`
- Value: JSON response
- TTL: 7 days
- Metadata: fetch timestamp, cache version
  **AND** subsequent searches for the same barcode within 7 days use cached data
  **AND** displays "Using cached data from [date]" in the import preview

#### Scenario: Invalidate cache on user request

**GIVEN** a product was imported 5 days ago (cached)
**WHEN** the user clicks "Refresh from External Sources" with "Force refresh" checkbox enabled
**THEN** the system bypasses the cache
**AND** makes a fresh API request
**AND** updates the cache with new data
**AND** displays "Refreshed from OpenFoodFacts on [date]"

#### Scenario: Handle cache corruption

**GIVEN** the IndexedDB cache contains corrupted data for a barcode
**WHEN** the system attempts to read the cached response
**AND** JSON parsing fails
**THEN** the system deletes the corrupted cache entry
**AND** makes a fresh API request
**AND** logs a warning "Cache corruption detected for off:3017620422003"

---

### Requirement: Handle API rate limits gracefully

**Unique ID**: `data-import-rate-limit-1`

The system MUST respect rate limits for external APIs to avoid being blocked.

#### Scenario: Throttle requests to OpenFoodFacts

**GIVEN** OpenFoodFacts has an undocumented rate limit (estimated ~10 requests/second)
**WHEN** the user triggers multiple imports in rapid succession (e.g., 5 products in 1 second)
**THEN** the system queues the requests
**AND** enforces a 100ms delay between requests
**AND** displays "Queued: Importing product 3 of 5" in the UI
**AND** prevents overwhelming the API

#### Scenario: Handle 429 Too Many Requests response

**GIVEN** an external API returns HTTP 429 status code
**WHEN** the system receives the response
**THEN** the system reads the `Retry-After` header (if present)
**AND** waits the specified duration before retrying
**AND** displays "Rate limit reached. Retrying in [X] seconds..." to the user
**AND** logs the rate limit event for monitoring

---

### Requirement: Transform external API data to internal types

**Unique ID**: `data-import-transform-1`

All data imported from external APIs MUST be transformed into Typia-validated internal types (FoodInstance, ProductInstance, Process, etc.).

#### Scenario: Transform OpenFoodFacts response to FoodInstance

**GIVEN** the system receives an OpenFoodFacts API response
**WHEN** the transformation process runs
**THEN** the system maps OFF fields to FoodInstance fields:

- `product.product_name` → `type`
- `product.ingredients` → `ingredients` (array of InputInstance)
- `product.packaging` → custom property `packaging`
- `product.nova_group` → custom property `novaGroup`
- `product.categories` → tags or custom property
  **AND** validates the result with Typia runtime validation
  **AND** logs any validation errors with field details

#### Scenario: Calculate confidence score based on data completeness

**GIVEN** an OpenFoodFacts response with incomplete data (e.g., missing ingredients)
**WHEN** the transformation calculates confidence score
**THEN** the system applies penalties:

- Missing `product_name`: -0.3
- Missing `ingredients`: -0.3
- Missing `categories`: -0.2
- Missing `packaging`: -0.1
  **AND** ensures confidence score is clamped between 0.1 and 1.0
  **AND** displays the confidence score in the import preview (e.g., "Confidence: 70%")

---

### Requirement: Provide data export functionality

**Unique ID**: `data-export-1`

Users MUST be able to export ProductInstance and Process data to standard formats for use in other tools.

#### Scenario: Export ProductInstance as JSON

**GIVEN** the user has created a ProductInstance with nested inputs and processes
**WHEN** the user clicks "Export" and selects "JSON" format
**THEN** the system serializes the ProductInstance to JSON
**AND** includes all nested objects (InputInstance, Process, Impact)
**AND** includes `externalSources` metadata for traceability
**AND** downloads a file named `{productName}-{timestamp}.json`

#### Scenario: Export decomposition tree as CSV

**GIVEN** the user has created a product with a full decomposition tree (3 levels deep)
**WHEN** the user clicks "Export" and selects "CSV" format
**THEN** the system flattens the tree structure into rows
**AND** each row represents one node (ProductInstance or InputInstance)
**AND** includes columns: level, parentId, name, quantity, unit, source, confidence
**AND** downloads a file named `{productName}-decomposition-{timestamp}.csv`

#### Scenario: Export for use in external LCA tools

**GIVEN** the user has imported data from OpenLCA and added custom modifications
**WHEN** the user clicks "Export for LCA tools"
**THEN** the system exports data in a format compatible with OpenLCA or SimaPro
**AND** maps tm-editor types to LCA standard types (processes, flows, exchanges)
**AND** warns if any custom fields cannot be mapped
