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

## One pack per unit, and never split across units

The owner's rule, verbatim: **Eagle Artillery belongs to the Mortar only, and the
earthquake belongs to the Titan only.** Don't drop an Eagle Artillery cut under a
Titan sound key or an Earthquake Spell cut under a Mortar key, even if the timing or
character happens to fit — this project got that wrong once (`quake-charge.wav` was an
Eagle Artillery charge sample sitting under the Titan's wind-up key) and
`SampleProvenance.test.js` now fails the suite if it happens again. Record a new
sample's source pack in `SampleProvenance.js` when you add one.

## Titan ground pound

Not part of the original 14 above - added once the Titan's ground pound and phase
transition got their own sound keys (`quake-charge`, `quake-impact`, `phase-change`).

- [ ] `quake-charge.wav` — the 500ms wind-up telegraph before the pound lands, still
      synthesized. **Earthquake_Spell.ogg cannot supply this**: measured in 0.3s
      windows it opens at -12.8dB with the hit already at full level (finer-grained
      50ms windows show the same peak in the first 50ms — there is no quiet build-up
      before it), sustains a rumble around -11dB from 1.2s to 3.0s, decays through
      -23.5dB and -39.8dB, and is silent from 3.72s. There is no wind-up anywhere in
      the file to extract, so this stays synthesized until a real wind-up sample
      exists. (A prior version of this file wrongly used an Eagle Artillery charge
      sample here — see the rule above.)
- [x] `quake-impact.wav` — the pound itself, all three waves (Clash of Clans
      Earthquake Spell sample, trimmed to fit before the Titan resumes moving)
- [ ] `phase-change.wav` — the Titan's health-threshold escalation, still synthesized

The supplied file was trimmed and gain-reduced from source before being committed
here — see `SAMPLE_VARIANTS` in `UnitSamples.js` for why gain is handled as a variant
transform rather than baked into the files, and the branch's dev log for the exact
ffmpeg commands. **This is a best-effort guess at the right trim point and level,
not a mix decision — it needs the owner's ears.**

## Mortar shell landing

The Mortar fired with a sound and landed with nothing - `createExplosion` emitted no
feedback event at all. Fixed with its own sound key, `mortar-impact` (variant `landing`),
additive to the shared `hit` sound that already plays for every enemy the splash
catches: the landing is emitted first, so it leads rather than trails.

- [x] `mortar-impact.wav` — the shell's impact (Eagle Artillery impact sample, trimmed
      from 2.52s of continuous rumble down to ~0.58s: the attack transient plus a
      short release, not the source's full decay)

**This trim point and the landing's gain (`SAMPLE_VARIANTS.landing` in
`UnitSamples.js`) are a best-effort guess, not a mix decision — they, and the combined
level of the landing playing alongside the hit sound, need the owner's ears.** The
synthesized fallback (`UNIT_VOICES['mortar-impact']`) needs the same listen if no
sample is present.

## Levels

Sounds are mixed in three tiers so the game has a foreground. You do not need to match
these yourself — the game applies them — but it helps to know which tier a file lands in,
because a sample chosen to be impressive on its own can disappear at 40%.

- **40%** — `projectile` and `hit`, plus the sounds that fire constantly or on every click:
  energy pickup, placing a defender, a rejected placement.
- **70%** — everything else, including all three death sounds, `mortar`, `mortar-impact`,
  `sniper`, `magic`, `melee`, `summon`, `heal`, `artillery`, `fire`, and the wave-start stings.
- **100%** — `titan` and `boss`, plus base damage, level won and level lost, and the
  Titan's `quake-charge`/`quake-impact`/`phase-change` ability sounds above.

Pick samples that sound right at those relative levels.

Good CC0 source: [Kenney](https://kenney.nl/assets?q=audio) — Impact Sounds and Digital
Audio suit this game, and staying inside one of them is the point.
