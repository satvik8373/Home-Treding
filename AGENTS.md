# STRICT UI DESIGN & CODING RULES (Mavrix Trading Platform)

This document defines mandatory, non-negotiable styling, design, and content guidelines for all user interfaces, components, and pages.

## 1. Zero Gradients
- Strictly PROHIBITED: `linear-gradient`, `radial-gradient`, or multi-tone gradient backgrounds, buttons, headers, or text gradients.
- Required: Solid, flat, institutional-grade colors (e.g., `#ffffff`, `#f8fafc`, `#f1f5f9`, `#0f172a`, `#1e293b`).

## 2. Zero Neon & Glowing Accents
- Strictly PROHIBITED: Neon green, electric cyan, vibrant lime, glowing text shadows, or neon box-shadows (e.g., `0 0 10px #00ffcc`).
- Required: Muted, professional, accessible financial palette (e.g., `#16a34a` for positive/profit, `#dc2626` for negative/loss, `#2563eb` for primary actions, `#64748b` for secondary text).

## 3. Zero Transparent / Glassmorphism UI
- Strictly PROHIBITED: Frosted glass, `backdrop-filter: blur`, translucent containers, transparent layered cards, or opacity overlays on cards.
- Required: Solid opaque backgrounds (`#ffffff` on `#f8fafc` / `#f1f5f9` page background) with crisp, clear delineation.

## 4. Zero Coloured Border Radius / Outlines
- Strictly PROHIBITED: Highlighting cards or dialogs with bright, colored, neon, or rainbow border strokes (e.g., `border: 2px solid #22c55e`).
- Required: Clean neutral hairline borders (`border: 1px solid #e2e8f0` or `#f1f5f9`), or no border with clean surface separation.

## 5. Zero Blinking Dots & Pulsing Animations
- Strictly PROHIBITED: Blinking indicators, pulsing radar dots, `animation: pulse`, `pulse={true}`, or continuously flashing elements.
- Required: Clean, calm, static status badges (e.g., solid status chips with `pulse={false}`).

## 6. Zero AI-Generated Fill Content & Placeholders
- Strictly PROHIBITED: Dummy marketing metrics, fake strategy claims (e.g., "99.8% win rate guaranteed"), placeholder text, fake static IPs, or unverified claims.
- Required: Display strictly real data fetched from APIs/brokers, or clean empty states when no data is present (e.g., "No executed trades today").

## 7. Zero Unwanted Elements & Text Clutter
- Strictly PROHIBITED: Redundant toggles, duplicate cards, repetitive disclaimers, clunky technical error dumps, and decorative widgets.
- Required: High-density, institutional-quality, production-ready trading interface where every pixel and character has a functional purpose.
