# Birdly Implementation Task Plan

This file tracks the execution plan for turning the Birdly scaffold into a polished, production-ready local AI coaching app.

## Current Status

- [x] Electron + Vite + React + TypeScript project scaffold exists
- [x] Main and overlay windows are wired
- [x] Core IPC/service modules are present
- [x] README, LICENSE (MIT), and `.gitignore` exist
- [x] Build compiles successfully (`npm run build`)
- [x] Real-time STT pipeline wired end-to-end
- [x] Real-time OCR pipeline wired end-to-end
- [x] Coaching orchestration updated for low latency
- [ ] RAG quality and retrieval scoring improved
- [ ] Post-meeting recording + export fully validated
- [ ] Packaging validated on Windows/macOS/Linux

## Phase 1 - Real-Time STT + OCR (First Iteration)

1. [x] Validate microphone capture permissions and failure UX.
2. [ ] Confirm Whisper model warm-up and first-token latency.
3. [x] Implement stable chunk processing (latest-chunk queue to reduce lag).
4. [x] Add OCR capture interval controls and throttling.
5. [x] Merge transcript + OCR streams into a single coaching context object.
6. [x] Add resilience: pipeline error surfacing to renderer.

## Phase 2 - Stealth Overlay Hardening

1. Validate content protection behavior across Zoom/Meet/Teams.
2. Improve click-through mode transitions and focus management.
3. Add explicit hotkey remapping in Settings.
4. Persist widget position/size/opacity per display.
5. Add guardrails for multi-monitor and DPI scaling edge cases.

## Phase 3 - Knowledge Base + RAG Quality

1. Improve document chunking strategy by file type.
2. Add metadata filters (source file, section, recency).
3. Add retrieval confidence scoring and top-k tuning.
4. Add KB indexing progress and cancellation UX.
5. Persist vector data store safely in local app data.

## Phase 4 - Post-Meeting Automation

1. Validate optional full-session recording flow.
2. Improve summary template quality and action-item extraction.
3. Add follow-up email presets by role/tone.
4. Add Markdown + PDF export robustness and naming conventions.

## Phase 5 - Production Readiness

1. Add integration smoke tests for key IPC flows.
2. Add performance budget checks for startup and suggestion latency.
3. Review threat model and tighten Electron security defaults.
4. Validate packaged builds and installers per platform.
5. Publish release checklist and contribution guidelines.
