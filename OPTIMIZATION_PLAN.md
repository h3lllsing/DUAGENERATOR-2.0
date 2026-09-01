# OPTIMIZATION PLAN — Video Rendering + UI/UX
> Created: 2026-09-01 | Status: Phase 1 + 2 + 3 Complete

---

## PHASE 1 — QUICK WINS (1-2 days, low risk)

### 1.1 Parallel TTS — Arabic + Urdu ek saath
**File:** `core/tts_engine.py`
**Impact:** ⚡ 50% TTS time saved (network I/O bound)
**Effort:** Low (1-2 hours)

**Current:**
```
Arabic TTS → wait → Urdu TTS → wait → merge
Total: ~6-10 seconds (2x network roundtrip)
```

**Target:**
```
Arabic TTS ─┐
             ├→ merge
Urdu TTS  ──┘
Total: ~3-5 seconds (1x network roundtrip)
```

**Implementation:**
- Use `asyncio.gather()` or `concurrent.futures.ThreadPoolExecutor`
- Both TTS calls are independent, no shared state
- Merge step waits for both to complete
- Keep retry logic per-voice (3 attempts with backoff)
- Also apply to `remotion/scripts/prepare_dua.py` (Pipeline B)

**Files to modify:**
- `core/tts_engine.py` — add `generate_both()` async function
- `core/audio_mixer.py` — accept parallel audio paths
- `main.py` — call `generate_both()` instead of sequential
- `remotion/scripts/prepare_dua.py` — parallel TTS for Remotion pipeline

---

### 1.2 CSS Custom Properties (Design Tokens)
**File:** `style.css`
**Impact:** 🔴 Foundation for all UI work
**Effort:** Low-Medium (2-3 hours)

**Current:** 50+ hardcoded color values, spacing values, radius values scattered across 400 lines

**Target:** Single `:root` block with all tokens, CSS uses `var(--token)` everywhere

**Implementation:**
```css
:root {
  /* Colors */
  --bg: #0d1015;
  --surface-1: #11161f;
  --surface-2: #1c2333;
  --surface-3: #232a36;
  --gold: #d4af37;
  --gold-light: #f0d060;
  --gold-secondary: #e6c46a;
  --text-1: #e8e6e3;
  --text-2: #8b949e;
  --text-3: #5a6474;
  --success: #3fb950;
  --danger: #ff7b72;
  --warning: #e3b341;
  --info: #60a5fa;
  --purple: #a855f7;

  /* Spacing */
  --sp-xs: 4px;
  --sp-sm: 6px;
  --sp-md: 10px;
  --sp-lg: 16px;
  --sp-xl: 24px;

  /* Radius */
  --r-sm: 6px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-xl: 14px;
  --r-pill: 99px;

  /* Font sizes */
  --fs-xs: 9px;
  --fs-sm: 11px;
  --fs-base: 14px;
  --fs-md: 13px;
  --fs-lg: 16px;
  --fs-xl: 18px;
}
```

**Steps:**
1. Add `:root` block at top of style.css
2. Replace ALL hardcoded colors with `var(--token)`
3. Replace spacing values with `var(--sp-*)`
4. Replace radius values with `var(--r-*)`
5. Replace font sizes with `var(--fs-*)`
6. Test every page/modal/function still works

**Files to modify:**
- `style.css` — add `:root`, replace all values
- No HTML changes needed (CSS-only)

---

### 1.3 Fix Color Contrast (WCAG AA)
**File:** `style.css`
**Impact:** 🔴 Accessibility — `#5a6474` fails AA (2.6:1 ratio)
**Effort:** Low (15 minutes)

**Current:** `#5a6474` on `#0d1015` = 2.6:1 ratio (fails WCAG AA minimum 4.5:1)

**Target:** `#7a8494` on `#0d1015` = 4.6:1 ratio (passes AA)

**Implementation:**
- Find all `#5a6474` in style.css
- Replace with `#7a8494`
- Also check `#8b949e` on small text (borderline 4.5:1 — acceptable for 13px+)

**Affected elements:**
- `.card-ref` (9px — fails even with fix, but decorative)
- `.stats` text
- `.searchwrap span` (icon)
- Various label/muted text

---

### 1.4 Toast Animations + Dismiss Button
**Files:** `style.css`, `app.js`
**Impact:** 🟡 Better UX — toasts currently appear/disappear instantly
**Effort:** Low (1 hour)

**Current behavior:**
- `toast()` in app.js creates `<div>`, appends, removes after 5s
- No entrance/exit animation
- No dismiss button
- Can stack multiple identical messages

**Target:**
- Slide-in from right on appear
- Slide-out on dismiss
- X button to close early
- Type-specific icons (success/error/warning)

**Implementation:**

CSS:
```css
@keyframes toastIn { from { opacity:0; transform:translateX(20px); } }
@keyframes toastOut { to { opacity:0; transform:translateX(20px); } }
.toast { animation: toastIn 0.25s ease; }
.toast.removing { animation: toastOut 0.25s ease forwards; }
.toast .toast-x { cursor:pointer; opacity:0.6; }
.toast .toast-x:hover { opacity:1; }
```

JS:
```js
function toast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.innerHTML = '<span>' + msg + '</span><span class="toast-x" onclick="this.parentElement.remove()">\u00d5</span>';
  document.getElementById('toasts').appendChild(el);
  setTimeout(function() {
    el.classList.add('removing');
    setTimeout(function() { el.remove(); }, 250);
  }, 4000);
}
```

**Files to modify:**
- `style.css` — add toast animations
- `app.js:523-527` — update `toast()` function

---

## PHASE 2 — MEDIUM (3-5 days, moderate risk)

### 2.1 Enable `parallel_map()` for Frame Rendering
**File:** `core/hardware.py`, `core/scene_engine.py`
**Impact:** ⚡ Multi-core frame generation
**Effort:** Medium (3-4 hours)

**Current:** `hardware.py` has `parallel_map()` using `ProcessPoolExecutor` — NEVER CALLED

**Target:** Use it for effects processing and potentially scene rendering

**Implementation:**
1. Import `parallel_map` in `scene_engine.py`
2. Apply to effects batch processing (each frame independently)
3. Keep frame generation sequential (PIL not process-safe for shared state)
4. But effects (numpy/OpenCV) can be parallelized per-frame

**Risk:** Process pool overhead for small videos. Gate behind frame count threshold.

**Files to modify:**
- `core/scene_engine.py` — parallelize effects
- `core/effects_engine.py` — batch effect application
- `core/hardware.py` — verify threshold tuning

---

### 2.2 Parallel Batch Render
**File:** `remotion/dashboard/routes/render.js`
**Impact:** ⚡⚡ 2-3x batch speed
**Effort:** Low-Medium (2 hours)

**Current:** Queue processes videos ONE AT A TIME (`processQueue()` sequential)

**Target:** Render 2-3 videos simultaneously using Remotion's built-in concurrency

**Implementation:**
1. Change `processQueue()` to launch 2-3 concurrent renders
2. Track active render count
3. Each render is independent (own subprocess, own temp files)
4. Respect system resources — don't overload CPU
5. Add `MAX_CONCURRENT_RENDERS` config (default: 2)

**Risk:** Higher CPU/RAM usage. Need resource monitoring.

**Files to modify:**
- `remotion/dashboard/routes/render.js` — `processQueue()` parallel launch
- `remotion/remotion.config.ts` — `setConcurrency(2)` explicit

---

### 2.3 Modal Accessibility (`role="dialog"` + `aria-modal`)
**File:** `index.html`
**Impact:** 🔴 Screen readers can't identify modals
**Effort:** Low (1 hour)

**Current:** Only YouTube panel has `role="dialog"`. All other modals (8+) lack it.

**Target:** All `.modal-bg` elements have `role="dialog" aria-modal="true" aria-labelledby="[heading-id]"`

**Implementation:**
1. Add unique `id` to each modal heading (`<h2>`)
2. Add `role="dialog" aria-modal="true" aria-labelledby="heading-id"` to each `.modal-bg`
3. Update JS focus trap to respect ARIA

**Affected modals (9 total):**
- `#playerbg` — Video Player
- `#modalbg` — Add/Edit Dua
- `#voicebg` — Voice Only
- `#aiimportbg` — AI Import
- `#helpbg` — Help
- `#setbg` — Settings
- `#histbg` — History
- `#aimodalbg` — AI Parse (old)
- `#vfxbg` — VFX Studio

**Files to modify:**
- `index.html` — add attributes to all modals

---

### 2.4 Mobile Card Popover Fix
**File:** `style.css`
**Impact:** 🔴 Card content inaccessible on mobile
**Effort:** Medium (2 hours)

**Current:** `.card-pop` uses `position: absolute; left: 50%; transform: translateX(-50%)` — overflows on mobile

**Target:** At ≤520px, convert to bottom sheet or modal pattern

**Implementation:**

Option A (Bottom Sheet):
```css
@media(max-width:520px) {
  .card-pop {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    top: auto;
    width: 100%;
    max-height: 60vh;
    border-radius: 16px 16px 0 0;
    transform: none;
    animation: sheetUp 0.25s ease;
  }
  @keyframes sheetUp { from { transform: translateY(100%); } }
}
```

Option B (Modal on mobile):
```css
@media(max-width:520px) {
  .card:hover .card-pop { display: none; }
  /* JS: on card tap, show as modal instead */
}
```

**Files to modify:**
- `style.css` — mobile media query for `.card-pop`
- `app.js` — optional: tap handler for mobile

---

### 2.5 Skeleton Loading States
**Files:** `style.css`, `app.js`
**Impact:** 🟡 Better perceived performance
**Effort:** Medium (2 hours)

**Current:** Plain "Loading..." text with spinner

**Target:** Skeleton card placeholders that mimic grid layout with shimmer

**Implementation:**

CSS:
```css
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--surface-1) 25%, var(--surface-2) 50%, var(--surface-1) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--r-md);
}
.skeleton-card {
  height: 200px;
  border-radius: var(--r-lg);
}
```

JS:
```js
function showSkeleton(count) {
  var html = '';
  for (var i = 0; i < (count || 8); i++) {
    html += '<div class="skeleton skeleton-card"></div>';
  }
  document.getElementById('grid').innerHTML = html;
}
```

**Files to modify:**
- `style.css` — add skeleton styles
- `app.js:28` — replace "Loading..." with skeleton

---

### 2.6 Fix Focus Trap Memory Leak
**File:** `app.js`
**Impact:** 🟡 Event listeners accumulate
**Effort:** Low (30 minutes)

**Current:** `_trapFocus()` adds `keydown` listener but NEVER removes it on modal close

**Target:** Store handler reference, remove on close

**Implementation:**
```js
function _trapFocus(modalId) {
  var modal = document.getElementById(modalId);
  var handler = function(e) {
    if (e.key === 'Escape') { closeModal(modalId); return; }
    if (e.key !== 'Tab') return;
    // ... trap logic
  };
  modal._focusHandler = handler;
  modal.addEventListener('keydown', handler);
}

function _removeTrapFocus(modalId) {
  var modal = document.getElementById(modalId);
  if (modal._focusHandler) {
    modal.removeEventListener('keydown', modal._focusHandler);
    modal._focusHandler = null;
  }
}
```

**Files to modify:**
- `app.js` — update `_trapFocus` and all modal close functions

---

### 2.7 YouTube Table Mobile Scroll
**File:** `style.css`
**Impact:** 🟡 Content overflow on mobile
**Effort:** Low (10 minutes)

**Current:** `.yt-uploaded-wrap` has `overflow-y: auto` but no `overflow-x`

**Target:** Horizontal scroll for table on narrow screens

**Implementation:**
```css
.yt-uploaded-wrap {
  overflow-x: auto;  /* add this */
}
```

**Files to modify:**
- `style.css:227` — add `overflow-x: auto`

---

## PHASE 3 — LARGER (1 week+, higher risk)

### 3.1 Stream Frames to Encoder
**File:** `core/video_builder.py`, `core/scene_engine.py`
**Impact:** ⚡ Lower memory, enables pipelining
**Effort:** High (1-2 days)

**Current:** ALL frames stored in `List[Image]` in RAM, then passed to encoder
- 20s video = ~900 PIL Images = ~2-4 GB RAM

**Target:** Generator pattern — yield frames to encoder as produced

**Implementation:**
```python
def frame_generator(dua_data, config):
    for scene in timeline:
        for frame_idx in range(scene.frame_count):
            yield render_frame(scene, frame_idx)

# Writer consumes generator
write_video(frame_generator(dua_data, config), output_path)
```

**Risk:** Requires refactoring the entire frame rendering chain. High complexity.

**Files to modify:**
- `core/scene_engine.py` — convert to generator
- `core/video_builder.py` — accept generator input
- `core/effects_engine.py` — apply effects on-the-fly
- `main.py` — update pipeline orchestration

---

### 3.2 Single-Pass Encode (Pipeline A)
**File:** `core/video_builder.py`
**Impact:** ⚡ Faster encode (skip intermediate)
**Effort:** Medium (3 hours)

**Current:**
```
Pass 1: Frames → temp.mp4 (CRF 10, ultrafast)
Pass 2: temp.mp4 → final.mp4 (CRF 15, slow, + filters + audio)
```

**Target:** Single pass with filters + audio:
```
Frames → final.mp4 (CRF 15, slow, + filters + audio)
```

**Implementation:**
- Merge encode + mux into single ffmpeg command
- Use pipe input for frames (avoid temp file)
- Apply filters (unsharp, eq) in same pass

**Files to modify:**
- `core/video_builder.py` — rewrite encode pipeline

---

### 3.3 Styled Confirm Modal
**File:** `app.js`, `style.css`, `index.html`
**Impact:** 🟡 Consistent design system
**Effort:** Medium (3 hours)

**Current:** Native `confirm()` used 10+ times — breaks dark theme

**Target:** Custom styled modal with Promise-based API

**Implementation:**
```js
function styledConfirm(title, message) {
  return new Promise(function(resolve) {
    document.getElementById('confirm_title').textContent = title;
    document.getElementById('confirm_msg').textContent = message;
    document.getElementById('confirm_yes').onclick = function() { resolve(true); };
    document.getElementById('confirm_no').onclick = function() { resolve(false); };
    document.getElementById('confirmbg').classList.add('show');
  });
}

// Usage:
if (await styledConfirm('Delete Dua', 'Kya aap waqai is dua ko delete karna chahte hain?')) {
  // delete
}
```

**Files to modify:**
- `index.html` — add confirm modal HTML
- `style.css` — add confirm modal styles
- `app.js` — replace all `confirm()` calls with `styledConfirm()`

---

### 3.4 Mobile Navigation
**File:** `index.html`, `style.css`, `app.js`
**Impact:** 🟡 Better mobile UX
**Effort:** Medium-High (4-5 hours)

**Current:** Toolbar chips always visible, wrap on small screens but cluttered

**Target:** Hamburger menu at ≤600px with slide-out panel

**Implementation:**
```css
@media(max-width:600px) {
  .toolbar-actions { display: none; }
  .toolbar-actions.open {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 280px;
    background: var(--surface-1);
    padding: 20px;
    z-index: 100;
    animation: slideIn 0.2s ease;
  }
}
```

**Files to modify:**
- `style.css` — mobile nav styles
- `app.js` — toggle handler
- `index.html` — add hamburger button

---

### 3.5 Card Enter/Exit Animations
**File:** `style.css`
**Impact:** 🟢 Polished feel
**Effort:** Low (30 minutes)

**Implementation:**
```css
.card { animation: cardIn 0.2s ease; }
@keyframes cardIn {
  from { opacity: 0; transform: translateY(8px); }
}
```

**Files to modify:**
- `style.css` — add animation to `.card`

---

### 3.6 Manifest Pre-generation
**File:** `scripts/bulk_build.py`
**Impact:** ⚡ Pipeline overlap
**Effort:** Medium (2 hours)

**Current:** Manifest generated one-by-one before each render

**Target:** Pre-generate manifests for all unrendered duas in bulk

**Implementation:**
- Run `make_manifest.py` for all unrendered duas
- Store in `remotion/src/data/<id>.json`
- Remotion render skips manifest step if file exists

**Files to modify:**
- `scripts/bulk_build.py` — add manifest generation
- `remotion/scripts/make_manifest.py` — skip-if-exists check

---

## EXECUTION ORDER

```
PHASE 1 (Quick Wins) ──── do first, low risk
  1.1 Parallel TTS
  1.2 CSS Custom Properties
  1.3 Fix Color Contrast
  1.4 Toast Animations

PHASE 2 (Medium) ──── do second, moderate risk
  2.1 Enable parallel_map()
  2.2 Parallel Batch Render
  2.3 Modal Accessibility
  2.4 Mobile Card Popover
  2.5 Skeleton Loading
  2.6 Focus Trap Fix
  2.7 YouTube Table Scroll

PHASE 3 (Larger) ──── do last, higher risk
  3.1 Stream Frames
  3.2 Single-Pass Encode
  3.3 Styled Confirm
  3.4 Mobile Nav
  3.5 Card Animations
  3.6 Manifest Pre-gen
```

---

## RISK ASSESSMENT

| Phase | Risk Level | Rollback Ease | Testing Required |
|-------|-----------|---------------|-----------------|
| 1.1 Parallel TTS | Low | Easy (revert to sequential) | TTS output quality |
| 1.2 CSS Variables | Low | Easy (revert CSS) | Visual regression |
| 1.3 Color Contrast | Low | Trivial | Visual check |
| 1.4 Toast Animations | Low | Easy | Manual test |
| 2.1 parallel_map | Medium | Medium | Frame output comparison |
| 2.2 Batch Parallel | Medium | Easy (set concurrency=1) | Resource monitoring |
| 2.3 Modal ARIA | Low | Easy | Screen reader test |
| 2.4 Mobile Popover | Medium | Easy | Mobile device test |
| 2.5 Skeleton | Low | Easy | Visual check |
| 2.6 Focus Trap | Low | Easy | Keyboard nav test |
| 2.7 Table Scroll | Low | Trivial | Mobile test |
| 3.1 Stream Frames | High | Hard (major refactor) | Full pipeline test |
| 3.2 Single-Pass | Medium | Medium | Video quality QC |
| 3.3 Confirm Modal | Low | Easy | Manual test |
| 3.4 Mobile Nav | Medium | Easy | Mobile test |
| 3.5 Card Animations | Low | Trivial | Visual check |
| 3.6 Manifest Pre-gen | Low | Easy | Render test |

---

## ESTIMATED TIMELINE

| Phase | Duration | Prerequisites |
|-------|----------|---------------|
| Phase 1 | 1-2 days | None |
| Phase 2 | 3-5 days | Phase 1 complete |
| Phase 3 | 1 week+ | Phase 2 complete |
| **Total** | **~2 weeks** | — |
