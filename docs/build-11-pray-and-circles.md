# Build 11: Pray and Circles, rebuilt with context (John, 18 Oct 2026)

John, on TestFlight build 9: "there's nothing on circle for the user, they don't know what they are signing up for …
on New circle it just goes there … let's significantly improve it."

Nothing here is built yet. Draft it on the canvas with `/design` (Light, Dark, AX5; Mobbin cited), John approves the frames,
then build. Rules that hold throughout: no counts that shame, nobody named who prayed (build 8 plan §I.3), licensed text
never shown or sent (rule 9), helpline before a self-harm post (PR-12).

## What is wrong today

| Where | Today | Why it fails |
|---|---|---|
| Pray page (`app/pray/index.tsx`) | a settings-style list: "Add to your list", "Pray for someone", "Ask for prayer", "Your requests", "New circle"; 13 pt grey section labels (fixed to bold titles in ab164c6) | it reads as a menu, not a place to pray; it does not say what each thing does, who sees it or where it goes; it does not match PR-07 |
| New circle | `Alert.prompt("New circle")`, then straight into an empty circle | no word on what a circle is, who can join, what members see, that it needs iCloud, or how invites work |
| A circle (`app/pray/circle.tsx`) | a list of requests and two rows, one grey line "Only people in X see these" | no members, no explanation, no empty state, invite is a row with no preview of what is sent |
| Joining | the iCloud share sheet's own accept screen, then nothing in Yada | the person invited lands with no welcome or explanation |
| Pray for someone (`app/pray/someone.tsx`) | a list page | PR-09 is a calm full-screen hold with the request large in Literata and the pill at the foot (design QA, qa-today.md) |
| Your requests (`app/pray/mine.tsx`) | one flat list | PR-11 groups Live and Answered and gives each a ⋯ |

## What build 11 should give the reader

1. **Pray, as a place** (PR-07 as the base): today's line from your list first, then one card for Pray for someone with how
   many requests wait (never zero), Ask, Your requests grouped; Circles as cards with their people's initials and the
   newest request's first words. Each part says in one line who sees it ("Only you", "Anyone using Yada, no names", "The 6
   people in Home group").
2. **A circle explained before it exists:** New circle opens a short sheet: what a circle is (people you invite, up to 12),
   what they see (requests posted to the circle, how many prayed, never who), what they do not (your list, your other
   requests), that it uses iCloud so Yada stores nothing. Then Name, then Invite with the message previewed, then the
   circle.
3. **A circle's page:** the people (initials or first names they chose), the requests in Literata, an empty state that
   says what to do first, Ask this circle as the one primary, Invite with the preview, Leave and Delete in ⋯ with what
   each does spelled out.
4. **Joining:** a welcome screen in Yada after accepting: the circle's name, who invited you, what you will see, one
   button into it; and a way to leave at once.
5. **Pray for someone, Your requests, Ask:** brought to PR-09, PR-11 and PR-10 (Ask was rebuilt on 18 Oct: 037ff10,
   3a4a96d).

## Open questions for John

- Can a member see the other members' names, or only the count? (Recommendation: first names they choose, as Ask does.)
- Should a circle have a short description its creator writes ("Our small group, Tuesdays")?
- Should Pray become its own tab once Circles are rebuilt (PT-01 proposed it)?

## References already on the canvas

PR-07, PR-09, PR-10, PR-11, PR-12, CI-01 to CI-03, PT-01, XT-03 to XT-05. The design QA of 18 Oct
(`qa-today.md` in the session notes) lists every current difference.
