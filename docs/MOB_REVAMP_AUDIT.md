# MOB Revamp Audit

## Repo State At Revamp Start

Initial command:

```bash
git status --short --branch
```

Result: branch `main...origin/main` with a dirty worktree. Existing modified tracked files included `App.tsx`, `ErrorBoundary.tsx`, `eas.json`, `index.ts`, all main screen files, and `src/contexts/ThemeContext.tsx`. Existing untracked files included `package.json`, `package-lock.json`, `app.json`, `tsconfig.json`, `src/services/`, `src/types.ts`, and project documentation files.

All existing dirty/untracked files were treated as the user baseline. No Git cleanup, reset, commit, or push was performed.

## Baseline Commands

| Command | Result |
|---|---|
| `npm install` | Passed; npm reported moderate audit findings. |
| `npm run typecheck` | Passed before implementation. |
| `npm run doctor` | Initially failed on Expo patch mismatches only. |
| `npm ls expo-sqlite --depth=0` | Initially empty. |
| `npm ls jest eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin jest-expo --depth=0` | Initially empty. |

Expo package mismatch was fixed with `npx expo install --fix --npm`; `npm run doctor` then passed.

## Claimed Vs Actual

| Claim or expected feature | Actual baseline | Risk | Action |
|---|---|---:|---|
| Offline POS | Partial, AsyncStorage arrays | High | SQLite foundation added. |
| Barcode scanning | Uses Expo Camera | Medium | Keep and harden later. |
| Inventory | Basic add/edit/delete/search | High | Product repository and inventory movements added. |
| Billing | Separate inventory and bill writes | Critical | Transactional sale creation added. |
| Receipts | Basic PDF/share | Medium | Keep for now; improve in Phase 2/4. |
| Reports | Derived from bills | Medium | SQLite sales summary added for future use. |
| AES encryption | Not implemented | High | Removed from README. |
| Charts | Not implemented | Low | Removed from README. |
| 98 percent coverage | Not implemented | High | Removed from README; tests added. |
| EAS readiness | Config exists | Medium | Expo doctor now passes. |

## Known Risks

- UI is still student-project level and screen-heavy.
- Some existing screens still use compatibility service APIs rather than direct repositories.
- Legacy migration imports existing sales without replaying stock deductions because legacy inventory already represents current stock.
- No cloud sync, auth, encryption, or multi-user support exists yet.
