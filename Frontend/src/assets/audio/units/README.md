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

- [ ] `projectile.wav` — every basic ranged shot, both sides (Shooter, Skeleton)
- [ ] `artillery.wav` — Grenadier
- [x] `mortar.wav` — Mortar only, a heavier thump (Eagle Artillery fire sample)
- [ ] `sniper.wav` — Sniper only, a sharp crack
- [ ] `magic.wav` — Frost Archer, Ice Bomb, Mage spells
- [ ] `fire.wav` — Fire Blast
- [ ] `heal.wav` — Healer, both sides
- [ ] `melee.wav` — any enemy striking a defender
- [ ] `summon.wav` — Necromancer, Splitter and Swarm Witch creating enemies
- [ ] `death-small.wav` — Basic, Fast, Mini, Swarm Witch
- [ ] `death-medium.wav` — every other ordinary enemy
- [ ] `death-defender.wav` — any defender destroyed
- [ ] `titan.wav` — Titan death, should feel heavy
- [ ] `boss.wav` — Boss death, the biggest sound in the game

The shared `hit` sound (an enemy taking damage) is already in place and needs no file.

## Titan ground pound

Not part of the original 14 above - added once the Titan's ground pound and phase
transition got their own sound keys (`quake-charge`, `quake-impact`, `phase-change`).

- [x] `quake-charge.wav` — the 500ms wind-up telegraph before the pound lands
      (Eagle Artillery charge sample, trimmed to the wind-up window)
- [x] `quake-impact.wav` — the pound itself, all three waves (Clash of Clans
      Earthquake Spell sample, trimmed to fit before the Titan resumes moving)
- [ ] `phase-change.wav` — the Titan's health-threshold escalation, still synthesized

Both supplied files were trimmed and gain-reduced from source before being committed
here — see `SAMPLE_VARIANTS` in `UnitSamples.js` for why gain is handled as a variant
transform rather than baked into the files, and the branch's dev log for the exact
ffmpeg commands. **These are a best-effort guess at the right trim point and level,
not a mix decision — they need the owner's ears.**

## Levels

Sounds are mixed in three tiers so the game has a foreground. You do not need to match
these yourself — the game applies them — but it helps to know which tier a file lands in,
because a sample chosen to be impressive on its own can disappear at 40%.

- **40%** — `projectile` and `hit`, plus the sounds that fire constantly or on every click:
  energy pickup, placing a defender, a rejected placement.
- **70%** — everything else, including all three death sounds, `mortar`, `sniper`, `magic`,
  `melee`, `summon`, `heal`, `artillery`, `fire`, and the wave-start stings.
- **100%** — `titan` and `boss`, plus base damage, level won and level lost, and the
  Titan's `quake-charge`/`quake-impact`/`phase-change` ability sounds above.

Pick samples that sound right at those relative levels.

Good CC0 source: [Kenney](https://kenney.nl/assets?q=audio) — Impact Sounds and Digital
Audio suit this game, and staying inside one of them is the point.
