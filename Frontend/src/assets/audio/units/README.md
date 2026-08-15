# Game sound files

Drop a file here named after a **sound**, not a unit. Several units share each sound
on purpose — a Shooter and a Skeleton firing the same basic projectile use one file.

Supported extensions: `.wav` or `.mp3` (Safari has gaps decoding `.ogg`).

**Any sound without a file falls back to a synthesized version**, so you can add these a
few at a time and hear each one. Nothing goes silent, and a page reload is needed after
adding a file.

## Getting them to sound like one game

Take all of these from a **single pack**. That matters more than any individual choice —
samples from different packs carry different room tone and mastering, which is what makes
a set sound like assorted noises rather than one game.

Aim for cartoon-arcade character: soft pops, comic thuds, squelches. Short, 0.1–0.5s.

## Combat sounds (14)

- [ ] `projectile.wav` — every basic ranged shot, both sides (Shooter, Skeleton, Assassin)
- [ ] `artillery.wav` — Grenadier
- [ ] `mortar.wav` — Mortar only, a heavier thump
- [ ] `sniper.wav` — Sniper only, a sharp crack
- [ ] `magic.wav` — Frost Archer, Ice Bomb, Mage spells
- [ ] `fire.wav` — Fire Blast
- [ ] `heal.wav` — Healer, both sides
- [ ] `melee.wav` — any enemy striking a defender
- [ ] `summon.wav` — Necromancer and Splitter creating enemies
- [ ] `death-small.wav` — Basic, Fast, Mini, Swarm Leader
- [ ] `death-medium.wav` — every other ordinary enemy
- [ ] `death-defender.wav` — any defender destroyed
- [ ] `titan.wav` — Titan death, should feel heavy
- [ ] `boss.wav` — Boss death, the biggest sound in the game

The shared `hit` sound (an enemy taking damage) is already in place and needs no file.

## Levels

Sounds are mixed in three tiers so the game has a foreground. You do not need to match
these yourself — the game applies them — but it helps to know that `projectile`, `hit`
and pickups play at 40%, most sounds at 70%, and `titan`, `boss` and base damage at full.
Pick samples that sound right at those relative levels.

Good CC0 source: [Kenney](https://kenney.nl/assets?q=audio) — Impact Sounds and Digital
Audio suit this game, and staying inside one of them is the point.
