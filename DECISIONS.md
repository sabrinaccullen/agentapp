# Architecture Decisions — Mobile App

Entries are append-only. Never delete or overwrite a past decision — add a new entry if something changes and note what superseded it.

Format:
**DECISION-### — Short title**
Date | Files affected
What was decided and why. What was tried and rejected, and why.

---

## DECISION-001 — Audio recorder quality preset placement
2026-06-14 | `utils/audio.ts`

Quality preset must be passed into the `AudioRecorder` constructor, not into `prepareToRecordAsync()`. In Expo SDK 56, `prepareToRecordAsync()` takes no arguments — passing a preset there is silently ignored and the recorder initialises with default (low-quality) settings.

**Do not revert this.** The original unconfigured constructor (`{}`) caused the 1-2 character voice dictation cut-off (BUG-001).

## DECISION-002 — record() must be awaited
2026-06-14 | `utils/audio.ts`

`_recorder.record()` must be awaited. Without await, the UI reports "Listening…" before the audio session is actually ready, resulting in the first portion of speech being dropped.

## DECISION-003 — useFocusEffect cleanup must be ref-guarded
2026-06-14 | `screens/CaptureScreen.tsx`, `screens/ConversationScreen.tsx`

Cleanup callbacks in useFocusEffect must check a `isListeningRef` before calling `stopRecording()`. An unconditional cleanup races with `stopDictation()` — if cleanup fires first it nulls `_recorder`, then `stopDictation()` receives null and silently discards the audio.

All screens with recording capability must have this guarded cleanup. ConversationScreen previously had no cleanup at all — unguarded removal of the cleanup would orphan the native recorder on tab switch.

## DECISION-005 — useFocusEffect cleanup must reset tab to 'write'
2026-06-14 | `screens/CaptureScreen.tsx`

The `useFocusEffect` blur cleanup must call `setTab('write')` in addition to `setIsListening(false)`. Without this, returning to the screen leaves the tab state as `'dictate'`, causing `handleTabChange` to short-circuit (it bails early if `newTab === tab`) and preventing dictation from restarting without a manual Write→Dictate tap (BUG-004).

## DECISION-004 — Transcription MIME type must match recorder output
2026-06-14 | `utils/transcribe.ts`, `utils/audio.ts`

The MIME type passed to the Whisper endpoint in `transcribe.ts` must exactly match the codec/container the recorder in `audio.ts` is configured to output. A mismatch causes complete transcription failure (BUG-002 — regression from DECISION-001 fix until format alignment was confirmed).

Before changing the quality preset or recording format in `audio.ts`, verify the output container and codec and update `transcribe.ts` to match.

## DECISION-006 — Tab navigator replaced with stack navigator rooted at Home Screen
2026-06-14 | `App.tsx`, `screens/HomeScreen.tsx`, `contexts/ThemeContext.tsx`

The bottom tab navigator is replaced with a `createNativeStackNavigator` rooted at `HomeScreen`. History and Settings are push destinations from Home's secondary nav. CaptureScreen is a modal presentation (slides up from bottom) as the entry prompt placeholder until the Capture/Conversation overlay spec lands. ConversationScreen and QuickAddScreen are not removed but are not wired into the navigator — they will be surfaced via the overlay spec.

`@react-navigation/native-stack` was chosen over the JS-based `@react-navigation/stack` because `react-native-screens` was already a project dependency, making it zero additional native code.

## DECISION-007 — Theme state stored in ThemeContext via expo-secure-store
2026-06-14 | `contexts/ThemeContext.tsx`, `utils/storage.ts`

Theme selection persists across launches via `saveSecure`/`getSecure` (expo-secure-store) using key `vesper_theme`, consistent with the project's existing storage pattern. `@react-native-async-storage/async-storage` was not added — reusing the existing secure store avoids a new dependency and another native module.

Theme colors for Candlelight, Shoreline, and Overcast are placeholder approximations (warm amber, cool teal, desaturated grey-blue) since the full Design System spec has not yet been approved. Golden Hour matches the approved spec exactly. Do not treat the other three as final — update them when the palette spec lands.

## DECISION-008 — StatusBar from react-native, not expo-status-bar, for translucent bleed
2026-06-14 | `screens/HomeScreen.tsx`

`expo-status-bar`'s `<StatusBar>` component does not expose `translucent` or `backgroundColor` props in SDK 56. The spec requires `translucent backgroundColor="transparent" barStyle="light-content"` so that the gradient bleeds behind the status bar. React Native's built-in `StatusBar` is used directly for this screen.

## DECISION-010 — Overlay implemented as inline animated component in HomeScreen
2026-06-15 | `screens/HomeScreen.tsx`, `screens/OverlayPanel.tsx`

The overlay is rendered as a controlled `Animated.View` inside HomeScreen, not as a React Navigation transparent modal. React Navigation was considered but rejected: transparent modal can't dim the HomeScreen behind it without a cross-component context or listener, and the spring + dim animations need to run simultaneously. The inline approach gives full control over both with a single `Animated.parallel`.

The overlay uses `Animated.spring` (toValue 0, damping 80, stiffness 400) for slide-up and `Animated.timing` (300ms) for dim. Closing uses timing in both directions for a clean exit. Swipe-to-dismiss is a known stub — see backlog.

## DECISION-011 — Conversation messages persisted in SQLite, not AsyncStorage
2026-06-15 | `utils/database.ts`, `screens/OverlayPanel.tsx`

The spec says "AsyncStorage" for conversation persistence. `@react-native-async-storage/async-storage` is not installed and expo-secure-store has a ~2KB iOS limit — insufficient for any real conversation history. `expo-sqlite` is already installed and used for captures; a `conversation_messages` table was added to the same database. The storage mechanism is transparent to the overlay component.

## DECISION-012 — ConversationMode type and MODES array removed; single Vesper persona
2026-06-15 | `utils/conversation.ts`, `screens/ConversationScreen.tsx`

The three-mode system (task/chat/plan) and their separate system prompts are replaced by a single Vesper persona: warm, thoughtful, references vault context when available. `ConversationMode` type and the `mode` parameter on `sendMessage` are removed. ConversationScreen.tsx is retained as a file (not deleted) but is not wired into the navigator — it will remain dormant until further decision.

## DECISION-013 — Display tier (32px) approved for greeting only
2026-06-15 | `screens/HomeScreen.tsx`

The global font scale caps at 19px, but the Home Screen spec explicitly approves a Display tier at 32px for the greeting ("Good morning." / "Good afternoon." / "Good evening.") — Cormorant Garamond SemiBold only. This is the emotional centrepiece of the screen and intentionally breaks the standard cap. No other element uses 32px; Review should treat this as a standing exception for `styles.greeting` in HomeScreen.tsx.

## DECISION-017 — Note tag picker reuses the toolbar container; tag stored as nullable string column
2026-06-15 | `screens/OverlayPanel.tsx`, `utils/database.ts`

Per the Note Tags addendum (`spec-overlay-2026-06-14.md`, HANDOFF-024): tapping Save in Note mode no longer saves immediately — it sets `isPickingTag` and swaps the existing toolbar's children (Speak + Save) for a horizontally-scrollable row of tag pills (Personal/Work/Idea/Reminder/Skip), per spec's instruction to reuse the toolbar container rather than introduce a new component tree. Selecting a pill or Skip calls `commitNoteSave(tag)` — the renamed/extended version of the old `handleNoteSave`, now taking the tag and running the same checkmark-then-dismiss animation as before.

Cancel-on-tap-back-into-text-area is implemented by blurring `noteInputRef` when entering picker mode (`handleSavePress`) and resetting `isPickingTag` on the TextInput's `onFocus` — refocusing the input is the detectable signal for "tapped back into the text area."

`captures` table gets a new nullable `tag TEXT` column (migrated via `ALTER TABLE` for existing installs, same pattern as the `queued` column in DECISION-? / original schema). `saveCapture` takes an optional third `tag` param, defaulting to `null`. No tag management UI was built — v1 ships with the hardcoded list per spec, out of scope until the Settings screen is specced.

## DECISION-014 — KeyboardAvoidingView needs explicit keyboardVerticalOffset inside the overlay
2026-06-15 | `screens/OverlayPanel.tsx`

`KeyboardAvoidingView`'s `behavior="padding"` was already in place but under-padded the toolbar (BUG-007). Root cause: the overlay is rendered inside a parent `Animated.View` with `transform: [{ translateY }]` (DECISION-010), and KAV's native layout measurement doesn't account for that transform — it thinks its top sits at `y=0` instead of `SCREEN_HEIGHT * 0.08` (the overlay's actual on-screen top). Fixed by passing `keyboardVerticalOffset={SCREEN_HEIGHT * 0.08}` explicitly rather than relying on KAV's auto-measurement.

If the overlay's height ratio (currently 92% in `HomeScreen.tsx`) ever changes, this offset must be updated to match.

## DECISION-015 — Conversation input field needs explicit lineHeight
2026-06-15 | `screens/OverlayPanel.tsx`

`styles.inputField` had no `lineHeight`, so the TextInput's line box was sized too tightly around cap height, clipping descenders ("y", "g") in the placeholder text (BUG-008). Added `lineHeight: 20` against `fontSize: 16`.

## DECISION-016 — Reduce Motion must subscribe to live changes, not just read once on mount
2026-06-15 | `screens/HomeScreen.tsx`, `screens/OverlayPanel.tsx`

Both screens read `AccessibilityInfo.isReduceMotionEnabled()` once on mount but never updated if the OS setting changed while the app was already running (BUG-006) — e.g. QA toggling Reduce Motion in Settings and switching back without force-quitting. Added `AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)` in both components' mount effects, with listener cleanup on unmount.

## DECISION-009 — Theme cross-fade uses content opacity animation, not gradient interpolation
2026-06-14 | `screens/HomeScreen.tsx`

On theme cycle, the entire `Animated.View` wrapping screen content fades to near-zero opacity (200ms), theme state updates (gradient colors snap), then fades back to full (200ms) — total 400ms matching the spec. True gradient interpolation between two `LinearGradient` instances was considered but avoided: it requires maintaining a "previous theme" ref and two gradient instances rendered simultaneously, adding complexity for a marginal visual difference. Reduce Motion uses an instant swap with no animation.
