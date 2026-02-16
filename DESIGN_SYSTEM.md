# DenArt Design System & Component Library

## Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-brand-red` | `#C41E3A` | Primary CTAs, accents |
| `--color-brand-red-hover` | `#E62E4A` | Hover states |
| `--color-brand-red-light` | `#DD4458` | Subtle accents |
| `--color-sand` | `#f5f5f5` | Primary text |
| `--color-sand-muted` | `#a0a0a0` | Secondary text |
| `--color-void` | `#0D0D0D` | Dark backgrounds |
| `--color-void-light` | `#1A1A1A` | Card backgrounds |
| `--color-deepest` | `#07070b` | Page backgrounds |

## Typography

- **Display:** Cormorant Garamond (headings)
- **Body:** Karla (paragraphs, UI)

## Spacing

- Base unit: 4px
- Common: `px-4`, `py-8`, `gap-4`, `gap-6`

## Components

### CTAButton
**File:** `src/components/CTAButton.astro`

```astro
<CTAButton href="/path" variant="primary" size="md" showArrow={false}>
  Button Text
</CTAButton>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| href | string | required | Link destination |
| variant | 'primary' \| 'secondary' | 'primary' | Red filled or outline |
| size | 'sm' \| 'md' \| 'lg' | 'md' | Button size |
| showArrow | boolean | false | Show right arrow |

**Styles:**
- Primary: Red bg (`bg-brand-red`), white text, hover lift + shadow
- Secondary: Transparent, sand border, sand text, hover fills

---

### PageHero
**File:** `src/components/PageHero.astro`

```astro
<PageHero 
  title="Page Title"
  subtitle="Optional subtitle"
  backgroundImage="/images/hero.jpg"
>
  <slot /> <!-- Extra content below title -->
</PageHero>
```

---

### MediaCard
**File:** `src/components/MediaCard.astro`

```astro
<MediaCard
  outlet="NBC"
  network="TODAY Show"
  type="TV, United States"
  thumbnail="/images/media/today.jpg"
  slug="today-show"
/>
```

---

### Card
**File:** `src/components/Card.astro`

Generic card wrapper with hover effects.

---

### GalleryCard
**File:** `src/components/GalleryCard.astro`

For gallery image tiles with hover zoom.

---

### SectionHeader
**File:** `src/components/SectionHeader.astro`

Section titles with optional subtitle.

---

### Badge
**File:** `src/components/Badge.astro`

Small accent labels.

---

### FeatureList
**File:** `src/components/FeatureList.astro`

Icon + text list items.

---

## Page Templates Using Components

| Page | Components Used |
|------|-----------------|
| index.astro | CTAButton ✅ |
| in_media/index.astro | CTAButton ✅ |
| services/*.astro | ServiceCard, PageHero (todo) |
| classes/*.astro | Card, CTAButton (todo) |
| gallery/*.astro | GalleryCard, GalleryGrid (todo) |
| about.astro | Card, SectionHeader (todo) |
| contact.astro | ContactForm, CTAButton (todo) |
