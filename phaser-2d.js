(() => {
  'use strict';
  const Phaser = window.Phaser;
  if (!Phaser) return;

  function createPhaserView({ host, maps, scenery, obstacles, workers, industrialLights, getState, getPlayer }) {
    const canvas = document.createElement('canvas');
    canvas.id = 'phaser-game';
    canvas.setAttribute('aria-label', 'Phaser 2D factory renderer');
    host.appendChild(canvas);
    let sceneRef;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 450,
      canvas,
      transparent: true,
      banner: false,
      render: { antialias: true, pixelArt: false, roundPixels: true },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: { create, update }
    });

    function tileValues(map) {
      return map.map(row => row.map(tile => tile === '1' ? 1 : tile === '2' ? 2 : tile === 'D' ? 3 : tile === 'B' || tile === 'E' ? 4 : 0));
    }

    function createTileTexture(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      [0x1c231f, 0x303832, 0x3d3328, 0x544425, 0x6c2923].forEach((fill, index) => {
        g.fillStyle(fill, 1); g.fillRect(index * 64, 0, 64, 64);
        g.lineStyle(1, index === 0 ? 0x718071 : 0x151a17, .38); g.strokeRect(index * 64 + 1, 1, 62, 62);
        if (index === 2) { g.fillStyle(0x111713, 1); g.fillRect(index * 64 + 12, 13, 40, 38); }
        if (index === 4) { g.fillStyle(0xb49a38, 1); for (let x = 0; x < 64; x += 18) g.fillRect(index * 64 + x, 45, 10, 7); }
      });
      g.generateTexture('factory-tiles', 320, 64); g.destroy();
    }

    function createDustTexture(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xd6cf9f, .7); g.fillCircle(4, 4, 4); g.generateTexture('factory-dust', 8, 8); g.destroy();
    }

    function create() {
      sceneRef = this;
      createTileTexture(this); createDustTexture(this);
      this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
      this.mapLayer = null; this.floor = -1;
      this.dynamic = this.add.graphics().setDepth(8);
      this.lightLayer = this.add.graphics().setDepth(9);
      this.fogLayer = this.add.graphics().setDepth(10);
      this.playerSprite = this.add.circle(0, 0, 10, 0xd8d4bb, .98).setDepth(20);
      this.playerSprite.setStrokeStyle(2, 0x89948a, .9);
      this.particles = this.add.particles(0, 0, 'factory-dust', {
        speed: { min: 3, max: 12 }, angle: { min: 0, max: 360 }, scale: { start: .35, end: 0 },
        alpha: { start: .22, end: 0 }, lifespan: 4200, frequency: 120, quantity: 1, emitting: true, blendMode: 'ADD'
      }).setDepth(18);
    }

    function rebuildMap(scene, floor) {
      const map = maps[floor];
      if (!map) return;
      if (scene.mapLayer) scene.mapLayer.destroy();
      const tilemap = scene.make.tilemap({ data: tileValues(map), tileWidth: 64, tileHeight: 64 });
      const tileset = tilemap.addTilesetImage('factory-tiles', 'factory-tiles', 64, 64, 0, 0);
      scene.mapLayer = tilemap.createLayer(0, tileset, 0, 0).setDepth(0);
      scene.mapLayer.setCollision([1, 2, 3, 4]);
      scene.tilemap = tilemap; scene.floor = floor;
    }

    function drawActor(graphics, actor, kind) {
      const x = actor.x * 64, y = actor.y * 64;
      graphics.fillStyle(kind === 'worker' ? 0x9a7332 : 0x050707, .98);
      graphics.fillCircle(x, y, kind === 'worker' ? 11 : 14);
      if (kind === 'worker') { graphics.fillStyle(0xd0b64b, 1); graphics.fillCircle(x, y - 5, 7); }
      else { graphics.fillStyle(actor.kind === 'warden' ? 0xd4bd51 : 0xbb3e32, 1); graphics.fillCircle(x - 4, y - 5, 2); graphics.fillCircle(x + 4, y - 5, 2); }
    }

    function drawLighting(scene, player) {
      const state = getState(), now = performance.now() / 1000;
      scene.lightLayer.clear(); scene.lightLayer.setBlendMode(Phaser.BlendModes.SCREEN);
      for (const lamp of industrialLights.filter(light => light.floor === player.floor)) {
        const x = lamp.x * 64, y = lamp.y * 64, pulse = .82 + Math.sin(now * 1.7 + x) * .08;
        scene.lightLayer.fillStyle(0xc99558, .08 * pulse); scene.lightLayer.fillCircle(x, y, lamp.radius * 64);
        scene.lightLayer.fillStyle(0xf1c47b, .18 * pulse); scene.lightLayer.fillCircle(x, y, 5);
      }
      scene.lightLayer.fillStyle(0xe8d7a4, state.flash && state.battery > 0 ? .2 : .04);
      scene.lightLayer.fillCircle(player.x * 64, player.y * 64, state.flash ? 105 : 48);
      scene.lightLayer.setBlendMode(Phaser.BlendModes.NORMAL);
      scene.fogLayer.clear(); scene.fogLayer.fillStyle(0x020303, .16); scene.fogLayer.fillRect(0, 0, maps[0][0].length * 64, maps[0].length * 64);
    }

    function update() {
      const scene = sceneRef, state = getState(), player = getPlayer();
      canvas.style.display = state.viewMode === '2d' ? 'block' : 'none';
      if (!scene || state.viewMode !== '2d') return;
      if (scene.floor !== player.floor) rebuildMap(scene, player.floor);
      scene.playerSprite.setPosition(player.x * 64, player.y * 64);
      scene.dynamic.clear();
      for (const prop of scenery.concat(obstacles).filter(item => item.floor === player.floor)) {
        scene.dynamic.fillStyle(prop.type === 'forklift' ? 0xaa852d : 0x53605a, .9);
        scene.dynamic.fillRect(prop.x * 64 - 12, prop.y * 64 - 12, 24, 24);
      }
      for (const worker of workers) if (worker.floor === player.floor && worker.alive) drawActor(scene.dynamic, worker, 'worker');
      drawLighting(scene, player);
      scene.cameras.main.startFollow(scene.playerSprite, true, .12, .12);
      scene.cameras.main.setBounds(0, 0, maps[0][0].length * 64, maps[0].length * 64);
    }

    return { ready: true, canvas, game };
  }

  window.CursedFactoryPhaser = { create: createPhaserView };
})();
