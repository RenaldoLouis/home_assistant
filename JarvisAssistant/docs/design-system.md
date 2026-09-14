# Jarvis Assistant — Design System & Vibe Guide

## 1. Aesthetic Philosophy: "Warm Linen & Botanical Editorial"
Jarvis is crafted as an everyday personal companion that delivers **calm, clarity, and trust** — the opposite of cold, aggressive fintech dashboards or flashy cyberpunk AI tools.

The interface evokes high-end printed editorial typography and warm organic paper:
- **Calm & Human**: Warm oatmeal/linen background (`#F5F4F0`) instead of harsh pure white or dark mode obsidian.
- **Editorial Typography**: Elegant serif headers paired with crisp, clean modern sans-serif body copy.
- **Botanical Accents**: Deep forest teal/emerald (`#176B61`) and gentle sage mint (`#E4EFE8`) reflecting growth and peace of mind.
- **Tactile Depth**: Light cards (`#FFFFFF`) with whisper-thin organic borders (`#E8E8E1`), subtle elevation, and responsive spring presses.

---

## 2. Color Palette Tokens (`src/theme/colors.ts`)

| Token | Hex Value | Usage |
|---|---|---|
| `background` | `#F5F4F0` | Primary app screen background (warm linen) |
| `card` | `#FFFFFF` | Primary surface for expense lists, cards, and modal sheets |
| `cardBorder` | `#E8E8E1` | Subtle divider and container stroke |
| `textPrimary` | `#222824` | Primary headers, values, active labels (soft charcoal) |
| `textSecondary`| `#636B65` | Eyebrows, timestamps, subtitles, secondary metadata |
| `accent` | `#176B61` | Primary brand action color, active dates, highlights |
| `mint` | `#E4EFE8` | Brand mark badge background, chip fills, synced status |
| `coral` | `#D65743` | Active day indicators, expense highlights |
| `danger` | `#B34838` | Destructive actions (e.g. Delete expense, Sign Out) |
| `warning` | `#8B5E19` | Warning banners and pending sync alerts |
| `orbIdle` | `#176B61` | Voice orb idle resting state |
| `orbListening` | `#B77D28` | Voice orb active listening state |
| `orbSpeaking` | `#176B61` | Voice orb speaking feedback state |

---

## 3. Typography & Hierarchy

### Eyebrow / Overline
```css
font-size: 10.5–11px;
font-weight: 600;
letter-spacing: 1.6–1.8px;
text-transform: uppercase;
color: #636B65;
```
*Example: `YOUR EVERYDAY COMPANION`, `ACCOUNT & SECURITY`, `RECENT EXPENSES`*

### Header / Title
```css
font-family: serif;
font-size: 28–32px;
color: #222824;
letter-spacing: -0.5px;
```
*Example: `A little more clarity.`, `Jarvis Assistant`*

### Currency & Numerical Focus
```css
font-size: 24–36px;
font-weight: 700;
color: #222824;
letter-spacing: -1px;
```
*Example: `IDR 125.000`*

### Body & Descriptions
```css
font-size: 13–15px;
line-height: 20–22px;
color: #636B65;
```

---

## 4. Components & Motion

1. **`AnimatedPressable`**:
   - Uses `react-native-reanimated` shared values on the UI thread.
   - Scale down to `0.97` on press-in over `120ms` (`Easing.bezier(0.23, 1, 0.32, 1)`).
   - Spring back to `1.0` on release.
   - Disables scale when `useReducedMotion()` is enabled.
   - Enforces minimum `48dp × 48dp` touch targets (Apple HIG & Android Accessibility compliant).

2. **Cards & Containers**:
   - Background: `#FFFFFF`
   - Border radius: `16dp` to `22dp`
   - Border: `1dp solid #E8E8E1`
   - Shadow: `shadowColor: '#000'`, `shadowOffset: { width: 0, height: 2 }`, `shadowOpacity: 0.04`, `shadowRadius: 8`

3. **Callout / Tip Boxes**:
   - Background: `#F0F4EC` (soft sage tint)
   - Border: `1dp solid #D2DCD0`
   - Radius: `12dp` to `16dp`
   - Used for permission prompts, hints, and account status

4. **Buttons**:
   - **Primary Action**: Solid `#176B61` with white text, or clean `#FFFFFF` with `#D2DCD0` border (for OAuth providers). Radius: `24dp`. Min height: `48dp`–`50dp`.
   - **Secondary / Outline Action**: Transparent background, `1dp solid #D2DCD0`, text `#176B61`. Radius: `24dp`. Min height: `48dp`.
   - **Destructive Action**: Text `#B34838` or `#D32F2F`, bold weight `700`.

---

## 5. Screen Consistency Check
Every newly created screen (Login, Settings, Onboarding, Modals) **MUST** adhere to this design system:
- Do **NOT** introduce dark obsidian (`#050D1A`), neon cyan (`#00F2FE`), or high-contrast tech blues.
- Keep the background warm linen (`#F5F4F0`).
- Use the serif typography for primary titles.
- Use `Colors` tokens imported directly from `src/theme/colors`.
