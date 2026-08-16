# Cursed Factory

A self-contained first-person 3D browser horror game. Escape Fallow Industrial Works by restoring power, calibrating the steam manifold, restarting the production line, recovering the foreman's keycard, and surviving the creatures patrolling the factory.

## Features

- Three monster types with grid-based pursuit and different silhouettes
- Two factory workers who flee from—and can be killed by—the monsters
- Breaker-code, steam-pressure, and production-order puzzles
- Interactive alarms, supply lockers, hydraulic presses, control panels, and notes
- Conveyors, boilers, robot arms, ventilation fans, pipes, barrels, pallets, crates, steam, and industrial machinery
- High-resolution ray-cast rendering with procedural material textures, dynamic flashlight lighting, fog, dust, reflections, and camera movement
- Optional secrets, worker-survival statistics, flashlight management, and synthesized positional threat cues

## Run

Start any static server in this folder, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- WASD — move
- Mouse — look
- Shift — sprint
- E — interact
- F — flashlight
- Escape — release mouse / pause

The game has synthesized sound, a procedural ray-cast 3D renderer, three secrets, and no runtime JavaScript dependencies. Web fonts enhance the presentation when an internet connection is available; system fallbacks are included.
