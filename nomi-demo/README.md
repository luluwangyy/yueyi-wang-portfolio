# Nomi

Nomi is a two-sided medication routine prototype designed for older adults and their caregivers. It presents the parent and caregiver experiences side by side and keeps both screens connected through shared browser state.

[Open the live prototype](https://luluwangyy.github.io/yueyi-wang-portfolio/nomi-demo/)

## Prototype features

- Parent and caregiver interfaces displayed together
- Shared interaction state between both screens
- Medication review and confirmation flow
- Gentle caregiver check-ins received by the parent screen
- Reminder snoozing and help requests
- Routine, history, privacy, and notification settings
- Adjustable text size, higher contrast, and reduced-motion preferences
- Responsive layouts for desktop and smaller screens

## Technology

- React 18
- TypeScript
- Vite
- Tailwind CSS and custom CSS
- Lucide React icons
- PostCSS and Autoprefixer
- GitHub Pages

## Visual system

The interface uses a restrained liquid-glass visual language with rounded forms, feathered mesh gradients, milky perimeter fog, fine grain, and lightweight typography. The design keeps medication information calm and readable while visually distinguishing the parent and caregiver experiences.

## Interaction model

The prototype is entirely client-side. React state synchronizes both phones during the current browser session. Sending a check-in from the caregiver screen updates the parent screen immediately. No backend, account system, database, or persistent storage is included.

## Deployment

This directory contains the browser-ready production build used by the portfolio website. The Vite build uses relative asset paths so the prototype can run from the `/nomi-demo/` GitHub Pages subdirectory.

## Important note

Nomi is a product design prototype and does not provide medical advice. The names, schedules, and medication details shown in the interface are illustrative.
