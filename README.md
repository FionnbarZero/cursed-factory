# Cursed Factory

A self-contained first-person 3D browser horror game. Escape Fallow Industrial Works by finding the line fuse, restoring power, recovering the foreman's keycard, and surviving the creature patrolling the factory.

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
