---
name: Aqar Lite
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#404944'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707974'
  outline-variant: '#bfc9c3'
  surface-tint: '#2b6954'
  primary: '#003527'
  on-primary: '#ffffff'
  primary-container: '#064e3b'
  on-primary-container: '#80bea6'
  inverse-primary: '#95d3ba'
  secondary: '#406655'
  on-secondary: '#ffffff'
  secondary-container: '#bfe9d3'
  on-secondary-container: '#446a59'
  tertiary: '#3d2b0d'
  on-tertiary: '#ffffff'
  tertiary-container: '#564121'
  on-tertiary-container: '#cbad85'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b0f0d6'
  primary-fixed-dim: '#95d3ba'
  on-primary-fixed: '#002117'
  on-primary-fixed-variant: '#0b513d'
  secondary-fixed: '#c2ecd6'
  secondary-fixed-dim: '#a6d0bb'
  on-secondary-fixed: '#002115'
  on-secondary-fixed-variant: '#284e3e'
  tertiary-fixed: '#fedeb2'
  tertiary-fixed-dim: '#e0c298'
  on-tertiary-fixed: '#281800'
  on-tertiary-fixed-variant: '#584323'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: '0'
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: '0'
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: '0'
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: '0'
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: '0'
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: '0'
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: '0'
  label-lg:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: '0'
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: '0'
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: '0'
  tabular-mono:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system positions itself as an authoritative, precision-focused enterprise SaaS platform tailored for high-ticket real estate sales and installment tracking in Arabic-speaking markets. The tone is deliberate, institutional, and dependable—evoking fiscal security, regulatory compliance, and architectural prestige.

The visual style blends **Corporate / Modern** structure with **Tactile / Refined** elements:
- Clean enterprise tabular density, avoiding whimsical micro-interactions in favor of predictable, low-latency financial operations.
- Native Right-to-Left (RTL) architecture where visual weight, navigation hierarchy, and forward-backward semantics naturally honor Arabic spatial logic.
- Controlled architectural accents (sand/warm gold) grounded by deep botanical greens, signaling heritage, stability, and wealth management.

## Colors
The palette balances institutional stability with high-density data legibility:

- **Primary (`#064E3B`)**: Grounded deep emerald. Used for authoritative anchor points, primary navigation indicators, dominant calls-to-action, and active table selection rows.
- **Secondary (`#022C1E`)**: Forest night. Reserved for the persistent global sidebar, master headers, and elevated system brand chrome.
- **Tertiary / Accent (`#C5A880`)**: Muted architectural sand-gold. Reserved for high-value milestone indicators, VIP property tags, and contract execution highlights. Avoid using this tone for interactive states or raw body text.
- **Neutral (`#0F172A`)**: Deep charcoal slate. Establishes maximum contrast against `#FFFFFF` and `#F8FAFC` surfaces, ensuring strict financial legibility for ledger figures and Arabic script diacritics.
- **Functional Semantics**:
  - `Success` (`#10B981`): Complete transactions, paid installments (`مدفوع`), and active inventory (`متاح`).
  - `Warning` (`#F59E0B`): Pending reviews (`قيد المراجعة`) and fast-approaching maturity schedules.
  - `Danger` (`#EF4444`): Overdue installments (`متأخر`), contract terminations, and failed payment handshakes.

## Typography
Typography is driven by `IBM Plex Sans` (prioritizing the Arabic script system), with fallback support to `Tajawal`. Arabic typography requires generous vertical headroom to prevent ascender and descender collisions (such as the upper strokes of ك and lower sweeps of ر or ي).

- **Line Height Ratios**: Set between 1.5x and 1.65x for body and headlines to maintain breathing room for complex Arabic glyphs.
- **Tabular Figures**: All monetary amounts, installment numbers, unit square meters, and percentages must render with monospaced tabular features (`font-feature-settings: "tnum" 1`) to preserve column alignment across tables and calculation ledgers.
- **Letter Spacing**: Letter-spacing (kerning) is explicitly set to `0` across all Arabic typography, as positive or negative tracking breaks the intrinsic cursive linkages of the script.

## Layout & Spacing
The layout relies on a strict 12-column fluid grid system aligned to an 8px structural step (with a 4px sub-grid for icons and badges). 

- **Directionality (RTL)**:
  - Sidebar docks to the right screen edge (`right: 0`).
  - Column 1 starts on the right; page content advances towards the left.
  - Drill-down arrows, back actions, and chevron sequences are flipped horizontally (`transform: scaleX(-1)` where directional).
- **Breakpoints**:
  - **Desktop (>= 1280px)**: 12 columns, `gutter-lg` (2rem), fixed 280px right-hand sidebar navigation, 72px top utility bar.
  - **Tablet (768px - 1279px)**: 8 columns, `gutter-md` (1.5rem), collapsible icon-only right sidebar (72px width), data tables convert to horizontally scrollable viewports with frozen primary identifier columns.
  - **Mobile (< 768px)**: 4 columns, `gutter` (1rem), full off-canvas navigation drawer sliding from the right, multi-column metric cards stack into single-column vertical records.

## Elevation & Depth
Elevation emphasizes structured corporate hierarchy using subtle surface containment and low-contrast borders rather than deep decorative drop-shadows.

- **Level 0 (Canvas Base)**: `#F8FAFC`. Houses the application layout behind cards and modular sections.
- **Level 1 (Card / Table Surface)**: Crisp `#FFFFFF` bounded by a 1px solid `#E2E8F0` border. No drop shadow during static state; utilizes `0 1px 2px 0 rgba(15, 23, 42, 0.05)` to create minimal structural lift.
- **Level 2 (Dropdowns & Popovers)**: `#FFFFFF` with a 1px `#CBD5E1` boundary and soft ambient shadow: `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modal Dialogs & Drawers)**: `#FFFFFF` surfaced above a semi-transparent scrim (`rgba(15, 23, 42, 0.6)`). Casts a concentrated ambient shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`.
- **Active / Drag State**: 2px focused ring in `#064E3B` with 15% opacity blur, maintaining clear UI target recognition.

## Shapes
The design system operates with **Soft (`1`)** geometry. Radii are calculated at:
- Base components (buttons, input fields, dropdown triggers): `0.25rem` (4px).
- Containers, modal dialogs, and table shells: `0.5rem` (8px).
- Badges, pill statuses, and circular profile chips: `9999px` (Pill-shaped overrides).

This architectural precision reinforces technical reliability, avoiding excessive playfulness while preventing hard 90-degree corners from feeling severe.

## Components

### Data Tables
- **Header**: Height 44px, background `#F1F5F9`, border-bottom 1px solid `#CBD5E1`. Typography set to `label-md`, right-aligned. Sort arrows appear to the left of the Arabic label.
- **Rows**: Height 52px, alternating or clean white rows with hover state `#F8FAFC`. Bottom separator `#E2E8F0`. Numeric installment cells must use `tabular-mono` with left alignment (to match universal balance notation) while names and unit IDs stay right-aligned.

### Status Pills
Pills use a fully rounded border radius (`9999px`), 11px font size (`label-sm`), with `space-xs` vertical padding and `space-sm` horizontal padding:
- **متاح (Available)**: Text `#065F46`, Background `#D1FAE5`, Border 1px solid `#A7F3D0`.
- **محجوز (Reserved)**: Text `#92400E`, Background `#FEF3C7`, Border 1px solid `#FDE68A`.
- **مباع (Sold)**: Text `#1E293B`, Background `#E2E8F0`, Border 1px solid `#CBD5E1`.
- **مدفوع (Paid)**: Text `#047857`, Background `#ECFDF5`, Border 1px solid `#6EE7B7`.
- **متأخر (Overdue)**: Text `#B91C1C`, Background `#FEE2E2`, Border 1px solid `#FCA5A5`.
- **قيد المراجعة (Under Review)**: Text `#854D0E`, Background `#FEF9C3`, Border 1px solid `#FEF08A`.

### Role Badges
Structured badges identifying system permissions, with a subtle border and 4px radius:
- **مدير الشركة (Company Manager)**: Text `#064E3B`, Background `#ECFDF5`, Accent dot `#064E3B`.
- **مسؤول مبيعات (Sales Rep)**: Text `#1E40AF`, Background `#EFF6FF`, Accent dot `#3B82F6`.
- **محاسب (Accountant)**: Text `#7C2D12`, Background `#FFEDD5`, Accent dot `#EA580C`.

### Buttons
- **Primary**: Background `#064E3B`, Text `#FFFFFF`, Hover `#022C1E`, Active transform scale (0.98).
- **Secondary / Outline**: Background `#FFFFFF`, Border 1px solid `#CBD5E1`, Text `#0F172A`, Hover `#F8FAFC`.
- **Tertiary Accent**: Background `#C5A880`, Text `#022C1E`, Hover `#B8996E`.
- **Danger**: Background `#EF4444`, Text `#FFFFFF`, Hover `#DC2626`.
- **Layout**: Button leading icon sits on the right side of the text label in RTL layout; trailing action icon sits on the left.

### Form Inputs & Search Fields
- Height 40px, background `#FFFFFF`, border 1px solid `#CBD5E1`, radius 4px.
- Focus state: Border color `#064E3B`, box-shadow `0 0 0 3px rgba(6, 78, 59, 0.12)`.
- Label typography: `label-md` seated above the input, aligned right.
- Input suffix/prefix (such as SAR currency marks `ر.س`): Placed on the left edge inside the box for RTL text flow.

### Modals (Reservations & Payment Recording)
- Fixed widths: 480px (Standard Payment Entry), 640px (Unit Contract Wizard).
- Fixed footer with primary affirmative action situated on the right side of the modal footer, and secondary dismissive action on the left side.
- Close trigger (X) positioned at top-left corner (opposite to modal header title on the top-right).
