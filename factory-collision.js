(() => {
  'use strict';

  const PROFILES = Object.freeze({
    forklift: { width: .52, depth: 1.16, height: 1.28, offsetY: -.22 },
    conveyor: { width: .62, depth: 1.04, height: .62, standable: true, rotates: true },
    robotarm: { width: .44, depth: .44, height: 1.65 },
    lathe: { width: .97, depth: .38, height: 1.16 },
    pressMachine: { width: .64, depth: .5, height: 2.42 },
    machine: { width: .64, depth: .5, height: 2.42 },
    generator: { width: .71, depth: .49, height: 1.7 },
    pump: { width: .77, depth: .44, height: 1.34 },
    turbine: { width: .9, depth: .5, height: 1.46 },
    boiler: { width: .45, depth: .45, height: 1.96 },
    tank: { width: .55, depth: .55, height: 2.54 },
    workbench: { width: .84, depth: .42, height: .89, standable: true },
    pallet: { width: .49, depth: .49, height: .18, standable: true },
    crate: { width: .49, depth: .49, height: .72, standable: true },
    cabinet: { width: .42, depth: .29, height: 1.6 },
    barrels: { width: .54, depth: .43, height: 1.43 },
    pipe: { width: .29, depth: .29, height: 2.2 },
    fan: { width: .58, depth: .13, height: 1.85 }
  });

  function buildMachineryColliders(scenery) {
    const colliders = [];
    scenery.forEach((item, sourceIndex) => {
      const profile = PROFILES[item.type];
      if (!profile) return;
      const rotated = Boolean(profile.rotates && Math.abs(Math.floor(item.x + item.y) % 2));
      colliders.push({
        sourceIndex,
        type: item.type,
        floor: item.floor ?? 0,
        x: item.x + (profile.offsetX || 0),
        y: item.y + (profile.offsetY || 0),
        width: rotated ? profile.depth : profile.width,
        depth: rotated ? profile.width : profile.depth,
        height: profile.height,
        standable: Boolean(profile.standable)
      });
    });
    return colliders;
  }

  function contains(collider, x, y, padding = 0) {
    return Math.abs(x - collider.x) <= collider.width / 2 + padding
      && Math.abs(y - collider.y) <= collider.depth / 2 + padding;
  }

  function blocks(colliders, x, y, floor, feetHeight = 0, radius = 0) {
    return colliders.some(collider => collider.floor === floor
      && feetHeight < collider.height - .025
      && contains(collider, x, y, radius));
  }

  function surfaceHeightAt(colliders, x, y, floor, maxHeight = Infinity) {
    let height = 0;
    for (const collider of colliders) {
      if (collider.floor !== floor || !collider.standable || collider.height > maxHeight + .035) continue;
      if (contains(collider, x, y, -.025)) height = Math.max(height, collider.height);
    }
    return height;
  }

  const api = { PROFILES, buildMachineryColliders, contains, blocks, surfaceHeightAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CursedFactoryCollision = api;
})();
