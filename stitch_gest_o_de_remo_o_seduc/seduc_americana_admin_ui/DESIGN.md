---
name: SEDUC Americana Admin UI
colors:
  surface: '#fbf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae8e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#414752'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#717783'
  outline-variant: '#c1c6d4'
  surface-tint: '#005faf'
  primary: '#005dac'
  on-primary: '#ffffff'
  primary-container: '#1976d2'
  on-primary-container: '#fffdff'
  inverse-primary: '#a5c8ff'
  secondary: '#27609c'
  on-secondary: '#ffffff'
  secondary-container: '#89bcfe'
  on-secondary-container: '#004b85'
  tertiary: '#4a5e78'
  on-tertiary: '#ffffff'
  tertiary-container: '#637792'
  on-tertiary-container: '#fffeff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#a5c8ff'
  on-primary-fixed: '#001c3a'
  on-primary-fixed-variant: '#004786'
  secondary-fixed: '#d3e4ff'
  secondary-fixed-dim: '#a2c9ff'
  on-secondary-fixed: '#001c38'
  on-secondary-fixed-variant: '#004881'
  tertiary-fixed: '#d2e4ff'
  tertiary-fixed-dim: '#b3c8e6'
  on-tertiary-fixed: '#051c33'
  on-tertiary-fixed-variant: '#344861'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  headline-lg:
    fontFamily: Roboto Flex
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Roboto Flex
    fontSize: 1.375rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Roboto Flex
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
  body-lg:
    fontFamily: Roboto Flex
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-md:
    fontFamily: Roboto Flex
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
  body-sm:
    fontFamily: Roboto Flex
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-lg:
    fontFamily: Roboto Flex
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Roboto Flex
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.025em
  label-sm:
    fontFamily: Roboto Flex
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: 0.875rem
    letterSpacing: 0.05em
  tabular-data:
    fontFamily: Roboto Flex
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.5rem
  margin: 1.25rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an institutional, administrative-grade interface designed specifically for municipal education workflows within the Secretaria de Educação de Americana (SEDUC Americana / Prefeitura Municipal de Americana - SP).

The aesthetic is grounded in the utilitarian precision of Material Design and Quasar Framework conventions, optimized for desktop-heavy administrative operators handling intense data workflows: school seat distributions, teacher substitutions, roster calls, and official civil service records.

### Character & Principles
- **Institutional Reliability:** Interfaces communicate authority, permanence, and auditability. The look is sober, corporate, and trustworthy.
- **High Operational Density:** Whitespace is disciplined and restrained. Screens accommodate extensive tabular datasets, comprehensive filters, and context-dense data panels without requiring excessive vertical scrolling.
- **Functional Explicitness:** Microcopy and interactive affordances eliminate ambiguity. Critical administrative decisions are marked by clear callouts, precise semantic badges, and unambiguous action labels.
- **Visual Stability:** The system avoids transient design fads, decorative gradients, and floating effects, relying instead on clean surface divisions, crisp 1px borders, and disciplined elevation tiers.

## Colors

The palette balances institutional blue identity with high-contrast functional and semantic indicators.

### Palette Architecture
- **Primary (`#1976D2`):** Primary action color, active tabs, focused inputs, and prominent administrative triggers.
- **Secondary (`#0B4F8A`):** Deep institutional blue. Used for the top application bar, institutional branding accents, and primary grouping headers.
- **Tertiary (`#0D233A`):** Saturated navy. Applied to deep navigation sidebars, prominent metadata titles, and high-priority container headings.
- **Neutral Surface & Text (`#333333`):** High-legibility base for typography. Backgrounds utilize `#F4F6F9` (canvas neutral) and `#FFFFFF` (elevated cards and tabular rows), bordered with `#E4E7EB`.

### Semantic Tokens
- **Success / Available Slot (`#1B8754` / Background `#E8F5E9`):** Indicates finalized choices, confirmed allocations, and open/available classroom slots.
- **Warning / Substitution (`#E65100` / Background `#FFF3E0`):** Alerts operators to temporary contracts, pending verifications, or mandatory substitutions.
- **Critical / Absence / Removal (`#D32F2F` / Background `#FFEBEE`):** Flags disqualifications, unexcused absences, system locks, or irrevocable deletions.

## Typography

The type scale is calibrated for high information density on desktop screens (1080p and 1440p displays). Variable weights of **Roboto Flex** maintain clarity even at reduced sizes within data grids and condensed form layouts.

### Usage Standards
- **Page & Module Headers (`headline-lg`, `headline-md`):** Reserved for top-level municipal modules (e.g., "Atribuição de Aulas 2025") and section headers.
- **Administrative Body (`body-md`, `body-sm`):** Form values, instructional guidance, and dialog summaries.
- **Operational Data (`tabular-data`):** Numbers, document IDs (CPF, RG), matrícula numbers, and ranking positions use tabular figures (`font-variant-numeric: tabular-nums`) for strict vertical alignment.
- **Labels & Badges (`label-md`, `label-sm`):** Rendered in uppercase with subtle letter-spacing for instant visual scanning of candidate states and protocol timestamps.

## Layout & Spacing

Layouts follow a structured 12-column grid system tuned for 1280px+ desktop workstations with a persistent 260px administrative navigation drawer and a 48px top municipal utility bar.

### Grid & Density Principles
- **Operational Density:** Standard layouts use `space-sm` (8px) and `space-md` (12px) for intra-component gaps. Margins between disparate functional modules maintain a uniform `space-lg` (16px) or `space-xl` (24px) stride.
- **Tables & Grids:** Data rows are kept at 36px to 40px height for dense scanning, using `gutter-dense` (8px) horizontal padding per cell to maximize horizontal space.
- **Responsive Adaptations:**
  - **Desktop (>=1200px):** Persistent navigation, dual-pane master-detail views, comprehensive multi-column filter bars.
  - **Tablet (768px - 1199px):** Collapsible drawer, single-pane stack with sticky summary headers.
  - **Mobile (<768px):** Emergency view mode only; data tables switch to stacked field cards.

## Elevation & Depth

This system avoids ambient floating shadows in favor of structured architectural depth using Material/Quasar light-elevation tiers paired with low-contrast borders.

### Elevation Hierarchy
- **Level 0 (Canvas Base):** Background canvas rendered in `#F4F6F9`. No shadow.
- **Level 1 (Panels, Data Grids & Form Cards):** Background `#FFFFFF` with a crisp `1px solid #E4E7EB` border and an ultra-subtle shadow: `0 1px 3px rgba(13, 35, 58, 0.06)`.
- **Level 2 (Active/Hovered Row & Dropdown Menus):** Background `#FFFFFF`, border `#D0D5DD`, shadow: `0 3px 6px rgba(13, 35, 58, 0.10)`.
- **Level 3 (Modal Dialogs & Decision Sheets):** Background `#FFFFFF`, shadow: `0 8px 24px rgba(13, 35, 58, 0.16)`. Accompanied by a 40% opacity backdrop overlay (`rgba(13, 35, 58, 0.4)`).

## Shapes

To sustain an administrative and institutional tone, corners are restrained. Soft 4px radii (`roundedness: 1`) provide edge definition without visually softening data boundaries.

### Shape Specifications
- **Input Fields, Buttons, Table Enclosures:** `0.25rem` (4px). Preserves linear rhythm across dense data grids.
- **Cards & Data Tables:** `0.25rem` (4px) exterior border-radius with square inner cells.
- **Chips & Badges:** `0.25rem` (4px) with subtle 1px border stroke, avoiding circular pill shapes to maximize horizontal space in tight columns.
- **System Modal Panels:** `0.5rem` (8px) maximum corner radius.

## Components

### Header & Breadcrumbs
- **Municipal Top Bar:** Deep secondary blue (`#0B4F8A`) surface, height 48px, featuring the official coat of arms / mark for "Prefeitura Municipal de Americana" alongside "SEDUC - Secretaria de Educação". Includes operator session details, current operational school year, and system sync indicator.
- **Breadcrumb Navigation:** Rendered on `#F4F6F9`, using `label-md` typography with chevron dividers (`/`) indicating hierarchy: `SEDUC > Atribuição 2025 > Ensino Fundamental I > Fila de Chamada`.

### Buttons
- **Label Standards:** Button text must be explicitly verb-driven and unambiguous. Never use generic "OK" or "Salvar". Use phrases such as:
  - `"Registrar escolha informada pelo profissional"`
  - `"Chamar próximo da fila"`
  - `"Confirmar substituição temporária"`
  - `"Registrar ausência / Desclassificar"`
- **Primary:** Solid `#1976D2` fill, `#FFFFFF` text, 36px height (compact density: 32px), `label-lg`, 4px border-radius.
- **Destructive/Critical:** Solid `#D32F2F` fill or outlined `#D32F2F` with `#FFEBEE` hover background.
- **Secondary / Outlined:** 1px border `#0B4F8A`, text `#0B4F8A`, transparent background.

### Input Fields & Controls
- **Text Inputs & Selects:** Dense height of 36px, `1px solid #E4E7EB`, `#FFFFFF` background. Floating or top-stacked mini-labels in `label-md`. Focus ring: 2px solid `#1976D2` with zero offset.
- **Checkboxes & Radios:** Sharp, compact 16x16px boxes with `#1976D2` checked state, strictly aligned with table row centers.

### Data Tables (Administrative Grade)
- **Header:** `#E4E7EB` or `#F4F6F9` background, 32px height, uppercase `label-sm` text in `#333333`, column sort affordances always visible.
- **Rows:** 36px to 40px fixed height, alternating row colors (zebra tint: `#FFFFFF` and `#FAFBFC`), hover state with `#F0F4F8`.
- **Status Cells:** Integrated compact badges highlighting operational states:
  - `VAGA DISPONÍVEL` (Green `#1B8754` on `#E8F5E9`)
  - `SUBSTITUIÇÃO PENDENTE` (Amber `#E65100` on `#FFF3E0`)
  - `AUSENTE / DESISTENTE` (Red `#D32F2F` on `#FFEBEE`)

### Operational Cards
- Minimalist containers with a 1px solid border (`#E4E7EB`), 0 elevation at rest, featuring a distinct 3px primary or semantic accent bar on the left edge to denote card priority (e.g., candidate being called, pending decision).