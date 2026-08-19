(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const v = (x = 0, y = 0, z = 0) => new B.Vector3(x, y, z);
  const color = hex => B.Color3.FromHexString(hex);

  function createFactoryView({ canvas, maps, connectors, scenery, machineryColliders = [], obstacles, doors, objects, monsters, workers, getState, getPlayer }) {
    let engine;
    try {
      engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    } catch (error) {
      console.warn('Babylon factory renderer unavailable:', error);
      return { ready: false, canvas };
    }

    const scene = new B.Scene(engine);
    scene.collisionsEnabled = true;
    const CELL_SPACING = 1.5;
    const FLOOR_HEIGHT = 3.8;
    const mapWidth = maps[0][0].length, mapHeight = maps[0].length;
    const worldWidth = mapWidth * CELL_SPACING, worldHeight = mapHeight * CELL_SPACING;
    const worldX = x => x * CELL_SPACING;
    const worldZ = z => z * CELL_SPACING;
    const floorY = floor => floor * FLOOR_HEIGHT;
    scene.clearColor = new B.Color4(.006, .009, .008, 1);
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogDensity = .038 / CELL_SPACING;
    scene.fogColor = color('#080d0b');
    scene.imageProcessingConfiguration.exposure = .78;
    scene.imageProcessingConfiguration.contrast = 1.28;

    const camera = new B.UniversalCamera('factory-camera', v(1.5, 1.55, 1.5), scene);
    camera.minZ = .035;
    camera.maxZ = 55 * CELL_SPACING;
    camera.fov = 1.02;
    camera.inputs.clear();

    const material = (name, diffuse, { emissive = '#000000', specular = '#111511', alpha = 1 } = {}) => {
      const m = new B.StandardMaterial(name, scene);
      m.diffuseColor = color(diffuse);
      m.emissiveColor = color(emissive);
      m.specularColor = color(specular);
      m.alpha = alpha;
      return m;
    };

    const mats = {
      floor: material('oil-dark concrete', '#1b211e', { specular: '#34392f' }),
      seam: material('recessed floor seam', '#242a26', { specular: '#303630' }),
      wall: material('riveted steel', '#333b37', { specular: '#4e554d' }),
      wallAlt: material('oxidized steel', '#3d3025', { specular: '#33271f' }),
      machine: material('machine enamel', '#29332f', { specular: '#687069' }),
      machineDark: material('machine recess', '#0c100e'),
      steel: material('bare steel', '#626a64', { specular: '#959d94' }),
      rubber: material('rubber', '#0b0d0c'),
      belt: material('conveyor belt', '#151a18', { specular: '#292f2b' }),
      rust: material('rust', '#633821'),
      copper: material('copper pipe', '#76502e', { specular: '#8c6c45' }),
      yellow: material('safety yellow', '#9b7925', { emissive: '#160f02' }),
      paper: material('paper', '#b9b49b', { emissive: '#17160f' }),
      worker: material('worker coat', '#846226'),
      helmet: material('safety helmet', '#c5a938', { emissive: '#151002' }),
      monster: material('monster', '#030504'),
      red: material('red indicator', '#40100c', { emissive: '#d13e31' }),
      green: material('green indicator', '#1c3215', { emissive: '#9fc34e' }),
      lock: material('lock indicator', '#534b13', { emissive: '#d8c84d' }),
      steam: material('steam', '#bac7c0', { emissive: '#171d1a', alpha: .12 })
    };

    const box = (name, size, position, mat, parent = null) => {
      const mesh = B.MeshBuilder.CreateBox(name, size, scene);
      if (parent) mesh.parent = parent;
      mesh.position.copyFrom(position);
      mesh.material = mat;
      return mesh;
    };
    const cylinder = (name, options, position, mat, parent = null) => {
      const mesh = B.MeshBuilder.CreateCylinder(name, options, scene);
      if (parent) mesh.parent = parent;
      mesh.position.copyFrom(position);
      mesh.material = mat;
      return mesh;
    };
    const sphere = (name, diameter, position, mat, parent = null) => {
      const mesh = B.MeshBuilder.CreateSphere(name, { diameter, segments: 10 }, scene);
      if (parent) mesh.parent = parent;
      mesh.position.copyFrom(position);
      mesh.material = mat;
      return mesh;
    };
    const rootAt = (name, x, z, floor = 0) => {
      const root = new B.TransformNode(name, scene);
      root.position.set(worldX(x), floorY(floor), worldZ(z));
      return root;
    };
    const edge = mesh => {
      mesh.enableEdgesRendering();
      mesh.edgesWidth = 1.4;
      mesh.edgesColor = new B.Color4(.04, .055, .048, .72);
      return mesh;
    };
    const indicator = (parent, x, y, z, mat = mats.red, diameter = .055) => sphere('indicator', diameter, v(x, y, z), mat, parent);

    for (let floor = 0; floor < maps.length; floor++) {
      const base = floorY(floor);
      const ground = B.MeshBuilder.CreateGround(`factory floor L${floor + 1}`, { width: worldWidth, height: worldHeight, subdivisions: Math.max(worldWidth, worldHeight) }, scene);
      ground.position.set(worldWidth / 2, base, worldHeight / 2);
      ground.material = mats.floor;
      ground.receiveShadows = true;
      box(`factory ceiling L${floor + 1}`, { width: worldWidth, height: .12, depth: worldHeight }, v(worldWidth / 2, base + 3.22, worldHeight / 2), mats.machineDark);
      for (let i = 1; i < mapWidth; i++) box(`floor seam x ${floor}-${i}`, { width: .009, height: .006, depth: worldHeight }, v(worldX(i), base + .006, worldHeight / 2), mats.seam);
      for (let i = 1; i < mapHeight; i++) box(`floor seam z ${floor}-${i}`, { width: worldWidth, height: .006, depth: .009 }, v(worldWidth / 2, base + .006, worldZ(i)), mats.seam);
    }

    const ambient = new B.HemisphericLight('cold ambient', v(0, 1, 0), scene);
    ambient.diffuse = color('#68736a');
    ambient.groundColor = color('#090b0a');
    ambient.intensity = .19;

    const flashlight = new B.SpotLight('flashlight', camera.position.clone(), v(1, -.06, 0), 1.12, 7, scene);
    flashlight.diffuse = color('#f1dfad');
    flashlight.specular = color('#cfc5a6');
    flashlight.range = 12 * CELL_SPACING;
    flashlight.intensity = 3.8;

    for (let floor = 0; floor < maps.length; floor++) for (const [x, z] of [[.13,.32],[.38,.32],[.63,.32],[.86,.32],[.23,.68],[.5,.68],[.78,.68]].map(([x,z])=>[x*worldWidth,z*worldHeight])) {
      const lamp = new B.PointLight(`red cage lamp ${floor}-${x}-${z}`, v(x, floorY(floor) + 2.72, z), scene);
      lamp.diffuse = floor ? color('#b64b28') : color('#9e2e24');
      lamp.range = 4.2 * CELL_SPACING;
      lamp.intensity = .34;
      cylinder('lamp cage', { height: .22, diameter: .14, tessellation: 8 }, v(x, floorY(floor) + 2.76, z), mats.red).rotation.z = Math.PI / 2;
    }

    const rotors = [];
    const pressHeads = [];
    const flickers = [];
    const steamPuffs = [];

    function createMachineBank(x, z, variant = 0, floor = 0) {
      const root = rootAt(`machine bank ${floor}-${x}-${z}`, x, z, floor);
      box('machine bay plinth', { width: CELL_SPACING * .9, height: .08, depth: CELL_SPACING * .9 }, v(0, .04, 0), mats.machineDark, root);
      edge(box('machine bank body', { width: .88, height: 2.35, depth: .88 }, v(0, 1.18, 0), variant % 2 ? mats.wallAlt : mats.machine, root));
      box('machine bank panel', { width: .58, height: .62, depth: .035 }, v(0, 1.35, -.455), mats.machineDark, root);
      for (let i = -1; i <= 1; i++) indicator(root, i * .16, 1.58, -.48, i === 0 ? mats.green : mats.red);
      for (let i = -2; i <= 2; i++) box('vent slot', { width: .08, height: .018, depth: .025 }, v(i * .11, 1.08, -.48), mats.steel, root);
      const wheel = cylinder('machine handwheel', { height: .04, diameter: .3, tessellation: 14 }, v(.2, .72, -.49), mats.yellow, root);
      wheel.rotation.x = Math.PI / 2;
      rotors.push({ mesh: wheel, axis: 'z', speed: .35 + variant * .05 });
      return root;
    }

    function createDoor(d) {
      const root = rootAt(d.name, d.x + .5, d.y + .5, d.floor);
      const vertical = d.orientation === 'vertical';
      const span = CELL_SPACING - .14, jambOffset = CELL_SPACING / 2 - .02;
      const panel = edge(box('sliding door panel', vertical ? { width: .14, height: 2.72, depth: span } : { width: span, height: 2.72, depth: .14 }, v(0, 1.38, 0), mats.machine, root));
      const statusMat = material(`${d.id} status`, '#3a100d', { emissive: '#c04436' });
      const status = sphere('door status', .105, vertical ? v(.11, 2.35, -.34) : v(.34, 2.35, -.11), statusMat, root);
      if (vertical) {
        box('door jamb', { width: .24, height: 3, depth: .12 }, v(0, 1.5, -jambOffset), mats.steel, root);
        box('door jamb', { width: .24, height: 3, depth: .12 }, v(0, 1.5, jambOffset), mats.steel, root);
      } else {
        box('door jamb', { width: .12, height: 3, depth: .24 }, v(-jambOffset, 1.5, 0), mats.steel, root);
        box('door jamb', { width: .12, height: 3, depth: .24 }, v(jambOffset, 1.5, 0), mats.steel, root);
      }
      box('hazard rail', vertical ? { width: .17, height: .12, depth: span - .14 } : { width: span - .14, height: .12, depth: .17 }, v(0, .22, 0), mats.yellow, root);
      return { root, panel, status, statusMat, vertical };
    }

    function createGate(name, x, z, floor = 0) {
      const root = rootAt(name, x + .5, z + .5, floor);
      const span = CELL_SPACING - .14;
      const panel = edge(box(`${name} panel`, { width: span, height: 2.8, depth: .16 }, v(0, 1.42, 0), mats.machine, root));
      for (let i = -3; i <= 3; i++) box('gate hazard stripe', { width: .14, height: .14, depth: .025 }, v(i * .18, .32, -.095), i % 2 ? mats.yellow : mats.rubber, root);
      indicator(root, span / 2 - .12, 2.3, -.11, mats.red, .09);
      return { root, panel };
    }

    const doorViews = new Map();
    const gateViews = {};
    for (let floor = 0; floor < maps.length; floor++) for (let z = 0; z < maps[floor].length; z++) for (let x = 0; x < maps[floor][z].length; x++) {
      const tile = maps[floor][z][x], base = floorY(floor);
      if (tile === '1') edge(box(`wall ${floor}-${x}-${z}`, { width: CELL_SPACING - .02, height: 3, depth: CELL_SPACING - .02 }, v(worldX(x + .5), base + 1.5, worldZ(z + .5)), (x * 3 + z + floor) % 7 === 0 ? mats.wallAlt : mats.wall));
      else if (tile === '2') createMachineBank(x + .5, z + .5, (x + z) % 3, floor);
      else if (tile === 'D') {
        const door = doors.find(item => item.floor === floor && item.x === x && item.y === z);
        if (door) doorViews.set(door.id, createDoor(door));
      } else if (tile === 'B') gateViews.power = createGate('powered fire door', x, z, floor);
      else if (tile === 'E') gateViews.exit = createGate('north security gate', x, z, floor);
    }

    for (let floor = 0; floor < maps.length; floor++) for (const [z, x1, x2] of [[5.35, 1, 8], [5.35, 12, mapWidth-2], [11.35, 2, 8], [11.35, 12, mapWidth-2]]) {
      const pipe = cylinder('overhead utility pipe', { height: worldX(x2 - x1), diameter: .13, tessellation: 10 }, v(worldX((x1 + x2) / 2), floorY(floor) + 2.68, worldZ(z)), mats.copper);
      pipe.rotation.z = Math.PI / 2;
      for (let x = x1; x <= x2; x += 2) cylinder('pipe collar', { height: .09, diameter: .2, tessellation: 10 }, v(worldX(x), floorY(floor) + 2.68, worldZ(z)), mats.steel).rotation.z = Math.PI / 2;
    }

    const stairConnector = connectors.find(c => c.type === 'stairs');
    if (stairConnector) {
      const root = rootAt('two-level industrial staircase', stairConnector.x + .5, stairConnector.y + .5, 0);
      const flightSteps = 6, tread = .24, rise = FLOOR_HEIGHT / (flightSteps * 2);
      for (let i = 0; i < flightSteps; i++) {
        const lowerHeight = rise * (i + 1), lowerZ = -.72 + tread * (i + .5);
        box('lower steel stair tread', { width: .58, height: lowerHeight, depth: tread - .02 }, v(-.36, lowerHeight / 2, lowerZ), i % 2 ? mats.steel : mats.wallAlt, root);
        box('lower stair guard post', { width: .045, height: .7, depth: .045 }, v(-.69, lowerHeight + .3, lowerZ), mats.yellow, root);
        const upperHeight = rise * (flightSteps + i + 1), upperZ = .72 - tread * (i + .5);
        box('upper steel stair tread', { width: .58, height: upperHeight - FLOOR_HEIGHT / 2, depth: tread - .02 }, v(.36, FLOOR_HEIGHT / 2 + (upperHeight - FLOOR_HEIGHT / 2) / 2, upperZ), i % 2 ? mats.wallAlt : mats.steel, root);
        box('upper stair guard post', { width: .045, height: .7, depth: .045 }, v(.69, upperHeight + .3, upperZ), mats.yellow, root);
      }
      box('stair lower landing', { width: .72, height: .12, depth: .72 }, v(-.36, .06, -.86), mats.steel, root);
      box('stair switchback landing', { width: 1.48, height: .12, depth: .72 }, v(0, FLOOR_HEIGHT / 2 + .06, .86), mats.steel, root);
      box('stair upper landing', { width: .72, height: .12, depth: .72 }, v(.36, FLOOR_HEIGHT + .06, -.86), mats.steel, root);
    }

    let elevatorCab = null;
    const elevatorConnector = connectors.find(c => c.type === 'elevator');
    if (elevatorConnector) {
      const shaft = rootAt('freight elevator shaft', elevatorConnector.x + .5, elevatorConnector.y + .5, 0);
      const shaftHeight = FLOOR_HEIGHT + 3;
      for (const x of [-.69,.69]) for (const z of [-.69,.69]) box('elevator shaft column', { width: .1, height: shaftHeight, depth: .1 }, v(x, shaftHeight / 2, z), mats.steel, shaft);
      for (const y of [0,FLOOR_HEIGHT]) box('elevator landing header', { width: 1.48, height: .16, depth: .12 }, v(0, y + 2.72, -.7), mats.yellow, shaft);
      elevatorCab = new B.TransformNode('freight elevator cab', scene);elevatorCab.parent=shaft;
      box('elevator platform', { width: 1.28, height: .12, depth: 1.28 }, v(0, .06, 0), mats.steel, elevatorCab);
      box('elevator back', { width: 1.28, height: 2.45, depth: .1 }, v(0, 1.25, .61), mats.machine, elevatorCab);
      for (const x of [-.61,.61]) box('elevator cage side', { width: .08, height: 2.45, depth: 1.2 }, v(x, 1.25, 0), mats.machine, elevatorCab);
      indicator(elevatorCab, .48, 2.3, -.61, mats.green, .08);
    }

    function createConveyor(s) {
      const root = rootAt('roller conveyor', s.x, s.y, s.floor);
      root.rotation.y = (Math.floor(s.x + s.y) % 2) * Math.PI / 2;
      box('conveyor frame', { width: .92, height: .14, depth: 1.55 }, v(0, .48, 0), mats.steel, root);
      box('moving belt', { width: .79, height: .08, depth: 1.45 }, v(0, .58, 0), mats.belt, root);
      for (let z = -.62; z <= .63; z += .21) {
        const roller = cylinder('conveyor roller', { height: .82, diameter: .09, tessellation: 10 }, v(0, .61, z), mats.steel, root);
        roller.rotation.z = Math.PI / 2;
        rotors.push({ mesh: roller, axis: 'x', speed: 2.4 });
      }
      for (const x of [-.39, .39]) for (const z of [-.58, .58]) box('conveyor leg', { width: .08, height: .45, depth: .08 }, v(x, .23, z), mats.machine, root);
    }

    function createPress(s) {
      const root = rootAt('hydraulic stamping press', s.x, s.y, s.floor);
      box('press foot', { width: .95, height: .18, depth: .75 }, v(0, .09, 0), mats.machineDark, root);
      for (const x of [-.39, .39]) box('press upright', { width: .17, height: 2.2, depth: .5 }, v(x, 1.18, 0), mats.machine, root);
      box('press crown', { width: .95, height: .32, depth: .58 }, v(0, 2.25, 0), mats.machine, root);
      cylinder('hydraulic ram', { height: .82, diameter: .18, tessellation: 12 }, v(0, 1.72, 0), mats.steel, root);
      const head = box('press head', { width: .56, height: .21, depth: .46 }, v(0, 1.26, 0), mats.yellow, root);
      pressHeads.push({ mesh: head, base: 1.26, phase: s.x });
      box('press bed', { width: .72, height: .16, depth: .55 }, v(0, .56, 0), mats.steel, root);
      indicator(root, -.28, 2.27, -.31, mats.red, .07);
      indicator(root, -.13, 2.27, -.31, mats.green, .07);
    }

    function createTank(s, compact = false) {
      const root = rootAt(compact ? 'boiler' : 'pressure tank', s.x, s.y, s.floor);
      const body = cylinder('pressure vessel', { height: compact ? 1.35 : 2, diameter: compact ? .62 : .76, tessellation: 18 }, v(0, compact ? .78 : 1.08, 0), mats.machine, root);
      body.rotation.y = Math.PI / 12;
      for (const y of compact ? [.35, 1.2] : [.35, 1.75]) cylinder('tank band', { height: .065, diameter: compact ? .67 : .82, tessellation: 18 }, v(0, y, 0), mats.steel, root);
      const gauge = cylinder('pressure gauge', { height: .045, diameter: .24, tessellation: 18 }, v(.31, compact ? 1.05 : 1.36, -.23), mats.paper, root);
      gauge.rotation.x = Math.PI / 2;
      cylinder('tank outlet', { height: .5, diameter: .11, tessellation: 10 }, v(0, compact ? 1.7 : 2.28, 0), mats.copper, root);
    }

    function createPump(s) {
      const root = rootAt('centrifugal pump', s.x, s.y, s.floor);
      box('pump skid', { width: 1.15, height: .12, depth: .65 }, v(0, .08, 0), mats.steel, root);
      const motor = cylinder('pump motor', { height: .58, diameter: .42, tessellation: 14 }, v(-.28, .44, 0), mats.machine, root);
      motor.rotation.z = Math.PI / 2;
      const housing = sphere('pump volute', .58, v(.34, .46, 0), mats.rust, root);
      housing.scaling.z = .5;
      const wheel = B.MeshBuilder.CreateTorus('pump flywheel', { diameter: .5, thickness: .075, tessellation: 18 }, scene);
      wheel.parent = root; wheel.position.set(.34, .46, -.29); wheel.rotation.x = Math.PI / 2; wheel.material = mats.yellow;
      rotors.push({ mesh: wheel, axis: 'z', speed: 2.2 });
      cylinder('pump discharge', { height: .74, diameter: .13, tessellation: 10 }, v(.34, .96, 0), mats.copper, root);
    }

    function createTurbine(s) {
      const root = rootAt('floor turbine', s.x, s.y, s.floor);
      box('turbine plinth', { width: 1.35, height: .16, depth: .75 }, v(0, .08, 0), mats.steel, root);
      const shell = cylinder('turbine casing', { height: 1.02, diameter: .68, tessellation: 18 }, v(0, .6, 0), mats.machine, root);
      shell.rotation.z = Math.PI / 2;
      const rotor = new B.TransformNode('turbine rotor', scene);rotor.parent = root;rotor.position.set(-.53, .6, 0);rotor.rotation.z = Math.PI / 2;
      cylinder('turbine hub', { height: .1, diameter: .2, tessellation: 12 }, v(0, 0, 0), mats.rust, rotor);
      for (let i = 0; i < 6; i++) { const blade = box('turbine blade', { width: .08, height: .38, depth: .045 }, v(0, .19, 0), mats.steel, rotor);blade.rotation.y = i * Math.PI / 3;blade.rotation.z = i * Math.PI / 3; }
      rotors.push({ mesh: rotor, axis: 'x', speed: 3.5 });
      cylinder('turbine pipe', { height: .8, diameter: .15, tessellation: 10 }, v(.38, 1.05, 0), mats.copper, root);
    }

    function createLathe(s) {
      const root = rootAt('engine lathe', s.x, s.y, s.floor);
      box('lathe bed', { width: 1.45, height: .17, depth: .56 }, v(0, .5, 0), mats.steel, root);
      box('lathe cabinet', { width: 1.32, height: .48, depth: .5 }, v(0, .24, 0), mats.machine, root);
      box('headstock', { width: .44, height: .62, depth: .52 }, v(-.46, .84, 0), mats.machine, root);
      const spindle = cylinder('lathe chuck', { height: .16, diameter: .33, tessellation: 12 }, v(-.19, .86, 0), mats.rust, root);
      spindle.rotation.z = Math.PI / 2;
      rotors.push({ mesh: spindle, axis: 'x', speed: 3 });
      cylinder('lathe stock', { height: .68, diameter: .1, tessellation: 10 }, v(.18, .86, 0), mats.steel, root).rotation.z = Math.PI / 2;
      box('tool carriage', { width: .26, height: .28, depth: .42 }, v(.24, .72, 0), mats.yellow, root);
    }

    function createRobotArm(s) {
      const root = rootAt('assembly robot', s.x, s.y, s.floor);
      cylinder('robot pedestal', { height: .26, diameter: .65, tessellation: 14 }, v(0, .13, 0), mats.machine, root);
      const shoulder = new B.TransformNode('robot shoulder', scene);shoulder.parent = root;shoulder.position.set(0, .34, 0);
      cylinder('robot joint', { height: .32, diameter: .34, tessellation: 12 }, v(0, 0, 0), mats.yellow, shoulder).rotation.x = Math.PI / 2;
      const upper = box('robot upper arm', { width: .22, height: .86, depth: .24 }, v(.18, .4, 0), mats.yellow, shoulder);upper.rotation.z = -.42;
      const elbow = sphere('robot elbow', .29, v(.36, .78, 0), mats.machineDark, shoulder);
      const forearm = box('robot forearm', { width: .2, height: .72, depth: .2 }, v(.58, 1.03, 0), mats.yellow, shoulder);forearm.rotation.z = -.85;
      const claw = box('robot gripper', { width: .34, height: .12, depth: .28 }, v(.82, 1.27, 0), mats.steel, shoulder);
      rotors.push({ mesh: shoulder, axis: 'y', speed: .16, oscillate: true, phase: s.x });
    }

    function createFan(s) {
      const root = rootAt('ventilation fan', s.x, s.y, s.floor);
      edge(box('fan housing', { width: .86, height: .86, depth: .18 }, v(0, 1.42, 0), mats.machine, root));
      const rotor = new B.TransformNode('fan rotor', scene);rotor.parent = root;rotor.position.set(0, 1.42, -.13);
      sphere('fan hub', .17, v(0, 0, 0), mats.yellow, rotor);
      for (let i = 0; i < 5; i++) {const blade=box('fan blade',{width:.13,height:.58,depth:.05},v(0,.26,0),mats.rubber,rotor);blade.rotation.z=i*Math.PI*2/5+.25}
      rotors.push({ mesh: rotor, axis: 'z', speed: 3.8 });
    }

    function createGenerator(s) {
      const root = rootAt('diesel generator', s.x, s.y, s.floor);
      edge(box('generator body', { width: 1.05, height: .95, depth: .72 }, v(0, .55, 0), mats.machine, root));
      box('generator grille', { width: .58, height: .48, depth: .035 }, v(0, .61, -.38), mats.machineDark, root);
      for(let x=-.22;x<=.22;x+=.11)box('grille bar',{width:.035,height:.4,depth:.02},v(x,.61,-.405),mats.steel,root);
      cylinder('generator exhaust', { height: .75, diameter: .13, tessellation: 10 }, v(.38, 1.32, .18), mats.rust, root);
      indicator(root, -.39, .94, -.39, mats.red, .07);
    }

    function createSimpleProp(s) {
      const root = rootAt(s.type, s.x, s.y, s.floor);
      if (s.type === 'barrels') for (const [x,z,y] of [[-.18,0,.39],[.2,.06,.39],[0,.2,1.05]]) cylinder('oil drum',{height:.75,diameter:.4,tessellation:14},v(x,y,z),mats.wallAlt,root);
      else if (s.type === 'crate' || s.type === 'pallet') edge(box(s.type,{width:.72,height:s.type==='crate'?.72:.18,depth:.72},v(0,s.type==='crate'?.36:.09,0),mats.rust,root));
      else if (s.type === 'cabinet') {edge(box('electrical cabinet',{width:.62,height:1.6,depth:.42},v(0,.8,0),mats.machine,root));box('cabinet panel',{width:.42,height:.55,depth:.03},v(0,1.05,-.225),mats.machineDark,root);indicator(root,-.1,1.18,-.25,mats.red);indicator(root,.08,1.18,-.25,mats.green)}
      else if (s.type === 'workbench') {box('bench top',{width:1.25,height:.13,depth:.62},v(0,.82,0),mats.rust,root);for(const x of [-.52,.52])for(const z of [-.22,.22])box('bench leg',{width:.09,height:.8,depth:.09},v(x,.4,z),mats.steel,root);box('bench vice',{width:.22,height:.18,depth:.2},v(.35,.98,-.12),mats.machine,root)}
      else if (s.type === 'forklift') {box('forklift chassis',{width:.75,height:.34,depth:1.05},v(0,.3,0),mats.yellow,root);box('forklift cab',{width:.66,height:.92,depth:.52},v(0,.82,.18),mats.machineDark,root);for(const x of [-.28,.28])for(const z of [-.38,.38]){const wheel=cylinder('forklift wheel',{height:.16,diameter:.35,tessellation:12},v(x,.22,z),mats.rubber,root);wheel.rotation.z=Math.PI/2}for(const x of [-.2,.2])box('fork',{width:.08,height:.06,depth:.85},v(x,.17,-.78),mats.steel,root)}
      else if (s.type === 'jumpBarrier') {box('barrier rail',{width:.92,height:.13,depth:.12},v(0,.55,0),mats.yellow,root);for(const x of [-.4,.4])box('barrier post',{width:.1,height:.62,depth:.1},v(x,.31,0),mats.steel,root)}
      else if (s.type === 'crouchPipe') {const pipe=cylinder('low steam pipe',{height:.95,diameter:.22,tessellation:12},v(0,1.12,0),mats.copper,root);pipe.rotation.z=Math.PI/2;for(const x of [-.36,.36]){const collar=cylinder('pipe flange',{height:.08,diameter:.34,tessellation:12},v(x,1.12,0),mats.steel,root);collar.rotation.z=Math.PI/2}}
      else if (s.type === 'pipe') {cylinder('pipe riser',{height:2.2,diameter:.19,tessellation:12},v(0,1.1,0),mats.copper,root);const valve=B.MeshBuilder.CreateTorus('pipe valve',{diameter:.42,thickness:.055,tessellation:16},scene);valve.parent=root;valve.position.set(0,1.23,-.17);valve.rotation.x=Math.PI/2;valve.material=mats.yellow}
      else if (s.type === 'sign') {box('factory sign',{width:.9,height:.38,depth:.06},v(0,1.55,0),mats.yellow,root);box('sign inset',{width:.76,height:.25,depth:.025},v(0,1.55,-.045),mats.machineDark,root)}
      else if (s.type === 'hook') {const cable=cylinder('hoist cable',{height:2.3,diameter:.035,tessellation:8},v(0,2.05,0),mats.rubber,root);const hook=B.MeshBuilder.CreateTorus('hoist hook',{diameter:.36,thickness:.075,tessellation:16,arc:.72},scene);hook.parent=root;hook.position.set(0,.85,0);hook.material=mats.rust}
      else if (s.type === 'steam') for(let i=0;i<6;i++){const puff=sphere('steam puff',.2+i*.04,v(0,.3+i*.2,0),mats.steam,root);steamPuffs.push({mesh:puff,phase:i*.7+s.x})}
      return root;
    }

    for (const s of scenery) {
      if (s.type === 'conveyor') createConveyor(s);
      else if (s.type === 'pressMachine' || s.type === 'machine') createPress(s);
      else if (s.type === 'boiler') createTank(s, true);
      else if (s.type === 'tank') createTank(s, false);
      else if (s.type === 'pump') createPump(s);
      else if (s.type === 'turbine') createTurbine(s);
      else if (s.type === 'lathe') createLathe(s);
      else if (s.type === 'robotarm') createRobotArm(s);
      else if (s.type === 'fan') createFan(s);
      else if (s.type === 'generator') createGenerator(s);
      else createSimpleProp(s);
    }
    for (const obstacle of obstacles) createSimpleProp(obstacle);

    const collisionMeshes = machineryColliders.map((collider, index) => {
      const mesh = B.MeshBuilder.CreateBox(`machinery collision ${index} ${collider.type}`, {
        width: worldX(collider.width),
        height: collider.height,
        depth: worldZ(collider.depth)
      }, scene);
      mesh.position.set(worldX(collider.x), floorY(collider.floor) + collider.height / 2, worldZ(collider.y));
      mesh.isVisible = false;
      mesh.isPickable = false;
      mesh.checkCollisions = true;
      mesh.metadata = { factoryCollider: true, type: collider.type, standable: collider.standable };
      return mesh;
    });

    const objectViews = new Map();
    for (const o of objects) {
      if (o.type === 'door' || o.type === 'exit' || o.type === 'stairs' || o.type === 'elevator') continue;
      const root = rootAt(o.label, o.x, o.y, o.floor);
      root.position.y += o.floorItem ? .12 : 1.25;
      if (o.mount === 'E' || o.mount === 'W') root.rotation.y = Math.PI / 2;
      const panelMat = ['note','diagram','ventDiagram','craneNote'].includes(o.type) ? mats.paper : o.type === 'alarm' ? mats.red : o.type === 'card' ? mats.green : mats.machine;
      edge(box('interactive wall fixture', { width: .34, height: .46, depth: .09 }, v(0, 0, 0), panelMat, root));
      if (!['note','diagram','ventDiagram','craneNote','secret'].includes(o.type)) indicator(root, -.08, .11, -.055, o.type === 'alarm' ? mats.red : mats.green, .05);
      objectViews.set(o.id, root);
    }

    function createWorker(w) {
      const root = rootAt(w.name, w.x, w.y, w.floor);
      cylinder('worker body', { height: .95, diameterTop: .31, diameterBottom: .4, tessellation: 10 }, v(0, .68, 0), mats.worker, root);
      sphere('worker head', .28, v(0, 1.3, 0), mats.paper, root);
      const helmet = sphere('hard hat', .34, v(0, 1.4, 0), mats.helmet, root);helmet.scaling.y=.45;
      return root;
    }
    function createMonster(m) {
      const root = rootAt(m.kind, m.x, m.y, m.floor);
      if (m.kind === 'crawler') {
        const body=sphere('crawler body',.7,v(0,.35,0),mats.monster,root);body.scaling.set(1,.45,1.45);
        for(const side of [-1,1])for(let z=-.28;z<=.3;z+=.28){const leg=box('crawler leg',{width:.07,height:.06,depth:.58},v(side*.32,.25,z),mats.monster,root);leg.rotation.y=side*.65}
        indicator(root,-.11,.42,-.48,mats.red,.05);indicator(root,.11,.42,-.48,mats.red,.05);
      } else if (m.kind === 'overseer') {
        cylinder('overseer torso',{height:1.75,diameterTop:.38,diameterBottom:.62,tessellation:8},v(0,1.02,0),mats.monster,root);
        edge(box('overseer cage head',{width:.58,height:.58,depth:.5},v(0,2.02,0),mats.machineDark,root));
        for(const x of [-.22,0,.22])box('overseer face bar',{width:.035,height:.48,depth:.035},v(x,2.02,-.27),mats.rust,root);
        for(const side of [-1,1]){const arm=box('overseer arm',{width:.12,height:1.15,depth:.12},v(side*.45,1.08,0),mats.monster,root);arm.rotation.z=side*.22}
        indicator(root,0,2.04,-.3,mats.red,.095);
      } else {
        cylinder('monster torso',{height:m.kind==='warden'?1.7:1.35,diameterTop:.42,diameterBottom:.55,tessellation:9},v(0,m.kind==='warden'?1.03:.84,0),mats.monster,root);
        sphere('monster head',m.kind==='warden'?.54:.42,v(0,m.kind==='warden'?1.95:1.62,0),mats.monster,root);
        indicator(root,-.1,m.kind==='warden'?1.98:1.64,-.23,mats.red,.05);indicator(root,.1,m.kind==='warden'?1.98:1.64,-.23,mats.red,.05);
      }
      return root;
    }
    const workerViews = new Map(workers.map(w => [w.id, createWorker(w)]));
    const monsterViews = new Map(monsters.map(m => [m.id, createMonster(m)]));

    let lastWidth = 0, lastHeight = 0;
    function render() {
      const state = getState(), player = getPlayer(), now = performance.now() / 1000;
      if (canvas.clientWidth !== lastWidth || canvas.clientHeight !== lastHeight) { lastWidth = canvas.clientWidth; lastHeight = canvas.clientHeight; engine.resize(); }
      camera.position.set(worldX(player.x), floorY(player.floor) + (player.crouched ? .92 : 1.56) + player.z, worldZ(player.y));
      camera.rotation.set(0, Math.PI / 2 - player.a, 0);
      flashlight.position.copyFrom(camera.position);
      flashlight.direction.set(Math.cos(player.a), -.045, Math.sin(player.a));
      flashlight.intensity = state.flash && state.battery > 0 ? 3.8 : 0;
      ambient.intensity = state.power ? .3 : .16;

      for (const d of doors) {
        const view = doorViews.get(d.id);if (!view) continue;
        view.panel.isVisible = !d.open;
        view.statusMat.emissiveColor.copyFrom(d.locked ? color('#d8c84d') : d.open ? color('#9fc34e') : color('#c04436'));
        view.statusMat.diffuseColor.copyFrom(d.locked ? color('#534b13') : d.open ? color('#1c3215') : color('#3a100d'));
      }
      if (gateViews.power) gateViews.power.root.setEnabled(!state.power);
      if (gateViews.exit) gateViews.exit.root.setEnabled(!state.won);
      if (elevatorCab) elevatorCab.position.y += (floorY(state.elevatorFloor) - elevatorCab.position.y) * Math.min(1, engine.getDeltaTime() / 500);

      for (const rotor of rotors) {
        if (rotor.oscillate) rotor.mesh.rotation[rotor.axis] = state.power ? Math.sin(now * rotor.speed + rotor.phase) * .42 : 0;
        else if (state.power) rotor.mesh.rotation[rotor.axis] += rotor.speed * engine.getDeltaTime() / 1000;
      }
      for (const press of pressHeads) press.mesh.position.y = press.base - (state.power ? Math.max(0, Math.sin(now * 1.2 + press.phase)) * .35 : 0);
      for (const light of flickers) light.intensity = state.power ? .4 + Math.random() * .7 : 0;
      for (const puff of steamPuffs) {puff.mesh.position.y=.3+((now*.34+puff.phase)%1.5);puff.mesh.position.x=Math.sin(now+puff.phase)*.08}
      for (const o of objects) objectViews.get(o.id)?.setEnabled(o.active);
      for (const w of workers) {
        const root = workerViews.get(w.id);root.position.x=worldX(w.x);root.position.z=worldZ(w.y);root.scaling.y=w.alive?1:.16;root.position.y=floorY(w.floor)+(w.alive?0:.08);
      }
      for (const m of monsters) {
        const root = monsterViews.get(m.id);root.setEnabled(m.active);root.position.x=worldX(m.x);root.position.z=worldZ(m.y);root.position.y=floorY(m.floor);
        if (m.target) root.rotation.y = Math.atan2(m.target.x-m.x,m.target.y-m.y);
      }
      scene.render();
    }

    window.addEventListener('resize', () => engine.resize());
    console.info(`Babylon.js ${B.Engine.Version} factory machinery renderer ready`);
    return { ready: true, canvas, scene, engine, collisionMeshes, render };
  }

  window.CursedFactoryBabylon = { create: createFactoryView };
})();
