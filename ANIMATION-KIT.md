# ArcReplay Animation Kit

Reusable Motion-powered animation primitives for this project and future Vite sites.

## Install

```bash
npm install motion
```

Import and initialize:

```js
import { initAnimationKit } from "./animation-kit.js";

initAnimationKit();
```

## Page entrance

```html
<main data-page-entrance>...</main>
```

## Scroll reveal

```html
<section data-reveal data-reveal-amount="0.2">...</section>
```

## Staggered list or grid

```html
<div data-stagger data-stagger-amount="0.16">
  <article data-stagger-item>...</article>
  <article data-stagger-item>...</article>
</div>
```

## Pointer spotlight and card lift

```html
<article data-spotlight data-lift>...</article>
```

Copy the `[data-spotlight]` and `[data-lift]` CSS rules with the module when using this in another visual system.

## Infinite marquee

Use `.motion-marquee`, `.motion-marquee-track`, and two identical `.motion-marquee-set` groups. Duplicating the group makes the `translateX(-50%)` loop seamless.

## Seamless background video

```html
<div data-seamless-video>
  <video muted playsinline preload="auto" src="hero.mp4"></video>
  <video muted playsinline preload="auto" src="hero.mp4"></video>
</div>
```

The kit starts the second video 0.22 seconds before the active one ends and crossfades between them.

## React and Next.js projects

The same package works in React 18.2+ and Next.js:

```js
import { motion } from "motion/react";
```

Use CSS transitions for simple hover color changes. Use Motion for scroll triggers, staggered sequences, interruptible animations, and gestures.
