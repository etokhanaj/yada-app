# Review, 18 Oct 2026: Henry's outline and Prayers of the Bible

John's decisions, given in chat on 18 Oct 2026 and recorded on the review page
(https://claude.ai/artifact/MCo3f6DksjrsRDAxFtgfHU, record `decisions/bulk`). Nothing in the app has changed yet.

## Henry's outline: 66 use the new summary, 218 keep the old

"Keep old" turns the replacement down. It does not approve the summary already in the app.
Source of both versions: `docs/research/henry-steer-2026-10-16.txt`.

Use the new summary for:

`GEN.8.13-8.19`, `GEN.22.1-22.10`, `GEN.50.15-50.21`, `EXO.14.1-14.14`, `EXO.15.1-15.21`, `NUM.5.1-5.4`, `NUM.22.1-22.21`, `NUM.24.1-24.9`, `NUM.26.63-26.65`, `DEU.33.1-33.29`, `JDG.3.12-3.30`, `JDG.7.15-7.25`, `JDG.10.6-10.18`, `2SA.5.6-5.11`, `2SA.10.9-10.19`, `1KI.21.8-21.16`, `1KI.22.1-22.12`, `2KI.15.32-15.38`, `2KI.21.19-21.26`, `2KI.22.14-22.20`, `2KI.24.6-24.9`, `1CH.20.1-20.3`, `1CH.23.24-23.32`, `2CH.30.13-30.27`, `NEH.1.1-1.11`, `NEH.4.1-4.8`, `EST.1.1-1.8`, `JOB.13.1-13.28`, `JOB.38.1-38.41`, `ISA.59.1-59.17`, `JER.12.5-12.13`, `EZK.1.4-1.14`, `EZK.1.22-1.28`, `EZK.10.1-10.22`, `EZK.13.1-13.16`, `EZK.22.17-22.22`, `OBA.1.1-1.14`, `MIC.6.1-6.8`, `NAM.2.1-2.13`, `ZEC.8.1-8.23`, `MAT.5.1-5.12`, `ACT.4.1-4.12`, `ACT.5.33-5.42`, `ACT.9.23-9.25`, `ACT.19.21-19.41`, `ACT.20.7-20.12`, `ACT.23.1-23.11`, `ACT.23.12-23.22`, `ACT.26.1-26.23`, `ROM.15.1-15.6`, `ROM.15.14-15.22`, `GAL.2.11-2.21`, `GAL.3.1-3.9`, `EPH.2.1-2.10`, `EPH.5.21-5.33`, `EPH.6.5-6.9`, `PHP.2.12-2.18`, `2TH.3.1-3.5`, `2TH.3.16-3.18`, `2TI.3.10-3.17`, `1JN.1.1-1.4`, `3JN.1.9-1.14`, `REV.5.1-5.10`, `REV.11.15-11.19`, `REV.16.1-16.16`, `REV.20.7-20.10`

## Errors found, each a separate fix (checked against the BSB in core v7)

| Passage | Problem | Checked |
|---|---|---|
| 2 Kings 15:1–7 | The summary in the app **now** says "Ahaziah's son Jotham"; 15:7 says Jotham is Azariah's son. The replacement repeats it. | yes, BSB 15:7 |
| Jeremiah 52:12–23 | The replacement says the seventh day; 52:12 says the tenth. Kept old. | yes, BSB 52:12 |
| Ezekiel 33:1–9 | The replacement joins the unwarned man's death (v. 8) to "you will have saved your life" (v. 9), reversing the meaning. Kept old. | yes, BSB 33:6, 33:9 |
| Daniel 6:10–24 | Neither version says Daniel is thrown to the lions and God saves him. | John's fix note |
| Ezra 2:1–67 | The replacement points to a list it doesn't give and puts the livestock before the people. | John's fix note |
| Acts 2:1–13 | The replacement still leaves out the Holy Spirit's coming. | John's fix note |
| Judges 2:6–9, Exodus 34:10–35, Job 20:1–29, Hebrews 11:20–22 | The replacements stay flagged, repeat themselves or lose coverage. | not checked |

The 2 Kings 15 error is live in the app. It comes from the extractive pick, so the fix is in the rules, not a hand edit.

## Prayers of the Bible: all 39 approved

BSB text only. The reader opens the whole passage; the first verse sometimes only introduces the prayer.
Notes from the review: Ephesians 1 and Colossians 1 report Paul's prayers rather than speak them, and stay in.
Luke 23:34 keeps the BSB's footnote that some manuscripts leave the prayer out.

| Title | Passage |
|---|---|
| Abraham pleads for Sodom | `GEN.18.23-18.32` |
| Jacob before meeting Esau | `GEN.32.9-32.12` |
| Moses pleads for Israel | `EXO.32.11-32.13` |
| Hannah's prayer | `1SA.2.1-2.10` |
| David after God's promise | `2SA.7.18-7.29` |
| Solomon asks for wisdom | `1KI.3.6-3.9` |
| Solomon dedicates the temple | `1KI.8.22-8.53` |
| Elijah on Mount Carmel | `1KI.18.36-18.37` |
| Hezekiah under siege | `2KI.19.15-19.19` |
| Jabez | `1CH.4.10-4.10` |
| David's praise before the people | `1CH.29.10-29.19` |
| Jehoshaphat before battle | `2CH.20.6-20.12` |
| Ezra's confession | `EZR.9.6-9.15` |
| Nehemiah for Jerusalem | `NEH.1.5-1.11` |
| The Levites' confession | `NEH.9.5-9.37` |
| A prayer of confession | `PSA.51.1-51.19` |
| A prayer of David | `PSA.86.1-86.17` |
| A prayer of Moses | `PSA.90.1-90.17` |
| Search me, O God | `PSA.139.23-139.24` |
| Jeremiah buys the field | `JER.32.17-32.25` |
| Daniel's confession | `DAN.9.4-9.19` |
| Jonah from the fish | `JON.2.1-2.9` |
| Habakkuk's prayer | `HAB.3.1-3.19` |
| The Lord's Prayer | `MAT.6.9-6.13` |
| Jesus in Gethsemane | `MAT.26.39-26.39` |
| Mary's song | `LUK.1.46-1.55` |
| Simeon | `LUK.2.29-2.32` |
| The tax collector | `LUK.18.13-18.13` |
| Jesus on the cross: forgive them | `LUK.23.34-23.34` |
| Jesus on the cross: into your hands | `LUK.23.46-23.46` |
| Jesus prays for himself and his followers | `JHN.17.1-17.26` |
| The church under threat | `ACT.4.24-4.30` |
| Stephen | `ACT.7.59-7.60` |
| Paul: that you may know him | `EPH.1.15-1.23` |
| Paul: rooted in love | `EPH.3.14-3.21` |
| Paul: that your love may abound | `PHP.1.9-1.11` |
| Paul: filled with the knowledge of his will | `COL.1.9-1.12` |
| The God of peace | `HEB.13.20-13.21` |
| Come, Lord Jesus | `REV.22.20-22.20` |
