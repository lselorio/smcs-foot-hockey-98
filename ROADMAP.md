# Foot Hockey 98 — Roadmap & Upcoming Tasks

*Inspired by recess at St. Michael's Choir School (66 & 67 Bond Street) in the 1980s–90s.*

## Upcoming Features & New 66 Bond Recess Games

1. **Multi-Sport 66 Bond Anthology (Shared Arena & *"In Ludo Est!"* Intro)**
   - Reuse the **66 Bond** schoolyard arena, classmate roster, uniforms, and the **360° spinning SMCS crest + sung Gloria/Magnificat + *"In Ludo Est!"* boot intro** to launch additional recess sports:
     - **Elimination** — Classic St. Mike's schoolyard basketball elimination game on 66 Bond's hoops.
     - **Touch Football** — Schoolyard touch football across 66 Bond.

2. **Classmate Roster & Player Attributes** *(26 St. Mike's classmates with Pick Teams, traits & REGULAR/DRESS uniforms; expand or tune attributes anytime)*
   - Distinct playable classmates with individualized player attributes (speed, kick power, ball control, catching/hands, goalie reflexes, checking, glasses & tall/short/beefy/thin builds).

3. **Mobile Touch Controls & Public Hosting Prep** *(Safari macOS/iOS `.mp3` audio done!)*
   - Auto-detected on-screen retro controls for phones/tablets (left virtual thumbstick/D-pad, right `SHOOT`/`PASS`/`CATCH` buttons, portrait & landscape responsive layout, `touch-action: none`).
   - Deploy as a zero-backend static site (e.g. GitHub Pages / Netlify) to share with classmates.

4. **Two Play Surfaces: "66 Bond" & "67 Bond"** *(66 Bond complete; 67 Bond lower priority for now)*
   - Add **67 Bond** as a second selectable schoolyard court with its own dimensions and net layout.

## Completed Milestones

5. ~~**Safari macOS/iOS Audio & Browser Compatibility**~~ *(Done)*
   - Mastered `.mp3` versions of `boot-gloria`, `boot-magnificat`, and `boot-voice` alongside `.ogg`, with automatic format-order detection (`.mp3` first on Safari), WebKit-safe `decodeAudioData`, gesture audio unlock on `keydown`/`pointerdown`, and Safari pixel-art rendering polish.

6. ~~**Chiptune Sacred / Liturgical Soundtrack, Postlude & Sung Boot Intros**~~ *(Done)*
   - Live 4-voice 16-bit **Palestrina *Sicut Cervus***, **Gregorian *Missa VIII (de Angelis)* Gloria**, and **Gregorian *Salve Regina*** (with Solesmes episema & pre-quilisma nuance) with auto-advancing playlist (`G` to switch, `N` on/off).
   - Random sung **Gloria in excelsis Deo** / **Magnificat** over the 360° spinning SMCS crest → booming **"IN LUDO EST!"**, **Widor Toccata** cathedral organ postlude on **"ITE, LUDUS FINITUS EST"**, and the secret 6-voice **Palestrina *Missa Papae Marcelli* Gloria — "AMEN"** post-credits stinger (`Shift+I` on Title or Final screen).

6. ~~**66 Bond Schoolyard Arena & Landmarks**~~ *(Done)*
   - Top black-brick wall with 5 vertically-grilled windows & wide yellow-brick rectangle net; right red-brick wall with taller square window cage net + protruding brick room above it; bottom red-brick wall with **"Basement 56!"** downstairs staircase & green safety barrier, bottom-right ascending stairs with seated classmate (**"The Bird That Couldn't Fly."**), and two active corner basketball games (top-left on left wall, lower-left on bottom wall) that ricochet and kick away nearby tennis balls.

7. ~~**Three Recess Periods & Period Net Swaps**~~ *(Done)*
   - 3 periods: **Morning Recess** (1:00), **Lunch Recess** (2:00 — 2× length), and **Afternoon Recess** (1:00), swapping nets between periods.

8. ~~**Post-Goal Possession & Demo Mode**~~ *(Done)*
   - After a goal is scored, the team that **gave up the goal** gets possession via their **goalie in the crease** to restart play.
   - Full CPU-vs-CPU **Demo Mode** (`D` on Title or 10s idle attract).

9. ~~**Left-Wall Body Check & Snow Day Weather Mechanic**~~ *(Done)*
   - Body checking is legal along the **left wall** of 66 Bond on clear days, and **legal everywhere** when it's **snowing** (white slippery snow-packed ground + falling snowflakes).
