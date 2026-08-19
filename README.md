# Cursed Factory

A self-contained, two-floor browser horror game with switchable top-down 2D and first-person 3D views. Escape Fallow Industrial Works by restoring both production levels, recovering the foreman's keycard, and surviving the creatures patrolling the factory.

## Features

- Four monster types with floor-aware grid pursuit and different silhouettes
- Three factory workers who flee from—and can be killed by—the monsters
- Breaker-code, steam-pressure, production-order, ventilation, and overhead-crane puzzles
- Two complete 22×18 navigation maps connected by an industrial switchback stair and powered freight elevator
- Three enclosed safe rooms across both floors, with doors that monsters can force open unless locked from inside
- Interactive sliding doors and bulkheads, alarms, supply lockers, hydraulic presses, control panels, and notes
- Babylon.js-powered first-person rendering with both factory floors physically stacked and synchronized game state
- Animated procedural lathes, pumps, turbines, conveyors, presses, boilers, robot arms, ventilation fans, pipes, and industrial machinery
- High-resolution 2D rendering with procedural material textures, directional flashlight lighting, fog-of-war, dust, shadows, and a tracking camera
- Live 2D/3D switching that preserves floor, position, puzzles, inventory, workers, and monster state
- Monsters and workers can route through the stairs or powered elevator while pursuing cross-floor targets
- Six spacious production zones with wide marked aisles and separated machinery islands
- Required jump and crouch traversal is contained in realistic parts-cage and maintenance-bay entrances
- Factory-facing wall racks and control plates for every collectible and interactive fixture
- Optional secrets, worker-survival statistics, flashlight management, and synthesized positional threat cues

## Run

Start any static server in this folder, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- WASD — move
- Mouse — aim flashlight
- V — switch between 2D and 3D
- Shift — sprint
- Space — jump safety barriers
- C or Ctrl — crouch under low pipes
- E — interact
- L — lock or unlock a closed safe-room door from inside
- F — flashlight
- Escape — pause

The game has synthesized sound, a procedural floor-switching 2D renderer, a stacked Babylon.js 3D renderer, and four secrets. Babylon.js is vendored locally so gameplay does not require a network connection. Web fonts enhance the presentation when an internet connection is available; system fallbacks are included.
