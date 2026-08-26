> **FROZEN — v0.10 complete (2026-08-25).** Ye file archive hai. Saare future
> notes v0.11 ke liye `notes0.11.md` mein jayenge. Yahan se koi cheez
> aagey nahi badegi.

---

## 2026-08-25 (v0.10) — RE-UPLOAD GUARD (4-LAYER)

BOSS ISSUE: Wife ne double-click kiya → ek hi video 2 bar upload ho gayi YouTube pe.
ROOT CAUSES:
  1. upload.py:474 — `and dua_id not in only_set` bypass tha → manual selections
     ka ledger check SKIP hota tha (by design, force re-upload feature).
  2. Portal picker mein uploaded videos freely select ho sakti thi bina warning.
  3. ytStart() mein koi uploaded-video warning nahi thi — sirf generic "LIVE?".
  4. Button click pe turant disable nahi hota — server 5s cooldown tha lekin UI
     react nahi karta tha.
FIX (4 independent layers):
  L1: upload.py — `and dua_id not in only_set` removed → hamesha skip.
  L2: server.js /api/youtube/upload — `ytAllUploadedIds()` check → 409 if dup.
  L3: ytStart() JS — frontend confirm + button immediately disabled.
  L4: ytToggleDua() — picker mein uploaded video select pe confirm dialog.
DEFENSE CHAIN: Layer 4 (select) → Layer 3 (start) → Layer 2 (server) → Layer 1 (script).
RESULT: Re-upload now physically impossible. All 4 verified + syntax-checked.
VERSION: server.js header "Dua Video Studio v0.10", title <sup>v0.10</sup>.

---

## 2026-08-24 (evening 5) — CLOCK-WIPE WEDGE BUG (CRITICAL, PURANE VIDEOS BAKED)

BOSS REPORT: "3rd line k end mey ajeeb cut off" (urdu content).
ROOT CAUSE: DuaVideo.tsx clock-wipe mask (urdu phase reveal) wipeDeg clamp
[0,370] - conic soft edge (wipeDeg-40) kabhi 360 cross nahi karta tha =>
330-370deg ka wedge HAMESHA invisible (from -90deg => LEFT-MIDDLE band =
RTL urdu lines ka tail!) Mask kabhi remove nahi hota tha.
FIX: interpolate [0,400] + wipeDeg>=400 pe mask=undefined (zero risk).
PROOF (definitive): same frame+look still render old-mask vs fixed =>
diff EXACTLY left-mid band 3171 px changed, baaki zones 0. Proof stills:
fx_proof/oldmask_f950.png vs fixed_f950.png.
SCOPE: bug PURANE SAARE videos me baked hai (96 mp4). Fix naye renders
pe apply hoga. MEGA RE-RENDER decision pending (boss).
NOTE: fps=24 hai (30 nahi) - comp duration = totalDuration*24.
RTL ragged-left ki wajah se left<right edge density NATURAL hai -
asymmetry test ke liye diff-based proof use karo (ratio tests noisy).

## 2026-08-24 (evening 4) — BACKGROUND 404 FIX (11 THEME JPGs)

Problem: Background.tsx har theme ke liye public/backgrounds/<theme>.jpg
HEAD-fetch karta hai (optional photo layer feature); folder EMPTY tha =>
har render pe console me 404 noise (graceful fallback tha is liye video
kharab nahi hota tha).
FIX: PIL se har theme ka EXACT gradient-matched 1080x1920 JPG generate
kiya (CSS linear-gradient parser incl. 165deg tilt wale themes).
Visual delta = ZERO (image layer same colors jo gradient div ke neeche
pehle se thi).
BONUS: ab chahein to kisi bhi theme ki jpg AI-photo se replace karke
photo background use kar sakte hain (feature live hai).
NOTE: manuscript theme LIGHT PARCHMENT hai (#f6edd9...) - dark nahi.
Files: remotion/public/backgrounds/{dark,mosque,sunset,manuscript,
emerald,ocean,desert,royal,ramadan,eid,qadr}.jpg
Script backup: temp/opencode/gen_bg_jpgs.py

## 2026-08-24 (evening 3) — VIDEO_MAX_DURATION 40 -> 50 (BOSS APPROVED)

Boss ne kaha "bismillah thori hatana hai" => sayyidul_istighfar ka
bismillah=false WALA decision REVERSED (bismillah=true restored).
Policy change: config.py VIDEO_MAX_DURATION = 50 (Shorts asli limit 60s).
Sayyidul final: urdu 242 chars + bismillah dono me => QC PASS,
video 51.18s. duration field=44.
quality_checker/timeline_builder/mixer sab config se read karte hain =>
single-point change, sab jagah propagate.
RULE UPDATE: ab speech <=50s policy. Lambe duaein ab aaram se fit.

## 2026-08-24 (evening 2) — BLURIN BUG FIX + SAYYIDUL DURATION FIX

BUG: blurin textFx mein showPill=TRUE har lafz pe (sirf active hona chahiye
tha) + future words opacity 0.16/blur7px => glowing BOXES dikh rahi thi lekin
andar ka text invisible => boss complaint "BOX pe content lighted nahi reh
raha". Aakhri Do Ayaat pe pakda (arabic phase lum 122 -> urdu phase 90 crash).
FIX (KaraokeText.tsx): pill sirf active word pe; future words opacity 0.38 +
blur 3px (readable ghost). tsc clean.
RE-RENDERED (force, voices same kyunki audio artifacts reuse... siwaye
sayyidul ke - uska TTS regen hua): bazaar_dakhil, bimar_ki_iyadat,
aakhri_do_ayaat, sayyidul_istighfar — sab QC PASS.
SAYYIDUL ISSUE: force=TTS regen => edge-tts ne overnight slow pace de diya
(Microsoft voice model update) => 48.7s speech > 40s policy. Fixes applied:
(1) urdu condensed 294->242 chars, (2) bismillah=false is dua ke liye
(bismillah INTRO me VISUAL phir bhi hota hai, sirf audio overlap hatega),
(3) duration field 30->36. Backup: duas.json.bak_sayyidul_trim.
LESSON: edge-tts voices server-side update hote hain => purani artifacts ke
bina force-render kabhi bhi policy fail kar sakta hai. Text trim se sirf
~0.03s/char milta hai; bismillah toggle ~7s bachata hai.
Pixel proof: aakhri naya version poore timeline pe STABLE (lum 42-46, koi
phase-crash nahi). Bazaar stable 76->70.

## 2026-08-24 (evening) — +10 NAYI DUAS (v3 batch) RENDERED

duas.json: 87 -> 97. Backup: data/duas.json.bak_newduas_v3.
Naye (sab unique id+title validated vs list, categories valid):
sayyidul_istighfar(Bukhari6306), adhan_ke_baad(Bukhari614),
qunut_witr(AbuDawud1425), rabbana_zalamna(7:23), bazaar_dakhil(Tirmizi3428),
bimar_ki_iyadat(Muslim2688), namaz_qaim_ibrahim(Ibrahim40),
aakhri_do_ayaat(2:286+Muslim808), la_hawla_kanz(Bukhari6382),
azkaar_bad_namaz(Muslim597).
Sab 10 v3 random looks ke sath render: QC PASS -14.3 LUFS x10,
thumbs <id>.png x10, out total 96 mp4.
Sample looks: qunut=desertmirage/deco/popwave/rehal/driftbreathe/
patternwipe/medallion | azkaar=volumetric/rosette/typewriter/kaaba/zoomin/
geostar (v3 dims LIVE in production renders).
LESSON: render driver stdout buffering => python -u use karo; server job
background mein chalta rehta hai agar driver mar jaye (resume-safe).
BAKI/PENDING: MEGA RE-RENDER purane videos ka - user decision pending.

## 2026-08-24 (later) — MASTER LOOK v3: PLUGIN ARCHITECTURE + 6 NAYE DIMENSIONS

USER REQUIREMENT: "aise design karo ke aage koi bhi naya idea easily add
ho sake" => REGISTRY-driven system banaya. Naya dimension = 1 entry server
registry + 1 component Remotion module. Kuch aur nahi chhuna padta.

SERVER (fx-guardrails.js):
- LOOK_DIMENSIONS registry: {preset,borderFx,skyFx,artFx} (purane,
  theme-affinity pools) + 6 NAYE: frame/textFx/motif/gradeFx/camera/
  introFx/ornament. Har entry = pool factory(theme).
- LOOK_WEIGHTS: classic/glide/auto defaults zyada (taste guard).
- pickWeighted(pool, weights), filterPresetPool(theme) exports.
- look-spec.js buildLookSpec: ab registry LOOP hai (11 dims auto-pick).

REMOTION (src/LookVariants.tsx NEW ~575 lines):
- ORNAMENT_IDS: starcrescent(purana StarOrnament moved here)/
  lanternjhumka(lalten pair swing+glow)/medallion(8-petal rosette
  rotate+breathe)/geostar(double-square lattice shimmer)
- CAMERA_IDS: static/zoomin(+5.5% linear)/panx(+-2.6% seed-dir,scale1.045)/
  kenburns(y+rot+scale drift)/driftbreathe(slow sin breathe). Scale>=1
  always (no edge gaps). Poora visual stack wrap hota hai (progress bar +
  audio + grades bahar).
- MOTIF_IDS: none/tasbih/kaaba/rehal(quran-stand)/star8 - bada faint SVG
  icon bg mein drift karta hai. OPACITY LESSON: 0.075 pe detector AND
  aankh dono miss (avg-diff 0.00 EXACT) => 0.30 dark / 0.18 paper final +
  glow drop-shadow + thickened strokes. Pixel proof: kaaba avg=0.46
  strong=50, tasbih avg=0.23 strong=70.
- INTRO_IDS: classic(DrawOnBismillah moved here)/crescentfade(chand pop+
  bismillah fade-up)/patternwipe(rotating star pattern + circle wipe).
  BISMILLAH const bhi yahan shift.
KaraokeText.tsx: mode prop (TEXT_FX_IDS glide/blurin/typewriter/popwave),
word-level only (RTL ligature-safe research note). typewriter = caret
block blink + pill; blurin = future words blur7px->sharp; popwave =
spring pop + residual wave on past words.
GradeLayer.tsx: moodId prop (MOOD_GRADES warmgold/coolnight/sepia/dreamy)
theme grade ke UPAR subtle overlay.
DuaVideo: LookSpec += textFx/motif/gradeFx/camera/introFx/ornament (+flat
legacy mirrors in normalization). Purana IntroCard/DrawOnBismillah/
StarOrnament defs REMOVE (ab LookVariants se).

server.js: lookSummary badge ab extras dikhata hai:
  t:textFx m:motif g:gradeFx c:camera i:introFx o:ornament (sirf jab
  default se alag). THUMB LOOK log fix (wrapped file .preset undefined
  tha => unwrap + preset/frame/camera print).
Portal history verified LIVE:
  "cinemafocus / none / petals / vines / deco / t:typewriter / m:rehal /
   g:sepia / c:panx / i:crescentfade / o:medallion"

TESTS: tsc clean. Still A/B pixel diffs (frame300, royal/classic base):
  popwave+kenburns strong=2565 full | typewriter+zoomin=2294 |
  crescentfade intro center=609 topband=0(correct intro-only) |
  warmgold avg=6.3 no hard edges(subtle grade correct). E2E force render
  salah_end: manuscript theme, ALL v3 dims picked, QC PASS -14.3 LUFS,
  thumb regen, mp4 count 86 intact.

NAYA IDEA ADD KARNE KA TARIQA (docs):
  1. fx-guardrails.js: pool array + LOOK_DIMENSIONS entry (+weights opt.)
  2. LookVariants.tsx: component + ID list + dispatcher case
  3. DuaVideo: sirf agar bilkul naya LAYER type ho (existing 6 me na fit)
  Bas - agle render se random picks mein shamil.
BAKI/PENDING: 10 new-dua videos abhi v2 looks par hain (v3 fields missing
=> safe defaults chal rahe); MEGA RE-RENDER user decision pending.

## 2026-08-24 — PHASE B + PHASE A COMPLETE: FULL FX STACK LIVE (17 effects)

NAYE FILES:
- remotion/src/SkyFx.tsx (Phase B): rain / storm(rain+lightning strikes
  deterministic) / snow / fog banks / smoke(bakhur, dono kono se) /
  fireflies(pulsing glow wander) / petals(rotating fall sway)
- remotion/src/BorderFx.tsx (Phase A): clouds(parallax drift wrap) /
  birds(flock flap bob cross) / flags(pendulum pennant strings) /
  wind(streaks + urte patte)

GUARDRAILS v3 (fx-guardrails.js): positive-affinity maps sab teen pools:
  BORDER_ALLOWED: clouds[night/ramadan/sunset/royal] flags[celebration]
    wind[desert/sunset/green]
  SKY_ALLOWED: rain/storm night themes; snow winter-nights; fog misty;
    fireflies garden-nights; petals celebration/paper; smoke=ALL
  filterSkyPool/filterBorderPool/filterArtPool (filterAffinity core).
  NOTE: purana exclude-map approach hata diya (positive affinity better).

DuaVideo layer order: Background > BorderFx > ArtFx > SkyFx > content/text
Server: config.skyFx + config.borderFx ('auto'|forced), settings me ab
TEEN dropdowns (Islamic Art / Sky Weather / Border), POST sanitize.

TESTS (pixel-diff, frame-200 mostly):
  rain=31 snow=78 storm=1341(frame125 strike) clouds=2593 birds=46
  flags=157 PASS || fog/smoke/petals/fireflies/wind = SOFT-BY-DESIGN
  (cluster-dump se confirm: smoke columns x~130/x~950 rising correctly;
   grid-sampling thin/soft fx ko miss karta tha - threshold lesson noted)
  LESSON: soft gradient fx ke liye cluster-map dump (delta>8 buckets) use
  karo, strict threshold nahi.
E2E: forced storm+birds full render => glitterroyal/birds/storm/rosette
  look file, QC PASS -14.3 LUFS, thumb match. FINAL CONFIG: sab AUTO.

TOTAL SYSTEM ABHI: 15 style presets x {5 border + 8 sky + 7 art} fx
random combos, guardrail-filtered per theme, har render naya look,
voices stable, thumbs guaranteed-match.

BAKI/PENDING: MADAD guide me naye dropdowns ka zikr (cosmetic);
manuscript.jpg asset missing (404) - alag task; MEGA RE-RENDER planning
(76 videos naye random system se) - USER decision kab aur kitni.

---## 2026-08-23 — PHASE C COMPLETE: ISLAMIC ART FX (6 effects) LIVE
NAYA FILE: remotion/src/ArtFx.tsx (ArtFxLayer dispatcher, mulberry32 seeded)
  1. rosette  - kono par 8-point star medallions + kinari band draw-on (110f)
  2. sitare   - 16 chamakte sitare + girti nuqta-dots (v2 boosted: glow+size,
                paper theme par pehle bohot subtle tha - diff 5 -> 75 fix)
  3. vines    - arabesque beliyan kono se ugti (140f draw-on, patte spring)
  4. lanterns - 6 fanous kinaron se rise loop, flicker+wobble+glow
  5. caravan  - 3 oont silhouette dune par cross (sirf desert/sunset themes)
  6. palms    - 4 khajoor darakht corners pe sway intro-spring ke sath

GUARDRAILS (fx-guardrails.js): ART_ALLOWED positive-affinity map -
  caravan[sunset,desert] palms[desert,sunset,emerald,ocean]
  vines[emerald,manuscript,royal,eid,ocean,qadr]
  lanterns[dark,mosque,royal,ramadan,eid,qadr]; rosette/sitare = sab themes.
  filterArtPool() look-spec me; manual override guardrail BYPASS karta hai
  (user ki explicit choice > taste rule).

INTEGRATION: DuaVideo.tsx <ArtFxLayer fx=lookSpec?.artFx seed=lookSpec?.seed>
  Background ke baad, text se pehle (readable-safe). Server: config.artFx
  ('auto'=random | fx-id=forced) + settings dropdown s_art + POST sanitize.

VERIFICATION (pixel-diff vs none-baseline, frame-100/140 stills):
  rosette=103 PASS | sitare-v2=75 PASS | vines=146 PASS
  caravan=2789 PASS | palms=666 PASS | lanterns=52 PASS
  Full-video E2E bhi PASS (lanterns forced render: DONE + QC PASS).
  NOTE: model image-preview support nahi karta isliye System.Drawing
  pixel-diff verification technique use ki (reusable pattern).

FINAL CONFIG: stylePreset=auto, lookMode=random, artFx=auto
PENDING POLISH: MADAD guide me Art FX dropdown ka zikr add karna (cosmetic);
manuscript.jpg background asset abhi bhi missing (404) - alag task.

NEXT OPTIONS: Phase B (sky/weather FX) ya Phase A (border basics) ya
mega re-render planning. USER decides.

---## 2026-08-23 — BUILD COMPLETE: RANDOM LOOK SYSTEM ("Har Bar Naya") LIVE
### Backup pehle banaya: H:\DuaVideoGenerator_BACKUP_2026-08-23_v1_functional
### (939 files / 2.5GB - code+videos+thumbs+audio; sirf node_modules exclude)

USER DECISIONS LOCKED: voices STABLE (kabhi random nahi), FX phase order =
C (Islamic Art) pehle, phir B/A jaisa user bole.

NAYE FILES:
- remotion/dashboard/fx-guardrails.js - taste tables (PRESET_EXCLUDE,
  BORDER/SKY/ART pools 'none' se shuru, SKY_EXCLUDE manuscript rain/storm)
- remotion/dashboard/look-spec.js - buildLookSpec(theme): {seed, preset,
  borderFx, skyFx, artFx, theme, generatedAt}

SERVER.JS CHANGES:
- readLookMode() default 'random'; ensureLookSpec(duaId,dua): file reuse
  within job, delete-on-signature; doJob me HAR NAYE JOB par file DELETE
  phir ensure => naya look har render par (pehle bug tha: reuse forever)
- stylePropsArgs(duaId): explicit preset > saved look file > [] (legacy)
- npxRender + genThumb dono duaId pass karte hain; genThumb THUMB LOOK log
- recordHistory extra {look: "preset/border/sky/art"} batch+single dono
- Settings modal radio [Har Bar Naya | Signature] + POST /api/config
  lookMode sanitize; History modal me golden look badge
- cleanup_temp.py ko kuch NAHI karna - JUNK_EXT me _look.json NAHI hai
  (jaan-boojh ke hamesha rakhte hain ~200B, warna thumb mismatch)

DUAVIDEO.TSX: LookSpec interface export + resolution order:
  masterpiece flag > lookSpec.preset > stylePreset prop > hash-auto
  (purani videos backward compatible - unke thumbs hash se match)

TEST RESULTS (salah_end, force renders):
  T1 PASS - render #1: cinematic seed 733808107, QC PASS (-14.3 LUFS),
     history look badge aya
  T2 PASS - render #3: waterripple seed 439881704 (alag look!)
     [bug fix beech me: file-delete line add ki - warna hamesha same]
  T3 PASS - THUMB LOOK waterripple == video ka look (usi file se props)
  T4 PASS-by-design - retry/thumb isi job ki file padhte hain
  T5 PASS - signature mode: koi look file nahi, koi LOOK log nahi,
     purana hash-auto behavior; config wapis random restore
  T6/T7 - agla batch / FX phases par prove honge
FINAL CONFIG: {"channelName":"Noor-e-Iman","handle":"@bushranasir1075",
  "stylePreset":"auto","lookMode":"random"}

NOTE: manuscript.jpg background 404 (pre-existing asset gap, theme image
missing; Background color-fallback se video theek banti hai) - baad me
asset add karna ya theme-map adjust.

NEXT (user go-ahead): PHASE C Islamic Art FX - ART_FX pool bharna
(rosette-draw/calligraphy-sparkle/vines/rising-lanterns/caravan/palm-oasis)
+ DuaVideo.tsx components consume karne lagenge (seed micro-variations).

---## 2026-08-23 — AUDIT + PICTURE-PERFECT IMPLEMENTATION PLAN (Random Look System)
### (KOI CHANGE NAHI - ye exact build blueprint hai, user order par execute hoga)

=== DETAILED AUDIT FINDINGS (verified code anchors) ===

F1. PROPS FLOW SAFE: Root.tsx defaultProps={{data}} + CLI --props per-key
    merge karta hai (missing keys fallback). Aaj stylePreset isi tarah jata
    hai => lookSpec bhi top-level prop key banega. RISK ZERO.
F2. THEME DO JAGAH RESOLVE HOTA HAI:
    - Python make_manifest.py resolve_theme (manifest me bake, har render)
    - JS dashboard/theme-map.js resolve(d) (portal display mirror)
    => Guardrails ke liye server theme-map.js use karega (render se pehle).
F3. RETRY GOTCHA (CRITICAL): doJob me QC fail par DOOSRA npxRender hota hai
    (server.js approx L650). Agar retry par naya lookSpec bana to QC wali
    video alag look ki hogi! FIX: lookSpec FILE ek dafa likho, retry USE
    karega, regenerate NAHI.
F4. THUMBNAIL GOTCHA (CRITICAL): genThumb() alag remotion 'still' call hai
    (stylePropsArgs() ke sath). Random looks me thumb ALAG look ka ban sakta
    tha. FIX: thumb usi saved <id>_look.json se props lega => match 100%.
    Note: thumbsAll() standalone path bhi isi file padhega.
F5. CACHE SAFE: cacheKey md5(dua+audio+config+sfx) me lookSpec NAHI jayega
    (warna har render force jaisa ho jata). Cache sirf !force skip ke liye;
    naya look chahiye to force=true hi hai (portal expert checkbox).
F6. HISTORY READY: recordHistory(id, ok, extra) extra-object merge karta hai
    => lookSummary string extra me jayegi. Cap 200 entries maujood.
F7. BATCH OK: processQueue per-item doJob(false) - naye videos ko apna
    apna fresh lookSpec milega (queue-level shared NAHI).
F8. VOICES UNTOUCHED: pick_voice deterministic - plan me stable rakha gaya.
F9. StylePreview composition alag hai (1280x720) - optional future: isko
    bhi lookSpec prop dena (abhi skip).
F10. TEMP HYGIENE: <id>_look.json TEMP me - cleanup_temp.py abhi sirf
    .part/.tmp janta hai => ya to overwrite-per-render karo (simple) ya
    cleanup list me add karo (better).

=== PICTURE-PERFECT BUILD BLUEPRINT ===

STEP 1 - lookSpec GENERATOR (server.js naya module look-spec.js):
  function buildLookSpec(theme) {
    const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
    return {
      seed: Math.floor(Math.random()*1e9),
      preset: pick(ALLOWED.preset[theme] || ALL_PRESETS),
      borderFx: pick(ALLOWED.borderFx[theme] || ['none', ...]),
      skyFx: pick(...), artFx: pick(...),
      generatedAt: Date.now(),
    };
  }
  ALLOWED = guardrail table (theme-affinity) - naya file fx-guardrails.js.

STEP 2 - doJob INTEGRATION (server.js):
  - 'manifest' step ke BAAD (theme confirm ho jane par):
      const lookPath = path.join(TEMP, duaId + '_look.json');
      let spec;
      if (fs.existsSync(lookPath)) { spec = JSON.parse(read); }  // retry reuse
      else { spec = buildLookSpec(theme); writeAtomic(lookPath, spec); }
  - npxRender aur genThumb dono ko props file me spec include karne ka
    flag: stylePropsArgs(duaId) modified - agar lookPath exist kare to
    wahi file --props me jaye ({stylePreset, lookSpec} merged).
  - recordHistory extra: {look: spec.preset+'/'+spec.borderFx+'/'+spec.skyFx}

STEP 3 - REMOTION SIDE (DuaVideo.tsx):
  - Props type me lookSpec?: LookSpec;
  - presetFinal resolution ORDER: data.masterpiece > lookSpec.preset >
    stylePreset prop > autoPresetFor(hash)   [backward compatible]
  - Background.tsx: S fields lookSpec.se map karo (borderFx/skyFx abhi
    placeholder - Phase A/B components aane par active honge)
  - Micro-effects seeds: lookSpec.seed se derive (mulberry32(seed%1e6))

STEP 4 - PORTAL (server.js UI + API):
  - Settings modal: radio "Look Mode": [Har Bar Naya (random)] /
    [Fixed Signature (purana auto)] => config.lookMode ('random'|'signature')
  - saveSettings POST body + readStylePreset-style reader fn
  - History modal entries me look summary badge
  - MADAD guide me 1 line update (baad me)

STEP 5 - CLEANUP: cleanup_temp.py list me _look.json (30 din purana ho to)

=== TEST MATRIX (har step ke baad) ===
  T1: force render => video bani, history me look logged
  T2: USI video dobara force render => DIFFERENT look (random proof)
  T3: thumb vs video frame-100 compare => SAME look (match proof)
  T4: QC-fail simulate (mushkil) => retry same look (reuse proof)
  T5: signature mode select => re-render purane auto-jaisa (fallback proof)
  T6: batch queue 3 videos => teeno alag looks (variety proof)
  T7: paper-theme dua (manuscript) => storm/rain kabhi nahi (guardrail proof)

=== EXECUTION ORDER (user go-ahead ke baad) ===
  Step 1+2+3 (core) -> T1,T2,T3 -> Step 4 -> T5 -> T7 -> Phase A/B/C/D FX
  har FX group ke sath T6. Total approx 2-3 sessions code + tests.

STATUS: AUDIT + BLUEPRINT FINAL - zero code changes. Build sirf user
ke "START" command par.

---
## 2026-08-23 — USER DECISION: HAR BAR RANDOM LOOK (signature NAHI)
### (abhi bhi KOI CODE CHANGE NAHI - sirf revised planning)

USER NE KAHA: "har video ka apna signature look NAHI chahiye - har bar
RANDOM looks chahiye". Matlab Model C (deterministic hash) ko replace/
supplement karna hoga RANDOM-at-render-time se.

=== REVISED ARCHITECTURE: "RNG Look Spec" ===

FLOW (jab banega):
  1. Render start par server RANDOM "lookSpec" banata hai:
     {seed, preset, borderFx, skyFx, artFx, textFx, transition} 
     - guardrail-filtered (current theme ke allowed options me se)
  2. lookSpec --props FILE ke through Remotion ko pass hota hai
  3. DuaVideo prop ko use karta hai (hash-auto sirf fallback)
  4. VIDEO KE ANDAR sab consistent (ek hi seed se sab layers)
  5. lookSpec render HISTORY me LOG hota hai

KYA SEED KYA TRUE-RANDOM:
  - Video ke andar ki micro-randomness (particle positions, sway phases):
    seeded by lookSpec.seed => ek hi rendered mp4 hamesha identical
    (Remotion frame-determinism zaroori hai, warna frames corrupt lagte)
  - Video-to-video variety: lookSpec khud render ke waqt fresh random
    => har naya/re-render alag look

CRITICAL GOTCHAS (plan me handle hone chahiye):

1. THUMBNAIL MISMATCH RISK: genThumb alag process/chunk me chalta hai -
   agar usne ALAG random look liya to poster video se match nahi karegi!
   FIX: video render ke waqt lookSpec save (temp/<id>_look.json) =>
   thumb generation USI file se padhe => match guaranteed.

2. CACHE-HIT THUMB REGEN: THUMBS button purani videos ke posters banahta
   hai - unke paas lookSpec file ho gi (render ke waqt saved) to theek;
   PURANE videos (aaj ki batch) ke pas NAHI => unka thumb classic hi
   rahega jab tak re-render na ho. Acceptable.

3. REPRODUCIBILITY: agar kisi render ka look PASAND aa jaye aur wo
   dobara chahiye => history ka lookSpec replay karke exact recreate
   ho sakta hai. Isliye log zaroori, feature bhi easy (future).

4. VOICES: abhi gender-jodi deterministic hai. Random look me voices
   bhi random karne hain ya audio identity stable rakhni hai?
   (RECOMMEND: voices stable rakho per dua - awaz channel ki pehchan
   hai; visuals random, audio consistent = professional combo.)
   USER SE POOCHNA HOGA.

5. GUARDRAILS random par bhi lagenge: storm kabhi manuscript-paper par
   nahi, garden sirf green/ocean/dawn par etc. RNG allowed-list se
   pick karega (theme-aware filter), pure universe se NAHI.

PORTAL UI PLAN:
  - Settings me naya radio: "Look Mode": [Auto Signature] [Har Bar Naya]
  - Default: Har Bar Naya (user ki ye ichchha) 
  - History me har render ka look summary dikhe (preset+fx names)

EXISTING 76 VIDEOS PAR ASAR: zero abhi. Jab bhi force re-render hogi,
usi waqt fresh random look milega. Koi bulk re-render sirf user bole.

STATUS: PLANNING UPDATED per user decision - zero code changes.

---
## 2026-08-23 — MASTER PLAN: MAX POTENTIAL + RE-RENDER STRATEGY
### (USER ORDER: KOI CHANGE NAHI - sirf planning)

SACH YE HAI: har visual change ke liye RE-RENDER zaroori hai - style/voice/
effects mp4 me BAKE ho jate hain. Portal setting badalne se purani video
nahi badalti (server.js hint bhi yahi kehta: 'naya render usi preset se').

=== ZIADA SE ZIADA KYA HO SAKTA HAI (full potential) ===

LAYER STACK PER VIDEO (worst-case rich look):
  1. Theme (11): background scene + colors + decor
  2. Style Preset (15 CGI): aurora/bokeh/shimmer/gloss/chromatic/tilt/particles
  3. Border FX (~9): clouds/rain/storm/forest/garden/wind/flags/birds/tornado
  4. Sky FX: snow/fog/smoke-bakhur/fireflies/petals/milkyway/moon-phases
  5. Islamic Art FX: draw-on rosette border/calligraphy sparkles/arabesque
     vines/rising lanterns/caravan silhouettes/mosaic assemble
  6. Text FX: ink-bleed reveal/gold-foil sheen/word-sync glow pulse
  7. Film FX: light-leak sweeps/lens flare/VHS(special)/grain(vary)
  8. Transitions: ink-splash/star-iris wipe (ar->ur boundary par)
TOTAL unique looks theoretically: 11x15x9x~8x~6x~4 ~= lakhs - practically
guardrails ke sath ~200-400 tasteful combos jo channel variety dega.

=== RE-RENDER KA HISAB ===

Current state: 76 videos BAKED hain:
  - ~66 purane 5-preset auto se (batch 70/70 aaj complete hui thi)
  - 3 CGI tests (volumetric/waterripple/embernight)
  - baqi individual renders
Render cost: ~90-120 sec/video => 76 videos = approx 2 - 2.5 ghante/pass
Disk: approx 25MB avg x 76 = approx 2GB per generation (155GB free - no issue)

STRATEGY OPTIONS:
  OPT-1 (RECOMMENDED): SAB PEHLE CODE, PHIR EK FINAL MEGA PASS
    - Saare phases ka code develop + test (3 sample renders per phase)
    - Jab user khush: EK hi full re-render (2.5 hrs background) =>
      76/76 videos naye Effect Stack ke sath => phir upload schedule
    - Re-render count: sirf 1x (baad me sirf NEW features par partial)
  OPT-2: har phase ke baad full re-render => 4-5 passes = 10+ hrs wasted.
    REJECT.

=== PHASED ROADMAP (har phase me: code -> 3 test renders -> user PLAY approval) ===

PHASE 0 - Effect Stack Architecture (code only, no visual change):
  - ResolvedStyle me stack fields + independent hash multipliers per axis
  - make_manifest.py me theme-affinity guardrail table
  - Portal: alag dropdowns (Style/Border/Sky/Islamic FX) sab Auto default
  - StylePreview ko preset pass (previews live dikhne lagenge)

PHASE A - Border Basics (easy wins):
  - Clouds drift | Birds flock | Swinging flags | Wind gust streaks
  - Test: 3 renders different themes

PHASE B - Weather & Atmosphere:
  - Rain (+storm lightning combo) | Snow | Fog banks | Bakhur smoke |
    Fireflies | Petals fall

PHASE C - Islamic Art Showcase (channel ki pehchan):
  - Draw-on geometric rosette border medallion
  - Calligraphy sparkle intro (diacritics sitare ban kar girte hue)
  - Arabesque vine corners growing | Rising lanterns
  - Caravan silhouette (desert themes) | Palm oasis sway

PHASE D - Text & Film Polish:
  - Ink-bleed urdu reveal | Gold foil sheen on text | Word-sync glow
  - Light leaks at section transitions | Star iris wipe ar->ur

FINAL STEP - Mega Re-render Day:
  - 76 videos full stack ke sath (approx 2.5 hr background queue)
  - QC sweep + portal review
  - Phir upload plan (user control me - kabhi bhi bina pooche NAHI)

DECISIONS USER SE CHAHIYE (jab start karein):
  1. Purani 76 videos bhi naye stack se re-render? (recommend: HAAN, 1x)
  2. Upload pehle hui videos ko replace karna hai ya sirf nayi series?
  3. Kaunsa phase pehle? (recommend: C Islamic Art - channel identity)

STATUS: PLANNING ONLY - zero code changes is entry ke sath.

---
## 2026-08-23 — STUDY #2: MULTI-CANVAS + RANDOMIZATION ARCHITECTURE
### (USER ORDER: CHANGE NAHI - sirf study)

Q1: Kya same CGI/VFX effects MULTIPLE canvases pe apply ho sakte hain?
A: HAAN - 3 levels par:

1) SAARE VIDEOS AUTOMATIC: Effects components (BokehLayer/ShimmerVeil/GlossSweep/
   ChromaticEdges/NoiseVeil/particle styles) sirf ResolvedStyle fields padhte
   hain - theme/decor se koi lena-dena nahi. Ek component code 76 videos chala
   raha hai; naya effect add karo => sab videos available.
2) EK VIDEO KE ANDAR STACKING: AbsoluteFill layers unlimited - BokehLayer do
   baar (alag seeds) = near/far DoF depth. Har effect independent instance.
3) PREVIEWS: StylePreview.tsx <Background theme/> bina stylePreset ke =>
   portal previews CLASSIC hi dikhate hain (naye effects previews me NAHI).
   Design decision pending: preview me preset pass karna ya nahi.

Q2: Kya in sab ke sath RANDOMIZE ho sakta hai?
A: HAAN - lekin 3 models hain (trade-offs):

MODEL A - Per-render true random: har re-render different look.
   PROBLEM: stability toot ti (approved video dobara render = koi aur look).
   REJECT for baked renders.
MODEL B - Seed-in-manifest: pehli render par seed save (manifest me), baad
   me wahi seed => stable + varied. BEST jab "har video unique feel" chahiye.
MODEL C - Deterministic hash axes (CURRENT SYSTEM): charCode-sum hash se
   rotation. Theme rotation ALREADY isi tarah (CATEGORY_ROTATIONS +
   GENERAL_ROTATION, make_manifest.py _seed_pick). Preset auto %15 bhi yahi.

CORRELATION WARNING (important): abhi EK hash multiple decisions drive karta
hai - gender bit ((h>>3)&1) + regional slot (h%len) + preset (h%15). Aur
axes add karne par (borderFx, particleStyle, weather) same-hash duas HAR
axis par same slot payengi = correlated combos. FIX pattern proven hai:
urdu voice fix jaisa alag multiplier per axis - e.g. axis2=(h*31+len*17+5)%N,
axis3=(h*13+len*29+7)%M... har dimension independent coverage.

COMBO EXPLOSION MATH:
11 themes x 15 presets x ~9 borderFx x 4 particle styles = 5,940 combos.
Sab acche NAHI (rain+manuscript paper? storm+minimal clean clash).
GUARDRAILS chahiye: compatibility matrix / category affinity rules -
e.g. storm sirf night themes (dark/qadr/mosque), garden sirf garden/ocean/
emerald/dawn, desertmirage sirf desert/sunset dunes.

PERFORMANCE BUDGET (worst case stack):
bokeh(34 dots) + shimmer SVG + gloss + chromatic + borderFx(birds 5) +
particles(1.45x) ~= 70-80 DOM nodes @1080x1920x30fps - Chrome headless OK,
render time approx +10-20%. Waterripple ne SVG filter already prove kiya.

RECOMMENDED DESIGN (jab user bole):
- "Effect Stack" model: har video ka apna stack {preset, borderFx, particleFx,
  weatherFx} - sab deterministic-seeded (Model C improved multipliers).
- Portal dropdowns: alag-alag (Style / Border FX / Sky FX) + "Auto" default.
- Taste-guardrail table make_manifest.py me (theme-affinity).
- Preview cards ko bhi preset pass karke live dekhne layak banana.

STATUS: RESEARCH ONLY - zero code changes is entry ke sath.

---
## 2026-08-23 — STUDY ONLY: LIVING BORDERS + FUTURE EFFECTS CATALOG
### (USER ORDER: KUCH BHI ABHI APPLY NAHI KARNA - sirf research)

### PART 1: BORDER FX STUDY (user request: clouds/tornado/rain/lightning/
### forest/garden/wind/swinging-flags/flying-birds canvas borders ke liye)

CURRENT STATE (verified code se):
- CornerOrnaments (Background.tsx L451): spring intro cascade + wobble decay +
  breathe - magar SHAPE static (2 gold lines + rotating diamond per corner).
- Gold double frame (L1469): gradient sheen travel + flicker - geometry fixed.
- Paper borders: royal filigree shimmer sin / plain divs - static.
- REUSABLE mechanics pehle se maujood: lantern top-origin sway (rotate+sin),
  noise2D wander, mulberry32 seeded randomness, per-frame SVG filter animate
  (ShimmerVeil/waterripple PROVEN), foreground parallax rig (borderPX/PY 1.65x).
- Cloud/bird/rain/lightning/tree/flag/tornado components KAHI NAHI (confirmed).

PROPOSED ARCHITECTURE (jab apply ho):
- <BorderFX> component border drift rig ke andar (vignette ke baad).
- ResolvedStyle me naye fields: borderFx ('none'|'clouds'|'rain'|'storm'|
  'forest'|'garden'|'wind'|'flags'|'birds'|'tornado') + borderFxStrength.
- Portal me ALAG dropdown "Living Borders" (theme x preset x borderFx = 3 layers).
- Auto mode: doosra hash-bit rotation (gender-jodi style).
- Effects: clouds(5-6 radial blobs noise drift) | rain(2 diagonal repeating-
  gradient layers near/far + edge mask) | lightning(seeded strike frames +
  flash decay + bolt polyline) | forest(side tree silhouettes bottom-origin sway,
  depth blur) | garden(bezier vines + leaf ellipses + butterfly scaleX flap) |
  wind(curved streaks + gust swells) | flags(SVG path d-per-frame wave + pole
  sway) | birds(V-wing arcs flap oscillation sine crossing) | tornado(stacked
  rotating ellipse rings + orbit debris ~15 nodes).
- Guard: paper themes pe rain/storm weird lagta - isPaper check zaroori.
- Effort: Phase A(clouds/birds/flags/wind)=easy | B(rain/lightning)=med |
  C(forest/garden SVG art)=zyada time | D(tornado)=bonus.

### PART 2: WEB RESEARCH - FUTURE EFFECTS CATALOG (Remotion + overlay guides
### + Islamic motion graphics se ideas). SAB PENDING, kuch bhi applied nahi.

A. Nature/Weather:
   - Snow (flakes + drift) | Fog/Mist banks | Incense/Bakhur smoke (rising curl,
     feTurbulence proven) | Fireflies (night themes) | Petals/leaves fall |
     Dappled sunlight (leaves se chhanpti roshni) | Water caustics patterns |
     Day-Night sky cycle (video duration par gradient shift).

B. Sky/Celestial:
   - Milky Way band | Moon phases crescent->full morph | Eclipse moment.
   (Shooting stars + moon halo ALREADY hain - masterpiece)

C. Islamic Art & Calligraphy (channel ke liye HIGH VALUE):
   - Geometric star pattern DRAW-ON: 8-fold rosette stroke-dashoffset se
     khud likhta hua border medallion (Hankin polygons-in-contact inspired -
     research paper Craig S. Kaplan, Univ Waterloo).
   - Calligraphy sparkle: diacritics sitaron ki tarah gir kar text banate
     (Al Ula Living Museum "Calligraphic Oasis" concept).
   - Arabesque vine corners GROWING (path draw + leaves sprout).
   - Golden pattern TUNNEL zoom loop background.
   - Mosaic tiles assemble (medallion ban'ti hui).
   - Camel caravan silhouette horizon cross (desert theme) + palm oasis sway.
   - Floating lanterns RISING (Ramadan raatein - ulta lanterns jo abhi hang hain).

D. Text/Kinetic (KaraokeText upgrades - timing sidecars already perfect):
   - Ink bleed reveal (urdu text blur-mask se phailti hui).
   - Gold foil specular localized sheen on text block.
   - Word-sync glow pulse (karaoke timing se).

E. Film/Camera overlays (research guides ke mutabiq best practices:
   subtle > heavy, edge-origin leaks, screen blend default, 1-2px blur match):
   - Light leak sweeps (section transitions pe - urduStart timing).
   - Anamorphic lens flare streak | Film scratches/jitter | VHS scanlines.

F. Transitions (ar->ur section boundary ke liye):
   - Ink splash wipe | Liquid morph | 8-point star iris wipe.

PRIORITY (Islamic channel ke liye): HIGH = C-group + smoke/fireflies/lanterns/
light-leaks; MED = weather group + birds/flags; LOW = tornado/VHS/eclipse.

TEST PROTOCOL (jab apply ho): har effect ka 1 force render + QC + user PLAY
approval, waise hi jaise CGI/VFX series me kiya tha (volumetric/waterripple/
embernight teeno PASS hue the).

---
## 2026-08-23 — CGI/VFX PRESET SERIES (5 -> 15 presets)

- User request: bohat saray presets chahiye (CGI/3D/VFX concepts list kiya).
- ResolvedStyle EXTENDED (stylePresets.ts) naye fields:
  bokehCount/bokehOpacity (DoF bokeh dots), chromaticAberration (lens RGB fringe),
  shimmerMode/shimmerStrength ('heat'|'ripple'|'silk' SVG feTurbulence+feDisplacementMap),
  glossSweepCycleSec (specular metallic sheen sweep, eased), particleStyle
  ('dust'|'glitter'|'embers'|'stars'), tilt3dDeg (Matrix3D perspective tilt),
  noiseVeilOpacity (procedural Perlin veil), raysAngleDeg (god-rays direction).
- Background.tsx naye components: BokehLayer, GlossSweep (cubic ease),
  ChromaticEdges, ShimmerVeil (SVG filter per-frame animated - Chrome headless OK),
  NoiseVeil; GodRays me angleDeg; renderParticles me style switch (glitter=rotated
  squares, embers=narangi+1.9x speed+tez flicker, stars=4-point clip-path).
- 10 NAYE PRESETS: volumetric, raytrace, embernight, glitterroyal, desertmirage,
  waterripple, silkmarble, cinemafocus, auroranova, qadrtilt (har ek ka apna
  aurora palette). Portal dropdown me "CGI / VFX Series" optgroup.
- AUTO rotation ab 15 presets par - distribution (77): masterpiece 9, qadrtilt 9,
  waterripple 8, cinemafocus 6, auroranova 6, desertmirage 5, volumetric 5,
  royal 5, glitterroyal 4, classic 4, embernight 4, raytrace 4, minimal 3,
  silkmarble 3, cinematic 2.
- TESTS (salah_end/salah_start/food_start force renders):
  volumetric PASS (20:51), waterripple PASS (20:53, SVG filter chala),
  embernight PASS (20:56). Config wapas auto.
- RENDER ALL COMPLETE is din: 70/70 batch done, disk pe 76/76 videos!
- render-all archived/locked filter fix bhi live (server restart ke sath).

---
## 2026-08-23 — MADAD GUIDE (dono zabano me, wife ke liye)

- Portal pe naya golden button: "MADAD" (RENDER ALL se pehle, sab chips me sab se aage).
- Click pe modal khulta hai 2 tabs: Roman Urdu | Urdu (Nastaliq).
- Pehli dafa page khulne par guide AUTO-OPEN hoti hai (localStorage dua_help_seen).
- Content 8 sections: page intro (76 videos), PLAY, search/chips, RENDER ALL
  (~2min/video, browser band chalega, CANCEL warning), YouTube flow (login check ->
  Authenticate Channel 1 -> Channel 1 -> DRY-RUN pehle -> LIVE + 1-6 select -> unlisted),
  Settings (Auto style), kya NAHI chhedna (DELETE/EDIT/force re-TTS/ADVANCED), folders.
- Urdu font: Noto Nastaliq Urdu (Google Fonts) + Jameel Noori fallback; .urtxt class rtl.
- GUIDE AUDIT: har claim code se verify - 26/26 PASS. Guide me sirf wahi buttons/text
  likhe jo portal me asli maujood hain (PLAY, UPLOAD, RENDER ALL, DRY-RUN default,
  unlisted selected, 1-6 select toast, logged-in sabz dot #56d364, EDIT sirf
  non-rendered cards pe, settings hint "naya render naya style").
- Server restart hua; node --check OK; /api/status healthy.

---
## 2026-08-23 — FULL PORTAL AUDIT (user request)

- 25-point automated audit chala (audit.py): endpoints, data integrity, files,
  voice jodis, themes/presets, configs, processes, disk, temp, logs.
- RESULT: 24 PASS + 1 "fail" jo feature nikla:
  - Portal 76 cards vs library 77 => subah_o_shaam_ki_hifazat_ki_jami_dua
    archived:true hai - portal filter (!archived && !locked) sahi kaam kar raha.
- REAL BUG FOUND + FIXED: dashboard crash.log me 2x ERR_HTTP_HEADERS_SENT
  (04:39/04:59 UTC) - /api/youtube/secret + /api/youtube/auth me >1MB payload
  pe 413 bhejne ke baad end-event race dobara send() karti thi => uncaughtException.
  FIX: send() helper me res.headersSent || writableEnded guard (server.js).
  REGRESSION TEST: 2MB junk POST => 413 mila, server zinda raha, naya crash NAHI.
- Audit script assumptions bhi fix huin: pick_voice TTSEngine ka static method,
  GENDER_POOLS class attr, VALID_THEMES = dark/mosque/sunset/manuscript/emerald/
  ocean/desert/royal/ramadan/eid/qadr (11), engine default=edge (cfg file optional).
- VERIFIED CLEAN: 77 duas valid fields, unique ids, deleted duas wapas nahi ayin,
  7/7 videos healthy, manifests valid, gender jodi 77/77 match, preset rotation
  poora (23/17/13/12/12), engine=edge+key, single node process, 157GB free,
  temp junk zero.

---
## 2026-08-23 — STYLE PRESET AUTO ROTATION (naya)

- Style presets ab AUTOMATION me: portal dropdown me naya option "Auto - har video ka apna style".
  - Auto mode: har dua ka deterministic preset (charCode-sum hash % 5) - re-render stable.
  - Distribution (77 duas): masterpiece 23, classic 17, minimal 13, cinematic 12, royal 12.
  - Preset kya badalta hai: aurora palette, gold frame, corner ornaments, light sweeps,
    particles/rays/orbs opacity, grain, vignette, paper treatment (Background.tsx L1172-1505).
- Code changes:
  - DuaVideo.tsx: autoPresetFor() helper; stylePreset prop absent ho to dua_id se derive.
  - server.js: STYLE_PRESETS me 'auto'; stylePropsArgs() auto pe props pass nahi karti;
    dropdown me Auto option (sab se upar).
- IMPORTANT: asli config file = remotion/dashboard/config.json (data/config.json NAHI - wo stray thi, delete kar di).
- config ab: {channelName: Noor-e-Iman, handle: @bushranasir1075, stylePreset: auto}.
- TESTED: salah_end force re-render under auto = OK (16:53, 15MB). Purani 7 videos classic look
  ki hui hain - RENDER ALL ke baad sab ko apna-apna preset milega.
- Server restart hua (node kill+start) auto enable ke waqt.

---
## 2026-08-23 — SFX RELAXING MODE (user-approved after 3 rounds)

- User ko end ka riser bohat taiz/loud laga. DuaVideo.tsx me final settings:
  - riser: playbackRate 0.68, volume ramp 0.01 -> 0.08 (pehle 0.05->0.60 tha), fade 48 frames
  - tick: volume 0.14, playbackRate 0.8
  - whoosh (urdu transition): volume 0.22, playbackRate 0.9
- Saari 7 maujooda videos naye SFX se re-rendered (force) - timestamps 16:16-16:34.
- VERIFIED: 7/7 mp4 fresh, portal PLAY-ready, zero upload.

---
## 2026-08-23 — GEMINI TTS ADDED (optional, edge-tts INTACT)

- Naya core/gemini_tts.py: Gemini 2.5 Flash Preview TTS via REST (urllib, no new deps). Research: Gemini TTS #1 in Arabic (89.7% human win rate), Urdu officially supported, ~\.006/video.
- Routing: tts_engine.generate_audio pehle data/tts_engine.json check karta hai. engine=gemini + key mojood ho to Gemini; explicit voice override ya koi failure => edge-tts fallback (purana path untouched).
- Voices: Gemini cross-lingual hai - SAME voice Arabi+Urdu dono bole (perfect jodi). Male bank: Charon/Rasalgethi/Algieba/Orus; Female: Leda/Kore/Aoede/Vindemiatrix. Dua-id hash se gender+slot (same gender system as edge pools).
- Style prompts: ar='calm solemn tilawah', ur='gentle narration'. Word timing: proportional sidecar (WordBoundary schema same) - karaoke approximate rahega.
- Toggle: scripts/set_tts_engine.py [edge|gemini]. Key: data/gemini_api_key.txt (free - aistudio.google.com). Key na ho to auto edge.
- PENDING: user ki API key -> live test -> phir 8 jodi demos Gemini me.

---
## 2026-08-23 — COMBO-TEST 8 VIDEOS + SAB ARTIFACTS DELETED (user-approved)

- Aaj ki 8 combo-test videos poori tarah reset: 8 mp4, 8 txt, 8 thumbs, 8 manifests, 41 temp files, history.json, qc.json, purana temp\custom test junk.
- DUAS SAFE: duas.json 77 entries INTACT, portal 76 cards sab unrendered.
- KEPT system assets: out\previews (11 theme pngs), temp\previews (8 animation-style mp4s) - style panel inko use karta hai.

---
## 2026-08-23 — CHILD-VOICE IDEA REJECTED by user

- edge-tts me asli child voices nahi hotin; pitch+35Hz demo banaya tha (temp/voice_demo) - user ne sune ke baad reject kiya, demo files deleted.
- Gender-matched jodi system (male/female banks in pick_voice) wahi rahega - wo approve hai.

---
## 2026-08-23 — COMBO TEST BATCH: 8/8 RENDERS OK (render-only, ZERO upload)

- 8 duas selected jo saari 8 voice combos cover karti hain: bathroom_exit, sleep_exit, food_start, travel_start, travel_end, salah_start, tashahhud_audhu, salah_end.
- Driver (one-off, opencode temp): /api/render single-job endpoint ko sequential chalaya; mp4-existence se skip logic. ~80 sec/video, sab OK err=None.
- Themes used: qadr, mosque, emerald, sunset x2, manuscript x3 - variety confirmed. Voice combos exactly as planned (pick_voice deterministic).
- VERIFIED NO UPLOAD: ledger empty {}, koi YT job nahi. User rule respected: upload sirf manual.
- Note: manifest me theme field ka naam 'template' hai.

---
## 2026-08-23 — VOICE COMBO FIX: ab saari 8 jodiyan (user-approved)

- Masla: pick_voice ek hi hash se AR+UR dono voice chunta tha -> sirf 4/8 combos possible (h%4 ne h%2 ko lock kar diya).
- Fix: Urdu ke liye alag seed - h_ur = h*31 + len(id)*17 + 5. Arabic wahi purana (re-render stability).
- RESULT: 8/8 combos active, distribution 5-15 duas per combo across 77. Deterministic verified.
- File: core/tts_engine.py pick_voice().

---
## 2026-08-23 — LOCKED DUAS BHI DELETE (user-approved, permanent)

- locked_duas.json (suraj_nikalne_ki_dua + azan_ke_baad_ki_dua - wife channel pe already uploaded) permanently deleted.
- Dono entries duas.json se removed (79 -> 77). Locks file moved to _deleted_locked_duas\ (insurance copy).
- upload.py ka locked_duas() missing-file-safe hai (try/except -> {}).
- VERIFIED: portal 76 cards (77 total - 1 archived), dry-run me koi LOCKED skip line nahi.
- Ab system me koi lock/REF-GUARD concept practically dormant hai.

---
## 2026-08-23 — FULL RESET (PERMANENT, user-approved)

- User decision: sari bani hui videos + artifacts PERMANENTLY delete. Library sirf dua texts par reset.
- DELETED: out mp4+txt (102), thumbs (44), thumbs_legacy (42), manifests (44), history.json (167 entries), qc.json (43), auto_runs.log, style_props.json. ~555 MB freed.
- KEPT: duas.json (79 texts), locked_duas.json, out\previews\ (11 theme previews - style panel asset), all code.
- STATE: portal 76 cards, sab NO MANIFEST/unrendered; upload pool 0 eligible; H: free 157 GB.
- **RULE: Re-render / re-upload KABHI bina user ki izazat nahi. Har render batch user ke explicit GO par hogi.**
- Next render = fresh style/voice rotation (non-dark themes) since manifests regenerate from scratch.

---
## 2026-08-23 — TEMP CLEANUP UTILITY (176.5 MB FREED)

- Naya script: scripts\cleanup_temp.py [--dry-run]
- Kya karta hai: RENDERED videos (mp4 exists) ke temp build-files delete - <id>_ar.mp3/_ur.mp3/_merged.wav/_ar_timing.jsonl/_ur_timing.jsonl. Unrendered ke temp files KEPT (render me chahiye honge).
- Naming logic upload.py ka safe_title import (title-based mp4 match).
- Stray temp files (unknown ids) report-only, kabhi auto-delete nahi.
- RUN RESULT: 220 files deleted, 176.5 MB freed (221 -> 1 file in temp). out 102 files intact, portal 76 cards healthy.
- Kabhi chalana ho: python scripts/cleanup_temp.py (--dry-run pehle)

---
## 2026-08-23 — sleep_enter DELETED (user decision)

- Sone Ki Dua (Bukhari 6324) = wife channel pe already uploaded (suraj_nikalne_ki_dua). User ne delete choose kiya (exception nahi).
- duas.json se entry removed (79 remaining) + artifacts moved to H:\DuaVideoGenerator\_deleted_sleep_enter\ (manifest, thumb, mp4, sidecar, temp audio - recoverable).
- VERIFIED: portal card gone (76 visible = 79 - 2 locked - 1 archived), upload dry-run me REF-GUARD skip line khatam, eligible pool unchanged 41.

---
## 2026-08-23 — CHHOTE FIXES: crash.log rotation + YT cancel button (LIVE)

### crash.log rotation (server.js)
- crashAppend(msg): >2MB par crash-YYYY-MM-DD.log rename, sirf latest 3 rotated rakhta hai. uncaughtException + unhandledRejection dono use karte hain.

### YT cancel button (graceful, orphan-proof)
- Mechanism: portal /api/yt-cancel -> data\.yt_cancel flag likhta hai. upload.py har video se PEHLE check karta hai => chalta hua upload POORA hota hai, agla nahi shuru hota (ledger mismatch / orphan uploads impossible).
- UI: yt_progress me CANCEL btn (sirf running ke waqt); click par 'CANCELLING...' state + toast.
- Cleanup: flag job-start par delete, p.on('close') par delete, aur upload.py end par bhi.
- Route 409 jab koi job running na ho.

### LIVE VERIFIED
- node --check + py_compile OK; server restarted.
- /api/yt-cancel (no job) = 409 correct body.
- Flag-file dry-run: '[1/3] CANCEL requested - stopping gracefully' + 'SUMMARY ... | CANCELLED' + script ne flag khud clean kiya.

---
## 2026-08-23 — AUTO-UPLOAD REVERTED TO MANUAL (user decision)

- Reason: user video pehle REVIEW karna chahta hai - achi na lage to upload hi nahi.
- REMOVED: schtasks 'DuaAutopilot' (deleted), Startup autopilot_logon.vbs (deleted), root autopilot_run.vbs (deleted). Verified: task gone, startup folder sirf Ollama + start_dua_studio.
- KEPT: upload.py --auto N flag (dormant - sirf manual CLI invocation par chalega), auto_runs.log history, logs\autopilot.log, YT panel manual flow (picker + quota + cooldown + unlisted default), card UPLOAD button -> picker pre-select.

### FINAL WORKFLOW (user-approved)
1. Video render (portal TTS+RENDER ya batch missing-only)
2. Portal PLAY se review
3. Pasand aaye to card UPLOAD -> YT panel -> UPLOAD SELECTED (unlisted)
4. Studio me review -> Public

---
## 2026-08-23 — AI IMPORT RESTORED (user request)

- Wife ke liye asaan tha (.json paste -> form auto-fill). AI IMPORT chip sab ke liye visible again (js-expert/display:none hataya).
- Style panel radios ABHI BHI expert-hidden (?expert=1) - wo style-change risk tha.
- Guards unchanged: rendered edit-reject, duplicate 403, render guard.

---
## 2026-08-23 — WIFE-SAFE PORTAL SIMPLIFICATION (LIVE)

### User-approved decisions
- Copy text button: REMOVE (dono states) | Style panel: ?expert=1 ke peeche | UPLOAD card-btn: YT picker pre-select (picker internals UNTOUCHED per user)

### Card UI (state-aware)
- RENDERED cards: [PLAY] [UPLOAD->quickUpload] + Delete. HIDE: render btn, force re-TTS, Edit.
- UNRENDERED: [TTS + RENDER / RENDER] + Edit + force re-TTS + Delete (jaisa pehle tha).
- REMOVED everywhere: Copy text, AI-Gemini prompt btn, Duplicate.

### Global UI
- Video Style radios + AI IMPORT chip => class js-expert, display:none; ?expert=1 URL par unhide (script top EXPERT regex).
- AI modal HTML left intact (unreachable without trigger) - zero risk dead code, functions copyText/aiMetaPrompt/dupDua kept defined but unreferenced.

### Server guards (UI bypass blockers)
1. startJob(): !force && alreadyRendered(duaId) -> {ok:false 'RENDERED hai...'} (new shared helper alreadyRendered reads duas.json+OUT mp4).
2. /api/render-all: items filtered to MISSING videos only - batch kabhi rendered ko re-render nahi karega.
3. /api/update-dua: rendered title par save -> 409 'RENDERED video edit nahi hoti'.
4. /api/duplicate-dua: poora handler DISABLED -> 403 'Duplicate feature band'.

### LIVE VERIFIED
- node --check OK; server restarted; quickUpload fn served; aiMetaPrompt card-btn absent; js-expert wraps present.
- POST render (rendered, no force) = clean reject msg | duplicate = HTTP 403 + body | update rendered = HTTP 409. hasbunallah data intact.

---
## 2026-08-23 — THUMBNAIL NAMING AUDIT + FIX (autopilot pool complete)

### ROOT CAUSE
- batch_render.py (old) saved thumbs as <dua_id>.png; dashboard render job genThumb() saved as <safe_title(title)>.png. upload.py expects STRICT <dua_id>.png => nayi renders autopilot ke liye 'not-ready'.
- Second layer found during fix: gusse thumb 2.6MB > YouTube 2MB limit (busy qadr frame).

### FIXES (4 layers)
1. server.js genThumb(): CANONICAL <dua_id>.png + legacy title-named file auto-adopted (copy) instead of re-render.
2. server.js portal cards: prefer <id>.png, fallback legacy title png (44 old id-based already fine).
3. server.js /api/thumbs-all: id-canonical naming + legacy adoption.
4. upload.py resolve_item(): legacy title-named thumb ko shutil.move se adopt (self-heal migration); oversize par _shrink_thumb() (PIL, width->720 optimize) - shrink fail ho to hi 'thumb >2MB' reason.

### VERIFIED LIVE
- gusse stray renamed -> portal card shows gusse_me_panah_ki_dua.png; videoFile intact.
- _shrink_thumb: 2649KB -> 716KB. Only oversize in library (next largest 1.4MB).
- Dry-run --auto 5: eligible 40 -> 41, READY 3, not-ready 0. Server restarted after js edits.

---
## 2026-08-23 — AUTO-PILOT LIVE (v1)

### upload.py --auto N engine
- --only ab optional; --auto N naya: oldest-rendered-first picking (mp4 mtime), cap = min(N, remaining_today).
- Sab safety layers auto-respected: LOCKED bypass-proof, REF-GUARD, archived, ledger-dedup, live-loop ceiling re-check.
- Single-flight lock: data/.autopilot.lock (45-min stale TTL, atexit release) - scheduler vs scheduler vs manual overlap impossible.
- Journal: data/auto_runs.log append-only (RUN start/end, per-item UPLOADED link, FAILED reason, SKIP reasons first-5+count, QUOTA CEILING stops).
- DRY-RUN VERIFIED: 40 eligible -> picked rabbi_zidni/hasbunallah/rabbi_shrah; locks+refguard+archived skipped; quota 2/5 => exactly 3 planned; uniqueness audit PASS.

### Scheduler (no-admin combo)
- H:\DuaVideoGenerator\autopilot_run.vbs: hidden wscript runner -> python -X utf8 upload.py --auto 3 --live --privacy unlisted --token/--ledger channel1 >> logs\autopilot.log
- schtasks task 'DuaAutopilot': HOURLY (Ready; NextRun verified). AtLogOn trigger admin mangta tha => Startup folder fallback: autopilot_logon.vbs (catch-up on PC-on, lock se double-run safe).
- Missed-hours backfill NAHI by design; startup run covers PC-off gap. Golden rule intact.

### KNOWN GAP (next round)
- Nayi single renders me thumb missing (gusse_me_panah_ki_dua.png absent) -> autopilot usko 'not-ready' skip karta hai (safe). Thumb regen step needed ya render pipeline fix.

---
## 2026-08-23 — STYLE/VOICE ROTATION v2 (LIVE, TEST-RENDERED)

### VOICE ROTATION (edge-tts pools)
- core/tts_engine.py: VOICE_POOLS added. ar: Hamed(SA)+Hamdan(AE)+Laith(SY)+Saleh(YE) | ur: Asad(PK)+Salman(IN). All solemn General/Friendly voices.
- TTSEngine.pick_voice(dua_id, lang): deterministic sum(ord)%len pool rotation (stable re-renders). PROSODY untouched => karaoke timing sync safe.
- main.py dua path: voice = dua.voice_arabic/urdu override OR pick_voice(); prints chosen voices in [1/5] step. Custom-dua path keeps defaults.
- duas.json: 0/80 rows carry voice fields today, so rotation applies to all future renders.

### THEME REBALANCE (dark 49% -> 0%)
- KEY FINDING: 58/80 duas.json rows carry STAMPED templates from import-loader era; many 'dark' stamps were silently overriding everything.
- New rule (all 3 resolvers): explicit NON-dark template wins; dark stamp = legacy default -> falls through to rotation. general: 4-way [manuscript,dark,royal,emerald]; rotations protection->desert/qadr, guidance->royal/manuscript, gratitude->eid/emerald, health->ocean/emerald; rest CATEGORY_THEME unchanged.
- Mirrors kept in sync (byte-same formula): remotion/scripts/make_manifest.py resolve_theme + CATEGORY_ROTATIONS/GENERAL_ROTATION/_seed_pick | dashboard/theme-map.js seedPick | scripts/import_pack_loader.py build_entry.
- VERIFIED: py_compile all OK; python vs JS resolve agreement 80/80 ids, 0 mismatches; new distribution manuscript16 ramadan12 emerald10 qadr9 sunset9 ocean9 royal8 mosque6 eid1 (desert available via protection rotation).
- Existing 43 MP4s untouched; only new renders get new looks.

### LIVE PROOF RENDER
- Server restarted (theme-map.js module load), POST /api/render {duaId:gusse_me_panah_ki_dua}.
- Result: out\Gusse Me Panah Ki Dua.mp4 (18MB, ~35s render), manifest src/data/gusse_me_panah_ki_dua.json template=qadr (was stamped dark -> now rotated).
- Voice for this id: ar=ar-YE-SalehNeural, ur=ur-IN-SalmanNeural (fresh ar/ur mp3 + timing sidecars written during run).
- Note: output mp4 named by TITLE not id; poll by title glob, not out\<id>.mp4.

---
## 2026-08-23 — AUTO-PILOT DESIGN (APPROVED PLAN) + LEGACY CLEANUP

### AUTO-PILOT MODE — FINAL DESIGN (build pending green light)
User requirement: PC pura din on nahi rehta; manual selection khatam; har cheez ka record; style/voice untouched.
Design: EVENT-DRIVEN CATCH-UP mode -
- Triggers: (a) logon/startup run, (b) hourly idle-check run (kuch na ho to ~2 sec exit)
- Har run ke 3 sawal: quota bachi? / pool ready? / kitni jaa sakti? => min(quota, pool, daily-limit)
- Pick order: rendered - uploaded(ledger) - locked - ref-guard - OLDEST MP4 FILE FIRST
- Upload defaults: unlisted + disclaimer + thumbnail + tags (sab existing)
- Records (4 layers): ledger + quota_state (delete-proof) + auto_runs.log (naya: date/batch/links/result) + portal [Uploaded] tags
- Golden rule: sirf AAJ ka ceiling; kal ki kami backfill NAHI (Google daily reset)
- Safety unchanged: locks, REF-GUARD, uniqueness audit har run, watchdog, cooldown
- Style/voice: rendering pipeline BILKUL untouched (autopilot sirf upload karta hai)
- Defaults proposed: 3/day start, unlisted, hourly idle-check
Status: AWAITING FINAL GREEN LIGHT from user. Build items: upload.py --auto engine, auto_runs.log writer, Task Scheduler XML (logon+hourly), portal me AUTO toggle/status (optional).

### LEGACY CLEANUP SCAN (same din)
Scan: scheduler tasks (0 project-related), registry Run keys (clean), startup folder, running processes (1 server only), project scripts, data dir, temp files.
REMOVED/QUARANTINED:
- Root se 7 old manual-era launchers quarantine => _legacy_launchers\: Start.bat, Stop.bat, MainMenu.bat, BatchAll.bat, CustomDua.bat, DuaVideo.bat, DuaVideo.vbs (double-click conflict risk tha)
- %TEMP%\opencode ke 9 audit test scripts deleted (t_*.py + scan_sidecars.py)
KEPT (verified harmless/helpful):
- Startup folder start_dua_studio.vbs = hidden dashboard auto-start (autopilot ke liye faida-mand) - INTACT
- duas.backup.json, duas.pre_pillar1.backup.json, import_pack_v1-v3.json (data safety, no runtime interference)
- crash.log absent; single node server healthy (200)

---
## 2026-08-23 — REFERENCE-COLLISION SAFETY (3 Layers)

1. REF-GUARD (upload.py): resolved dua ka reference agar LOCKED dua ke reference se match kare to wo run me SKIP hoti hai ('REF-GUARD: same hadith reference as LOCKED ...') - live/dry dono me.
2. UNIQUENESS AUDIT extension: ab 'references' block bhi - shared-ref groups list hoti hain (INFO).
3. PORTAL BADGE: /api/duas har card par refShared flag deta hai; picker par yellow 'ref shared' badge (tooltip: isi hadith par aur dua bhi hai). duaStatus me refShared+reference expose kiye.

Live proof: sleep_enter ab REF-GUARD se skip hota hai (6324 = locked suraj_nikalne_ki_dua); full dry-run 40 READY, 3 shared-ref groups INFO, RESULT PASS. Portal badges: 13 cards flagged (legit pairs jaise masjid enter/exit, mulk morning/evening).

---
## 2026-08-23 — PERMANENT DUA LOCK (Wife Channel Duplicates)

User request: Sahih Bukhari 614 & 6324 wali duas lock karo (wife ne upload kar di hain).
Locked: suraj_nikalne_ki_dua (Bukhari 6324) + azan_ke_baad_ki_dua (Bukhari 614).
Mechanism:
1. data/locked_duas.json = permanent log (title/reference/reason/locked_at) - kabhi delete na karo.
2. duas.json entries: archived=true + locked=true.
3. Portal /api/duas filter: archived/locked hidden (80 -> 77 cards; 1 pehle se archived subah_o_shaam).
4. upload.py locked_duas() check sab se pehle chalta hai - --only explicit selection se bhi BYPASS NAHI ho sakta. Har run me 'skip <id>: LOCKED (permanent)' line log hoti hai.
Note: sleep_enter (Sone Ki Dua) bhi Bukhari 6324 reference rakhta hai magar wo ALAG dua hai - lock NAHI kiya. Agar chahiye to bolo.
Verified: py_compile OK, node --check OK, portal 77, explicit --only bypass test => LOCKED skip lines.

---
## 2026-08-23 — PERSISTENT QUOTA TRACKING (Portal Detection)

Masla: ledger clean karne se portal quota counter reset ho jata tha (asli Google units ka pata nahi rehta).
Hal: append-only quota_state_<channel>.json (date->units, 60-day prune) + upload.py record_units har live upload par; ceiling ab max(ledger, quota-log) use karta hai.
Portal: status API me quotaUnitsToday/quotaUploadsToday per channel; status line ab 'Ready . Quota N/5' dikhati hai.
Aaj ka asli kharcha seed kiya: channel1 = 3200 units (2 uploads). Verified: dry-run 'quota: 2/5 (ledger:0, quota-log:2)' + status API fields.

---
## 2026-08-23 — MONETIZATION COMPLIANCE RULES APPLIED

1. DISCLAIMER: metadata.py build_description ab har description ke end me standardized Islamic educational disclaimer append karta hai (MAX_DESC room calc adjust ho gaya).
2. SAFE DEFAULT PRIVACY: upload.py --privacy default=unlisted; dashboard UI select unlisted-selected; server fallback bhi unlisted.
3. UNIQUENESS AUDIT: upload.py dry-run/live dono me per-run audit block - titles/tag-sets/descriptions uniqueness + sha1 title hashes; duplicates mile to DUP lines + RESULT WARN.
Verified: py_compile OK, node --check OK, full-library dry-run 43/43 => AUDIT RESULT PASS, UI HTML 'unlisted' selected confirmed.

---
## 2026-08-23 — PRODUCTION SAFEGUARDS (Deep-Edge Round)

3 safeguards + 1 bonus, sab verified:
1. REFRESH GUARD: beforeunload dialog jab render (busy) ya upload (ytBusy) active ho.
2. UPLOAD RETRY: upload.py do_live_upload ab resumable chunks par 5xx/429/OSError => 3 retries, 2/4/8s backoff.
3. [UPLOADED] TAG: ytAllUploadedIds() dono channels ki ledgers UNCAPPED parh kar status response me uploadedIds bhejta hai; picker cards par subtle green tag. Warning-only, selection allowed.
4. BONUS BOM-HARDENING: ledger readers ab UTF-8 BOM strip karte hain (PowerShell/Notepad hand-edits ke liye) - testing me pakda gaya.

Regression green: node --check OK, py_compile OK, 413/429/dry-run exit 0, uploadedIds LIVE verified. Score 100/100 A+ maintained.

---
## 2026-08-23 — POST-AUDIT FIX ROUND (Score 100/100 A+)

4 target fixes applied to server.js only:
1. CHILD WATCHDOG: 10-min timeout -> SIGKILL upload.py -> running=false reset (close+error dono pe clearTimeout).
2. POLL CLEANUP: ytApplyJob idle par clearInterval(ytPollT); beforeunload handler bhi.
3. PAYLOAD CAP: sab 14 POST body sites par 1MB limit -> HTTP 413 (headersSent guard + 100ms delayed destroy; pehli iteration me destroy response maar deta tha - fix kiya).
4. COOLDOWN: /api/youtube/upload par 5s throttle -> HTTP 429 (ytLastUploadReq global).

Verified LIVE: 413 (1.1MB body), 429 (double-fire), normal dry-run exit 0, node --check OK, py_compile OK. Reports: AUDIT_REPORT.md (216 lines) + audit_results.json fix_round + scores_final overall=100 Grade A+.

---
# DUA VIDEO STUDIO â€” NOTES
Last updated: 2026-08-23

---

## PHASE 1 SECURITY AUDIT (2026-08-23) â€” 3 FIXES, ALL PASS
- [FIXED cmd-injection] server.js exec() calls removed: L2089 open-folder
  aur L2260 open-video ab spawn('explorer',[path]) array-form (shell
  kabhi invoke nahi hota). Pehle `start "" "${file}"` me quoted-break
  injection possible tha.
- [FIXED CSRF/cross-origin] L1821-1827: /api/* pe Origin header guard -
  sirf 127.0.0.1/localhost/[::1] origins allowed, warna 403. (Text/plain
  simple-request se JSON POST CSRF block kiya.)
- [FIXED injection defense-in-depth] L1984: selectedDuas strict charset
  ^[a-z0-9_]{1,80}$ per id; invalid => 400. Spawn array-args pehle se
  hi shell-less the.
- [FIXED corruption] writeAtomic() helper (tmp+rename); ab duas.json
  (4 sites), config.json, history.json, qc.json, cache.json atomic
  writes hain. Secret tmp files ab *.tmp.json (gitignored).
- PASS (no change needed): ytJob lock synchronous => parallel uploads
  me doosra 409 (test verified r1=200 r2=409); python token/ledger
  saves os.replace+atomic, token chmod 600; API responses sirf masked
  client_id/booleans (GOCSPX/refresh_token scan clean); .gitignore +
  *.tmp patterns added; zero npm deps server side.
- Tests: injection payload => 400; evil-origin => 403; same-origin =>
  ok; parallel lock race => verified; duas regression-free.

---

## PORTAL UI REDESIGN (2026-08-23) â€” DONE
- Main screen ab clutter-free: sirf title + Refresh/Band + ek status
  line ("ðŸŸ¢ Channel 1: Ready Â· ðŸ”´ Channel 2: Setup needed" style).
- Credentials + Channel Login ab "âš™ï¸ Advanced Setup & Settings"
  collapsible me, default CLOSED.
- Dua selection: chhoti checkbox list ki jagah LARGE clickable cards
  (auto-fill grid, gold border + #1..#6 badge on select), prominent
  search bar, counter chip, Reset Selection. Big button label live:
  "ðŸš€ UPLOAD SELECTED (N) VIDEOS", disabled at 0/busy.
- Friendly progress box: running pe "â³ Uploading Video X of Y...
  Please wait" (backend job.total/done fields; done youtu.be URL
  milne pe badhta hai), auth window pe login message, finish pe
  summary. Raw logs ab closed-by-default "ðŸ”¥ Technical Logs"
  accordion ke andar.
- Results table ke upar "ðŸ“‹ Copy All YouTube Links" -> clipboard me
  "Dua Title - https://youtu.be/id" lines (navigator.clipboard +
  textarea fallback), toast confirm.
- Verified: node --check OK; adv section default-closed; dry-run x2
  exit 0 with total/done tracking; duas regression-free.

---

## 100% MANUAL UPLOAD MODE (2026-08-23) â€” DONE
- upload.py: `--only` ab REQUIRED (argparse) - auto sequential picking
  completely disabled; bina --only => exit 2 error. Docstring updated.
- POST /api/youtube/upload: `selectedDuas` strictly required - missing/
  empty => 400 "auto picking band hai". Server sanitize (dedupe+cap 6)
  -> seedha `--only id1,id2` pass hota hai. `limit` param removed.
- UI: Videos count dropdown (1-6) REMOVED. Searchable multi-select list
  hamesha visible (duas /api/duas se), counter "Selected: X / 6",
  RESET SELECTION button. UPLOAD NOW disabled jab 0 selected (ya busy).
  load()/panel-open pe list render hoti hai.
- Verified: CLI-no-only exit 2; API 400s; manual-2 dry-run exit 0 sirf
  chosen ids; node --check + py_compile OK; duas regression-free.

---

## MANUAL DUA SELECTION (2026-08-23) â€” DONE
- POST /api/youtube/upload ab optional `selectedDuas` array leta hai:
  sanitize (trim/dedupe/max 6 cap) -> upload.py ko `--only id1,id2`
  pass hota hai; empty/missing => auto sequential pick (pehle jaisa).
- UI me PICK MODE row: AUTO QUEUE | MANUAL PICK toggle, "Selected: X / 6"
  counter, RESET / AUTO-PICK NEXT PENDING button. MANUAL pe searchable
  checkbox list (duas global se, search title/id, 6 cap pe toast warn,
  selected order #badge).
- UPLOAD NOW payload manual mode me selectedDuas bhejta hai; khali
  selection pe friendly error.
- Verified: manual 2-id dry-run sirf wohi process hue (exit 0); 8 bheje
  -> 6 select; [] -> auto fallback; escaping + node --check OK;
  duas regression-free.

---

## YOUTUBE CREDENTIALS TEXT INPUT (2026-08-23) â€” DONE
- POST /api/youtube/settings {clientId, clientSecret} -> dono non-empty
  validate, standard "installed" OAuth JSON bana kar ATOMIC write:
  data/client_secret.json (redirect_uris localhost:8080 + 127.0.0.1).
- GET /api/youtube/settings -> present flag + maskedClientId
  ("xxxx...suffix") + path/sources (data ya root file).
- youtube_auth.py find_client_secret() ab data/client_secret*.json ko
  sabse pehle dekhta hai -> text-input se save kiya secret AUTH flow
  me seamlessly use hota hai (file upload wala root path bhi valid).
- UI STEP 1 ab do tareeqe: (a) Client ID + Secret inputs + SAVE
  CREDENTIALS + live badge (SET xxxx.../NOT SET, placeholder me masked)
  (b) file upload fallback. Inputs sirf placeholder update hote hain,
  saved secret kabhi echo nahi hota.
- Verified: empty fields => 400; dummy save => file structure spec-exact,
  GET/status masked correct; find_client_secret() data path resolve OK;
  cleanup done; node --check + py_compile OK; duas regression-free.

---

## YOUTUBE PORTAL CONTROL (2026-08-23) â€” DONE
- Naye endpoints:
  POST /api/youtube/secret  -> browser se client_secret.json content
       save karta hai (JSON validate: installed/web key zaroori,
       atomic write PROJECT/client_secret.json).
  POST /api/youtube/auth    -> {channel} youtube_auth.py login spawn;
       run_local_server consent window khud browser me kholta hai,
       token data/yt_token_channelN.json me save. Ek waqt me ek auth.
- UI panel ab STEP1 SETUP (file choose+save, AUTH CH1/CH2 badges) +
  STEP3 UPLOAD (channel, videos 1..6 dropdown, privacy, dry-run/live,
  UPLOAD NOW) + live log + RECENT UPLOADS table (#, Dua, Channel,
  Shorts link, Privacy).
- Limit validation ab 1..6 (upload.py quota ceiling 5/day phir bhi
  andar se enforce hota hai - safe).
- Verified: node --check OK; auth-no-secret => 409 guard (browser
  nahi khula); invalid secret => 400; dummy secret save+status FOUND
  (project name dikha) phir clean; limit6 ch2 dry-run exit 0; duas
  regression-free.

---

## YOUTUBE DASHBOARD UI (2026-08-23) â€” DONE
- server.js me 2 naye endpoints (render queue untouched):
  GET  /api/youtube/status  -> client_secret check + per-channel auth
       (youtube_auth.py status se) + aaj ke uploads + recent ledger
       entries + live job snapshot.
  POST /api/youtube/upload  -> {channel:channel1|channel2, limit:1-5,
       privacy:private|unlisted|public, mode:dry-run|live}; upload.py
       child spawn, logs ytJob buffer me stream, youtu.be URLs parse.
- UI: toolbar "YOUTUBE" chip -> collapsible Multi-Channel Manager
  panel (status badges, channel/limit/privacy/mode controls, live log,
  per-channel recent uploads links). Live start pe confirm dialog.
- Auth state mapping fix: token missing => 'missing' (youtube_auth.py
  status missing-token pe bhi exit 0 deta hai).
- Verified: node --check OK; dry-run via POST exit 0, 43 ready,
  archived skip; bad channel => 400; /api/duas regression-free.

---

## MULTI-CHANNEL UPLOAD SUPPORT (2026-08-22) â€” READY
- youtube_auth.py: `--token <path>` flag (set_token_path); login/test/
  revoke/status sab per-channel token file pe chalte hain.
  Default ab bhi data/yt_token.json.
- upload.py: `--token` (channel select) + `--ledger` (per-channel
  upload_state file). Quota ceiling har ledger ki apni count pe.
- .gitignore explicit blocks: client_secret.json, client_secret*.json,
  tokens*.json, yt_token.json, yt_token_*.json, data/yt_token*.json.
- Channel workflow example:
  login:   python remotion/scripts/youtube_auth.py login --token data/yt_token_channel1.json
  test:    python remotion/scripts/youtube_auth.py test --token data/yt_token_channel1.json
  upload:  python remotion/scripts/upload.py --live --limit 1 \
             --token data/yt_token_channel1.json --ledger data/upload_state_channel1.json

---

## PILLAR 4 EXECUTION (2026-08-22) â€” COMPLETE âœ…

### Task 1: metadata.py v2 (dynamic SEO)
- Category tag pools (18 cats) mixing English + Roman Urdu + Urdu
  script (Ø¯Ø¹Ø§Ø¦Û’ Ù…ØºÙØ±Øª / hifazat ki dua style), content-derived tags
  from title_en/title words + reference keywords.
- Deterministic rotation (sha1(dua_id) seeded): openers x5, CTAs x6,
  reference boxes x2, channel footers x3 (reads dashboard/config.json),
  hashtag pool rotation. Stable across regeneration (server.js safe).
- Results across library: unique tag lines 43/43, unique hashtag sets
  43/43, unique desc tails 43/43, Urdu-script tags 43/43, titles â‰¤100,
  tags â‰¤266ch (<500), desc â‰¤667ch. Part1/Part2 dup-tag fix via part
  discriminator token.
- FIXES during build: string>int compare; lone-surrogate DB text
  (clean()); Python split-surrogate escapes in OPENERS (ðŸ¤â†’\U0001F64F);
  rsplit bug that DROPPED hashtag line entirely.

### Task 2: youtube_auth.py + secrets hygiene
- OAuth desktop flow (InstalledAppFlow local server), refresh-token
  persistence data/yt_token.json (atomic write, chmod 600 best-effort).
- CLI: status | login | test | revoke. Client secret discovery:
  $YT_CLIENT_SECRET or client_secret*.json at root/remotion/.
- Lazy imports: dry-run paths work without google libs installed
  (libs ab install hain: google-api-python-client + google-auth-oauthlib).
- .gitignore created: client_secret*/tokens*/yt_token* excluded.

### Task 3: upload.py (engine + ledger + quota)
- Ledger data/upload_state.json atomic {dua_id:{status,video_id,
  privacy,units_spent,uploaded_at}}; double-post guard; archived skip.
- Pipeline: manifest â†’ <Title>.mp4 + STRICT out/thumbs/<dua_id>.png +
  sidecar parse (auto-regen if missing). Thumb >2MB rejected.
- Privacy default PRIVATE (--privacy public|unlisted override).
- Quota: 1600/upload vs 10000/day, 2000 reserve â†’ ceiling 5 uploads/
  day, enforced mid-loop from live ledger state.
- Live mode resumable chunks + thumbnails.set (warn-only on fail).

### Task 4: validation
- py_compile OK Ã—3, tsc --noEmit OK (no TS changes).
- Full dry-run: **43/43 READY, 0 fail**, archived skipped, quota plan
  8000 units shown. Ledger untouched by dry-run (by design).
- youtube_auth status runs clean (token missing / secret not found =
  expected until user does Google Cloud setup).

### Next steps for user (live uploads)
1. Google Cloud Console â†’ OAuth Desktop credentials download â†’
   rename client_secret.json at project root.
2. python remotion/scripts/youtube_auth.py login â†’ then test.
3. First upload: python remotion/scripts/upload.py --live --limit 1
   (private default), verify in Studio, phir hi privacy badhana.

---

## PILLAR 3 EXECUTION (2026-08-22) â€” COMPLETE âœ…

### Task 1: subah_o_shaam split (47s cap-violator fix)
- Entry `subah_o_shaam_ki_hifazat_ki_jami_dua` ARCHIVED in DB
  (`archived: true`, `superseded_by: [part1, part2]`) â€” purani
  manifest/audio/mp4 files untouched (legacy).
- Split point = shahadah clause | isti'adhah clause (Abu Dawud 5067 /
  Tirmidhi 3529). Naye entries: `_part1` (27.94s) + `_part2` (26.99s),
  dono -14 LUFS. DB total = **80 duas**.
- prepare_dua.py: archived entry par NOTE print hota hai.
- Videos render + qc_gate PASS: Part 1 = 33.0s (-14.3 LUFS, TP -1.3),
  Part 2 = 32.0s (-14.2 LUFS, TP -1.8).

### Task 2: remotion/scripts/batch_render.py (dedicated thumbnail batcher)
- Renders `thumbnail-card` comp -> out/thumbs/<dua_id>.png.
- mp4 filename TITLE-based hai -> title->dua_id map + `(n)` dup strip +
  dedupe; archived ids DB se skip; TEST files auto-unmapped.
- Checkpoint: out/thumbs/_render_state.json (atomic os.replace) â€”
  resume-safe, done-skip default, `--force` override.
- Dry-run DEFAULT (house rule). Flags: --apply/--limit/--only <ids>/--force.
- NOTE: `--only` dua_ids leta hai (stems nahi).
- Result: **43/43 thumbs done, 0 failed**, ~2.5s/thumb (118s full run).

### Task 3: ThumbCard.tsx (high-CTR still composition)
- Root.tsx me single `thumbnail-card` comp (1080x1920); props per-dua
  JSON override se. Theme-adaptive (bgGradient/accent/pill colors),
  contrast scrim sab themes pe, Shorts safe-zones respected (content
  y380-1500, channel line bottom-320), gold double frame + corner
  ornaments, Arabic headline (pehle 6 words) + title + reference pill
  (+ Part chip agar `_partN`).
- Purane TITLE-named thumbs (42) -> out/thumbs_legacy/ archive.

### Notes
- `public/backgrounds/*.jpg` khali hai -> ocean.jpg 404 warnings render
  logs me aate hain â€” GRACEFUL FALLBACK by design (Background.tsx:1179),
  5 purani ocean videos bhi aise hi bani hain. Regression NAHI.
- Backups: backups/backup_20260822_pillar3_pre.zip (duas.json, Root,
  KaraokeText, scripts, temp artifacts).

---

## AURORA + MASTERPIECE MODE (2026-08-22) â€” DONE
- AuroraGlows: bare drifting colored glows (screen blend), per-preset
  palettes (classic gold / royal emerald / cinematic blue-violet /
  masterpiece qadr-night 4-layer). stylePresets.ts AURORA table.
- Masterpiece = 5th preset (pehle hidden tha): shooting stars (3
  deterministic meteors), MoonHalo (2 breathing rings, sirf stars/qadr
  decor pe), RisingMotes (15 golden upar tairte motes).
- Dashboard Settings dropdown me "Masterpiece (Qadr Night FX)" add â€”
  ab SAB themes pe apply hota hai (paper pe FX auto-skip, halo sirf
  night decors). server STYLE_PRESETS whitelist updated.
- data.masterpiece flag (duas.json) -> make_manifest.py manifest me
  copy karta hai -> DuaVideo force masterpiece preset (setting ignore).
- First masterpiece video: Qadr Ki Raat Ki Dua.mp4 (Tirmidhi 3513,
  24s) â€” verified: shooting star visible (1143px streak), blue-dominant
  B=61 vs R=26.
- Cross-theme QA: dark+masterpiece blue-shift ok; paper safe render.
- PRESET_TEST_Cinematic.mp4 bhi sample render (36s).

## SYSTEM AUDIT SUMMARY (2026-08-22)
- Ek hi system live: node server.js (dashboard) + python scripts
  (TTS/manifest/QC via core/ ke 3 modules) + remotion render.
- Purana PIL GUI system soya hua (6 bat launchers root me) â€” user ne
  kaha chalne do, koi safai nahi. Migration PC-to-PC NAHI karni
  (same PC). Python rakhni hai (TTS pipeline depend karta hai).

---

## SECURITY/PERF/LOGS AUDIT (2026-08-22) â€” FINDINGS ONLY, KUCH NAHI BADLA

### Security âœ… (localhost design solid)
- server 127.0.0.1 bind only, path.basename traversal-safe,
  spawn array-mode no-shell, safeTitle sanitize, zero secrets.
- Minor: koi local app /api/render POST kar sakti hai (no token) â€”
  home PC pe negligible.

### Performance âš¡ (3 mauke)
1. HAR render me full rebundle ~15s/95s = 16% waste. Fix: Node API
   (@remotion/renderer) se bundle() reuse â€” batch me ~10min bachat.
2. Concurrency null (default) â€” thoda aur possible.
3. QC/thumb sequential â€” minor.

### Logs/Crash ðŸ”´ (sabse bada gap)
- job.logs sirf RAM (400 cap) â€” restart = history GAYAB. Per-render
  file persist NAHI hoti. FIX PENDING: out/logs/<dua>-<ts>.log likhna.
- Crash handlers exist -> dashboard/crash.log; ab tak crash ZERO.
- Server crash = manual restart (watchdog nahi).
- Cancel taskkill tree-kill ok.

### Gaps ðŸŸ¡ (abhi masla nahi)
- Disk guard nahi (H: free 156GB healthy) before render.
- temp/ 169MB TTS cache intentional; purani duas artifacts linger.
- out/ 384MB unbounded retention.
- Queue RAM-only (restart pe pending batch ud jati hai).

### Fix Priority (jab karein)
1. Render logs persist (~30m) 2. Watchdog auto-restart (~20m)
3. Bundle-reuse speed (~2h) 4. Disk guard + retention (~30m)

---

## STYLE PRESET SYSTEM (2026-08-22) â€” DONE
Theme = colors (11 themes) Ã— Preset = decor/VFX intensity. Freely
combinable (44 combos), koi conflict nahi.

- **File:** src/stylePresets.ts â€” ResolvedStyle interface, CLASSIC
  defaults (= purane hardcoded values), 4 presets:
    classic (current look) | royal (heavy ornaments/glow)
    minimal (no frame, subtle) | cinematic (deep vignette, slow sweeps)
- **Preset controls:** corner inset/size/opacity, hairline frame
  on/off+opacity, ornament scale/sway, rays/orbs opacity,
  particles scale, grain, vignette scale, sweep cycle/alpha.
- **Flow:** Dashboard Settings dropdown -> config.json stylePreset ->
  server readStylePreset() -> render/still CLI `--props=<temp file>`
  (JSON inline Windows pe toot jata hai â€” FILE use karo!) ->
  Remotion inputProps shallow-merge over defaultProps {data} ->
  DuaVideo resolveStyle() -> Background + StarOrnament + sweeps.
- **Cache:** cacheKey config.json content include karta hai -> preset
  change = auto cache bust âœ“. Thumbs bhi preset se bante hain.
- **QA (numeric, ham_o_gham frame 100):** corner line luma
  royal 36.9 > classic 30.2 > minimal 22.4 (+22%/-26% expected);
  ornament width 73/64/58 px; frame avg minimal me gone (33.5 vs 36.7).
- Backup pre-change: backups/backup_20260822_stylepresets_pre.zip
- Config POST semantics: undefined/null key = preserve old; empty
  string = intentional clear. Channel name restored after test.

---

## SYSTEM OVERVIEW
Naya video generation system (Remotion-based). Purana Python/PIL renderer
`legacy/` me archive ka plan hai (abhi intact hai).

- **Stack:** React + TypeScript -> Headless Chrome frames -> FFmpeg encode
- **Dashboard:** http://127.0.0.1:7860 (zero-dependency Node server)
- **Auto-start:** Startup folder VBS se server login pe chal jata hai
- **Desktop shortcut:** `Dua Studio.bat`

## RUN Kaise
1. PC on -> server auto-start (hidden)
2. Browser: http://127.0.0.1:7860 ya Desktop `Dua Studio.bat`
3. Card pe RENDER -> TTS check -> manifest -> video render (live progress)
4. PLAY button se video dekho (`remotion/out/` me save hoti hai)

## VIDEO STRUCTURE (V2 Premium)
| Section | Duration | Content |
|---------|----------|---------|
| Bismillah intro | 3.75s | Ø¨Ø³Ù… Ø§Ù„Ù„Û card + Hamed voice (TTS) |
| Arabic karaoke | ~varies | Word-by-word gold pill + glow pulse |
| Light sweep | transition | Arabic -> Urdu phase |
| Urdu karaoke | ~varies | Nastaliq, word-by-word |
| End card | ~3s | ðŸ¤²âœ¨ emoji + title + reference + SUBSCRIBE |

- Fonts bundled: Amiri Quran (Arabic), Noto Nastaliq Urdu, Scheherazade New
- Cinematic: Ken Burns zoom 1.0->1.055, film grain, vignette, particles
- Output: 1080x1920 (9:16), 24fps, h264+AAC

## 8 THEMES (category ke hisab se auto-select + form me thumbnail picker)
| Theme | Look | Categories |
|-------|------|-----------|
| dark | Dark + gold particles + stars | general (alternate) |
| mosque | Stars + moon + masjid silhouette | sleep, evening |
| sunset | Sun disc + warm gradient | morning, travel |
| manuscript | Paper + ink + border frame | prayer |
| emerald | Islamic geometry pattern | food, bathroom |
| ocean | Teal waves + crescent moon | manual |
| desert | Sand dunes + sun | manual |
| royal | Purple + ornate star pattern + rings | manual |

Mapping: `remotion/scripts/make_manifest.py` -> CATEGORY_THEME
Override: duas.json ke `template` field ya dashboard Add/Edit style grid
Previews: `remotion/out/previews/<theme>.png` (StylePreview composition se)

## VFX STACK (current)
- Draw-on Bismillah calligraphy (SVG stroke, intro)
- God rays (swaying light beams, top)
- Blur + zoom punch (Arabic->Urdu transition)
- Sparkle burst (end card, 16 sparks)
- Ken Burns zoom, film grain, vignette, particles/stars
- Light sweep, karaoke gold pill pop, spring animations
- Corner ornaments (chaar koney), progress bar (bottom gold line)
- Wave drift (ocean), dune layers (desert), rotating rings (royal)

## FILES MAP
```
H:\DuaVideoGenerator\
â”œâ”€â”€ data\duas.json              <- 33 duas database (source of truth)
â”œâ”€â”€ data\duas.backup.json       <- auto-backup pehli add-dua pe
â”œâ”€â”€ temp\<id>_ar.mp3            <- TTS outputs + _ur.mp3 + timing .jsonl
â”œâ”€â”€ temp\<id>_merged.wav        <- final audio (normalized + padded)
â”œâ”€â”€ remotion\
â”‚   â”œâ”€â”€ src\                    <- React components (DuaVideo, Background,
â”‚   â”‚                              KaraokeText, themes.ts, fonts.ts)
â”‚   â”œâ”€â”€ src\data\<id>.json      <- manifests (auto-generated per dua)
â”‚   â”œâ”€â”€ public\audio\           <- per-dua mp3 + bismillah.wav
â”‚   â”œâ”€â”€ public\fonts\           <- bundled fonts
â”‚   â”œâ”€â”€ scripts\make_manifest.py    <- sidecars -> manifest (+theme map)
â”‚   â”œâ”€â”€ scripts\prepare_dua.py      <- standalone TTS+merge (uses core/)
â”‚   â”œâ”€â”€ dashboard\server.js     <- dashboard server (zero-dep Node)
â”‚   â”œâ”€â”€ dashboard\start_server.vbs  <- auto-start launcher
â”‚   â””â”€â”€ out\<Title>.mp4         <- RENDERED VIDEOS
â”œâ”€â”€ core\                       <- PURANA PIPELINE (TTS/Audio ab bhi yahan se)
â”œâ”€â”€ main.py                     <- purana entry point (fallback)
â””â”€â”€ output\                     <- purane bug-wale videos (move/delete?)
```

## IMPORTANT TECHNICAL NOTES
- npm/npx PowerShell me block hote hain -> `npm.cmd` / direct node CLI use karo
- Remotion render: `node node_modules/@remotion/cli/remotion-cli.js render <comp-id> ...`
  - `--browser-executable="C:\Program Files\Google\Chrome\Application\chrome.exe"`
  ZAROORI hai (headless shell download fail hota hai)
- Composition ID = dua_id with `_` -> `-` (Remotion underscore allow nahi karta)
- Har dua ki apni composition (Root.tsx require.context se auto-register)
- Urdu sidecar timings UR mp3 relative hoti hain; merged timeline =
  ar_duration + 0.30 gap + offset (make_manifest.py sambhalta hai)
- ffmpeg PATH me nahi -> imageio_ffmpeg.get_ffmpeg_exe() use hota hai
- edge-tts ticks: offset / 10_000_000 = seconds
- Server duplicate-start safe (EADDRINUSE graceful exit)

## DASHBOARD FEATURES (v2/v3 current)
- 33 dua cards: badges + theme chip + MB size, RENDER/PLAY buttons,
  force re-TTS checkbox (state persist), action icons:
  Edit / Copy text / Duplicate / Delete (confirm + backup)
- Search box + category filter chips + stats header (X/N rendered + ring)
- In-page video player modal (range requests, seek support)
- Live job bar: step + percent + color-coded log console + dismiss
- Toast notifications (render done/fail), active card pulse
- Add-Dua form: thumbnail style picker (8 themes), voice pair,
  Enter/Esc/backdrop-close, auto-clear on save
- AI Import: Gemini prompt copy + paste-parse (JSON/labeled/built-in
  Chrome AI fallback), form auto-fill
- APIs: /api/duas, /api/status, /api/render, /api/open, /api/add-dua,
  /api/update-dua, /api/delete-dua, /api/duplicate-dua,
  /video/<name>, /preview/<theme>.png

---

- Version pin note: naye packages bhi 4.0.370 exact âœ“
## VISUAL VERIFICATION DONE (2026-08-21): 5 SAMPLE RENDERS ALL PASS
- sleep_enter(sunset/3.1MB), ham_o_gham(dark/6MB),
  subah_o_shaam_ki_hifazat(ocean/8.3MB, 35w/75w AUTO-FIT TEST),
  evening_mulk(mosque/4MB), salah_start(manuscript/4.7MB)
- Sab force=true (cache bypass), purana audio reuse (TTS skip),
  QC 5/5 PASS, thumbs regen OK, clock-wipe+lottie+noise+kisi me
  render fail nahi. User playback review pending (look feedback).
- AUTO-FIT TEXT: @remotion/layout-utils@4.0.370 installed;
  fitFontSize() helper DuaVideo.tsx me â€” measureText se wrapped-block
  height estimate karke font shrink karta hai. Arabic base 104 (min 58,
  max block 1150px) / Urdu base 50 (min 32, max 1250px). Sabse lambi
  dua subah_o_shaam_ki_hifazat (35w ar/75w ur) ab bhi safe. TSC CLEAN.

## LOTTIE BUG FIXED -> SVG STAR (2026-08-21)
- Bug: @remotion/lottie ka internal delayRender("Waiting for Lottie
  animation to load") 28s timeout â€” lottie-web hand-made JSON pe init
  hang. Flaky: fetch-vs-frame race decide karta tha kaunsi dua fail.
- Fix: async Lottie component HATA diya; deterministic <StarOrnament>
  SVG (8-point gold star, rotate+pulse, pure frame math, zero network).
- Packages installed hain (@remotion/lottie + lottie-web) magar abhi
  unused â€” future me VERIFIED-GOOD assets ke sath try kar sakta hai.
- Verify: salah_start fresh re-render PASS (6.2MB, QC true). Ab batch
  render safe.
- LESSON: verify script me stale videoFile/QC dhoka de sakta hai â€”
  fresh mtime + status step check karna chahiye.
- Visual verification (2026-08-21): 5 sample renders sab PASS
  (sleep_enter/ham_o_gham/subah_o_shaam/evening_mulk/salah_start).
- User-made dua masjid_me_dakhil_hote_waqt AUTHENTIC verify (Muslim
  713 exact text), rendered QC PASS. Template qadr laga hai (optional:
  mosque/emerald better fit).

## VISUAL QUALITY UPGRADE (2026-08-21) â€” DONE + QA VERIFIED
- Decor layer: CornerOrnaments ab animated (staggered draw-in + breathing
  + diamond pulse); non-paper themes pe double hairline gold frame
  (breathing); particles 2-depth layers (far dim/slow + near bright/fast,
  parallax drift ke sath); AmbientOrbs (2 Perlin-drift glow blobs, screen
  blend); GodRays softened (0.85->0.55, slow sway); moon glow breathing;
  PatternLattice/RoyalOrnament slow drift + counter-rotation; StarOrnament
  luminous (drop-shadow + inner counter-rotating 4-pt star).
- Color treatment: Theme.grade {brightness,contrast,saturate} per theme â€”
  root AbsoluteFill filter. Dark themes lift (1.10-1.14), light manuscript
  controls highlights (0.985/1.06/0.97). GradeLayer + bloom layer per
  theme (screen blend, subtle). Title textShadow: dark=luminous gold,
  paper=soft shadow.
- QA (numeric, ffmpeg+PNG decode): DARK yavg 22.5->23.6 after bump,
  ymax 241 (no clip), corners visible (ymax~100 vs bg~8). LIGHT yavg
  204-207, ymax 251 (no blowout), ymin 58 (contrast ok). QC PASS dono.
- NOTE: Remotion bundled ffmpeg minimal build â€” signalstats/BMP/null
  muxer NAHI hai; PNG roundtrip + custom Node PNG decoder use kiya
  (qa_stats.js pattern temp me).
- User visual playback review pending (model image-read nahi kar sakta).

## STAR SWAY + CRESCENT + CONTINUOUS SWEEPS (2026-08-21) â€” DONE
- User feedback: full-spin star content ke upar acha nahi lagta.
- A1+HalfMoon: StarOrnament ab crescent moon + 8-pt star (SVG mask
  self-contained), rotation HATA â€” gentle sway +-8deg (~7s cycle),
  pulse+glow same. Inner counter-rotation removed.
- B1: Continuous alternating light sweeps â€” har 6.5s ek pass, direction
  alternate (L->R / R->L), sin-envelope fade edges, gradient 0.13
  (phase-change wale jitna visible). Phase-change bright sweep bhi hai.
- QA: within-pass trajectory analysis se direction confirm (L2R passes
  x badhta hai, R2L me ghatta hai â€” 4/4 samples sahi). QC PASS.
- NOTE: numeric band-position absolute thresholds unreliable hain
  (gradient angle + bg asymmetry); RELATIVE motion dekhna chahiye.

---

# AUDIT (2026-08-21) â€” PURGED (sab complete)
RED/YELLOW/GREEN lists hata di gayin â€” har item implement ho chuka:
Batch Render+Cancel+Metadata+Settings+OpenFolder (P1), Safe-area+CTA+
LastWord+Grade+Drift+SFX+Pronunciation (P2), Caching+QC+Thumbs+History+
Bismillah toggle (P3), Templates ramadan/eid/qadr, Theme chip, Video
info, Filename sanitizer, Stats header, Form UX â€” SAB DONE.

## MIGRATION PLAN (old python -> legacy/) â€” PENDING DECISION
Step 1: standalone tts.py + audio.py (edge-tts + ffmpeg direct,
        core/ imports khatam)
Step 2: parity test (same dua, same output verify)
Step 3: move to legacy/: main.py, core/, tests/, frontend/, *.bat,
        HOWTOUSE.txt, PLAN.md, samples/
Keep: data/, temp/, remotion/, output/
Note: 202 purane tests legacy me jayenge (wo old renderer ke the)

## OPEN QUESTIONS
- [x] Purane output videos -> DELETED (fresh start cleanup)
- [x] Batch skip policy -> SKIP + report implemented
- [x] Lottie flake -> SVG star se FIXED (batch safe)
- [ ] Migration ab karni hai ya baad me? (recommendation: standalone
      tts.py banne ke baad)
- [ ] Long-format mode (>32s duas: Kaferoon/Maun/Ayat-ul-Kursi)?

## ABHI PENDING (2026-08-21 status)
- 42 naye items ka TTS+Render batch (user jab kaho â€” ab safe)
- User playback review: clock-wipe look + SVG star feedback
- masjid dua template qadr->mosque/emerald (optional, user decide)
- Long-format mode / Multi-language / Tajweed / Migration â€” sab baad

---

# FUTURE ROADMAP (2026-08-21 planning)

## TIER 1: Foundation (= audit ke RED items)
| Feature | Kyun |
|---------|------|
| Batch Render + Queue | 33 videos ek click |
| YouTube Metadata auto-generate | Upload-ready package per video |
| Thumbnails per dua | Preview + YouTube poster |

## TIER 2: Automation (channel growth engine)
| Feature | Detail |
|---------|--------|
| Auto-QC | Pixel-check + audio loudness check, fail = auto retry |
| ~~YouTube Auto-Upload / Scheduler / Compilation Builder~~ | REMOVED (user decision 2026-08-21) |

## TIER 3: Content Expansion
| Direction | Detail |
|-----------|--------|
| 100+ Duas | Full dua collections (Bukhari/Muslim) |
| Quran Series | Ayat-ul-Kursi, Surah chunks â€” same pipeline |
| Multi-language | English/Hindi/Turkish line (sirf TTS voice badalna) |
| Seasonal Packs | Ramadan / Eid / Jummah series |

## TIER 4: Premium Visuals
| Upgrade | Source |
|---------|--------|
| Real nature backgrounds | Pexels/Pixabay API (free, no copyright) |
| Animated calligraphy | SVG stroke animation |
| Tajweed coloring | Harf rules ke hisab se rang |
| Seasonal themes | Ramadhan theme, Laylatul Qadr theme |

## BUSINESS PATH
```
33 duas ready
   â†“ Tier 1 (DONE)
Manual posting -> 1000 subs + 10M Shorts views = YouTube Partner
   â†“ Tier 3 content
Zyada duas + series -> scale
   â†“ Tier 4
Multiple channels (Urdu/English/Arabic) -> scale
```
Sab FREE stack pe (sirf PC + internet).

## NEXT ACTION (jab resume ho)
Content Expansion (naya Phase 4) â€” 100+ duas AI Import se add karna.

---

# VIDEO SYSTEM AUDIT (2026-08-21) â€” IMPROVEMENTS

## EVIDENCE / TESTED
- Sabse lambi allowed dua `ham_o_gham` (24 AR words, 24.1s) render karke
  pixel-check kiya: Arabic block 604px, Urdu 728px â€” **NO OVERFLOW**.
- Current 31 allowed duas me text overflow ka koi risk nahi.
- Text vertically centered hai -> neeche khali area = Shorts UI caption
  zone ke liye already perfect.
- Word stats (temp sidecars se): max allowed = ham_o_gham 24 AR words;
  blocked >25s policy = bohat_khoobsurat_dua(111w/144s),
  sayyid_istighfar(36w/35s), d_10_15(25w/39s).

## A. Engagement Boosters (algorithm)
| # | Improvement | Note |
|---|-------------|------|
| 1 | Verse progress bar (patli gold line bottom) | retention â†‘ |
| 2 | CTA rotation end card (Subscribe/Like/Share/Follow) | har video alag signal |
| 3 | Last-word hold (aakhri lafz ke baad pura text dim-gold, pill fade) | graceful ending |

## B. Shorts-Safe Design
| # | Improvement | Note |
|---|-------------|------|
| 4 | Safe-area padding 80px -> 110-120px | right buttons + caption zone overlap se bachao |
| 5 | Bottom-empty advantage | ALREADY SAHI HAI (kuch mat karo) |

## C. Audio Quality
| # | Improvement | Note |
|---|-------------|------|
| 6 | TTS pronunciation fix map (common Arabic words dictionary) | edge-tts galtiyan |
| 7 | Ambient bed toggle (-26dB royalty-free pad, optional) | feel |

## D. System Speed & Quality
| # | Improvement | Note |
|---|-------------|------|
| 8 | Render caching (manifest+audio hash same -> skip) | speed |
| 9 | Concurrency tune (CPU cores ke hisab se) | speed |
| 10 | Auto-QC post-render (pixel+audio check -> dashboard PASS/FAIL badge) | reliability |

## E. Future-Proof (abhi nahi)
| # | Improvement | Note |
|---|-------------|------|
| 11 | Auto-fit text (@remotion/layout-utils) | jab 100+ duas hon gi |

## RECOMMENDED ORDER
1. #1 + #2 + #4 ek package (chhota kaam, bara fayda)
2. #10 Auto-QC
3. #8 caching
4. baaki jab time ho

---

# CINEMATICS / GPU / ADDONS RESEARCH (2026-08-21)

## BENCHMARK (apne PC pe, bathroom-enter 510 frames)
| Config | Time | Result |
|--------|------|--------|
| Default | 40.8s | baseline |
| --gl=angle (GPU) | 40.9s | koi farak nahi |
| angle + concurrency=11 | 43.2s | thora slow |

- Hardware: AMD Radeon RX590 GME 4GB + Ryzen 5 5600 (6c/12t)
- Conclusion: CSS-based content pe GPU flags bekaar. GPU sirf
  WebGL/Skia/Three.js effects ke liye useful (--gl=angle tab lagana).
- Asli speed win = RENDER CACHING (hash same -> skip), GPU nahi.
- Remotion docs: angle memory-leak issue long renders me; hamari
  videos short hain to problem nahi.

## OFFICIAL PACKAGES (free) â€” USE CASES
| Package | Kya Dega | Hamara Use |
|---------|----------|------------|
| @remotion/paths | evolvePath stroke-draw | ANIMATED BISMILLAH CALLIGRAPHY (intro me likhta hua) â€” killer feature |
| @remotion/transitions | TransitionSeries: clock-wipe/slide/wipe/fade | AR->UR transition upgrade |
| @remotion/noise | Perlin noise | organic particle drift (sine fake ki jagah) |
| @remotion/motion-blur | trail effects | word pop motion blur |
| @remotion/lottie | Lottie animations | LottieFiles free Islamic ornaments (lanterns/patterns) |
| @remotion/layout-utils | fitText | auto-fit (100+ duas future) |
| @remotion/shapes | SVG shapes | geometric ornaments |
| @remotion/skia | GPU shader glow/bloom | advanced, GPU ke sath hi |

Install: `npx remotion add <package>` ya npm.cmd install --save-exact @remotion/<pkg>@4.0.370

## THIRD-PARTY (free)
- Onda (ondajs) â€” 70 components + 18 transitions library
- remotion-gl-transitions â€” OpenGL shader transitions pack
- RemotionUI â€” production motion components
- LottieFiles.com â€” free Islamic Lottie animations

## REFINED PACKAGE PLAN (jab implement ho)
1. Animated Bismillah calligraphy (@remotion/paths evolvePath)
2. AR->UR wipe/clock-wipe (@remotion/transitions)
3. Noise particles (@remotion/noise)
4. Render caching (server.js me manifest+audio hash compare)
5. Lottie ornaments (baad me, theme variety ke liye)

## VERSION NOTE
Sab packages 4.0.370 pe pin rakho (fonts wala mismatch pehle ho chuka).

---

# MOTION/CINEMATIC CAPABILITY AUDIT (2026-08-21)
13 categories â€” kya hai, kya ho sakta hai. (Koi change nahi kiya, sirf audit)

## CATEGORY-BY-CATEGORY
| # | Category | Already Hai | Ho Sakta Hai |
|---|----------|-------------|--------------|
| 1 | Motion Graphics | gold pill, animated dividers, end-card pop | SVG Islamic icons, Lottie icons, geometric borders |
| 2 | Cinematics | Ken Burns zoom 1.0->1.055 | parallax depth (3 particle speed-layers + blur), blur->sharp reveal |
| 3 | Transitions | crossfade + light sweep | clock-wipe/slide (@remotion/transitions), BLUR transition (pure CSS filter), zoom-punch |
| 4 | VFX | particles(46), glow, vignette | light rays (conic-gradient rotate), bokeh, dust (@remotion/noise), smoke blobs, word-pop sparks |
| 5 | Kinetic Typography | pop-by-word, spring, glow pulse, past/future â€” STRONGEST | RTL slide-in, blur-in words, letter-spacing breathe |
| 6 | Camera Effects | slow zoom only | camera drift (noise wander), subtle shake on phase change, parallax zoom |
| 7 | Overlays | film grain, vignette | light leaks (blend-mode sweep), lens flare, floating bokeh |
| 8 | Background | gradients, particles, masjid silhouette, lattice, sun/moon | moving gradient, aurora blobs, SVG wave morph |
| 9 | Compositing | 8+ layer stack already | blend modes (screen/overlay), depth-of-field blur |
| 10 | Color Grading | per-theme palettes (5) | GRADE LAYER â€” full-frame CSS filter (contrast/warmth/tint) = sasta bara effect |
| 11 | Timing/Easing | spring() + interpolate clamp â€” solid | custom bezier, staggered word delays (wave effect) |
| 12 | Lower Thirds | top reference bar only | bottom lower-third slide-in, corner channel watermark |
| 13 | SFX/Audio | NOTHING (sirf TTS voice) â€” BIGGEST GAP | whoosh on transitions, intro ambience, riser before end card, CTA tick; Pixabay/Freesound free SFX; Remotion Audio volume prop |

## SUMMARY
```
Strong abhi:   Kinetic Typography, Compositing, Timing, Overlays(base)
Bada gap:      SFX (0%), Camera variety, Transitions sirf 1 type
Sasta+bara:    Color Grade Layer + Blur Transition + Camera Drift
               (teeno pure CSS/React, koi package nahi chahiye)
Assets chahiye: SFX files + Lottie ornaments (free: Pixabay/Freesound/LottieFiles)
Heavy/risky:   Skia shaders, Three.js (abhi zaroorat nahi)
```

## IMPLEMENTATION BUNDLES (jab karna ho)
- **Starter Combo (recommended):** Color Grade Layer + Camera Drift +
  Blur Transition + SFX pack (4 files free download) â€” video ka look
  bilkul alag level
- **Depth Combo:** parallax particles + bokeh + light rays
- **Typography Plus:** staggered word delays + blur-in + RTL slide
- **Transition Pack:** @remotion/transitions install + clock-wipe AR->UR

SFX sources: pixabay.com/sound-effects, freesound.org (license check CC0)

---

# AI AUTOMATION NOTES (2026-08-21)

## DECISION
- Local LLM/model connect NAHI karna (user decision).
- Sirf BROWSER-BASED FREE AI tools use honge.
- Paid/heavy AI (ElevenLabs voices, voice cloning, Azure paid) â€” OUT OF SCOPE.

## ALREADY AI IN USE
- edge-tts = Microsoft Azure Neural TTS (cloud deep-learning voices):
  HamedNeural (Arabic), AsadNeural/UzmaNeural (Urdu).
- Word timings (WordBoundary) bhi isi neural service se aati hain â€”
  karaoke isi pe chalta hai.
- Internet sirf TTS ke waqt chahiye; baaki system 100% local.

## BROWSER FREE AI TOOLS (verified categories)

### Text / Metadata / Translation
| Tool | Note |
|------|------|
| ChatGPT (chatgpt.com) | free tier |
| Claude (claude.ai) | free tier |
| Gemini (gemini.google.com) | free, generous |
| Copilot (copilot.microsoft.com) | free GPT-class |
| DeepSeek (chat.deepseek.com) | free |
| Qwen (chat.qwen.ai) | free â€” Arabic/Urdu me achha |

Workflow: dua text paste -> "YouTube title/description/tags/hashtags
likho" -> output copy -> video ke sath metadata file save.

### AI Background Images
| Tool | Free Limit |
|------|------------|
| Bing Image Creator (bing.com/create) | free DALL-E boosts |
| Leonardo.ai | ~150 tokens daily |
| Ideogram | daily free |
| Adobe Firefly | monthly credits (commercial-use safest) |

Download -> remotion/public/backgrounds/ -> theme me use.

### AI Audio/SFX
| Tool | Use |
|------|-----|
| ElevenLabs SFX (free tier) | whoosh/impact/ambience generation |
| Suno (free daily) | ambient nasheed-style pads |

## AI USE-CASES MAPPED (browser-only)
1. Auto Metadata Writer â€” har dua ka title/desc/tags (33x manual likhna
   khatam). Dashboard me "AI Prompt Copy" button possible hai jo ready-
   made prompt clipboard pe de de.
2. Custom AI backgrounds per theme (upar wale generators se).
3. Multi-language translation lines (English/Hindi channels ke liye).
4. Title/hook variants (A/B testing ke liye 3 variants per video).
5. SFX generation (transition whoosh, ambience) â€” SFX gap fill.

## NEXT ACTION (jab implement ho)
Sabse pehle: #1 Auto Metadata Writer (prompt template + dashboard
button) â€” ~30 min ka kaam, sabse zyada time bachata hai.

---

# MASTER PLAN â€” PHASES & WORKING ORDER (2026-08-21)
Status legend: [ ] pending | [~] partial | [x] done

## PHASE 0 â€” HOUSEKEEPING (aadha ghanta, ek dafa)
- [ ] Migration decision: core/ -> legacy/ plan ready hai (notes me).
      Recommendation: ABHI MAT KARO â€” prepare_dua.py core/ use karta hai.
      Jab Phase 2 me standalone tts.py ban jaye tab karna.
- [ ] Purane output/ videos: delete ya OneDrive archive (user gawahi de)
- [ ] NOTES.md stale sections purge (audit lists jo complete ho gayi)

## PHASE 1 â€” CHANNEL FOUNDATION (production machine) ~2-3 din
Goal: Ek click me 30+ videos + upload-ready package.
| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.1 | Batch Render All + queue UI (saari audio-ready duas, sequential, per-card status, fail=skip-and-continue) | server.js (queue array), index.html | 3-4h |
| 1.2 | Job Cancel button (child process kill, queue se next) | server.js | 1h |
| 1.3 | Auto Metadata Writer: render done -> <Title>.txt sidecar (title/desc/tags/hashtags template) + dashboard "AI Prompt Copy" button (Gemini se custom metadata mangwane ke liye) | server.js, new scripts/metadata.py | 2h |
| 1.4 | Channel settings panel (@handle + channel name) -> end card pe watermark + subscribe CTA | config.json, DuaVideo.tsx EndCard, index.html modal | 2h |
| 1.5 | Open Folder button (out/) + audio preview button (TTS mp3 player) | index.html, /audio route | 1h |
Acceptance: "RENDER ALL" dabao -> 31 videos + 31 .txt files bina hath lagaye.

## PHASE 2 â€” VIDEO QUALITY PACK (look ka final level) ~2 din
Goal: Har video premium + Shorts-safe.
| # | Task | Files | Effort |
|---|------|-------|--------|
| 2.1 | Safe-area padding 80px -> 115px (Shorts UI overlap fix) | DuaVideo.tsx paddings | 15m |
| 2.2 | CTA rotation end card (Subscribe/Like/Share/Follow â€” dua id % 4) | DuaVideo.tsx EndCard | 45m |
| 2.3 | Last-word hold (aakhri lafz ke baad text dim-gold fade) | KaraokeText.tsx | 45m |
| 2.4 | Color Grade Layer (per-theme CSS filter overlay: contrast/warmth/tint) | new GradeLayer.tsx | 1h |
| 2.5 | Camera Drift (noise-wander translate on background, Ken Burns ke sath) | Background.tsx | 1h |
| 2.6 | SFX pack: whoosh (transition), soft riser (end card), tick (CTA) â€” Pixabay CC0 download -> public/sfx/ -> Remotion <Audio> volume automation | DuaVideo.tsx | 2-3h |
| 2.7 | TTS pronunciation map (common Arabic words -> edge-tts friendly spelling) | prepare_dua.py / core tts | 1-2h |
Acceptance: 3 sample renders (dark/ocean/manuscript) dekh kar approve.

## PHASE 3 â€” RELIABILITY & SPEED ~1-2 din
| # | Task | Files | Effort |
|---|------|-------|--------|
| 3.1 | Render caching: manifest+audio hash -> out/ me video exist & fresh = skip (batch re-runs instant) | server.js | 2h |
| 3.2 | Auto-QC post-render: ffmpeg frame extract (brightness variance) + loudness check -> PASS/FAIL badge card pe, fail = auto retry once | server.js, scripts/qc.py | 3h |
| 3.3 | Per-dua thumbnail stills (card poster image, StylePreview pattern reuse with real dua data) | Root.tsx props override, server /thumb route | 2h |
| 3.4 | Render history persist (JSON log: date/dua/duration/size/result) | server.js | 1h |
| 3.5 | Bismillah intro on/off toggle per dua (duas.json field) | types, DuaVideo, form checkbox | 1h |

## PHASE 4 â€” CONTENT EXPANSION (jab channel chal raha ho)
- [ ] 100+ duas (Bukhari/Muslim collections â€” AI Import se fast add)
- [ ] Quran series (Ayat-ul-Kursi, surah chunks)
- [ ] Multi-language lines (English/Hindi â€” sirf TTS voice badalna)
- [ ] Seasonal packs (Ramadan/Eid/Jummah)
- [ ] Auto-fit text (@remotion/layout-utils) â€” 100+ pe zaroori

## PHASE 5 â€” PREMIUM VISUALS (optional polish)
- [ ] @remotion/transitions clock-wipe (AR->UR upgrade)
- [ ] @remotion/noise organic particles
- [ ] Lottie Islamic ornaments (LottieFiles free)
- [ ] AI-generated backgrounds per theme (Bing/Firefly -> public/backgrounds/)
- [ ] Tajweed coloring
Note: sab packages 4.0.370 pe pin.

## WORKING ORDER RULES
1. Phase order mat todo â€” 1 complete karo phir 2 (foundation pehle).
2. Har task ke baad: tsc --noEmit + ek test render + dashboard verify.
3. Naya feature = NOTES.md update same session me.
4. Version pin: @remotion/* @4.0.370 exact.
5. Backup before bulk ops: duas.json + out/ ki list.

## DECISIONS LOG
- 2026-08-21: Local LLM OUT, browser AI only (user).
- 2026-08-21: GPU flags bekaar (benchmark) â€” caching priority.
- 2026-08-21: Draw-on Bismillah SVG stroke se ho gaya (bina @remotion/paths).
- 2026-08-21: >25s policy wali 3 duas: batch me SKIP + report (recommendation,
  user confirm kare).
- 2026-08-21: PHASE 4 (Growth Engine: YouTube Auto-Upload, Scheduler,
  Compilation Builder) plan se PURA REMOVE â€” user decision. Ab Content
  Expansion = Phase 4, Premium Visuals = Phase 5.

---

# VOICE MASTERING (2026-08-21) â€” IMPLEMENTED
## Decision: Hamed solemn + studio chain (user approved "2+4 combo")
- Chain (make_manifest.py MASTER_FILTER): highpass 70Hz, bass +2.5dB,
  presence +1.5dB @3kHz, compressor (-18dB:3:1), LIGHT masjid aecho,
  loudnorm -16 LUFS / TP -1.5 (YouTube standard)
- Timing-safe: koi time-stretch nahi -> karaoke sync perfect
- make_manifest.py ab master_audio() use karta hai (wav->mp3 step)
- reprocess_audio.py: purani duas ka one-shot re-master (no TTS needed),
  run: python scripts/reprocess_audio.py
- Status: 33/33 audio mastered + bismillah.wav mastered
- Verify: sleep_enter.mp3 mean -23.3dB peak -1.8dB; test render OK
- Future renders: automatic (har manifest build pe polish hoti hai)

---

# FRESH START CLEANUP (2026-08-21)
## Voice Regeneration (solemn prosody implemented)
- core/tts_engine.py: PROSODY added â€” ar: rate -8% pitch -2Hz,
  ur: rate -5% pitch -1Hz (user-approved combo)
- config.py: VIDEO_MAX_DURATION 25 -> 32 (slow voices ne lambi duas
  cross ki; Shorts 3 min allow karta hai). ham_o_gham ab PASS (~27s).
- regen_all_voices.py: 30/33 fresh solemn TTS + mastered.
  3 BLOCKED (genuinely lambi): sayyid_istighfar, bohat_khoobsurat_dua
  (144s!), d_10_15 â€” ye purani voice audio se render hongi jab tak
  long-format mode nahi banta (future decision).
- bismillah.wav: regenerated (new prosody) + mastered.

## Deleted (user approved "sab new karain gey")
- out/ ki saari 9 purani .mp4 videos (old style/unmastered) â€” previews/ kept
- output/ folder (7 files, 40MB purane bug-wale videos)
- temp/voice_test/ samples, orphan bismillah.mp3
- Ab out/ sirf previews/ + nayi renders

## Current State
- Dashboard: 33/33 audio-ready, 33 manifests, 0 rendered (fresh start)
- Agla render = solemn voice + mastering + VFX + 8 themes ka full package

## CORRECTION (2026-08-21)
- bismillah.wav pehle sirf MASTER hui thi (purani voice). AB actually
  regenerate: new prosody (-8%/-2Hz) + master chain. Duration 3.41s
  (intro 3.75s window me fit). Verified.

## DASHBOARD v4 ADDITIONS (2026-08-21)
1. Per-side TTS: har card pe AR / UR mini buttons -> /api/tts-single ->
   prepare_dua.py --only ar|ur (dusra side exist kare to merge+manifest bhi)
2. TEST BENCH: toolbar button -> custom arabic/urdu text ki awaz,
   temp/custom/ me banti hai, portal me KUCH SAVE NAHI hota.
   Endpoints: /api/tts-custom, GET /temp/custom_*.mp3
   Script: scripts/tts_custom.py
   NOTE: PowerShell se Arabic JSON body corrupt hoti hai (? marks) â€”
   browser theek bhejta hai; testing ke liye node se payload file banao.
3. Folder buttons: VIDEOS (out/), AUDIO (public/audio) -> /api/open-folder
   (explorer.exe). Temp folder bhi possible via which=temp.
- REVISION: per-card AR/UR buttons hata diye (user request). Ab ek hi
  portal-level option: toolbar "VOICE ONLY" -> dua dropdown + force
  checkbox -> combined AR+UR recording (merged.wav) in-page player me.
  Endpoints: /api/voice-only, GET /temp-voice/<id>. /api/tts-single removed.
- REVISION 2: Test Bench modal/button REMOVE. Voice Only me ab 2 modes:
  (1) Portal Dua - dropdown + force -> merged.wav play (save nahi)
  (2) Custom Text - arabic/urdu + naam -> TTS + master ->
      public/audio/custom_<naam>.mp3 me SAVE hoti hai
      (portal list me nahi aati, sirf AUDIO folder me rehti hai).
  Endpoints: /api/voice-only, /api/tts-custom (name param),
  GET /audio/<file>, GET /temp-voice/<id>.
- FIX: Video Style "Dark Gold" apply nahi hota tha - resolve_theme
  (make_manifest.py) aur theme-map.js dono me `t != "dark"` guard tha
  jo explicit dark ko category-default pe girata tha. Guard hataya -
  ab selected template hamesha apply hota hai (8/8 styles).

---
# PHASE 1 COMPLETE (2026-08-21) â€” Channel Foundation
## Implemented + Verified
- 1.A Queue Engine: sequential processQueue(), /api/render-all
  (saari duas; >40s wali fail-record ho kar skip), /api/status me
  queue block {active,current,total,idx,done,failed,skipped}
- 1.B Batch UI: toolbar "RENDER ALL" chip + confirm dialog,
  job bar me batch line (idx/total + ok/fail/skip counts),
  card action me AI META prompt copy button
- 1.C Cancel: jobbar CANCEL button -> /api/cancel -> taskkill /T /F
  child kill, current fail-mark, queue agla uthata hai; single job
  cancel bhi (step='cancelled')
- 1.D Metadata Writer: scripts/metadata.py -> out/<Title>.txt sidecar
  (TITLE/DESCRIPTION ar+ur/reference/hashtags/TAGS). Har successful
  render ke baad automatic (doJob me, non-fatal).
  Verified: sleep_enter sidecar UTF-8 Arabic+Urdu OK.
- 1.E Channel Settings: dashboard/config.json {channelName,handle},
  GET/POST /api/config, gear icon modal, make_manifest.py manifest me
  "channel" inject karta hai, DuaVideo.tsx EndCard watermark
  (name - handle, fade-in frame 30-44). types.ts updated.
- Crash-guard: uncaughtException/unhandledRejection -> dashboard/crash.log
## Verification Status
- node --check OK | tsc --noEmit CLEAN | config roundtrip OK
- cancel endpoint no-op safe OK | metadata sidecar real test OK
- PENDING USER TEST: full batch run (RENDER ALL) + endcard watermark
  render check (config set kar ke ek video render karo)
## Next: PHASE 2 (Quality Pack): safe-area padding, CTA rotation,
  last-word hold, Color Grade Layer, Camera Drift, SFX, pronunciation map
---
# PHASE 2 COMPLETE (2026-08-21) â€” Quality Pack (audit ke hisab se)
- 2.1 Safe-area: Arabic/Urdu side padding 80/90 -> 115px, Urdu bottom
  6% -> 9% (Shorts UI overlap fix). Lambi dua fit check OK.
- 2.2 CTA rotation: EndCard ab dua_id hash % 4 se SUBSCRIBE/LIKE/
  SHARE/FOLLOW (alag colors). sleep_enter = SHARE (verified).
- 2.3 Last-word hold: KaraokeText me ended detect -> 0.8s dim-gold
  fade (opacity -30%, brightness -15%).
- 2.4 GradeLayer.tsx NEW: per-theme soft-light/overlay/multiply tint
  wash (8 themes) â€” text crisp rehta hai, sirf mood grade hota hai.
- 2.5 Camera Drift: Background me slow wander translate
  (sin/cos, max ~22px, inset -40 ke andar safe) + Ken Burns zoom.
- 2.6 SFX INFRA (files baad me): make_manifest public/sfx/*.mp3
  check karke manifest.sfx flags deta hai; DuaVideo conditional
  <Audio>: whoosh@phase-change(0.45), riser ramp(endcard se pehle),
  tick@endcard. Files drop karo -> auto activate.
- 2.7 Pronunciation map: prepare_dua.py apply_pronunciation()
  (ï·º expansion, tatweel removal, control-char strip) â€” sirf TTS text,
  stored/display text untouched.
## Verified: tsc CLEAN | test render sleep-enter 486 frames OK (3.1MB)
| mid+end frames pixel-check OK | CTA variant logic verified
- SFX FILES DONE (2026-08-21): Pixabay/Kenney network-blocked thete,
  isliye ffmpeg se ORIGINAL synthesized SFX banaye (copyright 100%
  safe - khud banaye): public/sfx/whoosh.mp3 (0.79s pink-noise+phaser),
  riser.mp3 (1.93s freq sweep), tick.mp3 (0.21s click).
  make_manifest ab sfx flags inject karta hai; sleep-enter render
  WITH sfx verified (3.12MB). Ab har naye render me SFX honge.
- PHASE 3 COMPLETE (2026-08-21):
  3.1 Render Caching: content-hash based (dua JSON+audio mtime/size+
      config+sfx flags -> md5) dashboard/cache.json me. doJob start pe
      hit = render skip (sirf thumb ensure + metadata), force checkbox
      bypass. VERIFIED: 45.5s -> 2.1s cache hit. NOTE: mtime approach
      fail thi kyunki make_manifest har baar rewrite karta hai.
  3.2 Auto-QC: scripts/qc.py (duration>=5s, brightness 8..247, frame
      variance>=2, loudness -30..-8 LUFS; pure ffmpeg rawvideo gray
      frames + loudnorm). doJob: QC fail -> auto retry render 1x ->
      phir bhi fail = job failed. dashboard/qc.json persist, card pe
      QC PASS/FAIL badge. VERIFIED: sleep_enter -16.4 LUFS PASS.
  3.3 Thumbnails: render success ke baad remotion still frame=100 ->
      out/thumbs/<Title>.png; GET /thumb/<file> (no-store); card pe
      poster img (click=play); duaStatus.thumbFile; THUMBS chip +
      POST /api/thumbs-all backfill (13 thumbs ban gaye).
  3.4 History: dashboard/history.json (last 200), recordHistory() in
      processQueue+startJob (PASS/FAIL+error), GET /api/history,
      HISTORY chip + modal. VERIFIED entries.
  3.5 Bismillah toggle: duas.json bismillah:false respect hota hai
      (prepare_dua.py), form checkbox f_bis default ON, add/update
      handlers persist. (Live render test pending - logic simple.)
  Bug fixes during phase: DONE log vid->vidPath; crypto require added.
- PHASE 3 POST-AUDIT FIXES (2026-08-21 evening):
  * BISMILLAH DOUBLE BUG: with_bismillah Urdu guard sirf "shuru Allah"
    dhundta tha; food_start/evening_isum/home_enter ka tarjuma khud
    "Allah ke naam se" se shuru -> audio me double/triple meaning.
    FIX: urdu.startswith("Allah ke naam se") bhi skip karta hai.
    Teeno force re-TTS + re-render, QC PASS. Arabic side pehle se
    idempotent thi (diacritic-strip + startswith check).
  * ZOMBIE LOCK BUG (serious): processQueue ke baad job.running=true
    reh jata tha (sirf startJob ka finally false karta hai) -> batch
    ke baad saare renders 'Job already running' reject. FIX: loop ke
    baad job.running=false + job.child=null. VERIFIED post-batch.
  * QC THRESHOLD: light themes (brightness~207) subtle animation pe
    variance 1.6 < 2.0 threshold -> false FAIL (bathroom_exit).
    FIX: 8 sample frames + variance >= 1.0. VERIFIED PASS.
  * STALE PLAYER FIX: serveVideo ab Cache-Control: no-store bhejta
    hai (206+200 dono) + player src ?ts=Date.now() cache-buster.
  * RENDER ALL BATCH TEST: 31 items -> 27 ok + 4 fail (3 policy
    blocks expected: sayyid_istighfar/bohat_khoobsurat_dua/d_10_15;
    bathroom_exit QC false-positive jo fix ho gaya). 29 mp4 total.
    NOTE: status API done=number hota hai (length), PS .Count=1
    dikhata tha - display artifact, bug nahi.
- PHASE 4.1 COMPLETE: 3 NEW TEMPLATES (2026-08-21):
  * ramadan "Ramadan Lanterns": purple-indigo night + swaying fanous
    lanterns (6, mulberry seed 99) + crescent moon; decor='lanterns'
  * eid "Eid Gold Green": emerald bg + gold bunting/diamond flags SVG
    + twinkling corner glows; decor='festive'
  * qadr "Laylatul Qadr": near-black blue + 130 dense stars +
    descending divine light beam (clip-path cone); decor='qadr'
  Files: themes.ts (3 themes + decor union), Background.tsx
  (Lanterns/FestiveOrnament/QadrSky), GradeLayer.tsx (3 grades),
  make_manifest.py valid tuple, server.js add+update validation lists
  + themegrid picker, previews via StylePreview still --props=file
  (PS mangles inline JSON - file-based props use karo).
  BUG FOUND: update-dua handler ki template list purani thi (naye
  reject silently) - fixed. Pixel-verified: ramadan RGB(33,20,50),
  eid (14,43,23), qadr (8,13,31). Sab QC PASS.
- MANUSCRIPT CONTRAST FIX (2026-08-21): user complaint - light paper
  bg pe contrast kharab. Changes: futureColor opacity 0.26->0.52
  (unread words ab visible), pastColor 0.85->0.95 deeper, arabic/
  urdu colors darker (#2a1c08/#3d2c14), pill light-gold -> deep
  gold-brown (#6e4c14->#96682a) taake cream active text pop kare.
  Preview regen + bathroom_exit re-render QC PASS.
- JOBBAR HEADER FIX (2026-08-21): job progress bar ab header ke ANDAR
  inline pill hai (same height as top bar) - step | dua | batch count |
  mini track | pct | CANCEL | X. Logbox removed (display:none, JS
  guarded), jbatch inline text. Bar sirf header me chalta hai.

---

# PHASE 4 STARTED (2026-08-21) â€” Content Expansion
## STATUS: PAUSED (user decision) â€” 75 duas total, 43 naye pending TTS/render
Resume points: Multi-language lines, Auto-fit text (@remotion/layout-utils),
long-format mode decision (Kaferoon/Maun/Ayat-ul-Kursi ke liye)
## System Audit (Phase 4 se pehle)
- 11 orphan files clean (deleted duas ke manifests/audio/video/thumbs)
- 21 orphan temp files clean; bacha 160 temp = active 32 duas ka exact set
- TSC CLEAN, server OK, QC 32/32 PASS
## Batch 1: 31 NEW Duas ADDED (32 -> 63 total)
- Source: data/import_pack_v1.json (main-drafted, user-approved flow)
- Sab <24 AR words (render policy safe), authentic references:
  Bukhari/Muslim/Tirmidhi/Abu Dawud/Ibn Majah/Muwatta/Quran
- Categories: prayer 5, food 3, travel 3, general 19, bathroom 1
- ghar_se_nikalne_ki_dua + talbiyah_hajj_umrah pe bismillah:false
- Bulk add node script se kiya (PowerShell Arabic corrupt karta hai)
- Dropped (policy risk): Durood Ibrahim, Qunoot, Istikhara (>24 words)
## BUG FIX: duaStatus() me bismillah field missing tha
- API response se field drop ho rahi thi -> Edit+Save pe false->true flip
- FIX: duaStatus return me bismillah: d.bismillah !== false added
- VERIFIED: API bis-false count = 2, Arabic/Urdu UTF-8 intact
## Pending (TTS/Render/QC user ke signal pe)
- 31 nayi duas ka TTS + render + QC jab user bole
- Batch 2: Quran series (Ayat-ul-Kursi, surah chunks)

## Batch 2: QURAN SERIES â€” 8 Surahs ADDED (63 -> 71 total)
- data/import_pack_v2.json: Ikhlas, Falaq, Naas, Kausar, Asr, Feel,
  Quraysh, Takbeer-e-Tashreeq (sab <=23 AR words, policy safe)
- EXCLUDED (policy risk, Quran text trim nahi ho sakta):
  Kaferoon (27w), Maun (25w) â€” long-format mode decision ke baad
- Ayat-ul-Kursi (~50w) bhi long-format mode ke baghair possible nahi

## Batch 3: SEASONAL PACKS â€” 4 Duas ADDED (71 -> 75 total)
- Qadr Ki Raat (Tirmidhi 3513, template=qadr), Kisi Aur Ke Yahan
  Iftar (Abu Dawud 3854), Main Roza Daar Hoon (Bukhari 1904),
  Arafa Ke Din (Tirmidhi 3585)
- Takbeer-e-Tashreeq Batch 2 me already add ho chuki thi

---

# PHASE 5 IN PROGRESS (2026-08-21) â€” Premium Visuals
## Audit pehle kiya (packages/folders/components verify)
## DONE (code + tsc CLEAN, RENDER VERIFICATION PENDING):
- 5.1 CLOCK-WIPE AR->UR: @remotion/transitions@4.0.370 installed;
  Urdu phase ab conic-gradient mask clock-wipe se reveal hota hai
  (Easing.out cubic, 23-frame window) â€” audio karaoke sync untouched,
  sirf visual mask layer. DuaVideo.tsx.
- 5.2 ORGANIC NOISE: @remotion/noise@4.0.370 installed; particles +
  camera drift dono ab Perlin noise2D wander use karte hain
  (sine-fake hata). Background.tsx.
- 5.3 LOTTIE: @remotion/lottie@4.0.370 + lottie-web@5.12.2 installed
  (peer dep ^5 â€” v11 conflict tha). Original placeholder ornament
  banaya: public/lottie/star-ornament.json (8-point gold star,
  rotate+pulse, 90 frames, copyright-safe khud banaya).
  DuaVideo title ke upar render hota hai (delayRender pattern,
  file missing = graceful skip). LottieFiles.com blocked (403) â€”
  real ornaments user khud download karke public/lottie/ me daale.
- 5.4 AI BACKGROUNDS SUPPORT: public/backgrounds/<theme>.jpg drop
  karo -> auto-activate (HEAD probe + delayRender, missing = fallback
  gradient). Image gradient ke UPAR, glow overlay uske upar (text
  contrast safe), Ken Burns zoom inherit. Background.tsx.
## PENDING:
- 5.5 Tajweed coloring â€” per-letter rules (KaraokeText deep change),
  render-test ke baghair risky, jab renders allow hon
- SAB ka VISUAL VERIFICATION: ek test render (sleep-enter) jab user
  allow kare â€” clock-wipe/lottie/noise/backgrounds sab ek sath check
- Version pin note: naye packages bhi 4.0.370 exact âœ“

## BATCH 1 - RENDERING QUALITY + GOLD SPECULAR + CASCADE (2026-08-22):
- 1.1 QUALITY PIPELINE: remotion.config.ts Config.setJpegQuality(100) +
  setCrf(15); server.js npxRender flags --crf=15 --jpeg-quality=100.
  Measured video bitrate 4530 -> 7635 kb/s (+58% quality headroom),
  banding-free aurora/grain intermediates.
- 1.2 BT.709 TAGGING: server.js tagBt709() = stream-copy remux via
  h264_metadata bitstream filter (colour/transfer/matrix=1). NOTE: plain
  -color_primaries/-colorspace flags -c copy pe IGNORE hote hain - sirf
  bsf VUI write karta hai (verified). Hooked after primary + retry render,
  non-fatal on failure. ffprobe: color_space/transfer/primaries = bt709 x3.
- 1.3 METALLIC GOLD (Background.tsx): goldGrad() 6-stop gradient
  (#6e5212 shadow / #d4af37 base / #fff3c4 specular / #ffe08a / #d4af37 /
  #8a6a1f deep) + backgroundSize 300% + posX slide = parametric 3.5s
  specular sweep ((frame/(fps*3.5))%1). Applied: corner bracket lines +
  diamonds (per-corner phase offsets), double hairline frame rings
  (mask-knockout: maskClip content-box,border-box + composite exclude/xor).
  DuaVideo StarOrnament: SVG linearGradient #orn-gold + animated
  gradientTransform translate sweep on crescent fill + star stroke;
  center dot #fffbe8. Paper/light theme corners stay flat brown (no FX).
- 1.4 CORNER CASCADE: simultaneous grow-in hata; delays TL=0/TR=120ms/
  BR=240ms/BL=360ms (array order [TL,TR,BL,BR] -> [0,120,360,240]);
  spring(damping12,stiffness150) lock-in + decaying micro-wobble
  (sin*2.2deg*exp(-t/0.7s)) + per-corner fade-in.
- QA NUMERIC (qa_batch1/qa_ring scripts): cascade visible order
  TL f10 -> TR f12 -> BR f16 -> BL f18 @24fps PASS (design startF
  6/8.9/11.8/14.6 + spring ramp). Bracket sweep deltas TL_h 19.6 /
  TR_v 33.5 luma, argmax samples 28 vs 8 (=120f apart) PASS.
  Frame-ring glint cycle delta -2.5..+22.5 luma, interior clean
  (29 = no solid fill) PASS.
- Test artifact: out/BATCH1_TEST_gold_cascade.mp4 (azan compo, 192f).
- Pre-change backup: backups/backup_20260822_batch1_pre.zip (90 KB)

=======================================================================
BATCH 2 - 2.5D MULTI-PLANE PARALLAX + ORGANIC PARTICLE DEPTH (2026-08-22)
=======================================================================
- 2.1 DEPTH PLANES (Background.tsx): camera rig carries MID at native
  1.0x drift. Relative offsets inside rig: FAR wrapper translate
  (-0.65x) => net 0.35x; FOREGROUND wrapper translate (+0.65x, inset
  -24) => net 1.65x. Border overlays (frame rings + CornerOrnaments)
  moved into dedicated sibling wrapper translate(+1.65x) outside rig
  (no zoom coupling). Assignments: FAR = StarField + MosqueSilhouette +
  WaveBands + Dunes; MID = moon/SunDisc/PatternLattice/WaveCrescent/
  Royal/Festive/QadrSky/aurora/rays/orbs/ShootingStars/MoonHalo;
  FOREGROUND = Lanterns + new ForegroundHaze (2 soft accent radial
  glows, screen blend, opacity .05-.07 breathe) + RisingMotes.
  Component splits: Stars -> StarField(far)+Stars(moon-only,mid);
  Waves -> WaveBands(far)+WaveCrescent(mid).
- 2.2 PARTICLE SYSTEM 3-DEPTH: PARTICLE_LAYERS spec array replaces
  far/near pair: fg 15% count seed301 size5-8px blur1.5-3px speed46-86
  alpha.45-.8 parallax1.65 | mg 50% seed77 size2.5-4.5 sharp speed18-48
  alpha.35-.75 parallax1.0 | bg 35% seed42 size1-2px speed6-16
  alpha.15-.35 parallax0.35. Rig-relative offset = (parallax-1).
  Desync turbulence: noise2D(atmo-<key>, frame*0.015, i*7.31)*sway*.45
  added to wander. Counts split round(15%)/round(35%)/rest-mg.
- BACKWARD COMPAT: CLASSIC preset untouched (stylePresets.ts zero
  changes); all themes flow through same plane architecture.
- QA NUMERIC: tsc clean x3 (edits/probe/revert). Azan render border
  float ptp 2.96px(static pre) -> 21.89px @1.65x PASS. Bokeh census
  azan pair medArea 219->255 (+16%) fat/orb blobs identical -> fg layer
  visible. Dark-theme (suraj_nikalne_ki_dua): moon dx std 5.60px (MID
  anchor), mosque dx std 2.94px < moon (FAR slower). SIGN-FLIP PROBE:
  far multiplier -0.65->-2.65 flipped slope(mosque~moon) +0.212 ->
  -1.628 ~= theoretical -1.65 => causal end-to-end proof of FAR wiring.
  Probe video deleted after test.
- OBSERVATION (pre-existing, not touched): theme 'mosque' decor value
  has no rendering branch in Background switch (mosque-template videos
  show no silhouette; bg image fallback covers visuals). Flagged for
  future batch decision.
- Test artifacts: out/BATCH2_TEST_parallax.mp4 (azan 192f),
  out/BATCH2_TEST_dark.mp4 (suraj dark theme 192f).
- Pre-change backup: backups/backup_20260822_batch2_pre.zip (113 KB)

## BATCH 3 (2026-08-22): Cinematic Typography Illumination + Choreographed
## Phase Transitions + Paper Preset Individualization

- 3.1 MULTI-PASS TEXT SHADOWS: KaraokeText.tsx new optional accentGlow prop
  (default rgba(212,175,55,0.45)); container filter = Pass1 dark ambient
  drop-shadow(0px 4px 12px rgba(0,0,0,0.85)) + Pass2 theme-adaptive soft edge
  bleed drop-shadow(0px 0px 8px accentGlow), composed with holdT brightness.
  Future-word textShadow += accent halo pass. DuaVideo passes accentGlow to
  both arabic+urdu KaraokeText AND wraps both phase containers with same
  two-pass chain after blur(). Paper theme uses ink tone
  rgba(110,80,30,0.30) instead of gold. Title kicker dark branch upgraded to
  spec values (0.85 ambient + tight accent bleed); EndCard title += accent33
  glow pass. Paper branch untouched.
- 3.2 CHOREOGRAPHED TRANSITIONS: Background.tsx new optional punchFrames
  prop; per-boundary envelope p=(frame-(pf-9))/18 in (0,1) ->
  punchAmt+=sin(pi*p); rig transform scale(zoom*(1+0.035*punchAmt)) =
  smooth 18-frame bell 1.0 -> 1.035 -> 1.0. Radial exposure bloom overlay
  circle 45%w at 50% 16% rgba(255,244,214,0.32*punchAmt) screen blend,
  gated !isPaper, placed over glow ellipse under FAR plane. DuaVideo passes
  phasePunchFrames=[INTRO_FRAMES(66 bismillah->content), urduStartFrame
  (arabic->urdu wipe)]. Existing text-layer zoomPunch resynced from keyframe
  [us-6,us+2,us+16]->1.04 asymmetric to SAME 18-frame symmetric bell at 0.02
  share (camera carries main punch now; combined peak ~5.6% directed feel).
  phaseBlur kept as-is.
- 3.3 PAPER PRESET INDIVIDUALIZATION: stylePresets.ts new exported type
  PaperTreatment 'none'|'royal'|'cinematic'|'minimal'; ResolvedStyle +=
  paperTreatment field. CLASSIC/masterpiece='none' (zero visual change),
  royal/cinematic/minimal set own treatment. Background.tsx paper section:
  ROYAL -> new PaperFiligree comp (outer 2px gold @inset28 shimmering
  sin(f/95) 0.85-1.0 + inner 1px accent66 @inset40 + 4 rotated gold-gradient
  corner diamonds w/ glow + ink contrast vignette rgba(62,42,12,.13));
  CINEMATIC -> new ParchmentAging comp (4 warm corner blotch radial
  gradients breathing sin(f/170) + left/bottom directional ink-bleed
  gradients); MINIMAL -> base border becomes hairline 1px @0.38 inset36 r4,
  grain opacity x0.55; base border block shared by none+minimal variants.
  Royal vignette opacity x1.18 (richer ink depth). Non-paper themes
  untouched.
- QA NUMERIC (bundled ffmpeg image2pipe PNG -> node zlib decode):
  A) bloom residual peak @frame66 = +29.68 luma vs old-video noise floor
     +4.28 => camera bloom pulse present exactly at boundary PASS.
  B) arabic band (f70-90) mean|new-old| 1.03 luma/px, full-frame 3.54 =>
     multi-pass shadows/glow alter pixels; band stdev 15.4 unchanged
     (contrast preserved) PASS. NOTE: first run used f20-44 window which is
     still IntroCard (content starts f66) -> false FAIL; window fixed.
  C) paper treatments distinct: cinematic corners -15.6 luma (aging);
     minimal left band +3.8 brighter + center grain muted (+0.9) =
     fainter hairline; royal edge-vs-center ink contrast 13.28 -> 19.18
     (+44%) = rich ink boost. Border profile check: classic single line
     minimum x34(d48), royal double line x29(d57 outer)+x39(d20 inner)
     ~10px apart => filigree verified. First royal render was identical to
     classic: root cause paperTreatment:'royal' missing from royal preset
     overrides; added, re-rendered, verified.
- BACKWARD COMPAT: CLASSIC preset paperTreatment 'none' renders identical
  base border path; punchFrames/accentGlow optional props default-off for
  any external callers.
- Test artifacts: out/BATCH3_TEST_dark.mp4 (suraj 100f),
  out/BATCH3_TEST_paper_{classic,royal,cinematic,minimal}.mp4 (yunus 90f x4).
- Pre-change backup: backups/backup_20260822_batch3_pre.zip (115 KB)

## BATCH 4 (2026-08-22): Final Polish - Platform Compatibility + P1/P2 Remediation

- 4.1 SAFE-ZONE PROGRESS BAR (DuaVideo.tsx): bar lifted off the absolute
  bottom edge into the platform-safe band: bottom 0->18px, side insets
  0->28px, height 6->4px, borderRadius 999 pill, track alpha .08->.14
  (thinner bar needs slightly stronger track), overflow hidden. Clears
  Shorts/Reels/TikTok caption/sound/gesture UI zones.
- 4.2 DYNAMIC METEOR SCHEDULE (Background.tsx ShootingStars): hardcoded
  starts {110,335,565} replaced by duration-scaled schedule from
  useVideoConfig().durationInFrames: even anchors (i+.5)/3 across timeline
  +-5% mulberry32(20260) jitter, frac clamp [.04,.86], start clamp
  [24, D-len-12]. x0/y0/len unchanged (.72/.10/.18/.06/.55/.16,
  lens 34/38/36). Verified spread: D=360f(15s)->starts 59/177/301,
  D=576f(qadr)->95/284/481, D=1080f(45s)->178/532/902. First attempt with
  pure-random fracs clustered all 3 meteors into one window (244-313) ->
  redesigned to anchored+jitter. useMemo keyed on durationInFrames.
- 4.3 THEME-ADAPTIVE SWEEP TINTS: new exported accentTint(accent,alpha)
  helper in themes.ts (accent mixed 45% toward white -> soft tint rgba).
  Replaced hardcoded warm-white rgba(255,240,190,x) in DuaVideo phase
  sweep + ambient sweep AND Background batch-3 radial bloom pulse. Cool
  accents (#c3d2f5 qadr, #6fd0f5 ocean) now tint cool; warm gold themes
  stay warm. Metallic goldGrad ornament sweep intentionally untouched
  (ornament palette, not text light). KaraokeText itself has no internal
  sweep (verified via grep).
- 4.4 SHARED MOON ANCHOR: new exported const MOON_ANCHOR {rightPct '12%',
  topPct '9%', diameter 110} in Background.tsx; Stars moon div + MoonHalo
  rings both consume it. FIXED pre-existing drift: MoonHalo ring centering
  margins were computed against hardcoded base size 96 while actual moon
  is 110px -> rings now centered exactly ((size-diameter)/2).
- 4.5 GRAIN FLICKER LOOP (Task 3): static film-grain SVG overlays (dark +
  paper) upgraded with GRAIN_FLICKER = ['0px 0px','-59px 1px','-123px 0px']
  cycling via backgroundPosition = GRAIN_FLICKER[frame % 3]. Same texture,
  zero added elements/render cost; dx offsets are non-divisor shifts of the
  160px tile so each of the 3 states samples a different noise phase.
- QA NUMERIC (bundled ffmpeg image2pipe PNG -> node zlib decoder, RGB+
  gray support):
  A) grain flutter mean|d(frame)| flat patch f40-58: paper 0.003(static
     old) -> 0.406 (+135x); dark 0.242 -> 0.375 over moving-content
     baseline => organic film-stock flutter present PASS.
  B) bar row profile @f50: OLD brightest y=1916 (bottom edge, luma 2.0),
     NEW y=1898 luma=20, bottom rows clean 000 => safe-zone lift PASS.
  C) qadr cool sweep lift pre(abs225)->peak(abs241): dR +6.8 dG +6.3
     dB +10.0 => blue lifts above red, no warm clash PASS.
  D) meteor#2 streak (left half, abs win 286-320 vs baseline 262-278):
     p99 92.8 -> 197.0 spike => dynamic-schedule meteor rendered PASS.
- BACKWARD COMPAT: CLASSIC preset object untouched; accentTint/MOON_ANCHOR/
  punchFrames/accentGlow additive exports; ShootingStars only active for
  masterpiece renders (CLASSIC unaffected); progress-bar restyle is global
  polish per task spec.
- Test artifacts: out/BATCH4_TEST_dark.mp4 (suraj 100f),
  out/BATCH4_TEST_paper.mp4 (yunus classic 90f),
  out/BATCH4_TEST_qadr.mp4 (qadr masterpiece 121f, frames 220-340).
- Pre-change backup: backups/backup_20260822_batch4_pre.zip (72 KB)

================================================================
PILLAR 1 - LIBRARY EXPANSION & CONTENT AUTOMATION (76 -> 150+)
Date: 2026-08-22 | Backup: backups/backup_20260822_pillar1_pre.zip
================================================================
TASK 1 - SCHEMA + TAXONOMY:
- src/types.ts: DuaManifest += optional transliteration,
  reference_source, reference_no (additive; legacy manifests valid).
- core/dua_database.py: OPTIONAL_SCHEMA_FIELDS, TAXONOMY_V2 (10 cats),
  LEGACY_CATEGORIES, get_optional_field_coverage().
- data/duas.json: 38 'general' remapped onto taxonomy v2 via
  GENERAL_REMAP; 2 pack entries merged (surah_kaferoon prayer,
  surah_maun guidance) => 78 duas. Legacy diff audit: 38 entries
  byte-identical, 38 category-field-only change, 0 deletions.
- data/categories.json: rebuilt = 18 cats (10 new meta + 8 legacy),
  counts recomputed from DB; general now 0.
- Theme aliases added in make_manifest.CATEGORY_THEME +
  dashboard/theme-map.js: protection dark | rizq emerald |
  forgiveness manuscript | morning_evening sunset | guidance
  manuscript | health ocean | anxiety_relief ocean | gratitude eid |
  family royal | occasions ramadan. Differential test vs old map on
  all 78: legacy-category diffs = 0 (python + js).
- dashboard/server.js: f_cat select, AI prompt whitelist,
  LanguageModel system prompt, extract-validation array extended.
TASK 2 - IMPORT GATE (scripts/import_pack_loader.py):
- Validates: unique slug ids, taxonomy membership, urdu <=75 words
  hard / >60 warn, harakat check (long arabic w/o diacritics =
  reject), dedup by id + normalized arabic vs DB and in-batch.
- Packs v1/v2/v3 (45 rows): 43 dedup-rejected (historical staging of
  existing content), 2 merged. Dry-run default; --apply writes with
  auto-backup + categories recount. Exit 2 when rejects present.
TASK 3 - BULK BUILD + QC LINT:
- scripts/bulk_build.py: --filter missing-manifest|category=X|all,
  --limit N, dry-run default, --apply executes prepare_dua.py ->
  make_manifest.py sequentially with 250-750ms pace jitter;
  429/422/rate-limit backoff 30-60s x3 attempts; VIDEO-002 exit-3
  policy rejects NOT retried. Plan verified: 36 missing-manifest.
- remotion/scripts/qc.py: --lint <id> | --lint-all pre-render gate
  (urdu length lint, harakat warning, duplicate-arabic detector:
  same-category dup = fail, cross-category reuse = warn). Found real
  reuse pair evening_audhu <-> nazar_e_bad_se_hifazat (flagged as
  acceptable cross-category reuse). Video-QC contract untouched.
CHECKS: py_compile OK (loader/bulk_build/qc/make_manifest/
prepare_dua/dua_database); node --check server.js + theme-map.js OK;
tsc --noEmit OK; qc.py --lint-all pass=true scanned=78 failed=0.
NOTE: 6 v2-category entries without explicit template now resolve to
themed aliases on FUTURE rebuilds (existing 42 manifests unchanged).

================================================================
PILLAR 2 - AUDIO & TTS PIPELINE MASTERCLASS (-14 LUFS + VOICE FIX)
Date: 2026-08-22 | Backup: backups/backup_20260822_pillar2_pre.zip
================================================================
TASK 1 - VOICE WIRING BUG FIX (CRITICAL):
- core/tts_engine.py: generate_audio() += voice=None override param;
  fallback VOICES[language] preserved (100% backward compatible).
- remotion/scripts/prepare_dua.py: now passes dua['voice_arabic'] /
  dua['voice_urdu'] into TTS calls. Dead schema fields are LIVE.
- Re-generated 8 female-voiced duas with Zariyah/Uzma: bathroom_exit,
  ayyub_as_ki_bimarion..., karz_aur_pareshani...,
  jahannam_se_azadi..., masjid_me_dakhil_hote_waqt,
  azan_ke_baad_ki_dua, talbiyah_hajj_umrah, suraj_nikalne_ki_dua.
  Proof: fresh MP3 hashes differ from pre-backup (re-synthesized).
- FINDING: subah_o_shaam_ki_hifazat_ki_jami_dua speech = 47s > 40s cap
  EVEN on male voices -> shipped manifest (totalDuration 47.05) was
  built BEFORE current VIDEO-002 policy. Legacy file kept intact;
  DB voices reverted Hamed/Asad; temp artifacts restored from backup.
  CONTENT-DEBT: needs text split (Pillar 3). Regen permanently blocked.
TASK 2 - BROADCAST LOUDNESS RETARGET:
- core/audio_mixer.py: LOUDNESS_TARGET -16->-14 LUFS,
  TRUE_PEAK_TARGET -1.5->-1.0 dBTP.
- make_manifest.py MASTER_FILTER: dynamic single-pass loudnorm REMOVED.
  master_audio() refactored 3-stage: tonal chain (highpass/bass/EQ/
  acompressor/aecho) -> AudioMixer two-pass LINEAR loudnorm ->
  transparent 192k mp3 encode. No gain-pumping; compressor transparent.
- Measured results (all 8 new masters): I = -14.26..-14.27 LUFS,
  TP = -2.01..-3.50 dBTP => platform-anchor accurate, zero clipping.
TASK 3 - KARAOKE TIMING PRECISION:
- make_manifest.py read_words(): PRIMING_COMPENSATION_S=0.044 applied
  to every WordBoundary start/end (clamped >=0); sections inherit.
  Verified: first-word start == raw_offset - 0.044 exactly.
- KaraokeText.tsx: active-word state moved to FRAME domain
  (floor/ceil snapped boundaries) -> no sub-frame highlight flicker.
TASK 4 - QC GATE:
- qc.py get_loudness() returns {i,tp}; video gate tightened to
  |I-(-14)|<=1.0 LUFS AND TP<=-1.0 dBTP. JSON contract keys unchanged
  (+loudness_tp added).
CHECKS: py_compile OK (tts_engine/audio_mixer/make_manifest/
prepare_dua/qc); tsc --noEmit OK; 8/8 gates PASS (LUFS+TP+priming).
NOTE: 33 non-regen masters remain -16 LUFS until natural rebuild;
new builds target -14 automatically.





































## 10 NEW DUAS + 10 CGI STYLE SHOWCASE (2026-08-24)

**Goal:** Har naya CGI preset ke liye ek nayi authentic dua render.

**Naye server feature (server.js ensureLookSpec):** Style dropdown me explicit
preset select ho (classic/auto ke siwa) to random look ka preset bhi FORCE ho
jata hai - FX layers phir bhi random. Portal se poore channel pe ek style
lagane ka rasta.

**Nayi duayein (duas.json, 77->87):** ilm_zidni, rizq_kifaya, shifa_mariz,
maghfirat_tawba, aafiyat_dunya_akhirat, hasbi_allah_wakil, ham_gham_panaah,
walidain_raham, dunya_akhirat_hasanah, nur_qalb_qabr. Sab chhoti/authentic
(Roman title + Urdu script + explanation + reference). Voice fields omit =
pick_voice auto. Backup: data/duas.json.bak_newduas

**Renders (sab QC PASS, ~-14.3 LUFS):**
| Dua | Preset | Bonus FX |
|---|---|---|
| ilm_zidni | volumetric | smoke |
| rizq_kifaya | raytrace | fog+rosette |
| shifa_mariz | waterripple | birds+smoke+vines |
| maghfirat_tawba | embernight | birds+storm+sitare |
| aafiyat_dunya_akhirat | silkmarble | rain+vines (re-render) |
| hasbi_allah_wakil | desertmirage | wind+smoke |
| ham_gham_panaah | cinemafocus | fog+lanterns |
| walidain_raham | qadrtilt | clouds+sitare |
| dunya_akhirat_hasanah | glitterroyal | birds+smoke+lanterns |
| nur_qalb_qabr | auroranova | birds+smoke+sitare |

**INCIDENT + FIX (aafiyat collision):** Nayi "Aafiyat Ki Dua" ne purani
morning_afiyah ki same-title video overwrite kar di (outName clash). Fix:
(1) nayi dua ka title -> "Aafiyat Dunya O Akhirat Ki Dua", (2) purani video
backup se restore, (3) nayi dobara render. Ab 86 mp4 = 76 purane + 10 naye.
LESSON: nayi dua add karte waqt title uniqueness check karo (duas.json me
duplicate-title scan).

**BUG FIX:** python script se duas.json me BOM aa gaya tha -> node JSON.parse
crash (/api/duas). Fix: BOM-less write + server.js me .replace(/^\uFEFF/)
guard. Purane backups bhi utf-8-sig padhte hain isliye safe.

## MASTER LOOK v2 + CRITICAL PROPS BUG FIX (2026-08-24)

**USER FEEDBACK:** "VFX videos mein dikh kyun nahi rahe? Borders abhi b
purane hain. Colors/canvas bhi look ke hisab se hon." - TUM SAHI THE!

**CRITICAL BUG FIX (props shape mismatch):** Server look file FLAT likhta tha
({preset, skyFx...}) aur Remotion DuaVideo NESTED lookSpec parhta tha => FX
layers har full render me SILENTLY IGNORE ho rahi thin! Sirf presets lagte
the (stylePreset override ya hash se). Pixel-proof: flat vs wrapped delta
25406 (poora canvas alag). FIX: (1) server ab {lookSpec:{...}} wrapped
likhta hai, purane flat files auto-migrate, (2) DuaVideo dono shapes
accept karta hai (rest-props normalization). Stills A/B se verify.

**MASTER RANDOM v2 - ek look = poora package:**
- frame: arch(mehrab) | deco(art-deco lines+diamonds) | rosette(gulab
  medallions) | classic(purana) - seed se pick, corners A/B verified
  (strong=76-100 px, center=0 control)
- tint: PRESET_TINTS[preset] canvas color harmony veil (LookTint, 15 mood
  palettes, Background ke upar content se neeche breathe animation)
- naya file: src/FrameStyles.tsx (FrameDecor + LookTint + hexA)
- fx-guardrails.js: FRAME_VARIANTS + PRESET_TINTS exports
- look-spec.js: frame pick(['arch','deco','rosette','rosette','classic']),
  tint auto preset se

**2 chhote fixes:** explicit-preset override pe tint bhi naye preset ka;
explicit mode thumb ab look merge karke banata hai (fx/frame/tint included).

**10 nayi duayein MASTER LOOKS ke saath re-render (sab DONE):**
ilm_zidni=desertmirage/petals/vines/deco | rizq_kifaya=cinematic/birds/
rosette-art/classic | shifa_mariz=auroranova/birds/arch | maghfirat=
desertmirage/birds+snow+rosette-art/arch | aafiyat=royal/birds+smoke/
rosette | hasbi=waterripple/clouds+smoke/deco | ham_gham=cinematic/
clouds+snow+rosette-art/classic | walidain=cinemafocus/rain+lanterns/
deco | dunya=classic/fireflies+sitare-art/rosette | nur=qadrtilt/birds+
petals+sitare/rosette. MP4 count: 86.

**LESSONS:** (1) PS5.1 Set-Content UTF8 BOM deta hai -> Remotion --props JSON
parse fail; python se BOM-less likho. (2) E2E verification me sirf logs pe
bharosa mat karo - pixel A/B karo (is bug ne 2 din chupa rehne diya).
