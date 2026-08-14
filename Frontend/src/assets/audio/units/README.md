# Unit sound files

Drop a file here named exactly after a unit's class name and that unit will play it.
No code change is needed — files are discovered at build time.

Supported extensions: `.ogg` (preferred — small and widely supported), `.wav`, `.mp3`.

**Any unit without a file keeps its synthesized voice**, so you can add these a few at a
time and hear each one. Nothing goes silent.

Each file is used three ways: as recorded when the unit acts, shortened and quieter when
it lands a hit, and pitched down when it dies. Short, punchy sounds work best — roughly
0.1 to 0.5 seconds.

A file whose name matches no unit below is reported as a warning in the browser console,
so a typo is visible rather than silent.

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
- [ ] `BombEnemy.ogg`
- [ ] `RangeEnemy.ogg`
- [ ] `ShieldEnemy.ogg`
- [ ] `HealerEnemy.ogg`
- [ ] `SplitterEnemy.ogg`
- [ ] `MiniEnemy.ogg`
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
