# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A JUCE 9 audio plugin (VST3, AU, AAX, CLAP, LV2, Standalone) that runs a chain of
Neural Amp Modeler (NAM) captures and impulse responses loaded from TONE3000. The
DSP and plugin wrapper are C++20 under `plugin/`; the UI is a React/TypeScript app
under `ui/` that is compiled by Vite into `plugin/webview/` and embedded into the
binary as JUCE binary data, then rendered in a native WebView. `README.md` and
`ui/README.md` are accurate and detailed; `plugin/docs/*.md` hold the design
rationale for oversampling, multi-core, stereo image, and local-model loading.
Read the relevant doc before changing those subsystems.

## Build and run

Order matters on a fresh clone: CMake configure fetches JUCE into `libs/` via CPM,
and `ui/package.json` has a `file:` dependency on that JUCE tree, so configure
must run before `npm install`.

```sh
git submodule update --init --recursive          # NeuralAmpModelerCore, AudioDSPTools
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release   # Linux: add -DCMAKE_TOOLCHAIN_FILE=cmake/linux-toolchain.cmake
cd ui && npm install && npm run build && cd ..   # tsc -b + vite build -> plugin/webview/
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release   # re-run so CMake picks up plugin/webview/
cmake --build build
```

`CMakePresets.json` offers `default` (Ninja, Debug, `build/`), `release`, `vs`,
and `Xcode` presets. Artefacts land in `build/plugin/TONE3000_artefacts/<config>/<format>/`.
`./script/install-plugin.sh VST3|AU|AAX [Debug]` copies into the user plugin
folder on macOS/Linux. Format toggles: `-DHEADLESS=ON`, `-DBUILD_AAX=OFF`,
`-DBUILD_LV2=OFF`, `-DBUILD_CLAP=OFF`.

The UI needs `VITE_T3K_PUBLISHABLE_KEY` in `ui/.env` for the TONE3000 OAuth flow
to work; see `ui/src/t3k/config.ts` for the other `VITE_T3K_*` switches.

## Tests and checks

```sh
./script/test-dsp.sh                        # configure (if needed) + build DspTests + run all
./script/test-dsp.sh 'IrConvolutionTest.*'  # gtest filter for a single test or suite
cmake --build build --target DspTests       # build only; binary is under build/test/DspTests_artefacts
ctest --test-dir build                      # gtest_discover_tests registers every case with ctest

cd ui
npm run lint          # eslint src
npm run format        # prettier --write; format:check for CI-style check
npm run build         # doubles as the typecheck (tsc -b)
npm run dev           # Vite at http://localhost:5173; layout/browsing only, no native bridge
```

`./script/validate-plugin.sh [FORMAT] [Debug]` runs pluginval (strictness 10),
clap-validator, and lv2lint against built artefacts. CI (`.github/workflows/build.yml`)
is `workflow_dispatch` only and does not run on PRs, so the PR template expects
the DSP tests, `npm run lint && npm run build`, and validators to be run locally.

The GoogleTest target compiles the processor sources straight from `plugin/src/`
with `HEADLESS=1` (no editor or webview), links NAM whole-archive, and points
`T3K_TEST_FILES_DIR` at the real `.nam` and `.wav` assets in `test/files`.
`test/src/dsp_tests.cpp` owns `main()`. Shared rigs live in `test/src/test_helpers.h`
(signal generators, Goertzel measurement) and `test/src/chain_test_helpers.h`
(`ChainTestProcessor`, which restores a bare chain tree through the real
`T3KB` state format, plus block-tree builders with embedded model bytes so no
test touches the network). Behavior changes to DSP or chain logic are expected
to update the pinning test in the same commit.

## Architecture

### Two processes of thought: native is the source of truth

Think of the plugin as a native state machine with a React view attached to it.
`TONE3000Processor` (`plugin/include/Processor.h`, one class spread across
`Processor.cpp`, `ProcessorChain.cpp`, `ProcessorState.cpp`, `ProcessorHistory.cpp`,
`ProcessorPresets.cpp`, `ProcessorModelLoader.cpp`) owns every persistent value:
APVTS parameters, the two chain lanes, undo history, presets, the model cache.
React holds only UI-local state and re-derives everything else from native.

The bridge has three primitives, all wrapped by `ui/src/backend/JuceBackend.ts`
behind the `IAudioBackend` interface so components never touch `window.__JUCE__`:

- **Parameters**: faceplate knobs bind to APVTS parameters through
  `juce::WebSliderRelay` and friends declared in `Editor.h`, consumed by
  `useParameter`.
- **Native functions**: request/response calls registered with
  `.withNativeFunction(...)` in `plugin/src/EditorWebViewSetup.cpp`, consumed via
  `useNativeFunction`. Adding a UI capability usually means a processor method,
  a registration there, and a hook.
- **Events**: pushed from C++ (`chainChanged`, meters, tuner frames,
  `audioDeviceChanged`).

Chain sync is revision-based. Every chain mutation bumps a revision; the editor's
timer watches the atomic and emits `chainChanged`; `useChainState` (the single JS
owner of chain state) calls `getChainState(knownRevision)`, which returns
`{ unchanged: true }` when nothing moved. Continuous gestures (knob drags) defer
their bump until the gesture settles, so drag-rate calls never trigger a full
resync. A slow fallback poll exists only as a safety net.

### Signal path

`processBlock` runs: input mode, input gain, noise gate, then a stereo Lanczos
boundary to 48 kHz (`ChainDomain.h`, bypassed when the host is already at 48 kHz),
an optional minimum-phase power-of-two oversampler (`ChainOversampler.h`), the two
chain lanes, back down, then Spread (mono) or Align (stereo), balance/pan, DC
blocker, tone stack, output gain. Each `ChainBlock` (`ChainBlock.h`) is a NAM or
IR engine with in/out gain, dry/wet mix, and a 6-band EQ in PRE or POST position.
Invariants that tests pin and that changes must preserve: reported latency
depends only on host rate (never on chain contents or oversampling toggles), IR
convolution always runs at the base rate inside a per-block island, and
multi-core output (`RtWorkerPool.h`) is bit-identical to serial.

### Chain edits are snapshot-reconciled

Undo, redo, preset load, duplicate, paste, and DAW state restore all go through
the same path: a settings-only `ValueTree` snapshot (tone JSON + params, never
model bytes) is reconciled against the live lanes so blocks whose id/tone/model
still match keep their loaded engines. Model bytes travel separately in a
per-block cache; presets embed them so they load offline. Local files (drop or
native picker) are wrapped in a synthetic tone JSON with `file://` model URLs and
then ride the exact catalog pipeline; see `plugin/docs/local-models.md`.

### Lane invariants

`kMinLaneSlots` in `ChainBlock.h` and `normalizeLaneInserts` enforce that a lane
always shows at least five tiles and at least one trailing insert slot. Any new
structural mutation must end by calling the normalizer, or the UI will render an
inconsistent rail.

### JUCE is patched at configure time

The root `CMakeLists.txt` is large because it applies idempotent source patches to
the CPM-fetched JUCE tree in `libs/juce` (WKWebView flash, WebKitGTK SONAME and
persistent storage, standalone window behavior, ALSA and AudioDeviceManager
fixes, macOS zoom). Each patch is guarded by a `T3K_*` marker string and fails
the configure loudly if its anchor no longer matches. When bumping JUCE, expect
to re-anchor these. Never edit `libs/` directly; it is gitignored and regenerated.

## Conventions and contracts

- **Version**: the repo-root `VERSION` file is the single source of truth. Bump
  with `./script/set-version.sh X.Y.Z`, which also mirrors into `ui/package.json`.
- **Compatibility contracts** (from the PR template): never reuse or renumber the
  AU parameter version hints in `Processor.cpp`; never change the LV2 URI or CLAP
  ID in `plugin/CMakeLists.txt`; if the `TONE3000State` tree changes shape, bump
  `kStateSchemaVersion` in `ProcessorState.cpp` and handle the old tree explicitly.
- **Formatting**: C++ follows `.clang-format` (Chromium base, 100 columns,
  includes never sorted). TypeScript follows `ui/.prettierrc` (single quotes,
  100 columns) and `ui/eslint.config.js`.
- **UI units**: every length is authored in `rem` against a 1024x578 design box;
  `useUiScale` sets the root font-size so `1rem` equals one design pixel. Raw `px`
  is only for real viewport coordinates and must be scaled with `getUiScale()`.
  Styling is inline with tokens from `ui/src/components/theme.ts`. Chrome is
  Liquid Glass: surfaces take the `glass` / `glass-clear` / `glass-prominent`
  classes from `ui/src/index.css` (via the `GLASS_*_CLASS` tokens) plus an
  inline radius from `RADIUS_SHEET` / `RADIUS_PANEL` / `RADIUS_CHIP` or a capsule;
  nothing paints an opaque panel over the root's `AMBIENT_BACKGROUND`.
- **WebKit floor**: `vite.config.ts` pins `build.target` to `safari13` because the
  plugin runs in old system WebKits. Do not raise it or use syntax it cannot parse;
  a parse error is a silent black window.
- **Comments over speculation**: the codebase explains the why of every
  non-obvious decision in a comment at the site. Match that; the PR template asks
  for no speculative fallbacks or dead code.
- `*.t3kpreset` files are binary `ValueTree` streams (`.gitattributes`); never
  diff or hand-edit them. `notes/` is a gitignored private maintainer directory.
