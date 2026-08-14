# Unit sound files

Drop a file here named exactly after a unit's class name and that unit will play it.
No code change is needed — files are discovered at build time.

Supported extensions: `.ogg`, `.wav`, `.mp3`. Prefer `.wav` or `.mp3` — Safari's
`decodeAudioData` has long-standing gaps with Ogg Vorbis, so an `.ogg` file can silently
fail to decode there. That failure is graceful (it's logged to the console and the unit
falls back to its synthesized voice), but it means an `.ogg` file that works everywhere
you tested it can still go silent for a Safari player.

**Any unit without a file keeps its synthesized voice**, so you can add these a few at a
time and hear each one. Nothing goes silent.

**A file is only ever used for the events that carry its class name — no unit uses its
file all three ways.** A defender's file plays when it fires and when it's destroyed,
but never for a hit: only the enemy taking damage carries a class name on that event. An
enemy's file plays when it takes a hit and when it dies, but never for firing: enemies
don't fire projectiles the way defenders do. Short, punchy sounds work best — roughly
0.1 to 0.5 seconds.

A file whose name matches no unit below is reported as a warning in the browser console,
so a typo is visible rather than silent.

**Samples are loaded once, on the first pointerdown, not watched for changes.** Add or
replace a file, then reload the page before you judge whether it worked — otherwise it
will look like the drop did nothing.

## Defenders (10)

- [ ] `BasicDefender.ogg` — the Shooter
- [ ] `HealerDefender.ogg` — Healer
- [ ] `GrenadeDefender.ogg` — Grenadier
- [ ] `BarricadeDefender.ogg` — Barricade (heard only when destroyed)
- [ ] `EnergyGenerator.ogg` — E-Gen (heard only when destroyed)
- [ ] `Sniper.ogg` — Sniper
- [ ] `Mortar.ogg` — Mortar
- [ ] `FrostArcher.ogg` — Frost Archer
- [ ] `FireBlast.ogg` — Fire Blast spell
- [ ] `IceBomb.ogg` — Ice Bomb spell

## Enemies (19)

- [ ] `BasicEnemy.ogg`
- [ ] `FastEnemy.ogg`
- [ ] `TankEnemy.ogg`
- [ ] `BombEnemy.ogg` — heard only on hit; it always explodes on death instead of
      emitting `enemy:died`, so its death sound never plays
- [ ] `RangeEnemy.ogg`
- [ ] `ShieldEnemy.ogg`
- [ ] `HealerEnemy.ogg`
- [ ] `SplitterEnemy.ogg`
- [ ] `MiniEnemy.ogg` — heard only on hit; it's a spawned enemy, and spawned enemies
      don't emit `enemy:died`, so its death sound never plays
- [ ] `SwarmLeader.ogg`
- [ ] `EMPEnemy.ogg`
- [ ] `VampireEnemy.ogg`
- [ ] `GhostEnemy.ogg`
- [ ] `BerserkerEnemy.ogg`
- [ ] `NecromancerEnemy.ogg`
- [ ] `AssassinEnemy.ogg`
- [ ] `MageEnemy.ogg`
- [ ] `TitanEnemy.ogg`
- [ ] `BossEnemy.ogg` — currently unreachable; `BossEnemy` is not wired into the engine

Good CC0 sources: [Kenney](https://kenney.nl/assets?q=audio) (Impact Sounds and Digital Audio
suit this game), and [OpenGameArt](https://opengameart.org/).
