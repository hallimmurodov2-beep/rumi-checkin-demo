# Agent instructions (Codex and other coding agents)

If you are the Codex agent that maintains The Rumi **Front Desk app**, start with **`CODEX-CONNECT-FRONTDESK.md`** in this folder. It explains how to connect the Front Desk app to this check-in tablet, and the rules for changing and deploying this repository.

For working on this codebase in general, read `CLAUDE.md`, which covers the stack, commands, deploy process and conventions, and `README.md`.

Rules that apply to every agent:

- Run `git pull` before changing anything, and commit and push your changes to `main`.
- Deploy production only from `main`, never with `vercel deploy --prebuilt` from a separate copy.
- Don't put API keys, signing secrets or passwords in code, docs or git.
- Guest-facing text must exist in English, Russian and Tajik (`src/translations.ts`).
