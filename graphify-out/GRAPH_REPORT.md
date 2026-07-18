# Graph Report - .  (2026-07-17)

## Corpus Check
- Corpus is ~10,050 words - fits in a single context window. You may not need a graph.

## Summary
- 313 nodes · 350 edges · 26 communities (23 shown, 3 thin omitted)
- Extraction: 94% EXTRACTED · 5% INFERRED · 1% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.88)
- Token cost: 130,489 input · 0 output

## Community Hubs (Navigation)
- Runtime Dependencies
- App Pages & Routing
- TypeScript App Config
- UI Component Primitives
- Node TypeScript Config
- Dev Tooling Dependencies
- shadcn Components Config
- Form Components
- Reservations & Booking
- Package Manifest
- SVG Icon Sprite
- Vite App Bootstrap
- Oxlint Rules Config
- API Data Models
- Layout Shell
- GoHotel Brand Identity
- Hero Illustration
- TS Project References
- Vite Logo Asset
- Axios API Client

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 21 edges
2. `react` - 15 edges
3. `compilerOptions` - 15 edges
4. `tailwind` - 6 edges
5. `aliases` - 6 edges
6. `useFormField()` - 6 edges
7. `BookingPage()` - 6 edges
8. `React + TypeScript + Vite Template` - 6 edges
9. `SVG Icon Sprite Sheet (icons.svg)` - 6 edges
10. `scripts` - 5 edges

## Surprising Connections (you probably didn't know these)
- `App()` --references--> `React Logo SVG (atom symbol, #00D8FF)`  [AMBIGUOUS]
  src/App.tsx → src/assets/react.svg
- `index.html Entry Page (gohotelfrontend)` --conceptually_related_to--> `React + TypeScript + Vite Template`  [INFERRED]
  index.html → README.md
- `FormItem()` --references--> `react`  [EXTRACTED]
  src/components/ui/form.tsx → package.json
- `useFormField()` --references--> `react`  [EXTRACTED]
  src/components/ui/form.tsx → package.json
- `RequireAuth()` --calls--> `useAuthStore`  [EXTRACTED]
  src/App.tsx → src/store/auth.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Vite Application Bootstrap Flow** — index_entry_html, index_root_mount_point, src_main_entry_module [INFERRED 0.85]
- **Layered Logo Rendering (bolt mask + blurred color ellipses + brand palette)** — public_favicon_bolt_logo_mark, public_favicon_masked_blur_gradient, public_favicon_brand_palette [EXTRACTED 1.00]
- **External Community/Social Brand Icons (Bluesky, Discord, GitHub, X)** — public_icons_bluesky_icon, public_icons_discord_icon, public_icons_github_icon, public_icons_x_icon [INFERRED 0.85]
- **SVG Symbol Sprite Set in public/icons.svg** — public_icons_bluesky_icon, public_icons_discord_icon, public_icons_documentation_icon, public_icons_github_icon, public_icons_social_icon, public_icons_x_icon [EXTRACTED 1.00]
- **Hero Visual Identity** — src_assets_hero_illustration, src_assets_hero_purple_brand_accent, src_assets_hero_isometric_minimal_style [INFERRED 0.75]

## Communities (26 total, 3 thin omitted)

### Community 0 - "Runtime Dependencies"
Cohesion: 0.04
Nodes (47): axios, class-variance-authority, clsx, date-fns, @hookform/resolvers, i18next, i18next-browser-languagedetector, lucide-react (+39 more)

### Community 1 - "App Pages & Routing"
Cohesion: 0.09
Nodes (18): React Framework, App(), RequireAuth(), React Logo SVG (atom symbol, #00D8FF), LoginPage(), loginSchema, DashboardPage(), useInvoices() (+10 more)

### Community 2 - "TypeScript App Config"
Cohesion: 0.07
Nodes (26): DOM, src, vite/client, compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly (+18 more)

### Community 3 - "UI Component Primitives"
Cohesion: 0.09
Nodes (5): react, Badge(), badgeVariants, Button(), buttonVariants

### Community 4 - "Node TypeScript Config"
Cohesion: 0.10
Nodes (19): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+11 more)

### Community 5 - "Dev Tooling Dependencies"
Cohesion: 0.11
Nodes (19): oxlint, devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom (+11 more)

### Community 6 - "shadcn Components Config"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 7 - "Form Components"
Cohesion: 0.20
Nodes (12): react, react, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 9 - "Reservations & Booking"
Cohesion: 0.33
Nodes (8): useCreateReservation(), useReservations(), addDaysStr(), BookingPage(), dayDiff(), statusColors, weekDays, ReservationsPage()

### Community 10 - "Package Manifest"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 11 - "SVG Icon Sprite"
Cohesion: 0.36
Nodes (10): Bluesky ClipPath (#bluesky-clip), Bluesky Icon (symbol #bluesky-icon), Dark Brand Icon Style (fill #08060d), Discord Icon (symbol #discord-icon), Documentation Icon (symbol #documentation-icon), GitHub Icon (symbol #github-icon), Purple Stroked UI Icon Style (stroke #aa3bff), Social/Community Icon (symbol #social-icon) (+2 more)

### Community 12 - "Vite App Bootstrap"
Cohesion: 0.28
Nodes (9): index.html Entry Page (gohotelfrontend), #root Mount Point, Hot Module Replacement (HMR), Oxlint Configuration (.oxlintrc.json), React Compiler, React + TypeScript + Vite Template, @vitejs/plugin-react (Oxc), @vitejs/plugin-react-swc (SWC) (+1 more)

### Community 13 - "Oxlint Rules Config"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 15 - "API Data Models"
Cohesion: 0.28
Nodes (8): Floor, Guest, Invoice, Reservation, ReservationDetail, Room, RoomDetail, RoomType

### Community 17 - "Layout Shell"
Cohesion: 0.47
Nodes (3): MainLayout(), Navbar(), Sidebar()

### Community 18 - "GoHotel Brand Identity"
Cohesion: 0.60
Nodes (5): GoHotel Favicon (favicon.svg), Lightning-Bolt Logo Mark (zigzag path silhouette), Brand Color Palette (purple #863bff / #7e14ff, lavender #ede6ff, cyan #47bfff), GoHotel Brand Identity, Masked Gaussian-Blur Mesh Gradient Technique

### Community 19 - "Hero Illustration"
Cohesion: 0.67
Nodes (4): Hero Illustration (Layered 3D Platforms), Isometric Minimal Illustration Style, Landing Page Hero Section, Purple Brand Accent Color

## Ambiguous Edges - Review These
- `App()` → `React Logo SVG (atom symbol, #00D8FF)`  [AMBIGUOUS]
  src/assets/react.svg · relation: references
- `Social/Community Icon (symbol #social-icon)` → `Dark Brand Icon Style (fill #08060d)`  [AMBIGUOUS]
  public/icons.svg · relation: conceptually_related_to

## Knowledge Gaps
- **124 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `App()` and `React Logo SVG (atom symbol, #00D8FF)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Social/Community Icon (symbol #social-icon)` and `Dark Brand Icon Style (fill #08060d)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `UI Component Primitives` to `App Pages & Routing`, `Form Components`, `Select Component`, `Reservations & Booking`, `Oxlint Rules Config`, `Table Component`, `Card Component`, `Layout Shell`?**
  _High betweenness centrality (0.292) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Package Manifest`, `Form Components`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `react` connect `Form Components` to `Runtime Dependencies`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._