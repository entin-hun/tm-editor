# Capability: Product Instance Management

> **Change Type**: MODIFIED
>
> **Capability ID**: product-instance-management
>
> **Description**: This capability enables users to create, edit, and manage ProductInstance objects with automatic data population from external authoritative sources.

---

## ADDED Requirements

### Requirement: Import product data from external APIs

**Unique ID**: `prod-inst-mgmt-import-1`

Users MUST be able to trigger data import from external sources when creating or editing a ProductInstance.

#### Scenario: Import food product data from OpenFoodFacts by barcode

**GIVEN** the user is creating a new FoodInstance
**AND** the user has entered a valid product barcode (e.g., "3017620422003")
**WHEN** the user clicks "Import from External Sources"
**THEN** the system queries OpenFoodFacts API with the barcode
**AND** displays a preview of available data (product name, ingredients, packaging, NOVA group)
**AND** allows the user to accept or reject the imported data
**AND** if accepted, populates the editor fields with the imported data
**AND** tags the fields with `externalSources` metadata indicating OpenFoodFacts as the source

#### Scenario: Import hardware product BOM from OSHWA by certification UID

**GIVEN** the user is creating a new ProductInstance for hardware
**AND** the user has entered an OSHWA certification UID (e.g., "US000123")
**WHEN** the user clicks "Import from External Sources"
**THEN** the system queries OSHWA (certification list or API) with the UID
**AND** displays available hardware data (project name, components, assembly documents)
**AND** if BOM data is available, shows a decomposition tree of components
**AND** allows the user to accept/reject the imported data

#### Scenario: Import industrial process data from OpenLCA by product name

**GIVEN** the user is creating a ProductInstance for an industrial good (e.g., "Steel ingot")
**AND** the user has entered a product name or category
**WHEN** the user searches OpenLCA Nexus via the import wizard
**THEN** the system displays matching datasets from OpenLCA
**AND** shows quantified inputs (materials, energy) and environmental impacts
**AND** allows the user to select the most relevant dataset
**AND** imports the data, creating InputInstance objects for each material/energy input

---

### Requirement: Display data provenance for imported fields

**Unique ID**: `prod-inst-mgmt-provenance-1`

Users MUST be able to see which external source provided each field's data.

#### Scenario: View data source badges in editor

**GIVEN** a ProductInstance has been populated with data from OpenFoodFacts
**WHEN** the user views the editor
**THEN** each field that was auto-populated shows a badge indicating "Source: OpenFoodFacts"
**AND** the badge is clickable
**AND** clicking the badge shows detailed metadata (fetch timestamp, confidence score, source URL)

#### Scenario: See multiple sources for a single field

**GIVEN** a ProductInstance has data from both OpenFoodFacts and OpenLCA
**AND** both sources provided a value for the "packaging" field
**WHEN** the user views the "packaging" field
**THEN** the field shows a badge listing both sources
**AND** clicking the badge reveals which source's value was used (based on confidence/priority)
**AND** shows the alternative values that were not selected

---

### Requirement: Allow manual override of imported data

**Unique ID**: `prod-inst-mgmt-override-1`

Users MUST be able to edit any field that was auto-populated from external sources, and manual edits MUST take precedence over external data.

#### Scenario: Edit an auto-populated field

**GIVEN** the "type" field was auto-populated with "Whole Milk" from OpenFoodFacts
**WHEN** the user changes the field to "Organic Whole Milk"
**THEN** the system saves the manual edit
**AND** marks the field as "manually edited" in metadata
**AND** future re-imports do NOT overwrite the manual edit unless explicitly requested

#### Scenario: Re-import after manual edits

**GIVEN** several fields have been manually edited after an import
**WHEN** the user clicks "Refresh from External Sources"
**THEN** the system shows a dialog listing fields that will be updated
**AND** highlights fields that have manual edits with a warning
**AND** requires explicit confirmation to overwrite manual edits
**AND** provides a checkbox to "Only update fields that are empty or auto-generated"

---

### Requirement: Validate imported data against type system

**Unique ID**: `prod-inst-mgmt-validation-1`

All data imported from external sources MUST be validated against the Typia type definitions before being accepted into the editor.

#### Scenario: Import data with missing required fields

**GIVEN** OpenFoodFacts returns a product with no "type" field (product name missing)
**WHEN** the transformation process attempts to create a FoodInstance
**THEN** the transformer detects the missing required field
**AND** assigns a confidence score of 0.1 (very low)
**AND** displays a validation error in the import wizard
**AND** prevents the user from accepting the import until the required field is filled manually

#### Scenario: Import data with invalid field types

**GIVEN** an external API returns a numeric value for a string field
**WHEN** the transformer attempts to map the data
**THEN** Typia validation fails
**AND** the system logs a detailed error (field name, expected type, actual type, source)
**AND** displays a user-friendly error message ("Invalid data from OpenFoodFacts: expected text for 'type', got number")
**AND** falls back to manual entry for that field

---

## MODIFIED Requirements

### Requirement: Create ProductInstance objects

**Unique ID**: `prod-inst-mgmt-create-1` _(existing requirement, being modified)_

Users MUST be able to create ProductInstance objects either manually or by importing data from external sources.

**Changes**:

- ADDED: Users can optionally import data from external sources during creation
- ADDED: Creation wizard includes "Import from External Sources" button
- MODIFIED: Default flow remains manual entry; import is optional

#### Scenario: Create ProductInstance with manual entry (unchanged)

**GIVEN** the user clicks "Create New Product Instance"
**WHEN** the user fills out all fields manually
**THEN** the system creates a ProductInstance with user-provided data
**AND** no external sources are queried

#### Scenario: Create ProductInstance with import (new)

**GIVEN** the user clicks "Create New Product Instance"
**WHEN** the user clicks "Import from External Sources"
**THEN** the import wizard opens
**AND** guides the user through data source selection, search, preview, and acceptance
**AND** pre-populates editor fields with imported data
**AND** user can further edit before saving the ProductInstance

---

### Requirement: Edit ProductInstance metadata

**Unique ID**: `prod-inst-mgmt-edit-1` _(existing requirement, being modified)_

Users MUST be able to edit ProductInstance metadata, with the ability to refresh data from external sources while preserving manual edits.

**Changes**:

- ADDED: Users can refresh imported data from external sources
- ADDED: Edit view includes "Refresh from External Sources" button
- ADDED: Manual edits are protected from automatic overwrites

#### Scenario: Edit manually entered ProductInstance (unchanged)

**GIVEN** a ProductInstance was created entirely with manual data entry
**WHEN** the user edits any field
**THEN** the system saves the changes
**AND** no external sources are involved

#### Scenario: Refresh imported data (new)

**GIVEN** a ProductInstance was created with imported data 30 days ago
**WHEN** the user clicks "Refresh from External Sources"
**THEN** the system re-queries the original external source(s)
**AND** shows a diff of changed fields (old value vs. new value)
**AND** requires user confirmation to apply the updates
**AND** preserves any manually edited fields unless explicitly overridden
