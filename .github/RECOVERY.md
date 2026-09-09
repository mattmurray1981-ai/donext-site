# Recover production without losing new research

Use one publishing path. A separate direct zip deployment does not run these checks and can overwrite the repaired site again.

The 7 September Bristol release succeeded in [workflow 34139900596](https://github.com/mattmurray1981-ai/donext-site/actions/runs/34139900596). Its logs identify function donor `6a9edc1cea9d1962d4364df8`, containing `hit` and `metrics-day`. Do not restore that entire deployment over newer research.

1. Stop the competing direct publisher. Run **Inspect Netlify recovery inputs (read only)** with that explicit donor ID, or run `capture-recovery-manifest.mjs` with `NETLIFY_SITE_ID`, `NETLIFY_AUTH_TOKEN` and `NETLIFY_FUNCTION_SOURCE_DEPLOY_ID`. This only reads metadata and writes a local manifest.
2. Review the output. Put the reviewed manifest at `.github/recovery/2026-09-08.json`, fill in `reason`, and list any obsolete production files to remove as `{ "path": "/exact/path", "reason": "Why this is intentionally removed" }`. Preserve all other production files. The complete captured SHA map pins what is being replaced; if production changes, capture/reconcile again.
3. Reconcile both newer live catalogs into the repaired public schema. Keep unexpired, verified additions. Set `updatedAt` to the actual reconciliation/check time, strictly newer than the live catalog; do not change the timestamp alone to defeat the freshness gate. Keep lead identifiers and editorial reasoning in private research.
4. Stage the reviewed static files. Every unlisted live file must remain present. The publisher checks that function source and package manifests match the donor exactly and that no surviving live function would change. It never packages a replacement function implicitly.
5. Run **Deploy production to Netlify** on the reviewed commit with `recovery_manifest` set to the manifest path. Normal pushes omit the manifest and retain the normal unmerged-change guards. CLI equivalents run `verify-live-deploy-inputs.mjs STAGE` followed by `deploy-preserved-site.mjs STAGE`, both with `NETLIFY_RECOVERY_MANIFEST` set to the reviewed file.
6. The publisher creates a draft, checks both city pages, assets, forms, catalog schema, privacy rules, aliases and read-only function health, then checks that production has not changed before publishing. Candidate and published file/function manifests must match the intended snapshot. Keep the resulting deployment ID in the operator handoff.

If Netlify requests `required_functions` for the donor digests, it cannot reuse the cached bundles: the draft stays unpublished. Recover/download the verified function bundles or package reviewed source as a separate explicit change. Do not remove the guard.

No synthetic signup or hit is used by verification. `GET hit` must return 405; metrics reads an unused historical date and must return valid JSON. A missing Blobs token or failed function prevents publication.
