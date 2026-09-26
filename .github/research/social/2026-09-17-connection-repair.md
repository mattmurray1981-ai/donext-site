# Cardiff and Birmingham connection repair — 17 September 2026

Recorded at 2026-09-17T19:54:00Z. No posts were sent during this repair.

## Confirmed findings

- The signed-in Meta Graph API Explorer returned Cardiff Page `1003042559562888` linked to Instagram `17841444957174775` / `donext_cardiff`, and Bristol Page `1278713381995669` linked to `17841427092617738` / `donext_bristol`, from a read-only `me/accounts?fields=id,name,instagram_business_account{id,username}` request. No Birmingham Page appeared in that authorisation. This does not prove that Birmingham's Page or Instagram linkage does not exist.
- The Explorer displayed `pages_show_list`, `business_management`, `instagram_basic`, `instagram_content_publish` and `pages_read_engagement`. It did not display `pages_manage_posts`; the latter is required for the intended Facebook Page publishing route. Displayed selections are not independently verified token grants.
- The GitHub browser showed the repository secrets page as signed out. Secure sign-in was attempted, but no completed authenticated state was verified. The GitHub connector supports code changes but does not expose secret-management operations. No tokens were copied or replaced.

## Completed code repair

[PR #26](https://github.com/mattmurray1981-ai/donext-site/pull/26) was merged as `3cd8f3541378a37f550226515100440c62f5d63e`. Connection checks now distinguish missing credentials, Meta HTTP rejection, Page mismatch, missing visible Instagram linkage, Instagram handle mismatch, network errors and malformed responses. Only fixed messages and allowlisted numeric provider codes reach logs. Raw provider bodies and secret values are excluded.

All 20 publisher tests and queue validation passed locally and in GitHub Actions. No account gates, queue entries, credentials, website code or delivery history were changed.

## Stored-credential check

The automatic read-only check after merge completed at 2026-09-17T19:52:38Z:

[Workflow evidence](https://github.com/mattmurray1981-ai/donext-site/actions/runs/35267435806)

| City | Result | Evidence |
| --- | --- | --- |
| Cardiff | Meta rejected the stored credential | HTTP 401, Meta code 190, subcode 463 |
| Birmingham | Publishing token absent | `missing_token` |
| Bristol | Direct publishing token absent | `missing_token`; existing Metricool delivery is separate and unaffected |

These are actual results from the configured GitHub secrets, distinct from the working Explorer browser authorisation. Earlier generic failures did not prove the reason on their own.

## Remaining connection work

1. Complete a supported authenticated GitHub browser session with access to repository Actions secrets. Do not request tokens or passwords in chat or add them to code/variables.
2. Renew Cardiff using Meta's supported long-lived Facebook Login/Page-token flow. Add Birmingham to the correct existing app authorisation and verify the exact Page and Instagram identities. Check the actual granted permissions, including Facebook Page publishing. Any Meta consent/security step must be handled through its supported UI.
3. Store each city Page token in its matching Actions secret. Run the read-only account check again.
4. Only after identity and permissions pass, prepare freshly researched content and inspected hosted artwork, enable the intended city and verify one controlled live delivery with per-network permalinks. Preserve the stable queue IDs and durable ledger; never re-send an uncertain result.

No direct destination is operational yet. The durable `donext-publishing-state` ledger remains empty. The existing Cardiff queue entry is expired and must not be reused. Subscriber emails remain drafts only.
