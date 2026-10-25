# Build 12's iCloud fields: deploy before public testers (25 Oct 2026)

TestFlight and the App Store use iCloud's **production** database, which refuses a field its schema doesn't have.
Build 12 writes three new fields. Without them in production, making a circle fails (every new circle stores its
picture), and Ask someone and Mark answered fail. No new app build is needed: the schema lives on Apple's servers.

| Record type | Field | Type | Written by |
|---|---|---|---|
| `cloudkit.share` | `picture` | Int(64) | New circle (PC-33): the circle's picture, 1 to 30 |
| `CircleRequest` | `to` | String, **Encrypted** | Ask someone (AO-02): the person's name, for your own list |
| `CircleRequest` | `answeredAt` | Date/Time | Mark answered on an ask (PR-51) |

`apps/mobile/cloudkit/schema.ckdb` now lists them.

## Steps (John, in CloudKit Console)

1. https://icloud.developer.apple.com → CloudKit Console → container **iCloud.studio.yada.reader** → **Development**.
2. Schema → Record Types:
   - **CircleRequest** → add field `to`, type **Encrypted String**; add field `answeredAt`, type **Date/Time**. Save.
   - **cloudkit.share** → add field `picture`, type **Int(64)**. Save.
   (If a field is already there, skip it: a development build may have created it.)
3. **Deploy Schema Changes…** → check the list shows only these additions → Deploy to Production.
4. On your iPhone with build 12 from TestFlight: make a circle, then Ask someone. Both should work.

No index is needed: none of the three is queried.

## Why this wasn't caught

The QA simulator build has no iCloud entitlement, so nothing wrote these fields in development, and the repo had no
record of a production deploy. Next time: compare every `r["…"] =`, `encryptedValues["…"] =` and `share["…"] =` in
`modules/yada-pray/ios/*.swift` with `schema.ckdb` before an upload.
