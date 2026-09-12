# DoNext direct publishing

Independent Instagram and Facebook Page publishing using Meta's API and the existing GitHub repository. No Metricool, Windsor, paid AI API, or previous bot runtime is required by this code. GitHub/Meta account limits still apply. This is a queue executor, not an event researcher: current organiser research, captions and original artwork must be prepared before marking an entry ready.

## Current status

Implementation prepared; all three cities disabled; empty queue; **no direct Meta publishing test has happened**. Handles are expected identities, not proof that the accounts exist. Cardiff and Birmingham Page IDs must be discovered and pinned after authorisation. Existing Bristol ID came from its connected account. No credentials or subscriber records belong in this public repository.

## One-time connection

1. Use a Meta developer app with the Instagram API with Facebook Login use case. Each Instagram account must be Professional and linked to its matching Facebook Page. The authorising Facebook account must have the necessary Page/app access. Meta can require additional business verification or app review depending on the app/access arrangement; do not claim that signing in alone completes API setup.
2. Authorise `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, and `pages_manage_posts` for those Pages. Obtain the matching **Page access token** for each city using Meta's supported token flow. Do not use an Instagram Login token with this Facebook Login adapter. Use supported long-lived credentials and track expiry/revocation; this implementation does not refresh them.
3. Store tokens as GitHub Actions secrets `META_CARDIFF_PAGE_TOKEN`, `META_BRISTOL_PAGE_TOKEN`, `META_BIRMINGHAM_PAGE_TOKEN`. Never send them in chat, commit them, or put them in Actions variables. They are passed only to Meta via an Authorization header. The workflow does not print provider bodies.
4. Run **DoNext direct social publishing → check**. This is read-only: verifies the token identifies the expected Page and Instagram handle, not that a write will succeed. Pin confirmed Page IDs in `accounts.json`.
5. Provision branch `donext-publishing-state` with `state.json` containing `{"version":1,"posts":{}}`. The publisher refuses to invent missing state; it must be created once and retained. Its records are public IDs/statuses and content hashes, never secrets or subscriber addresses.
6. Prepare one genuinely current, fact-checked JPEG post for a connected city, enable that city, set Actions variable `DONEXT_SOCIAL_ENABLED=true`, and run `publish`. Check the published permalink/account before enabling more cities. Authentication failure is a blocker, not a successful connection.

GitHub secrets: https://github.com/mattmurray1981-ai/donext-site/settings/secrets/actions

Meta app setup: https://developers.facebook.com/apps/

## Queue and cadence

`queue.json` contains entries with `id`, `city`, `network` (`instagram` or `facebook`), `status` (`draft` or `ready`), `caption`, `publishAt`, `expiresAt`, `verifiedAt`, `sources`, `imageUrl`, and `aiGenerated: false`. Times must include a timezone offset. Use Europe/London when planning and encode the correct date's GMT/BST offset. Friday briefs target 15:30 UK; other posts are chosen editorially. The runner polls every half-hour at :17/:47 UTC and may be delayed by GitHub, so it does not promise minute-exact posting. Set expiry to the latest useful publication time, before the featured event starts. Entries with research older than 36 hours are skipped and need re-verification, not a synthetic timestamp bump.

Sources must be checked organiser URLs. Caption should give age fit, price, booking needs and the city website link. Use stable IDs per city/network/campaign. Do not rename a used ID to retry it. Images must be public JPEGs on donext.co.uk, suitable for Instagram's current image requirements. This first adapter deliberately rejects AI imagery until the corresponding disclosure support has been verified; use original graphic artwork or licensed photographs. Reels, Stories, carousels, comments and DMs are outside this initial adapter.

Two independent gates prevent accidental sends: each city's `enabled` flag and the workflow's `DONEXT_SOCIAL_ENABLED` variable. Scheduled jobs stay off until the variable is true. PR validation never receives tokens. Check mode can run before enabling delivery.

## Delivery and recovery

The workflow serializes production runs. A compare-and-swap GitHub ledger claim must succeed before creating/uploading media. Instagram waits for the container to finish before publishing. Each network has its own ledger key, so an Instagram success is not repeated if Facebook fails. An interrupted or ambiguous attempt stays blocked for manual reconciliation; it is never blindly retried. Check the account/container, then record the confirmed media ID or investigate before any intentional retry. Never reset or delete the whole ledger.

The runner uses the queue from the checked-out main commit and checks that main is still current before starting. Publication windows and source freshness are rechecked per post. This guards repeat delivery from this publisher; it cannot detect posts made separately by another tool.

Run `node --test .github/social/publisher.test.mjs` and `node .github/social/publisher.mjs validate` without credentials. Provider/ledger tests are mocked; live write permission and media acceptance require the first connected-account test.

Subscriber email delivery is separate and remains inactive until Resend is connected. Existing Netlify forms continue collecting city and cadence preferences. Do not send through personal Gmail or publish subscriber lists here.

## Primary references

- https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login
- https://developers.facebook.com/documentation/pages-api/posts
- https://developers.facebook.com/docs/graph-api/changelog/versions/
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
