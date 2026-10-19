# Feature Implementation: Badge Sharing, Admin Digest Preview, Match Pledges, and Storybook

This PR implements several key features to improve the Stellar GreenPay platform:

## Summary

- **Task #1663**: Add badge sharing to social media with OG endpoint and ShareButtons
- **Task #1664**: Add admin preview and test-send functionality for monthly digest emails
- **Task #1665**: Build UI for on-chain donation matching pledges
- **Task #1667**: Expand Storybook coverage with new component stories

## Changes

### Task #1663: Badge Sharing to Social Media

**Frontend Changes:**
- Created OG image endpoint at `frontend/pages/api/og/badge/[publicKey].tsx` for dynamic badge card generation
- Updated `frontend/pages/donors/[publicKey].tsx` to integrate ShareButtons with localized copy
- Added localization strings for badge sharing in all locale files (en, es, fr, pt-BR)
- ShareButtons supports mobile native share API and desktop social buttons (X/Twitter, Facebook, copy link)

**Key Files:**
- `frontend/pages/api/og/badge/[publicKey].tsx` (new)
- `frontend/pages/donors/[publicKey].tsx` (modified)
- `frontend/components/ShareButtons.tsx` (modified)
- `frontend/locales/*.json` (modified)

### Task #1664: Admin Digest Preview and Test-Send

**Backend Changes:**
- Added `sendDigestEmail` import to `backend/src/routes/admin.js`
- Created new POST endpoint `/api/admin/digest/test-send` for sending test digest emails
- Endpoint validates email, projectId, and month parameters
- Fetches project data, calculates statistics, and sends digest via Resend API

**Frontend Changes:**
- Added state variables for digest preview/test-send functionality in `frontend/pages/admin/index.tsx`
- Implemented `handleDigestPreview` and `handleDigestTestSend` functions
- Added UI section with project selector, month input, email input, and action buttons

**Key Files:**
- `backend/src/routes/admin.js` (modified)
- `frontend/pages/admin/index.tsx` (modified)

### Task #1665: On-Chain Donation Matching Pledges

**Frontend Changes:**
- Added `buildCreateMatchPledgeTransaction` function to `frontend/lib/stellar.ts` for Soroban contract interaction
- Added match pledge state and form handling to `frontend/pages/projects/[id].tsx`
- Implemented `handleCreateMatchPledge` function to build, sign, and submit match pledge transactions
- Added UI section for creating 2x match pledges with cap and deadline inputs
- Displays active match status if a pledge exists

**Key Files:**
- `frontend/lib/stellar.ts` (modified)
- `frontend/pages/projects/[id].tsx` (modified)

### Task #1667: Storybook Coverage Expansion

**New Story Files:**
- Created `frontend/components/ShareButtons.stories.tsx` with desktop idle and copied states
- Created `frontend/components/ProjectCard.stories.tsx` with active, fully funded, and no-image variants

**Key Files:**
- `frontend/components/ShareButtons.stories.tsx` (new)
- `frontend/components/ProjectCard.stories.tsx` (new)

## Testing

- Badge sharing: Test OG endpoint unfurls correctly on social media platforms
- Admin digest: Test preview renders HTML and test-send delivers email
- Match pledges: Test on-chain transaction creation and submission
- Storybook: Run `npm run storybook` to verify new stories render correctly

## Notes

- The TypeScript errors shown in the IDE are pre-existing configuration issues related to missing type definitions and should be addressed separately
- All new features follow existing code patterns and styling conventions
- Match pledge UI requires wallet connection and valid Soroban contract configuration

Closes #1663, #1664, #1665, #1667
