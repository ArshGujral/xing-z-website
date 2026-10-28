---
name: Xing-Z
description: Cooler motors and pumps, tested before dispatch.
colors:
  night-ink: "#0a0706"
  night-ink-raised: "#0d0907"
  night-ink-deep: "#070504"
  ember-panel: "#2c221c"
  copper-glow: "#e39a73"
  copper-glow-soft: "#f0ad87"
  copper-glow-hi: "#f6c3a4"
  spark-white: "#ffffff"
  daylight-paper: "#f8f4ef"
  daylight-paper-raised: "#f1eae2"
  daylight-paper-deep: "#ece4db"
  daylight-panel: "#fffbf7"
  forged-copper: "#a8522c"
  forged-copper-soft: "#b5582f"
  forged-copper-deep: "#8a3d1c"
  workshop-ink: "#211711"
  whatsapp-green: "#25d366"
typography:
  display:
    fontFamily: "Helvetica Now Text, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(1.65rem, 4vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Helvetica Now Text, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Helvetica Now Text, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "Helvetica Now Text, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Helvetica Now Text, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    letterSpacing: "0.18em"
  tagline:
    fontFamily: "Lato, Helvetica Now Text, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.9
    letterSpacing: "0.26em"
rounded:
  md: "8px"
  lg: "12px"
  xl: "16px"
  card: "16px"
  panel: "24px"
  pill: "9999px"
spacing:
  gutter-phone: "20px"
  gutter-tablet: "48px"
  gutter-desktop: "64px"
  section-phone: "96px"
  section-desktop: "112px"
components:
  button-primary:
    backgroundColor: "{colors.spark-white}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    typography: "{typography.title}"
  button-glass:
    textColor: "{colors.spark-white}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  nav-bar:
    rounded: "{rounded.xl}"
    height: "64px"
  card:
    rounded: "{rounded.card}"
    padding: "24px"
  chip-option:
    rounded: "{rounded.pill}"
    padding: "4px 12px"
---

# Design System: Xing-Z

## Overview

**Creative North Star: "Copper & Current"**

The site holds two things in balance: the material and the electricity it carries. Copper arrives as glossy, braided cable lying across a near-black stage, and the current shows as small sparks and pulses running along it. Everything else stays out of the way, so the interface reads sleek, modern and minimal: one quiet sans-serif, flat dark grounds, and copper used as light rather than as decoration.

Panels and controls are glassy and light. They float over the copper as liquid glass, with a bright top-and-bottom edge and a faint blur, so the material always shows through. The logo starts large in the hero and glides into a glass bar that stays at the top of the screen. A light theme carries the same system on warm paper, with darker copper for contrast and the copper logo.

**Key Characteristics:**
- Near-black stage (dark) or warm paper (light), never a mid-tone ground.
- Copper is the only accent; electricity is blue-white in the dark and deep blue in the light.
- One typeface for everything except the tagline.
- Glass for floating chrome, solid white for the one primary action.
- Motion is purposeful: the sparking wires, the docking logo, the exploding motor.

## Colors

A two-theme palette of ink and copper: near-black ground with glowing copper in the dark, warm paper with forged copper in the light.

### Primary
- **Copper Glow** (copper-glow): the accent in the dark theme. Section labels, "Get prices on WhatsApp" links, icons, active states and the "We engineer." half of the tagline.
- **Forged Copper** (forged-copper): the same role in the light theme, darkened so text reaches readable contrast on paper.

### Neutral
- **Night Ink** (night-ink): the dark page ground. Raised and deep variants step the trust strip and footer by one tone.
- **Ember Panel** (ember-panel): the dark mobile menu.
- **Spark White** (spark-white): the dark theme's text and the fill of the primary button. Secondary text uses it at 60–80%.
- **Daylight Paper** (daylight-paper) and **Workshop Ink** (workshop-ink): the light theme's ground and text, with raised, deep and panel variants matching the dark ones.

### Tertiary
- **WhatsApp Green** (whatsapp-green): the floating WhatsApp button only. It is the brand colour of the channel, not of Xing-Z.

### Named Rules
**The One Metal Rule.** Copper is the only accent. No second brand hue; status and the WhatsApp button are the only other colours on the page.

**The Foreground Token Rule.** Text, borders and faint fills use the theme foreground (`--fg`) at an alpha, never a fixed white or black, so both themes come from the same classes.

## Typography

**Display Font:** Helvetica Now Text (with the system sans-serif stack)
**Tagline Font:** Lato Bold, for the brand tagline only

**Character:** One neutral grotesque carries everything, set large and slightly tight. Lato appears once, in small spaced capitals under the logo, so the tagline reads as part of the logo lockup.

### Hierarchy
- **Display** (400, clamp(1.65rem, 4vw, 3rem), 1.1): the hero headline, with its second half at 60% foreground.
- **Headline** (400, 30–48px, 1.05, −0.02em): section headings, using the same split, half full and half muted.
- **Title** (500, 18px): card titles, part names, button labels.
- **Body** (400, 16px, 1.6): running text, at 60–80% foreground, kept to about 30rem.
- **Label** (500, 12–14px, 0.18em, uppercase): the copper label above each section heading.
- **Tagline** (Lato 700, 12px, 0.26em, uppercase): under the hero logo only.

### Named Rules
**The Single Voice Rule.** Helvetica Now Text everywhere; Lato never leaves the tagline.

## Layout

Content sits in a centred column of at most 1280px, with side gutters of 20px on phones, 48px on tablets and 64px on desktops. Sections are separated by 96px of space on phones and 112px on desktops, with a faint top border. Grids collapse to one column on phones; the range shows two columns on tablets and three on desktops.

The hero is a full screen high. Its content sits centred below the floating bar, which keeps clear of the iPhone status bar and home indicator.

**The Fit-The-Laptop Rule.** A section reached from the nav should fit a 1366×607 laptop screen when it can; the configurator's illustration shrinks to the screen height to keep its options visible.

## Elevation & Depth

Depth comes from glass and tone, not from shadows. Surfaces sit flat on the ground. Floating chrome is liquid glass: a near-clear fill, a 4px backdrop blur, a soft inner highlight on the top edge, and a gradient edge that is bright at the top and bottom and fades out at the sides. Once the logo has docked, the nav bar tints to solid and blurs more (16px), with a soft shadow below, so content scrolling under it stays quiet.

### Shadow Vocabulary
- **Docked bar** (soft shadow under the glass bar once the logo has docked): separates the fixed bar from content scrolling underneath.
- **Product floor** (a blurred black ellipse plus a drop shadow on each product photo): seats each motor cut-out on its card. It is softer in the light theme.

### Named Rules
**The Glass-Not-Shadow Rule.** Anything that floats is glass. Shadows are kept for the docked bar and the product floors.

## Shapes

Gently rounded forms: 16px on cards, 24px on large panels (configurator preview, exploded view, dealer cards), 12px on dropdowns and phone menus, and full pills on every button and option chip. Cut-out product photos keep their own silhouettes; only the cards around them are rounded.

## Components

### Buttons
- **Shape:** full pill (9999px).
- **Primary:** Spark White fill with ink text, 12px × 24px, semibold 14px. One per area: "Get a quote on WhatsApp", "Become a dealer".
- **Glass (secondary):** liquid glass with foreground text: "See the range", "Get a quote" in the bar, "Discuss OEM supply".
- **Hover / Focus:** the primary button lightens to 90%; glass buttons gain a 10% foreground fill.

### Chips
- **Style:** the configurator's option chips sit in a track at 5% foreground. The selected chip is a solid foreground pill with ink text; unselected chips are 60% text.

### Cards / Containers
- **Corner Style:** 16px; large panels 24px.
- **Background:** foreground at 2%, over the page ground.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** a 1px foreground border at 10%, which turns copper at 50% on hover.
- **Internal Padding:** 20–24px.

### Navigation
- **Style:** a floating liquid-glass bar, 12px from the top (below the status bar on phones), 64px tall and rounded 16px. Links are 14px medium; "Range" opens a glass dropdown of the nine lines.
- **Signature:** the XING-Z logo starts large in the hero and glides into the bar's left slot as you scroll, and back on the way up.
- **Mobile:** a sun/moon theme switch and a hamburger; the menu opens a solid panel below the bar.

### Copper Wires (signature)
A canvas of glossy copper cables, some braided, with pulses, surges, arcs and sparks running along them. It is the hero's backdrop and the dealer section's. In the light theme the electricity turns deep blue and the sparks orange. A centred scrim keeps text readable over it.

### Exploded Motor (signature)
The H Frame motor shown in photographed outer parts and drawn inner parts, which separate when scrolled into view. Numbered copper badges are tied to a parts list with photo thumbnails.

## Do's and Don'ts

### Do:
- **Do** keep copper as the only accent, Copper Glow in dark and Forged Copper in light.
- **Do** build colours from the theme tokens (`--fg`, `--page`, `--accent`) so both themes follow.
- **Do** float chrome as liquid glass, with its bright top and bottom edge.
- **Do** keep one solid white pill as the primary action and route it to WhatsApp.
- **Do** use the copper logo in light mode and the white logo in dark mode.

### Don't:
- **Don't** add a second typeface beyond Helvetica Now Text and the Lato tagline.
- **Don't** add shadows to cards or panels at rest.
- **Don't** introduce a second accent hue; WhatsApp green stays on the WhatsApp button.
- **Don't** show unconfirmed claims, numbers or quotes in decorative type (see PRODUCT.md).
