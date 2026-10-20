# PRD: Memory Palace

**Status:** proposed · **Owner:** Michael Tan · **Last updated:** 2026-10-20

## Summary

Turn a real place you know (your bedroom, your flat, your walk to work) into a memory palace. You scan it with your phone, we help you pick a route of objects through it, and a diffusion model paints a vivid image for each chunk of what you're memorizing, placed on those objects. To recall, you walk the palace in order and type what you see.

This is the technique memory champions use to remember thousands of digits. Today it takes hours of self-study to set up. The goal is to make it work for someone who has never heard of it, in about ten minutes.

## Problem

Chunking and repetition (the current app) work well for a card or passport number: 4 to 6 chunks. They break down for long sequences like 100+ digits of π, a whole deck of cards, or a list of 30 things, because each new chunk competes with the others and there is nothing to hold their order.

A memory palace solves both problems. Places are something human memory is extraordinarily good at, and a route through a place gives every chunk a fixed position. But beginners struggle with three things:

1. **Building the palace.** Choosing a route and a set of distinct locations ("loci") and keeping their order straight.
2. **Making images.** Turning `8812` into something vivid and strange enough to stick takes practice.
3. **Placing images.** Imagining that image interacting with a specific object, every time, without it fading into something generic.

## Goals

- A first-time user sets up a palace of 10+ loci in under 10 minutes, with no prior knowledge of the technique.
- Users can memorize 50 digits of π in one session and recall them a week later at a higher rate than with chunking alone.
- The images are vivid and personal enough that users remember the scene, not just the number.
- The existing privacy promise holds for secret numbers: the number never leaves the device.

## Non-goals (for this version)

- Multi-person or shared palaces.
- Imaginary or generated places. The palace must be somewhere you've physically been, because that's where the benefit comes from.
- Replacing chunking mode. Short numbers stay in the current fast flow, and the palace is for long sequences.
- Competition formats (see [Daily Challenge](../daily-challenge/plan.md)).

## Users

- **Primary:** people already using rememberanyth.ing who hit the ceiling of chunking: π learners past ~60 digits, students with long ordered lists.
- **Secondary:** curious beginners who've heard of the "mind palace" from Sherlock and want to try it properly.

## Experience

### 1. Orientation (first time only, about 2 minutes)

A short, skippable walkthrough that explains the idea in plain words, with a 3-locus demo using a generic room: "Picture your front door. There's a giant swan wearing goggles blocking it." Then the user recalls the three. The point is to feel it work once before investing in setup.

### 2. Scan your place

Two capture paths, chosen by device:

| Path | Devices | What it produces |
|---|---|---|
| **3D scan** | iPhone/iPad with LiDAR (via a native shell using RoomPlan), later Android ARCore depth | A room mesh with labelled furniture (sofa, table, bed, door) and their positions |
| **Photo walk** | Any phone, in the web app | 8–20 photos taken in walking order, one per spot |

For larger spaces (a whole flat, a street), the user scans room by room and the rooms are joined into one route.

### 3. Define your route (the setup that needs orientation)

This is the step that makes or breaks the feature, so it is guided:

- We propose loci automatically: RoomPlan's detected objects, or objects detected in the photos (door, sofa, lamp, fridge…). The user accepts, removes or adds by tapping.
- **Rules we enforce, explained once:**
  - Loci must be distinct. Two identical chairs are flagged.
  - The route must go one way. We show it as a path and number the stops.
  - 10 loci per room is the sweet spot. We warn above about 15.
- The user walks the route once in a "tour" mode: each locus fades in, with its name, in order. Then a quick check: "What comes after the lamp?"
- Each locus gets a short name the user chooses ("the green sofa", "mum's lamp"). Names are personal and memorable.

The palace is saved and reusable. The same palace can hold different things over time (rewriting a palace is a known technique), and users can build several.

### 4. Encode

For each chunk, in order:

1. The chunk becomes an image concept from the user's **personal image table**: two digits map to one object or character (00–99). The app ships a default table built from the existing hooks, and users can change any entry.
2. The concept is rendered **at the locus**: the object appears interacting with the real furniture in the user's own photo or scan. The prompt rules are fixed: exaggerated scale, motion, something absurd, touching the object. Examples: "a swan wearing goggles", "crashing through", "the green sofa".
3. The scene fades in, holds until the user is ready (same interaction as today's flash), then fades out.

The user can reroll any image or write their own description. Self-made images are remembered better, and that is part of the design.

### 5. Recall

Walk the palace in order. At each locus the room fades in without the image. The user types the chunk, and the image fades in as confirmation. Mistakes follow today's rule: only that locus restarts. Reviews reuse the existing spaced schedule.

## Requirements

### Must have (v1)

- Orientation flow with a 3-locus demo.
- Photo-walk capture in the web app (camera via `getUserMedia`, or photo upload).
- Locus suggestion from photos, plus manual tap-to-add, reorder and rename.
- Route tour and order check.
- Personal 00–99 image table, editable, seeded from `src/data/hooks.json`.
- Image generation for loci and chunks (see Technical approach for where it runs).
- Recall walk with per-locus restart, connected to the existing SRS.
- Works for π and for user items. Secret items use the privacy-preserving path below.

### Should have (v1.1)

- Native capture with LiDAR/RoomPlan for 3D scans and automatic furniture labels.
- A 3D walkthrough view (rendered mesh, or Gaussian splats from a video) instead of a photo sequence.
- Multiple rooms joined into one route.

### Could have (later)

- Cards (52 images) and word lists on top of palaces.
- Palace "refresh": clear old images so the palace can be reused.
- Export a palace as a printable walkthrough.

## Technical approach

### Capture and locus detection

- **Web, photo walk:** an open-vocabulary detector (for example Grounding DINO or OWL-ViT class models) suggests objects per photo. To keep photos local, run a small detector on-device with WebGPU, or only suggest locus *types* from a fixed list and let users tap. Server detection is opt-in.
- **Native, 3D:** a thin iOS shell (Capacitor or SwiftUI wrapper around the web app) using Apple RoomPlan, which returns furniture categories and positions on-device. The mesh never leaves the phone.

### Image generation

Two kinds of generation with different privacy needs:

| What | Contains a secret? | Where it can run |
|---|---|---|
| The personal 00–99 image library (100 objects or characters) | No. It's a lookup table, not a number | Server or on-device; generated once per user |
| Locus "plates": the user's room photos, lightly stylized | No number, but it is the user's home | On-device preferred; server only with explicit opt-in |
| Final scene: a library image composited onto a locus | **Yes for secret items.** The combination encodes the digits | **On-device only** for secret items |

**The key design choice:** for secret items the final scene is assembled locally, by compositing pre-generated library images onto the locus plate with a depth-aware placement and a light local harmonization pass. No prompt that encodes the number is ever sent anywhere. Because the user's digit-to-image table lives only on the device, even the library images reveal nothing on their own.

For non-secret content (π, word lists), full scene generation can run server-side with an image model (a fast distilled diffusion model, image-to-image with an object mask) for higher quality.

On-device generation where available: Core ML Stable Diffusion variants on recent iPhones, SD-Turbo-class models with WebGPU in the browser. Quality and speed vary by device, so the compositing path is the guaranteed baseline.

### Data model additions

```ts
interface Palace { id; name; loci: Locus[]; createdAt }
interface Locus { id; name; order: number; photo?: Blob; anchor?: { x: number; y: number; depth?: number }; roomId? }
interface ImageTable { entries: Record<string, { concept: string; image?: Blob }> } // "00".."99"
interface PalaceItem extends Item { palaceId: string; placements: { locusId: string; chunk: string; scene?: Blob }[] }
```

Stored in IndexedDB like everything else. Photos and scenes can be large, so storage needs a quota check and a cleanup path.

### Privacy and the CSP

- The current CSP (`connect-src 'self'`) blocks all network access. Server generation needs a narrowly scoped `connect-src` for one API host, only used for non-secret content and only after the user opts in.
- The UI says plainly what is sent ("Your room photos will be sent to generate images. Your numbers never are.") and has a single switch to stay fully offline.
- Room photos and scans are sensitive in their own right (they show the inside of someone's home). They are never uploaded without opt-in, and server-side copies are deleted after generation.

## Success metrics

| Metric | Target |
|---|---|
| Orientation completion | > 70% of users who start it |
| Palace setup completion (10+ loci) | > 50% of users who finish orientation |
| Median setup time | < 10 minutes |
| 7-day recall accuracy on 50-digit sequences | +25 points vs chunking-only, measured with an in-app A/B test |
| Rerolls per image | < 1.5 on average (a proxy for image quality) |

## Risks

- **Setup friction** is the biggest risk. If it takes 30 minutes, nobody finishes. Mitigation: the 3-locus demo first, automatic locus suggestions, and a usable palace from as few as 5 loci.
- **Images that look generic or unsettling.** Diffusion models default to bland stock-photo scenes. The prompt rules and the user's own edits fight this. A filter avoids disturbing results in someone's real bedroom.
- **Device fragmentation.** LiDAR is limited to Pro iPhones and iPads. The photo walk must be a first-class path, not a fallback.
- **Cost.** Server generation at about 1 to 3 images per chunk adds up for π learners. Mitigation: cache library images, generate scenes lazily, and use on-device generation where available.
- **Weakening the privacy story.** Any upload path dilutes "nothing leaves your device". Keeping secrets strictly local, and making uploads opt-in and visible, is non-negotiable.

## Open questions

1. Is a native iOS shell worth it for v1.1, or can WebXR depth APIs get close enough?
2. Should the default image table be the Major system (digits to sounds to words), which scales better, or the simpler hooks we already have?
3. How many palaces does a typical user need? One per subject, or one reused?
4. Do generated images beat user-imagined images for recall at 30 days? The A/B test should measure both.

## Milestones

| Phase | Scope | Rough size |
|---|---|---|
| **0. Prototype** | Orientation + photo walk + manual loci + text-only scenes (no images) to test the setup flow alone | 1–2 weeks |
| **1. Images, non-secret** | Library generation + server scene generation for π, opt-in | 2–3 weeks |
| **2. Secret-safe** | On-device compositing for secret items, storage quotas | 2 weeks |
| **3. 3D** | Native shell, RoomPlan capture, 3D walkthrough | 4–6 weeks |
