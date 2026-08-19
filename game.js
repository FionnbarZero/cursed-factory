(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const canvas = $('#game'), ctx = canvas.getContext('2d', { alpha:false });
  const W=canvas.width,H=canvas.height,SCALE=H/270,FOV=Math.PI/3,MAX=32;
  ctx.imageSmoothingEnabled=true;
  const groundMap=[
    '1111111111111111111111',
    '1000000000E00001000011',
    '100000000000000D000011',
    '1000000000000001000011',
    '1000000220000001111111',
    '1111110220000000000001',
    '1000000000022000000001',
    '1000010000022000022001',
    '1111110000000000000001',
    '1000000011B11000000001',
    '1000002200000000000001',
    '1000002200000000000001',
    '1110110000000000000001',
    '110001000000000111D111',
    '1100010000000221000011',
    '1100010000000221000011',
    '1100010000000001000011',
    '1111111111111111111111'
  ].map(r=>r.split(''));
  groundMap[2][4]='S';
  groundMap[2][19]='L';
  function buildUpperMap(){
    const grid=Array.from({length:18},(_,y)=>Array.from({length:22},(_,x)=>x===0||x===21||y===0||y===17?'1':'0'));
    for(let y=1;y<=5;y++)grid[y][16]='1';
    grid[3][16]='D';
    for(let x=16;x<=20;x++)grid[5][x]='1';
    for(let x=7;x<=15;x++)grid[8][x]='1';
    grid[8][11]='D';
    for(let y=10;y<=16;y++)grid[y][6]='1';
    grid[13][6]='D';
    for(const [x,y] of [[9,3],[10,3],[13,4],[14,4],[2,7],[3,7],[9,12],[10,12],[14,14],[15,14]])grid[y][x]='2';
    grid[2][4]='S';
    grid[2][19]='L';
    return grid;
  }
  const maps=[groundMap,buildUpperMap()];
  const mapFor=(floor=player.floor)=>maps[floor]||maps[0];
  const connectors=[
    {id:'stairs',x:4,y:2,type:'stairs',name:'WEST INDUSTRIAL STAIR'},
    {id:'elevator',x:19,y:2,type:'elevator',name:'FREIGHT ELEVATOR'}
  ];
  function textureNoise(x,y,seed){const n=Math.sin(x*12.9898+y*78.233+seed*41.77)*43758.5453;return n-Math.floor(n)}
  function makeWallTexture(kind,seed){
    const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d'),img=g.createImageData(96,96),bases={concrete:[91,89,79],steel:[63,72,69],rust:[103,66,35],machine:[54,59,54]};
    for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4,n=textureNoise(x,y,seed),coarse=textureNoise(x>>2,y>>2,seed+2);let b=bases[kind]||bases.concrete;if(kind==='hazard')b=((Math.floor((x+y)/14)&1)?[28,29,25]:[154,119,30]);const stain=kind==='concrete'&&coarse>.76?-18:0,rust=kind==='steel'&&coarse>.88?[-8,-22,-27]:[0,0,0],v=(n-.5)*18+stain;img.data[i]=Math.max(0,b[0]+v+rust[0]);img.data[i+1]=Math.max(0,b[1]+v+rust[1]);img.data[i+2]=Math.max(0,b[2]+v+rust[2]);img.data[i+3]=255}g.putImageData(img,0,0);
    if(kind==='steel'||kind==='machine'){g.strokeStyle='rgba(12,16,14,.65)';g.lineWidth=2;g.strokeRect(1,1,94,94);g.beginPath();g.moveTo(0,48);g.lineTo(96,48);g.stroke();g.fillStyle='rgba(190,184,147,.7)';for(const x of [6,90])for(const y of [6,46,52,90]){g.beginPath();g.arc(x,y,1.6,0,Math.PI*2);g.fill()}}
    if(kind==='concrete'){g.strokeStyle='rgba(31,30,26,.42)';g.lineWidth=1;g.beginPath();g.moveTo(7,29);g.lineTo(24,35);g.lineTo(20,54);g.lineTo(37,66);g.moveTo(72,3);g.lineTo(67,22);g.lineTo(78,34);g.stroke();g.fillStyle='rgba(42,35,27,.22)';g.fillRect(0,76,96,20)}
    if(kind==='rust'){const grd=g.createLinearGradient(0,0,0,96);grd.addColorStop(0,'rgba(34,25,18,.1)');grd.addColorStop(1,'rgba(42,17,7,.55)');g.fillStyle=grd;g.fillRect(0,0,96,96);g.strokeStyle='rgba(33,19,11,.65)';for(let x=8;x<96;x+=19){g.beginPath();g.moveTo(x,0);g.lineTo(x+3,45+textureNoise(x,1,seed)*45);g.stroke()}}
    return c;
  }
  const wallTextures={concrete:makeWallTexture('concrete',1),steel:makeWallTexture('steel',2),rust:makeWallTexture('rust',3),machine:makeWallTexture('machine',4),hazard:makeWallTexture('hazard',5)};
  const dust=Array.from({length:54},(_,i)=>({x:textureNoise(i,2,9)*W,y:textureNoise(i,4,3)*H,z:.25+textureNoise(i,7,5)*1.4,r:.45+textureNoise(i,8,8)*1.5}));
  const TILE=64,lightCanvas=document.createElement('canvas'),lightCtx=lightCanvas.getContext('2d');lightCanvas.width=W;lightCanvas.height=H;
  const safeRooms=[
    {floor:0,x:16,y:1,w:4,h:3,n:'LOCKABLE OFFICE'},
    {floor:0,x:16,y:14,w:4,h:3,n:'SAFE TOOL CRIB'},
    {floor:1,x:17,y:1,w:4,h:4,n:'UPPER CONTROL OFFICE'}
  ];
  const zones=[
    ...safeRooms,
    {floor:0,x:0,y:0,w:7,h:9,n:'RECEIVING'}, {floor:0,x:7,y:0,w:8,h:9,n:'PRESS HALL'}, {floor:0,x:15,y:0,w:7,h:9,n:'ASSEMBLY A'},
    {floor:0,x:0,y:9,w:7,h:9,n:'MAINTENANCE'}, {floor:0,x:7,y:9,w:8,h:9,n:'TURBINE FLOOR'}, {floor:0,x:15,y:9,w:7,h:9,n:'SHIPPING'},
    {floor:1,x:0,y:0,w:7,h:9,n:'UPPER LOADING CATWALK'}, {floor:1,x:7,y:0,w:9,h:9,n:'ROBOTICS DECK'}, {floor:1,x:16,y:0,w:6,h:9,n:'CONTROL MEZZANINE'},
    {floor:1,x:0,y:9,w:7,h:9,n:'VENTILATION PLANT'}, {floor:1,x:7,y:9,w:9,h:9,n:'OVERHEAD CRANE BAY'}, {floor:1,x:16,y:9,w:6,h:9,n:'PAINT AND FINISH'}
  ];
  const state={mode:'menu',viewMode:'2d',start:0,power:false,fuse:false,pressureSolved:false,lineSolved:false,ventilationSolved:false,craneSolved:false,card:false,flash:true,battery:100,stamina:100,secrets:0,deaths:0,code:'',pressure:[0,0,0],ventilation:[0,0,0],lineSequence:[],craneSequence:[],msgTimer:0,step:0,beat:0,machineTimer:2,alarm:0,pressPulse:0,elevatorFloor:0,won:false};
  const player={x:2.5,y:2.5,floor:0,a:0,z:0,jumpVelocity:0,grounded:true,crouched:false,health:100};
  const monsters=[
    {id:'geared',kind:'geared',sx:11.5,sy:15.5,sfloor:0,x:11.5,y:15.5,floor:0,speed:.5,seen:0,pathTimer:0,target:null,active:false,victim:'elias'},
    {id:'crawler',kind:'crawler',sx:19.5,sy:8.5,sfloor:0,x:19.5,y:8.5,floor:0,speed:.72,seen:0,pathTimer:0,target:null,active:false,victim:'ren'},
    {id:'warden',kind:'warden',sx:14.5,sy:10.5,sfloor:0,x:14.5,y:10.5,floor:0,speed:.6,seen:0,pathTimer:0,target:null,active:false,victim:null},
    {id:'overseer',kind:'overseer',sx:13.5,sy:15.5,sfloor:1,x:13.5,y:15.5,floor:1,speed:.66,seen:0,pathTimer:0,target:null,active:false,victim:'mara'}
  ];
  const workers=[
    {id:'elias',name:'ELIAS',sx:19.5,sy:11.5,sfloor:0,x:19.5,y:11.5,floor:0,escapeX:2.5,escapeY:10.5,escapeFloor:0,speed:.31,pathTimer:0,target:null,alive:true},
    {id:'ren',name:'REN',sx:18.5,sy:6.7,sfloor:0,x:18.5,y:6.7,floor:0,escapeX:2.5,escapeY:2.5,escapeFloor:0,speed:.38,pathTimer:0,target:null,alive:true},
    {id:'mara',name:'MARA',sx:18.5,sy:12.5,sfloor:1,x:18.5,y:12.5,floor:1,escapeX:2.5,escapeY:2.5,escapeFloor:0,speed:.36,pathTimer:0,target:null,alive:true}
  ];
  const objects=[
    {id:'note',x:5.5,y:1.09,mount:'N',type:'note',label:'READ MAINTENANCE NOTE',active:true},
    {id:'fuse',x:2.09,y:15.5,mount:'W',type:'fuse',label:'TAKE LINE FUSE',active:true},
    {id:'breaker',x:1.09,y:7.0,mount:'W',type:'breaker',label:'USE MAIN BREAKER',active:true},
    {id:'pressureChart',x:18.5,y:3.91,mount:'S',type:'diagram',label:'READ PRESSURE CHART',active:true},
    {id:'pressurePanel',x:20.91,y:6.5,mount:'E',type:'pressure',label:'OPERATE STEAM MANIFOLD',active:true},
    {id:'linePanel',x:11.5,y:8.91,mount:'S',type:'conveyorPanel',label:'OPERATE LINE CONTROLS',active:true},
    {id:'card',floor:1,x:19.5,y:4.91,mount:'S',type:'card',label:"TAKE FOREMAN'S KEYCARD",active:false},
    {id:'officeDoorControl',x:15.5,y:2.5,type:'door',doorId:'officeDoor',label:'OPERATE OFFICE SLIDING DOOR',active:true},
    {id:'serviceDoorControl',x:18.5,y:13.5,type:'door',doorId:'serviceDoor',label:'OPERATE MAINTENANCE BULKHEAD',active:true},
    {id:'exit',x:10.5,y:1.5,type:'exit',label:'OPEN SECURITY GATE',active:true},
    {id:'alarm',x:19.91,y:2.5,mount:'E',type:'alarm',label:'PULL EMERGENCY ALARM',active:true},
    {id:'locker',x:2.5,y:6.09,mount:'N',type:'locker',label:'SEARCH SUPPLY LOCKER',active:true},
    {id:'pressSwitch',x:7.5,y:9.91,mount:'S',type:'pressSwitch',label:'CYCLE HYDRAULIC PRESS',active:true},
    {id:'secret1',x:1.09,y:10.5,mount:'W',type:'secret',label:'INSPECT WORKER BADGE',active:true},
    {id:'secret2',x:3.5,y:1.09,mount:'N',type:'secret',label:'LISTEN TO RECORDER',active:true},
    {id:'secret3',x:17.5,y:16.91,mount:'S',type:'secret',label:'READ LAST WILL',active:true},
    {id:'groundStairs',floor:0,x:4.5,y:2.5,type:'stairs',label:'CLIMB TO UPPER FACTORY',active:true},
    {id:'upperStairs',floor:1,x:4.5,y:2.5,type:'stairs',label:'DESCEND TO GROUND FACTORY',active:true},
    {id:'groundElevator',floor:0,x:19.5,y:2.5,type:'elevator',label:'CALL FREIGHT ELEVATOR',active:true},
    {id:'upperElevator',floor:1,x:19.5,y:2.5,type:'elevator',label:'USE FREIGHT ELEVATOR',active:true},
    {id:'ventChart',floor:1,x:1.09,y:11.5,mount:'W',type:'ventDiagram',label:'READ AIR-BALANCE CHART',active:true},
    {id:'ventPanel',floor:1,x:5.91,y:11.5,mount:'E',type:'ventilation',label:'CALIBRATE VENTILATION BANK',active:true},
    {id:'craneNote',floor:1,x:9.5,y:8.91,mount:'S',type:'craneNote',label:'READ CRANE START CARD',active:true},
    {id:'cranePanel',floor:1,x:13.5,y:8.91,mount:'S',type:'cranePanel',label:'OPERATE OVERHEAD CRANE',active:true},
    {id:'upperOfficeControl',floor:1,x:16.5,y:3.5,type:'door',doorId:'upperOfficeDoor',label:'OPERATE CONTROL OFFICE DOOR',active:true},
    {id:'upperBayControl',floor:1,x:11.5,y:8.5,type:'door',doorId:'upperBayDoor',label:'OPERATE CRANE BAY BULKHEAD',active:true},
    {id:'upperVentControl',floor:1,x:6.5,y:13.5,type:'door',doorId:'upperVentDoor',label:'OPERATE VENTILATION DOOR',active:true},
    {id:'upperAlarm',floor:1,x:20.91,y:10.5,mount:'E',type:'alarm',label:'PULL UPPER-DECK ALARM',active:true},
    {id:'upperLocker',floor:1,x:17.5,y:5.91,mount:'S',type:'locker',label:'SEARCH UPPER SUPPLY LOCKER',active:true},
    {id:'secret4',floor:1,x:20.91,y:15.5,mount:'E',type:'secret',label:'INSPECT SEALED INCIDENT REPORT',active:true}
  ];
  const obstacles=[
    {id:'jumpGate',x:3.5,y:12.5,type:'jumpBarrier',label:'JUMP INTO THE PARTS CAGE'},
    {id:'crouchGate',x:5.5,y:6.5,type:'crouchPipe',label:'CROUCH INTO THE MAINTENANCE BAY'},
    {id:'upperJumpGate',floor:1,x:8.5,y:6.5,type:'jumpBarrier',label:'JUMP THE CATWALK SAFETY RAIL'},
    {id:'upperCrouchGate',floor:1,x:15.5,y:11.5,type:'crouchPipe',label:'CROUCH UNDER THE VENT TRUNK'}
  ];
  const doors=[
    {id:'officeDoor',x:15,y:2,orientation:'vertical',safeSide:'E',open:false,locked:false,name:'OFFICE SLIDING DOOR'},
    {id:'serviceDoor',x:18,y:13,orientation:'horizontal',safeSide:'S',open:false,locked:false,name:'MAINTENANCE BULKHEAD'},
    {id:'upperOfficeDoor',floor:1,x:16,y:3,orientation:'vertical',safeSide:'E',open:false,locked:false,name:'UPPER CONTROL OFFICE DOOR'},
    {id:'upperBayDoor',floor:1,x:11,y:8,orientation:'horizontal',safeSide:'S',open:false,locked:false,name:'CRANE BAY BULKHEAD'},
    {id:'upperVentDoor',floor:1,x:6,y:13,orientation:'vertical',safeSide:'W',open:false,locked:false,name:'VENTILATION ACCESS DOOR'}
  ];
  const scenery=[
    {x:3.0,y:3.15,type:'forklift'}, {x:6.5,y:2.55,type:'conveyor'},
    {x:9.75,y:4.4,type:'robotarm'}, {x:12.75,y:2.7,type:'lathe'},
    {x:14.0,y:6.1,type:'pressMachine'}, {x:18.2,y:5.9,type:'conveyor'},
    {x:2.5,y:10.0,type:'generator'}, {x:4.6,y:10.4,type:'pump'},
    {x:9.5,y:12.0,type:'turbine'}, {x:12.4,y:12.3,type:'boiler'},
    {x:18.0,y:10.5,type:'lathe'}, {x:19.7,y:7.7,type:'tank'},
    {x:10.0,y:7.8,type:'conveyor'}, {x:15.2,y:8.3,type:'machine'},
    {x:7.6,y:14.5,type:'workbench'}, {x:10.7,y:15.3,type:'pallet'},
    {x:14.8,y:12.0,type:'cabinet'}, {x:19.0,y:12.0,type:'barrels'},
    {x:13.4,y:7.4,type:'steam'}, {x:8.5,y:2.1,type:'hook'},
    {x:6.5,y:9.1,type:'pipe'}, {x:16.0,y:6.2,type:'fan'},
    {x:1.8,y:2.0,type:'crate'}, {x:14.0,y:2.2,type:'barrels'},
    {x:10.4,y:10.5,type:'sign',text:'TURBINE 02'}, {x:7.0,y:16.0,type:'pipe'},
    {floor:1,x:2.4,y:4.4,type:'forklift'}, {floor:1,x:5.8,y:5.4,type:'conveyor'},
    {floor:1,x:8.8,y:2.4,type:'robotarm'}, {floor:1,x:12.3,y:3.1,type:'robotarm'},
    {floor:1,x:14.4,y:6.2,type:'lathe'}, {floor:1,x:18.4,y:7.0,type:'cabinet'},
    {floor:1,x:2.8,y:10.6,type:'fan'}, {floor:1,x:4.7,y:14.7,type:'generator'},
    {floor:1,x:9.1,y:10.5,type:'turbine'}, {floor:1,x:12.5,y:12.5,type:'pressMachine'},
    {floor:1,x:17.6,y:11.0,type:'conveyor'}, {floor:1,x:19.2,y:14.2,type:'tank'},
    {floor:1,x:8.1,y:15.2,type:'workbench'}, {floor:1,x:15.0,y:15.5,type:'barrels'},
    {floor:1,x:11.3,y:6.1,type:'hook'}, {floor:1,x:4.8,y:9.3,type:'pipe'},
    {floor:1,x:18.5,y:4.0,type:'sign',text:'CONTROL DECK'}, {floor:1,x:14.4,y:11.0,type:'steam'}
  ];
  for(const collection of [objects,obstacles,doors,scenery])for(const item of collection)if(item.floor===undefined)item.floor=0;
  const collisionSystem=window.CursedFactoryCollision;
  const machineryColliders=collisionSystem.buildMachineryColliders(scenery);
  const keys={}; let zBuffer=new Float32Array(W),nearObj=null,last=0,audio=null,walkPhase=0,moveBlend=0,viewBob=0,viewSway=0,cameraX=0,cameraY=0,mouseX=W*.7,mouseY=H*.5,lastObstacleHint=0,babylonView=null;

  function ensureBabylonView(){if(babylonView)return babylonView;const factory=window.CursedFactoryBabylon;if(!factory){babylonView={ready:false,canvas};return babylonView}babylonView=factory.create({canvas:$('#babylon-game'),maps,connectors,scenery,machineryColliders,obstacles,doors,objects,monsters,workers,getState:()=>state,getPlayer:()=>player});if(babylonView.ready)$('#game-shell').classList.add('babylon-ready');return babylonView}
  function activeCanvas(){return state.viewMode==='3d'&&babylonView?.ready?babylonView.canvas:canvas}

  function doorAtCell(x,y,floor=player.floor){return doors.find(d=>d.floor===floor&&d.x===x&&d.y===y)}
  function wall(x,y,floor=player.floor){const cx=Math.floor(x),cy=Math.floor(y),t=mapFor(floor)[cy]?.[cx];return !t||t==='1'||t==='2'||(t==='D'&&!doorAtCell(cx,cy,floor)?.open)||(t==='B'&&!state.power)||(t==='E'&&!state.won)}
  function onSafeSide(d,a=player){return d.safeSide==='E'?a.x>d.x+.5:d.safeSide==='W'?a.x<d.x+.5:d.safeSide==='S'?a.y>d.y+.5:a.y<d.y+.5}
  function machineryBlocks(x,y,floor=player.floor,feetHeight=0,radius=0){return collisionSystem.blocks(machineryColliders,x,y,floor,feetHeight,radius)}
  function surfaceHeightAt(x=player.x,y=player.y,floor=player.floor,maxHeight=Infinity){return collisionSystem.surfaceHeightAt(machineryColliders,x,y,floor,maxHeight)}
  function entityWall(entity,x,y,floor=entity.floor){const cx=Math.floor(x),cy=Math.floor(y),door=doorAtCell(cx,cy,floor),canBreach=entity.kind&&door&&!door.open&&!door.locked;return (!canBreach&&wall(x,y,floor))||machineryBlocks(x,y,floor,0,.13)}
  function breachDoor(entity,x,y,floor=entity.floor){const door=doorAtCell(Math.floor(x),Math.floor(y),floor);if(entity.kind&&door&&!door.open&&!door.locked){door.open=true;message(`${door.name} FORCED OPEN // LOCK IT FROM INSIDE`,2600);tone(58,.55,.11,'sawtooth')}}
  function obstacleBlocks(x,y){for(const o of obstacles){if(o.floor===player.floor&&Math.abs(x-o.x)<.43&&Math.abs(y-o.y)<.43){const blocked=o.type==='jumpBarrier'?player.z<.3:!player.crouched;if(blocked&&performance.now()-lastObstacleHint>1500){message(o.type==='jumpBarrier'?'PRESS SPACE TO JUMP THE SAFETY BARRIER':'HOLD C OR CTRL TO CROUCH UNDER THE PIPE',1700);lastObstacleHint=performance.now()}if(blocked)return true}}return false}
  function playerBlocked(x,y){return wall(x,y)||obstacleBlocks(x,y)||machineryBlocks(x,y,player.floor,player.z,.17)}
  function reset(){Object.assign(state,{mode:'play',start:performance.now(),power:false,fuse:false,pressureSolved:false,lineSolved:false,ventilationSolved:false,craneSolved:false,card:false,flash:true,battery:100,stamina:100,secrets:0,deaths:0,code:'',pressure:[0,0,0],ventilation:[0,0,0],lineSequence:[],craneSequence:[],msgTimer:0,beat:0,machineTimer:2,alarm:0,pressPulse:0,elevatorFloor:0,won:false});Object.assign(player,{x:2.5,y:2.5,floor:0,a:0,z:0,jumpVelocity:0,grounded:true,crouched:false,health:100});monsters.forEach(m=>Object.assign(m,{x:m.sx,y:m.sy,floor:m.sfloor,seen:0,pathTimer:0,target:null,active:false}));workers.forEach(w=>Object.assign(w,{x:w.sx,y:w.sy,floor:w.sfloor,pathTimer:0,target:null,alive:true}));doors.forEach(d=>Object.assign(d,{open:false,locked:false}));objects.forEach(o=>o.active=o.id!=='card');$('#inv-fuse').className='';$('#inv-card').className='';setObjective('Find a replacement line fuse');}
  function setObjective(t){$('#objective-text').textContent=t;$('#objective').classList.remove('complete');void $('#objective').offsetWidth;$('#objective').classList.add('complete')}
  function message(t,ms=2600){$('#message').textContent=t;$('#message').classList.add('show');state.msgTimer=ms}
  function show(id,on=true){$(id).classList.toggle('visible',on)}
  function setViewMode(mode){state.viewMode=mode;$('#game-shell').classList.toggle('mode-3d',mode==='3d');if(mode==='3d')ensureBabylonView();$('#view-toggle').textContent=`${mode.toUpperCase()} VIEW · [V]`;if(mode==='3d'&&state.mode==='play')activeCanvas().requestPointerLock?.();else if(mode==='2d'&&document.pointerLockElement)document.exitPointerLock?.();message(`${mode.toUpperCase()} VIEW ENABLED`,1400)}
  function toggleView(){if(state.mode!=='play'&&state.mode!=='paused')return;setViewMode(state.viewMode==='2d'?'3d':'2d')}
  function begin(){show('#briefing',false);show('#menu',false);show('#hud',true);reset();initAudio();}
  function initAudio(){if(audio)return;audio=new (window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sawtooth';osc.frequency.value=44;gain.gain.value=.018;osc.connect(gain).connect(audio.destination);osc.start()}
  function tone(freq,dur=.12,vol=.05,type='square'){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}
  function activateMonster(id){const m=monsters.find(m=>m.id===id);if(m&&!m.active){m.active=true;m.seen=999;tone(m.kind==='crawler'?75:48,.7,.1,'sawtooth')}}
  function openPuzzle(id){state.mode=id.slice(1);show(id);document.exitPointerLock?.()}
  function closePuzzle(){for(const id of ['#pressure','#conveyor','#ventilation','#crane'])show(id,false);state.mode='play'}
  function changeFloor(target,method){
    if(target===player.floor)return;
    if(method==='elevator'&&!state.power){message('FREIGHT ELEVATOR HAS NO POWER',2200);tone(75,.25,.05);return}
    player.floor=target;player.z=0;player.jumpVelocity=0;player.grounded=true;cameraX=0;cameraY=0;
    if(method==='elevator')state.elevatorFloor=target;
    if(target===1){activateMonster('overseer');if(state.lineSolved&&!state.ventilationSolved)setObjective('Balance the upper ventilation system')}
    else if(state.card)setObjective('Reach the ground-floor north security gate');
    monsters.forEach(m=>{m.target=null;m.pathTimer=0});
    message(`${method==='elevator'?'FREIGHT ELEVATOR':'INDUSTRIAL STAIR'} // ${target?'UPPER FACTORY — LEVEL 2':'GROUND FACTORY — LEVEL 1'}`,2600);tone(target?360:240,.35,.06,'square')
  }
  function toggleDoorLock(){if(state.mode!=='play'||nearObj?.type!=='door')return;const door=doors.find(d=>d.id===nearObj.doorId);if(!door)return;if(!onSafeSide(door)){message('THE LOCK CONTROL IS INSIDE THE SAFE ROOM',2200);tone(85,.16,.04);return}if(door.open){message('CLOSE THE DOOR WITH E BEFORE LOCKING',2200);tone(90,.16,.04);return}door.locked=!door.locked;monsters.forEach(m=>{m.target=null;m.pathTimer=0});message(`${door.name} ${door.locked?'LOCKED // SAFE ROOM SECURED':'UNLOCKED'}`,2200);tone(door.locked?520:260,.25,.06,'square')}
  function interact(){if(state.mode!=='play'||!nearObj)return;const o=nearObj;
    if(o.type==='note'){message('MAINT. NOTE: “Wake the line: FOUR — THREE — ONE.”',4500);o.active=false;tone(500)}
    else if(o.type==='diagram'){message('PRESSURE CHART: INTAKE 4 // PRESS 7 // EXHAUST 2',5200);tone(510)}
    else if(o.type==='ventDiagram'){message('AIR-BALANCE CHART: INTAKE 3 // SCRUBBER 1 // EXHAUST 4',5200);tone(510)}
    else if(o.type==='craneNote'){message('CRANE START CARD: HOIST // TROLLEY // MAGNET',4800);tone(500)}
    else if(o.type==='fuse'){state.fuse=true;o.active=false;$('#inv-fuse').classList.add('found');setObjective('Install the fuse at the main breaker');message('LINE FUSE ACQUIRED // SOMETHING HEARD THAT');activateMonster('geared')}
    else if(o.type==='door'){const door=doors.find(d=>d.id===o.doorId);if(!door)return;if(door.locked){message(`DOOR LOCKED // PRESS L ${onSafeSide(door)?'TO UNLOCK':'FROM INSIDE'}`,2000);tone(85,.18,.05);return}const occupied=[player,...workers.filter(w=>w.alive),...monsters.filter(m=>m.active)].some(a=>a.floor===door.floor&&Math.floor(a.x)===door.x&&Math.floor(a.y)===door.y);if(door.open&&occupied){message('DOORWAY OBSTRUCTED // MOVE CLEAR',1800);tone(90,.18,.05)}else{door.open=!door.open;message(`${door.name} ${door.open?'OPEN':'CLOSED // PRESS L INSIDE TO LOCK'}`,2200);tone(door.open?310:145,.22,.055,'square')}}
    else if(o.type==='breaker'){if(state.power){message('THE MAIN LINE IS LIVE')}else if(!state.fuse){message('A REPLACEMENT LINE FUSE IS REQUIRED')}else{state.mode='keypad';show('#keypad');document.exitPointerLock?.();state.code='';drawCode()}}
    else if(o.type==='pressure'){if(!state.power)message('THE STEAM MANIFOLD HAS NO POWER');else if(state.pressureSolved)message('PRESSURE HOLDING AT SAFE OPERATING LEVELS');else openPuzzle('#pressure')}
    else if(o.type==='conveyorPanel'){if(!state.power)message('LINE CONTROLS HAVE NO POWER');else if(!state.pressureSolved)message('STEAM PRESSURE MUST BE EQUALIZED FIRST');else if(state.lineSolved)message('PRODUCTION LINE RUNNING');else openPuzzle('#conveyor')}
    else if(o.type==='ventilation'){if(!state.power)message('VENTILATION CONTROLS HAVE NO POWER');else if(!state.lineSolved)message('GROUND PRODUCTION LINE MUST BE RUNNING');else if(state.ventilationSolved)message('UPPER AIRFLOW HOLDING AT SAFE LEVELS');else openPuzzle('#ventilation')}
    else if(o.type==='cranePanel'){if(!state.power)message('CRANE CONTROLS HAVE NO POWER');else if(!state.ventilationSolved)message('VENTILATION INTERLOCK MUST BE CLEARED');else if(state.craneSolved)message('OVERHEAD CRANE PARKED // CARD CABINET RELEASED');else openPuzzle('#crane')}
    else if(o.type==='stairs')changeFloor(1-o.floor,'stairs')
    else if(o.type==='elevator')changeFloor(1-o.floor,'elevator')
    else if(o.type==='card'){state.card=true;o.active=false;$('#inv-card').classList.add('found');setObjective('Return to the ground-floor north security gate');message("FOREMAN'S KEYCARD ACQUIRED // ALL CREATURES ALERTED");monsters.forEach(m=>{if(m.active)m.seen=999});tone(620,.2,.05)}
    else if(o.type==='exit'){if(!state.power)message('SECURITY GATE HAS NO POWER');else if(!state.lineSolved)message('SECURITY INTERLOCK: PRODUCTION LINE OFFLINE');else if(!state.ventilationSolved||!state.craneSolved)message('UPPER FACTORY INTERLOCKS REMAIN ACTIVE');else if(!state.card)message("FOREMAN'S KEYCARD REQUIRED");else win()}
    else if(o.type==='alarm'){state.alarm=8;monsters.forEach(m=>{if(m.active)m.seen=999});message('EMERGENCY ALARM PULLED // THEY ARE COMING');tone(170,1,.12,'sawtooth')}
    else if(o.type==='locker'){o.active=false;state.battery=100;message('FOUND: FRESH BATTERY + SHIFT ROSTER');tone(650)}
    else if(o.type==='pressSwitch'){state.pressPulse=2;monsters.forEach(m=>{if(m.active)m.seen=999});message('HYDRAULIC PRESS CYCLED // THE IMPACT ECHOES');tone(52,.8,.13,'square')}
    else if(o.type==='secret'){o.active=false;state.secrets++;message(['BADGE 044: “M. VALE — DECEASED.”','RECORDER: “It came off the line wearing a man.”','THE WILL IS DATED TOMORROW.','INCIDENT REPORT: “LEVEL TWO WAS NEVER ON THE BLUEPRINTS.”'][Math.max(0,state.secrets-1)%4],4000);tone(440)}
  }
  function codePress(n){if(n==='C')state.code='';else if(state.code.length<3)state.code+=n;drawCode();tone(250+Number(n||0)*25,.05,.025);if(state.code.length===3)setTimeout(()=>{if(state.code==='431'){state.power=true;state.mode='play';show('#keypad',false);setObjective('Read the pressure chart and equalize steam');message('MAIN POWER RESTORED // STEAM PRESSURE CRITICAL');activateMonster('crawler');tone(55,1,.13,'sawtooth')}else{message('INVALID SEQUENCE // ALARM SIGNAL TRANSMITTED');monsters.forEach(m=>{if(m.active)m.seen=999});state.code='';drawCode();tone(70,.35,.08)}},180)}
  function pressurePress(index){state.pressure[index]=(state.pressure[index]+1)%10;const el=$(`.pressure-dial[data-pressure="${index}"]`);el.querySelector('b').textContent=state.pressure[index];el.querySelector('i').style.transform=`translateX(-50%) rotate(${-135+state.pressure[index]*27}deg)`;tone(210+index*70,.05,.025)}
  function submitPressure(){if(state.pressure.join('')==='472'){state.pressureSolved=true;closePuzzle();setObjective('Restart the production line');message('STEAM PRESSURE EQUALIZED // ACCESS LINE CONTROLS');activateMonster('warden');tone(90,1,.1,'sawtooth')}else{message('PRESSURE IMBALANCE // MANIFOLD RESET');state.pressure=[0,0,0];document.querySelectorAll('.pressure-dial[data-pressure]').forEach(el=>{el.querySelector('b').textContent='0';el.querySelector('i').style.transform='translateX(-50%) rotate(-135deg)'});monsters.forEach(m=>{if(m.active)m.seen=999});tone(65,.5,.1)}}
  function linePress(n){if(state.lineSequence.length>=3)return;state.lineSequence.push(n);document.querySelectorAll('#sequence-display i')[state.lineSequence.length-1].classList.add('on');document.querySelector(`[data-line="${n}"]`).classList.add('pressed');tone(260+n*75,.12,.04);if(state.lineSequence.length===3)setTimeout(()=>{if(state.lineSequence.join('')==='213'){state.lineSolved=true;closePuzzle();setObjective('Reach Level 2 and balance the ventilation system');message('PRODUCTION LINE RUNNING // UPPER FACTORY INTERLOCK DETECTED');activateMonster('overseer');tone(58,1.2,.12,'sawtooth')}else{$('#line-status').textContent='INTERLOCK FAULT — SEQUENCE RESET';state.lineSequence=[];document.querySelectorAll('#sequence-display i').forEach(i=>i.classList.remove('on'));document.querySelectorAll('.line-buttons button').forEach(b=>b.classList.remove('pressed'));monsters.forEach(m=>{if(m.active)m.seen=999});tone(58,.6,.1)}},300)}
  function ventilationPress(index){state.ventilation[index]=(state.ventilation[index]+1)%6;const el=$(`.vent-dial[data-vent="${index}"]`);el.querySelector('b').textContent=state.ventilation[index];el.querySelector('i').style.transform=`translateX(-50%) rotate(${-135+state.ventilation[index]*45}deg)`;tone(225+index*65,.05,.025)}
  function submitVentilation(){if(state.ventilation.join('')==='314'){state.ventilationSolved=true;closePuzzle();setObjective('Start and park the Level 2 overhead crane');message('VENTILATION BALANCED // CRANE INTERLOCK RELEASED');monsters.forEach(m=>{if(m.active)m.seen=999});tone(82,1,.11,'sawtooth')}else{message('AIRFLOW REVERSAL // DAMPERS RESET');state.ventilation=[0,0,0];document.querySelectorAll('.vent-dial').forEach(el=>{el.querySelector('b').textContent='0';el.querySelector('i').style.transform='translateX(-50%) rotate(-135deg)'});monsters.forEach(m=>{if(m.active)m.seen=999});tone(62,.55,.1)}}
  function cranePress(n){if(state.craneSequence.length>=3)return;state.craneSequence.push(n);document.querySelectorAll('#crane-sequence i')[state.craneSequence.length-1].classList.add('on');document.querySelector(`[data-crane="${n}"]`).classList.add('pressed');tone(245+n*68,.12,.04);if(state.craneSequence.length===3)setTimeout(()=>{if(state.craneSequence.join('')==='312'){state.craneSolved=true;closePuzzle();objects.find(o=>o.id==='card').active=true;setObjective("Take the foreman's keycard from the upper control office");message('CRANE PARKED // CONTROL OFFICE CARD CABINET RELEASED');tone(58,1.2,.12,'sawtooth')}else{$('#crane-status').textContent='LOAD SWING DETECTED — SEQUENCE RESET';state.craneSequence=[];document.querySelectorAll('#crane-sequence i').forEach(i=>i.classList.remove('on'));document.querySelectorAll('[data-crane]').forEach(b=>b.classList.remove('pressed'));monsters.forEach(m=>{if(m.active)m.seen=999});tone(55,.65,.11)}},300)}
  function drawCode(){$('#keypad-display').textContent=[0,1,2].map(i=>state.code[i]||'_').join(' ')}
  function win(){state.won=true;state.mode='end';document.exitPointerLock?.();show('#hud',false);show('#ending');const s=Math.floor((performance.now()-state.start)/1000);$('#stat-time').textContent=`${String(s/60|0).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;$('#stat-secrets').textContent=`${state.secrets} / 4`;$('#stat-deaths').textContent=`${state.deaths} / 3`;tone(523,.8,.07,'sine')}
  function die(){state.mode='end';document.exitPointerLock?.();show('#hud',false);show('#ending');$('#end-label').textContent='SHIFT TERMINATED';$('#end-title').textContent='YOU JOINED THE LINE.';$('#end-copy').textContent='At 02:17, your timecard punches itself.';$('#stat-time').textContent='—';$('#stat-secrets').textContent=`${state.secrets} / 4`;$('#stat-deaths').textContent=`${state.deaths} / 3`;$('#damage').classList.add('hit');tone(38,1.5,.2,'sawtooth')}

  function castRay(a){const map=mapFor(),dx=Math.cos(a),dy=Math.sin(a);let mx=Math.floor(player.x),my=Math.floor(player.y);const ddx=Math.abs(1/(dx||.0001)),ddy=Math.abs(1/(dy||.0001));let sx,sy,sdx,sdy;if(dx<0){sx=-1;sdx=(player.x-mx)*ddx}else{sx=1;sdx=(mx+1-player.x)*ddx}if(dy<0){sy=-1;sdy=(player.y-my)*ddy}else{sy=1;sdy=(my+1-player.y)*ddy}let side=0,t='1',d=MAX;for(let i=0;i<40;i++){if(sdx<sdy){sdx+=ddx;mx+=sx;side=0}else{sdy+=ddy;my+=sy;side=1}t=map[my]?.[mx]||'1';if(!['0','S','L'].includes(t)&&!(t==='D'&&doorAtCell(mx,my)?.open)&&!(t==='B'&&state.power)&&!(t==='E'&&state.won)){d=side===0?(mx-player.x+(1-sx)/2)/(dx||.001):(my-player.y+(1-sy)/2)/(dy||.001);break}}let wallX=side===0?player.y+d*dy:player.x+d*dx;wallX-=Math.floor(wallX);return{d:Math.abs(d),side,t,mx,my,wallX}}
  function screenPoint(x,y){return{x:x*TILE-cameraX,y:y*TILE-cameraY}}
  function drawProp2D(s){
    const p=screenPoint(s.x,s.y),x=p.x,y=p.y,t=performance.now()/1000;if(x<-80||x>W+80||y<-80||y>H+80)return;ctx.save();ctx.translate(x,y);if(s.type==='forklift')ctx.rotate(-Math.PI/2);else if(s.type==='conveyor'&&!Math.abs(Math.floor(s.x+s.y)%2))ctx.rotate(Math.PI/2);ctx.fillStyle='rgba(0,0,0,.34)';ctx.beginPath();ctx.ellipse(4,8,24,10,0,0,Math.PI*2);ctx.fill();
    if(s.type==='jumpBarrier'){ctx.fillStyle='#191b18';ctx.fillRect(-29,-7,58,14);for(let i=-28;i<28;i+=14){ctx.fillStyle=(i/14)&1?'#b1912f':'#342c18';ctx.beginPath();ctx.moveTo(i,-7);ctx.lineTo(i+10,-7);ctx.lineTo(i+18,7);ctx.lineTo(i+8,7);ctx.closePath();ctx.fill()}ctx.strokeStyle='#c3ae52';ctx.strokeRect(-29,-7,58,14)}
    else if(s.type==='crouchPipe'){ctx.strokeStyle='#26302c';ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(-30,0);ctx.lineTo(30,0);ctx.stroke();ctx.strokeStyle='#788279';ctx.lineWidth=9;ctx.stroke();ctx.fillStyle='#9a8132';for(const x of [-21,21]){ctx.beginPath();ctx.arc(x,0,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#37413c';ctx.beginPath();ctx.arc(x,0,4,0,Math.PI*2);ctx.fill()}}
    else if(s.type==='forklift'){ctx.fillStyle='#aa852d';ctx.fillRect(-21,-17,35,34);ctx.fillStyle='#1b211e';ctx.fillRect(-8,-12,17,17);ctx.strokeStyle='#a0a69b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(14,-13);ctx.lineTo(27,-13);ctx.moveTo(14,13);ctx.lineTo(27,13);ctx.stroke();ctx.fillStyle='#111';for(const y of [-14,14]){ctx.beginPath();ctx.arc(-14,y,5,0,Math.PI*2);ctx.fill()}}
    else if(s.type==='tank'){ctx.fillStyle='#45534d';ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8b9388';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#202622';ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
    else if(s.type==='workbench'){ctx.fillStyle='#51432b';ctx.fillRect(-29,-15,58,30);ctx.strokeStyle='#89734b';ctx.lineWidth=3;ctx.strokeRect(-29,-15,58,30);ctx.fillStyle='#252a26';ctx.fillRect(-20,-8,14,9);ctx.fillRect(5,-9,17,7)}
    else if(s.type==='machine'||s.type==='pressMachine'||s.type==='generator'){ctx.fillStyle='#303a35';ctx.fillRect(-25,-23,50,46);ctx.strokeStyle='#778076';ctx.lineWidth=2;ctx.strokeRect(-25,-23,50,46);ctx.fillStyle='#111613';ctx.fillRect(-17,-14,34,16);ctx.fillStyle='#b33c2f';ctx.beginPath();ctx.arc(-9,-6,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c1b341';ctx.beginPath();ctx.arc(1,-6,3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9a8132';ctx.lineWidth=4;ctx.beginPath();ctx.arc(11,11,7,0,Math.PI*2);ctx.stroke()}
    else if(s.type==='lathe'){ctx.fillStyle='#35413b';ctx.fillRect(-31,-15,62,30);ctx.strokeStyle='#7c847b';ctx.lineWidth=2;ctx.strokeRect(-31,-15,62,30);ctx.fillStyle='#171c19';ctx.fillRect(-24,-10,18,20);ctx.strokeStyle='#a28a34';ctx.lineWidth=4;ctx.beginPath();ctx.arc(-4,0,7,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#9aa198';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(26,0);ctx.stroke();ctx.fillStyle='#9b7925';ctx.fillRect(9,-8,10,16)}
    else if(s.type==='pump'||s.type==='turbine'){ctx.fillStyle='#303a35';ctx.beginPath();ctx.ellipse(0,0,s.type==='turbine'?29:22,s.type==='turbine'?16:22,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#858d83';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#171c19';ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a78b31';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#76502e';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(15,-15);ctx.lineTo(26,-27);ctx.stroke()}
    else if(s.type==='conveyor'){ctx.fillStyle='#1d2421';ctx.fillRect(-34,-13,68,26);ctx.strokeStyle='#737a70';ctx.strokeRect(-34,-13,68,26);for(let i=-28;i<30;i+=12){ctx.fillStyle='#3f4842';ctx.beginPath();ctx.arc(i,0,5,0,Math.PI*2);ctx.fill()}}
    else if(s.type==='barrels'){for(const [bx,by] of [[-11,5],[10,5],[0,-9]]){ctx.fillStyle='#47554f';ctx.beginPath();ctx.arc(bx,by,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8a8e80';ctx.stroke();ctx.fillStyle='#242a27';ctx.beginPath();ctx.arc(bx,by,5,0,Math.PI*2);ctx.stroke()}}
    else if(s.type==='pipe'||s.type==='boiler'){ctx.fillStyle='#4e5b55';ctx.beginPath();ctx.arc(0,0,s.type==='boiler'?24:16,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#899087';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#171c19';ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#967f35';ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(13,0);ctx.moveTo(0,-13);ctx.lineTo(0,13);ctx.stroke()}
    else if(s.type==='fan'){ctx.fillStyle='#252c28';ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6b756c';ctx.stroke();ctx.save();ctx.rotate(state.power?t*2:0);ctx.fillStyle='#111613';for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.ellipse(11,0,12,5,.3,0,Math.PI*2);ctx.fill()}ctx.restore();ctx.fillStyle='#a08a38';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill()}
    else if(s.type==='crate'||s.type==='pallet'){ctx.fillStyle='#594a31';ctx.fillRect(-20,-20,40,40);ctx.strokeStyle='#927b51';ctx.lineWidth=3;ctx.strokeRect(-20,-20,40,40);ctx.beginPath();ctx.moveTo(-18,-18);ctx.lineTo(18,18);ctx.moveTo(18,-18);ctx.lineTo(-18,18);ctx.stroke()}
    else if(s.type==='robotarm'){ctx.strokeStyle='#a08330';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-17,16);ctx.lineTo(-5,-4);ctx.lineTo(18,-15);ctx.stroke();ctx.fillStyle='#202622';for(const [ax,ay] of [[-17,16],[-5,-4],[18,-15]]){ctx.beginPath();ctx.arc(ax,ay,6,0,Math.PI*2);ctx.fill()}}
    else if(s.type==='cabinet'){ctx.fillStyle='#35413b';ctx.fillRect(-17,-25,34,50);ctx.strokeStyle='#798178';ctx.strokeRect(-17,-25,34,50);ctx.fillStyle=state.power?'#b8c34d':'#3b422f';ctx.beginPath();ctx.arc(8,-15,3,0,Math.PI*2);ctx.fill()}
    else if(s.type==='sign'){ctx.fillStyle='#b49a38';ctx.fillRect(-25,-11,50,22);ctx.fillStyle='#191d1a';ctx.fillRect(-21,-7,42,14);ctx.fillStyle='#d7d1b4';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText(s.text||'CAUTION',0,2)}
    else if(s.type==='steam'){ctx.fillStyle='rgba(205,218,210,.12)';for(let i=0;i<5;i++){const sy=18-((t*20+i*13)%55),sx=Math.sin(t*1.4+i)*8;ctx.beginPath();ctx.arc(sx,sy,7+i,0,Math.PI*2);ctx.fill()}}
    else if(s.type==='hook'){ctx.strokeStyle='#8b7244';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,12,-Math.PI*.55,Math.PI*.75);ctx.stroke()}
    ctx.restore();
  }
  function drawMounted2D(o){
    const p=screenPoint(o.x,o.y),horizontal=o.mount==='N'||o.mount==='S',colors={note:'#c9c2a7',diagram:'#c9c2a7',ventDiagram:'#c9c2a7',craneNote:'#c9c2a7',card:'#9ab0a4',secret:'#8e9b8d',alarm:'#8e3028',locker:'#53605a',breaker:'#8d7a31',pressure:'#53605a',conveyorPanel:'#53605a',ventilation:'#53605a',cranePanel:'#53605a',pressSwitch:'#8d7a31'},color=colors[o.type]||'#778078';ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(horizontal?-18:-6,horizontal?-6:-18,horizontal?36:12,horizontal?12:36);ctx.fillStyle=color;ctx.fillRect(horizontal?-17:-5,horizontal?-4:-17,horizontal?34:10,horizontal?8:34);ctx.strokeStyle='#c1bda4';ctx.lineWidth=1;ctx.strokeRect(horizontal?-17:-5,horizontal?-4:-17,horizontal?34:10,horizontal?8:34);ctx.fillStyle='#242825';for(const q of horizontal?[[-13,0],[13,0]]:[[0,-13],[0,13]]){ctx.beginPath();ctx.arc(q[0],q[1],1.5,0,Math.PI*2);ctx.fill()}if(nearObj===o){ctx.strokeStyle='#d3dd58';ctx.lineWidth=2;ctx.shadowBlur=10;ctx.shadowColor='#d3dd58';ctx.strokeRect(horizontal?-20:-8,horizontal?-7:-20,horizontal?40:16,horizontal?14:40)}ctx.restore();
  }
  function drawDoor2D(d){
    const p=screenPoint(d.x,d.y),control=objects.find(o=>o.doorId===d.id);ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle='#8b9188';ctx.lineWidth=3;
    if(d.open){ctx.fillStyle='#303833';if(d.orientation==='vertical'){ctx.fillRect(3,3,12,TILE-6);ctx.fillRect(TILE-15,3,12,TILE-6);ctx.strokeRect(3,3,12,TILE-6);ctx.strokeRect(TILE-15,3,12,TILE-6)}else{ctx.fillRect(3,3,TILE-6,12);ctx.fillRect(3,TILE-15,TILE-6,12);ctx.strokeRect(3,3,TILE-6,12);ctx.strokeRect(3,TILE-15,TILE-6,12)}}else{ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(4,5,TILE-8,TILE-8);ctx.fillStyle='#39413c';ctx.fillRect(4,4,TILE-8,TILE-8);ctx.strokeRect(4,4,TILE-8,TILE-8);ctx.strokeStyle='#171c19';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(d.orientation==='vertical'?TILE/2:5,d.orientation==='vertical'?5:TILE/2);ctx.lineTo(d.orientation==='vertical'?TILE/2:TILE-5,d.orientation==='vertical'?TILE-5:TILE/2);ctx.stroke();ctx.fillStyle='#a78930';for(let i=8;i<TILE-9;i+=13){if(d.orientation==='vertical')ctx.fillRect(i,TILE-13,8,7);else ctx.fillRect(TILE-13,i,7,8)}}
    if(d.locked){ctx.shadowBlur=0;ctx.fillStyle='#d7c84d';ctx.fillRect(TILE/2-7,TILE/2-1,14,12);ctx.strokeStyle='#171b18';ctx.lineWidth=2;ctx.beginPath();ctx.arc(TILE/2,TILE/2-1,5,Math.PI,0);ctx.stroke();ctx.fillStyle='#252923';ctx.fillRect(TILE/2-1,TILE/2+3,2,5)}
    ctx.fillStyle=d.locked?'#d7c84d':d.open?'#9ec34c':'#c04436';ctx.shadowBlur=7;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(TILE-9,9,3.5,0,Math.PI*2);ctx.fill();if(nearObj===control){ctx.shadowBlur=12;ctx.shadowColor='#d3dd58';ctx.strokeStyle='#d3dd58';ctx.lineWidth=2;ctx.strokeRect(1,1,TILE-2,TILE-2)}ctx.restore();
  }
  function drawActor2D(a,type){
    const p=screenPoint(a.x,a.y);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(4,7,15,8,0,0,Math.PI*2);ctx.fill();if(type==='worker'){if(!a.alive){ctx.rotate(-.3);ctx.fillStyle='#805d2c';ctx.fillRect(-18,-6,34,12);ctx.fillStyle='#c0a344';ctx.beginPath();ctx.arc(18,0,7,0,Math.PI*2);ctx.fill()}else{ctx.fillStyle='#9a7332';ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d0b64b';ctx.beginPath();ctx.arc(0,-4,7,Math.PI,0);ctx.fill();ctx.fillStyle='#d4d0b5';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText(a.name,0,-17)}}else{ctx.fillStyle='#050707';if(a.kind==='crawler'){ctx.rotate(Math.atan2(player.y-a.y,player.x-a.x));ctx.beginPath();ctx.ellipse(0,0,18,9,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=3;for(const sy of [-1,1])for(const xx of [-9,0,9]){ctx.beginPath();ctx.moveTo(xx,sy*5);ctx.lineTo(xx+5,sy*16);ctx.stroke()}ctx.fillStyle='#c34031';ctx.beginPath();ctx.arc(15,-3,2,0,Math.PI*2);ctx.fill()}else if(a.kind==='warden'){ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d4bd51';ctx.shadowBlur=12;ctx.shadowColor='#d4bd51';ctx.beginPath();ctx.arc(0,-5,4,0,Math.PI*2);ctx.fill()}else{ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#0a0c0b';ctx.lineWidth=5;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(21,0);ctx.stroke()}ctx.fillStyle='#bb3e32';ctx.beginPath();ctx.arc(-4,-5,2,0,Math.PI*2);ctx.arc(4,-5,2,0,Math.PI*2);ctx.fill()}}ctx.restore();
  }
  function renderDarkness2D(px,py){
    const l=lightCtx;l.clearRect(0,0,W,H);l.fillStyle=state.flash?'rgba(0,3,4,.76)':'rgba(0,2,3,.9)';l.fillRect(0,0,W,H);l.globalCompositeOperation='destination-out';let ambient=l.createRadialGradient(px,py,10,px,py,state.flash?100:52);ambient.addColorStop(0,'rgba(0,0,0,.95)');ambient.addColorStop(1,'rgba(0,0,0,0)');l.fillStyle=ambient;l.fillRect(px-110,py-110,220,220);if(state.flash&&state.battery>0){l.save();l.beginPath();l.moveTo(px,py);for(let i=0;i<=48;i++){const a=player.a-.5+i/48,r=castRay(a).d*TILE;l.lineTo(px+Math.cos(a)*r,py+Math.sin(a)*r)}l.closePath();l.clip();const cone=l.createRadialGradient(px,py,20,px,py,420);cone.addColorStop(0,'rgba(0,0,0,.98)');cone.addColorStop(.55,'rgba(0,0,0,.72)');cone.addColorStop(1,'rgba(0,0,0,0)');l.fillStyle=cone;l.fillRect(0,0,W,H);l.restore()}l.globalCompositeOperation='source-over';ctx.drawImage(lightCanvas,0,0);
  }
  function render2D(){
    const map=mapFor(),worldW=map[0].length*TILE,worldH=map.length*TILE,targetX=player.x*TILE-W/2,targetY=player.y*TILE-H/2;cameraX+=(Math.max(0,Math.min(worldW-W,targetX))-cameraX)*.14;cameraY+=(Math.max(0,Math.min(worldH-H,targetY))-cameraY)*.14;ctx.fillStyle='#070a09';ctx.fillRect(0,0,W,H);
    const minX=Math.max(0,Math.floor(cameraX/TILE)-1),maxX=Math.min(map[0].length,Math.ceil((cameraX+W)/TILE)+1),minY=Math.max(0,Math.floor(cameraY/TILE)-1),maxY=Math.min(map.length,Math.ceil((cameraY+H)/TILE)+1);
    for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){const sx=x*TILE-cameraX,sy=y*TILE-cameraY,n=textureNoise(x,y,4+player.floor*7),type=map[y][x];ctx.fillStyle=n>.5?'#202620':'#1c221e';ctx.fillRect(sx,sy,TILE,TILE);ctx.strokeStyle='rgba(109,118,105,.1)';ctx.strokeRect(sx+.5,sy+.5,TILE-1,TILE-1);if(n>.78){ctx.fillStyle='rgba(39,24,15,.22)';ctx.beginPath();ctx.ellipse(sx+TILE*n,sy+TILE*(1-n),13+n*9,7+n*4,n,0,Math.PI*2);ctx.fill()}if(type==='S'||type==='L'){ctx.fillStyle=type==='S'?'rgba(190,164,62,.17)':'rgba(91,128,111,.2)';ctx.fillRect(sx+6,sy+6,TILE-12,TILE-12);ctx.strokeStyle=type==='S'?'#aa913c':'#708b7d';ctx.strokeRect(sx+8,sy+8,TILE-16,TILE-16);ctx.fillStyle='#b9bcae';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText(type==='S'?'STAIR':'LIFT',sx+TILE/2,sy+TILE/2+3)}}
    for(const r of safeRooms.filter(r=>r.floor===player.floor)){const p=screenPoint(r.x,r.y);ctx.fillStyle='rgba(150,164,126,.055)';ctx.fillRect(p.x,p.y,r.w*TILE,r.h*TILE);ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(200,207,157,.28)';ctx.lineWidth=2;ctx.strokeRect(p.x+3,p.y+3,r.w*TILE-6,r.h*TILE-6);ctx.setLineDash([]);ctx.fillStyle='rgba(211,220,171,.24)';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText(`SAFE ROOM // ${r.n.replace('LOCKABLE ','').replace('SAFE ','')}`,p.x+r.w*TILE/2,p.y+18)}
    const zoneLabels=player.floor===0?[['RECEIVING',3.5,3.7],['PRESS HALL',11,3.2],['ASSEMBLY A',18,6],['MAINTENANCE',3.5,10.5],['TURBINE FLOOR',11,13.5],['SHIPPING',18,10]]:[['LOADING CATWALK',3.5,6],['ROBOTICS DECK',11.5,6.5],['CONTROL',19,6.6],['VENTILATION',3.4,15.5],['CRANE BAY',11.5,15.5],['PAINT + FINISH',18.5,12]];
    for(const [label,lx,ly] of zoneLabels){const p=screenPoint(lx,ly);ctx.fillStyle='rgba(188,169,73,.12)';ctx.font='bold 17px monospace';ctx.textAlign='center';ctx.fillText(label,p.x,p.y);ctx.fillStyle='rgba(181,157,55,.16)';ctx.beginPath();ctx.moveTo(p.x-70,p.y+14);ctx.lineTo(p.x-42,p.y+14);ctx.lineTo(p.x-42,p.y+8);ctx.lineTo(p.x-26,p.y+18);ctx.lineTo(p.x-42,p.y+28);ctx.lineTo(p.x-42,p.y+22);ctx.lineTo(p.x-70,p.y+22);ctx.closePath();ctx.fill()}
    for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){const type=map[y][x],solid=type==='1'||type==='2'||(type==='D'&&!doorAtCell(x,y)?.open)||(type==='B'&&!state.power)||(type==='E'&&!state.won);if(!solid)continue;const sx=x*TILE-cameraX,sy=y*TILE-cameraY,kind=type==='2'?'machine':(type==='B'||type==='D'||type==='E')?'hazard':((x+y+player.floor)%4===0?'rust':'steel');ctx.fillStyle='rgba(0,0,0,.48)';ctx.fillRect(sx+7,sy+9,TILE,TILE);ctx.drawImage(wallTextures[kind],sx,sy,TILE,TILE);ctx.strokeStyle='rgba(192,190,160,.25)';ctx.strokeRect(sx+1,sy+1,TILE-2,TILE-2);if(type==='2'){ctx.fillStyle='#111713';ctx.fillRect(sx+12,sy+13,TILE-24,TILE-26);ctx.fillStyle='#a7352c';ctx.beginPath();ctx.arc(sx+20,sy+20,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#baac42';ctx.beginPath();ctx.arc(sx+31,sy+20,3,0,Math.PI*2);ctx.fill()}}
    for(const d of doors.filter(d=>d.floor===player.floor))drawDoor2D(d);for(const s of scenery.concat(obstacles).filter(s=>s.floor===player.floor))drawProp2D(s);for(const o of objects.filter(o=>o.floor===player.floor&&o.active&&!o.mount&&o.type!=='door')){const p=screenPoint(o.x,o.y);ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(p.x,p.y+5,12,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=o.type==='fuse'?'#d4dd55':o.type==='stairs'?'#b69b42':o.type==='elevator'?'#708b7d':'#aeb7a9';ctx.fillRect(p.x-7,p.y-7,14,14);if(nearObj===o){ctx.strokeStyle='#d4dd55';ctx.strokeRect(p.x-10,p.y-10,20,20)}}for(const o of objects.filter(o=>o.floor===player.floor&&o.active&&o.mount))drawMounted2D(o);
    for(const w of workers.filter(w=>w.floor===player.floor))drawActor2D(w,'worker');for(const m of monsters.filter(m=>m.active&&m.floor===player.floor))drawActor2D(m,'monster');const pp=screenPoint(player.x,player.y);ctx.fillStyle='rgba(0,0,0,.48)';ctx.beginPath();ctx.ellipse(pp.x,pp.y+7,player.crouched?12:16,7,0,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(pp.x,pp.y-player.z*26);ctx.rotate(player.a);ctx.fillStyle='#89948a';ctx.beginPath();ctx.arc(0,0,player.crouched?9:12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d8d4bb';ctx.beginPath();ctx.moveTo(player.crouched?14:18,0);ctx.lineTo(5,-6);ctx.lineTo(5,6);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(208,202,167,.35)';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(31,0);ctx.stroke();ctx.restore();renderDarkness2D(pp.x,pp.y);
    ctx.save();ctx.globalCompositeOperation='screen';for(const p of dust){const x=(p.x+performance.now()*.004*p.z)%W,y=(p.y+Math.sin(performance.now()*.001+p.x)*4)%H;ctx.fillStyle='rgba(194,184,143,.045)';ctx.beginPath();ctx.arc(x,y,p.r,0,Math.PI*2);ctx.fill()}ctx.restore();
  }
  function renderArchitecture(){
    const sky=ctx.createLinearGradient(0,0,0,H/2);sky.addColorStop(0,state.power?'#141917':'#070b0b');sky.addColorStop(.7,'#101512');sky.addColorStop(1,'#1b201b');ctx.fillStyle=sky;ctx.fillRect(-20,-20,W+40,H/2+20);
    const floor=ctx.createLinearGradient(0,H/2,0,H);floor.addColorStop(0,'#282a24');floor.addColorStop(.28,'#171a16');floor.addColorStop(.72,'#090b0a');floor.addColorStop(1,'#020303');ctx.fillStyle=floor;ctx.fillRect(-20,H/2,W+40,H/2+30);
    const wet=ctx.createLinearGradient(W*.5,H/2,W*.5,H);wet.addColorStop(0,'rgba(164,120,60,.11)');wet.addColorStop(.55,'rgba(81,88,75,.035)');wet.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=wet;ctx.beginPath();ctx.moveTo(W*.48,H/2);ctx.lineTo(W*.62,H);ctx.lineTo(W*.38,H);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(135,142,128,.13)';ctx.lineWidth=SCALE*.8;
    for(let i=-4;i<=4;i++){ctx.beginPath();ctx.moveTo(W/2+i*8,H/2);ctx.lineTo(W/2+i*96,H);ctx.stroke()}
    for(const d of [1,1.35,1.8,2.5,3.5,5,7,10]){const y=H/2+H*.48/d;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.strokeStyle='rgba(142,106,45,.38)';ctx.lineWidth=3*SCALE;ctx.beginPath();ctx.moveTo(W*.43,H/2);ctx.lineTo(W*.27,H);ctx.moveTo(W*.57,H/2);ctx.lineTo(W*.73,H);ctx.stroke();
    ctx.strokeStyle='rgba(188,191,170,.06)';ctx.lineWidth=SCALE;for(let i=0;i<10;i++){const y=H*.55+i*H*.045;ctx.beginPath();ctx.moveTo(W*.34,y);ctx.lineTo(W*.66,y);ctx.stroke()}
    for(const d of [2.2,3,4.3,6.2,9]){const y=H/2-H*.52/d,h=Math.max(2*SCALE,11*SCALE/d);ctx.fillStyle='rgba(20,25,22,.92)';ctx.fillRect(-10,y,W+20,h);ctx.fillStyle='rgba(121,106,73,.24)';ctx.fillRect(0,y+h-SCALE,W,SCALE)}
    const lampPulse=state.alarm>0?(Math.sin(performance.now()/80)>0?1:.15):state.power?.6+.25*Math.sin(performance.now()/120):.28;
    for(const [x,yr] of [[.22,.17],[.51,.25],[.79,.14]]){const y=H*yr,glow=ctx.createRadialGradient(W*x,y,0,W*x,y,55*SCALE);glow.addColorStop(0,`rgba(194,54,38,${lampPulse*.25})`);glow.addColorStop(1,'rgba(110,20,12,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(W*x,y,55*SCALE,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(231,75,53,${lampPulse})`;ctx.shadowBlur=10*SCALE;ctx.shadowColor='#a42820';ctx.fillRect(W*x-4*SCALE,y-2*SCALE,8*SCALE,3*SCALE);ctx.shadowBlur=0;ctx.strokeStyle='rgba(25,29,26,.9)';ctx.lineWidth=2*SCALE;ctx.beginPath();ctx.moveTo(W*x,-10);ctx.lineTo(W*x,y-3*SCALE);ctx.stroke()}
  }
  function renderAtmosphere(){
    const t=performance.now()/1000;ctx.save();ctx.globalCompositeOperation='screen';for(const p of dust){const x=(p.x+t*7*p.z+viewSway*4)%W,y=(p.y+Math.sin(t*p.z+p.x)*8*SCALE)%H,focus=state.flash?Math.max(0,1-Math.abs(x-W/2)/(W*.42)):.15;ctx.fillStyle=`rgba(207,199,161,${.03*focus})`;ctx.beginPath();ctx.arc(x,y,p.r*SCALE,0,Math.PI*2);ctx.fill()}ctx.restore();
    const haze=ctx.createLinearGradient(0,H*.28,0,H*.8);haze.addColorStop(0,'rgba(91,103,91,0)');haze.addColorStop(.55,state.power?'rgba(99,92,68,.055)':'rgba(72,88,83,.045)');haze.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=haze;ctx.fillRect(0,0,W,H);
  }
  function render(){ctx.fillStyle='#020303';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(viewSway,viewBob);renderArchitecture();
    for(let x=0;x<W;x++){
      const ra=player.a-FOV/2+(x/W)*FOV,r=castRay(ra),d=r.d*Math.cos(ra-player.a);zBuffer[x]=d;const wh=Math.min(H*2,H/d),top=(H-wh)/2;
      const industrial=Math.abs(r.mx*17+r.my*31)%5,kind=r.t==='2'?'machine':(r.t==='B'||r.t==='D'||r.t==='E')?'hazard':industrial===0?'rust':industrial<3?'steel':'concrete',tex=wallTextures[kind];let tx=Math.floor(r.wallX*95);if((r.side===0&&Math.cos(ra)>0)||(r.side===1&&Math.sin(ra)<0))tx=95-tx;ctx.drawImage(tex,tx,0,1,96,x,top,1,wh);
      if(r.t==='D'&&tx>73&&tx<82){const door=doorAtCell(r.mx,r.my);ctx.fillStyle=door?.locked?'#d7c84d':'#c04436';ctx.fillRect(x,top+wh*.17,1,Math.max(2,wh*.07))}
      let shade=Math.max(.12,1-d/16)*(r.side?.77:1);if(state.power)shade=Math.min(1,shade*1.12);const beam=state.flash?Math.max(0,1-Math.abs(x-W/2)/(W*.38))*Math.max(0,1-d/11):0;ctx.fillStyle=`rgba(0,4,3,${Math.max(0,1-shade)*.9})`;ctx.fillRect(x,top,1,wh);if(beam>0){ctx.fillStyle=`rgba(221,207,158,${beam*.13})`;ctx.fillRect(x,top,1,wh)}
    }
    renderSprites();ctx.restore();renderAtmosphere();flashlight();
  }
  function drawFactoryProp(s,size){
    const t=performance.now()/1000;ctx.lineJoin='round';
    if(s.type==='jumpBarrier'){
      ctx.fillStyle='#181b18';ctx.fillRect(-size*.62,size*.2,size*1.24,size*.18);for(let i=-6;i<6;i+=2){ctx.fillStyle='#a88a2f';ctx.fillRect(i*size*.1,size*.2,size*.1,size*.18)}ctx.strokeStyle='#c0a64a';ctx.strokeRect(-size*.62,size*.2,size*1.24,size*.18);
    }else if(s.type==='crouchPipe'){
      ctx.strokeStyle='#242b27';ctx.lineWidth=Math.max(8,size*.2);ctx.beginPath();ctx.moveTo(-size*.7,-size*.03);ctx.lineTo(size*.7,-size*.03);ctx.stroke();ctx.strokeStyle='#68756e';ctx.lineWidth=Math.max(5,size*.12);ctx.stroke();ctx.fillStyle='#9a8132';for(const x of [-.52,.52]){ctx.beginPath();ctx.arc(size*x,-size*.03,size*.12,0,Math.PI*2);ctx.fill()}
    }else if(s.type==='machine'||s.type==='generator'||s.type==='workbench'||s.type==='forklift'){
      ctx.fillStyle='#242a27';ctx.fillRect(-size*.42,-size*.4,size*.84,size*.82);ctx.strokeStyle='#5d6259';ctx.lineWidth=Math.max(1,size*.018);ctx.strokeRect(-size*.42,-size*.4,size*.84,size*.82);
      ctx.fillStyle='#171a18';ctx.fillRect(-size*.32,-size*.3,size*.64,size*.25);ctx.fillStyle='#8c2f25';ctx.fillRect(-size*.25,-size*.23,size*.05,size*.05);ctx.fillStyle='#b5a83c';ctx.fillRect(-size*.12,-size*.23,size*.05,size*.05);
      ctx.strokeStyle='#857233';ctx.lineWidth=Math.max(2,size*.05);ctx.beginPath();ctx.arc(size*.18,size*.14,size*.12,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#0b0d0c';ctx.beginPath();ctx.arc(size*.18,size*.14,size*.035,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#a78b2d';for(let i=-5;i<6;i+=2)ctx.fillRect(i*size*.08,size*.34,size*.08,size*.07);
    }else if(s.type==='conveyor'){
      ctx.fillStyle='#111513';ctx.fillRect(-size*.72,-size*.08,size*1.44,size*.25);ctx.strokeStyle='#65685e';ctx.lineWidth=Math.max(1,size*.025);ctx.strokeRect(-size*.72,-size*.08,size*1.44,size*.25);
      for(let i=-5;i<=5;i++){ctx.fillStyle=i%2?'#353a35':'#202421';ctx.beginPath();ctx.arc(i*size*.12,size*.045,size*.07,0,Math.PI*2);ctx.fill()}
      ctx.strokeStyle='#3e433d';ctx.beginPath();ctx.moveTo(-size*.55,size*.17);ctx.lineTo(-size*.48,size*.48);ctx.moveTo(size*.55,size*.17);ctx.lineTo(size*.48,size*.48);ctx.stroke();
    }else if(s.type==='pipe'){
      ctx.strokeStyle='#545b55';ctx.lineWidth=Math.max(4,size*.13);ctx.beginPath();ctx.moveTo(-size*.15,size*.45);ctx.lineTo(-size*.15,-size*.5);ctx.quadraticCurveTo(-size*.15,-size*.65,0,-size*.65);ctx.lineTo(size*.3,-size*.65);ctx.stroke();
      ctx.strokeStyle='#242825';ctx.lineWidth=Math.max(1,size*.025);for(const y of [-.35,.12,.4]){ctx.beginPath();ctx.moveTo(-size*.24,size*y);ctx.lineTo(-size*.06,size*y);ctx.stroke()}
      ctx.strokeStyle='#825f29';ctx.lineWidth=Math.max(2,size*.045);ctx.beginPath();ctx.arc(-size*.15,-size*.05,size*.18,0,Math.PI*2);ctx.moveTo(-size*.33,-size*.05);ctx.lineTo(size*.03,-size*.05);ctx.moveTo(-size*.15,-size*.23);ctx.lineTo(-size*.15,size*.13);ctx.stroke();
    }else if(s.type==='barrels'){
      for(const [x,y] of [[-.22,.02],[.18,.08],[0,-.18]]){ctx.fillStyle='#3e4843';ctx.fillRect(size*(x-.16),size*(y-.22),size*.32,size*.48);ctx.fillStyle='#1d2220';ctx.fillRect(size*(x-.17),size*(y-.18),size*.34,size*.045);ctx.fillRect(size*(x-.17),size*(y+.16),size*.34,size*.045);ctx.strokeStyle='#73776c';ctx.strokeRect(size*(x-.16),size*(y-.22),size*.32,size*.48)}
      ctx.fillStyle='#9a7b26';ctx.font=`bold ${Math.max(4,size*.08)}px monospace`;ctx.fillText('FLAM',-size*.1,size*.04);
    }else if(s.type==='boiler'||s.type==='tank'){
      ctx.fillStyle='#333a36';ctx.beginPath();ctx.ellipse(0,0,size*.34,size*.48,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#71766c';ctx.lineWidth=Math.max(1,size*.02);ctx.stroke();
      ctx.fillStyle='#151817';ctx.beginPath();ctx.arc(0,-size*.12,size*.14,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#998438';ctx.stroke();ctx.fillStyle='#9a3329';ctx.fillRect(-size*.04,-size*.16,size*.08,size*.08);
      ctx.strokeStyle='#59605a';ctx.lineWidth=Math.max(3,size*.08);ctx.beginPath();ctx.moveTo(-size*.25,-size*.33);ctx.lineTo(-size*.48,-size*.58);ctx.moveTo(size*.25,-size*.33);ctx.lineTo(size*.48,-size*.58);ctx.stroke();
    }else if(s.type==='sign'){
      ctx.fillStyle='#b89a35';ctx.fillRect(-size*.48,-size*.22,size*.96,size*.44);ctx.fillStyle='#171917';ctx.fillRect(-size*.43,-size*.17,size*.86,size*.34);ctx.fillStyle='#d0cba9';ctx.font=`bold ${Math.max(5,size*.105)}px monospace`;ctx.textAlign='center';ctx.fillText(s.text||'CAUTION',0,size*.035);
    }else if(s.type==='crate'||s.type==='pallet'){
      ctx.fillStyle=s.type==='crate'?'#51452e':'#403927';ctx.fillRect(-size*.42,-size*.26,size*.84,size*.58);ctx.strokeStyle='#81704a';ctx.lineWidth=Math.max(1,size*.03);ctx.strokeRect(-size*.42,-size*.26,size*.84,size*.58);ctx.beginPath();ctx.moveTo(-size*.38,-size*.22);ctx.lineTo(size*.38,size*.28);ctx.moveTo(size*.38,-size*.22);ctx.lineTo(-size*.38,size*.28);ctx.stroke();
    }else if(s.type==='fan'){
      ctx.fillStyle='#262c29';ctx.fillRect(-size*.43,-size*.43,size*.86,size*.86);ctx.strokeStyle='#656b63';ctx.strokeRect(-size*.43,-size*.43,size*.86,size*.86);ctx.save();ctx.rotate(state.power?t*1.8:0);ctx.fillStyle='#111513';for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.ellipse(size*.18,0,size*.23,size*.09,.25,0,Math.PI*2);ctx.fill()}ctx.restore();ctx.fillStyle='#8e7a35';ctx.beginPath();ctx.arc(0,0,size*.07,0,Math.PI*2);ctx.fill();
    }else if(s.type==='cabinet'){
      ctx.fillStyle='#343b37';ctx.fillRect(-size*.3,-size*.48,size*.6,size*.96);ctx.strokeStyle='#72776d';ctx.strokeRect(-size*.3,-size*.48,size*.6,size*.96);ctx.fillStyle='#111411';ctx.fillRect(-size*.2,-size*.34,size*.4,size*.22);ctx.fillStyle=state.power?'#b43d30':'#49231e';ctx.fillRect(-size*.13,-size*.27,size*.05,size*.05);ctx.fillStyle=state.power?'#bec64f':'#3a3e2a';ctx.fillRect(0,-size*.27,size*.05,size*.05);ctx.strokeStyle='#8b7732';ctx.lineWidth=Math.max(1,size*.03);ctx.beginPath();ctx.arc(0,size*.17,size*.13,0,Math.PI*2);ctx.stroke();
    }else if(s.type==='robotarm'){
      ctx.fillStyle='#8b7330';ctx.fillRect(-size*.3,size*.28,size*.6,size*.14);ctx.strokeStyle='#695a2c';ctx.lineWidth=Math.max(4,size*.11);ctx.beginPath();ctx.moveTo(0,size*.28);ctx.lineTo(-size*.12,-size*.12);ctx.lineTo(size*.2,-size*.38);ctx.stroke();ctx.fillStyle='#272b28';for(const [x,y] of [[0,.28],[-.12,-.12],[.2,-.38]]){ctx.beginPath();ctx.arc(size*x,size*y,size*.09,0,Math.PI*2);ctx.fill()}
    }else if(s.type==='hook'){
      ctx.strokeStyle='#222623';ctx.lineWidth=Math.max(1,size*.035);ctx.beginPath();ctx.moveTo(0,-size*.75);ctx.lineTo(0,size*.04);ctx.stroke();ctx.strokeStyle='#7c6640';ctx.lineWidth=Math.max(3,size*.1);ctx.beginPath();ctx.arc(size*.08,size*.12,size*.2,-Math.PI*.55,Math.PI*.7);ctx.stroke();
    }else if(s.type==='pressMachine'){
      ctx.fillStyle='#2c322f';ctx.fillRect(-size*.45,-size*.5,size*.22,size);ctx.fillRect(size*.23,-size*.5,size*.22,size);ctx.fillRect(-size*.45,-size*.5,size*.9,size*.2);ctx.fillStyle='#6e5b29';ctx.fillRect(-size*.18,-size*.3,size*.36,state.pressPulse>0?size*.65:size*.28);ctx.fillStyle='#171a18';ctx.fillRect(-size*.35,size*.3,size*.7,size*.12);ctx.fillStyle='#a98b2e';for(let i=-4;i<4;i+=2)ctx.fillRect(i*size*.09,size*.31,size*.09,size*.1);
    }else if(s.type==='steam'){
      ctx.globalAlpha=.1;for(let i=0;i<5;i++){const drift=Math.sin(t*1.5+i*2.1)*size*.12,y=size*.35-((t*.25+i*.18)%1)*size;ctx.fillStyle='#d7ded8';ctx.beginPath();ctx.ellipse(drift,y,size*(.12+i*.015),size*.19,0,0,Math.PI*2);ctx.fill()}
    }
  }
  function drawMonster(s,size){
    const bob=Math.sin(performance.now()/150+s.x)*2;ctx.fillStyle='rgba(2,2,2,.98)';ctx.strokeStyle='#050505';
    if(s.kind==='crawler'){
      ctx.translate(0,size*.28);ctx.beginPath();ctx.ellipse(0,0,size*.29,size*.14,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(size*.28,-size*.05,size*.13,size*.11,0,0,Math.PI*2);ctx.fill();ctx.lineWidth=Math.max(2,size*.045);for(const side of [-1,1])for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(side*size*(.08+i*.06),0);ctx.lineTo(side*size*.4,size*(.18+i*.06));ctx.stroke()}ctx.fillStyle='#d14b36';ctx.fillRect(size*.31,-size*.09,size*.025,size*.018);
    }else if(s.kind==='warden'){
      ctx.fillRect(-size*.22,-size*.22+bob,size*.44,size*.66);ctx.beginPath();ctx.arc(0,-size*.3+bob,size*.22,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#2b2c27';ctx.lineWidth=Math.max(3,size*.09);ctx.beginPath();ctx.moveTo(-size*.15,size*.02);ctx.lineTo(-size*.34,size*.48);ctx.moveTo(size*.15,size*.02);ctx.lineTo(size*.34,size*.48);ctx.stroke();ctx.fillStyle='#d1b949';ctx.shadowBlur=size*.16;ctx.shadowColor='#d1b949';ctx.beginPath();ctx.arc(0,-size*.31+bob,size*.045,0,Math.PI*2);ctx.fill();
    }else{
      ctx.beginPath();ctx.ellipse(0,-size*.2+bob,size*.16,size*.23,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-size*.13,-size*.08+bob,size*.26,size*.58);ctx.lineWidth=Math.max(2,size*.08);ctx.beginPath();ctx.moveTo(-size*.1,size*.05);ctx.lineTo(-size*.28,size*.52);ctx.moveTo(size*.1,size*.05);ctx.lineTo(size*.28,size*.52);ctx.stroke();ctx.fillStyle='#b94535';ctx.fillRect(-size*.06,-size*.25+bob,size*.035,size*.018);ctx.fillRect(size*.025,-size*.25+bob,size*.035,size*.018)
    }
  }
  function drawWorker(s,size){
    if(!s.alive){ctx.translate(0,size*.4);ctx.rotate(-.18);ctx.fillStyle='#6f4d23';ctx.fillRect(-size*.42,-size*.08,size*.68,size*.16);ctx.fillStyle='#b79a43';ctx.beginPath();ctx.arc(size*.32,0,size*.11,0,Math.PI*2);ctx.fill();return}
    const bob=Math.sin(performance.now()/105+s.x)*size*.025;ctx.fillStyle='#b7a43f';ctx.beginPath();ctx.arc(0,-size*.29+bob,size*.13,Math.PI,0);ctx.fill();ctx.fillStyle='#82602b';ctx.fillRect(-size*.13,-size*.22+bob,size*.26,size*.45);ctx.strokeStyle='#c6a646';ctx.lineWidth=Math.max(2,size*.055);ctx.beginPath();ctx.moveTo(-size*.08,-size*.08);ctx.lineTo(-size*.22,size*.18);ctx.moveTo(size*.08,-size*.08);ctx.lineTo(size*.2,size*.16);ctx.stroke();ctx.strokeStyle='#342f25';ctx.beginPath();ctx.moveTo(-size*.07,size*.2);ctx.lineTo(-size*.13,size*.46);ctx.moveTo(size*.07,size*.2);ctx.lineTo(size*.14,size*.46);ctx.stroke();ctx.fillStyle='#d0cfba';ctx.font=`${Math.max(4,size*.055)}px monospace`;ctx.textAlign='center';ctx.fillText(s.name,0,-size*.46);
  }
  function renderSprites(){
    const actors=monsters.filter(m=>m.active&&m.floor===player.floor).map(m=>({...m,type:'monster'})).concat(workers.filter(w=>w.floor===player.floor).map(w=>({...w,type:'worker'})));
    const sprites=scenery.concat(obstacles,objects.filter(o=>o.active&&o.type!=='door'),actors).filter(o=>o.floor===player.floor).map(o=>({...o,d:Math.hypot(o.x-player.x,o.y-player.y)})).sort((a,b)=>b.d-a.d);
    const propTypes=new Set(['machine','generator','workbench','forklift','tank','jumpBarrier','crouchPipe','conveyor','pipe','barrels','boiler','sign','steam','crate','pallet','fan','cabinet','robotarm','hook','pressMachine']);
    const controlTypes=new Set(['breaker','pressure','conveyorPanel','ventilation','cranePanel','alarm','locker','pressSwitch','diagram','ventDiagram','craneNote']);
    for(const s of sprites){let da=Math.atan2(s.y-player.y,s.x-player.x)-player.a;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;if(Math.abs(da)>FOV*.72)continue;const sx=(.5+da/FOV)*W,sourceSize=(propTypes.has(s.type)?125:s.type==='monster'?190:s.type==='worker'?150:controlTypes.has(s.type)?105:70)*SCALE,size=Math.min(H*1.4,sourceSize/s.d);if(zBuffer[Math.max(0,Math.min(W-1,sx|0))]<s.d*.8)continue;ctx.save();ctx.translate(sx,H/2+(s.floorItem?size*.37:0));if(!s.mount&&s.type!=='steam'&&s.type!=='hook'){ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(0,size*.48,size*.4,size*.075,0,0,Math.PI*2);ctx.fill()}
      if(propTypes.has(s.type))drawFactoryProp(s,size);
      else if(s.type==='monster')drawMonster(s,size);
      else if(s.type==='worker')drawWorker(s,size);
      else if(controlTypes.has(s.type)){
        ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(-size*.35,-size*.48,size*.7,size*.96);ctx.strokeStyle='#2b302c';ctx.lineWidth=Math.max(2,size*.045);ctx.beginPath();ctx.moveTo(0,-size*.72);ctx.lineTo(0,-size*.47);ctx.stroke();
        ctx.fillStyle=s.type==='alarm'?'#772c26':'#323934';ctx.fillRect(-size*.3,-size*.43,size*.6,size*.86);ctx.strokeStyle='#8a8d81';ctx.lineWidth=Math.max(1,size*.012);ctx.strokeRect(-size*.3,-size*.43,size*.6,size*.86);
        ctx.fillStyle='#b5aa81';for(const x of [-.25,.25])for(const y of [-.38,.38]){ctx.beginPath();ctx.arc(size*x,size*y,Math.max(1,size*.018),0,Math.PI*2);ctx.fill()}
        ctx.fillStyle='#111411';ctx.fillRect(-size*.2,-size*.3,size*.4,size*.22);ctx.fillStyle=state.power?'#bdc64d':'#793027';ctx.beginPath();ctx.arc(0,-size*.19,size*.055,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a58c35';ctx.font=`bold ${Math.max(5,size*.1)}px monospace`;ctx.textAlign='center';ctx.fillText({breaker:'MAIN',pressure:'PSI',conveyorPanel:'LINE',ventilation:'AIR',cranePanel:'CRANE',alarm:'ALARM',locker:'SUPPLY',pressSwitch:'PRESS',diagram:'4·7·2',ventDiagram:'3·1·4',craneNote:'H·T·M'}[s.type],0,size*.18)
      }
      else{const colors={fuse:'#d5db55',card:'#9ab0a4',breaker:'#b4a84d',exit:'#a33c32',note:'#c9c2a7',secret:'#8e9b8d'};ctx.globalAlpha=.75+.2*Math.sin(performance.now()/250+s.x);ctx.fillStyle=colors[s.type]||'#aaa';ctx.shadowBlur=10;ctx.shadowColor=ctx.fillStyle;if(s.type==='exit'){ctx.fillRect(-size*.35,-size*.7,size*.7,size*1.4);ctx.fillStyle='#111';ctx.fillRect(-size*.27,-size*.6,size*.54,size*1.2);ctx.fillStyle='#a88a2c';for(let i=-3;i<4;i+=2)ctx.fillRect(i*size*.1,-size*.68,size*.1,size*.08)}else if(s.floorItem){ctx.shadowBlur=0;ctx.fillStyle='#34302a';ctx.fillRect(-size*.28,size*.12,size*.56,size*.12);ctx.fillStyle=colors[s.type]||'#aaa';ctx.shadowBlur=8;ctx.shadowColor=ctx.fillStyle;ctx.fillRect(-size*.13,-size*.06,size*.26,size*.22)}else if(s.mount){ctx.shadowBlur=0;ctx.fillStyle='rgba(0,0,0,.52)';ctx.fillRect(-size*.22,-size*.27,size*.44,size*.54);ctx.fillStyle=colors[s.type]||'#aaa';ctx.fillRect(-size*.17,-size*.22,size*.34,size*.44);ctx.fillStyle='#222521';for(const x of [-.135,.135])for(const y of [-.18,.18]){ctx.beginPath();ctx.arc(size*x,size*y,Math.max(1,size*.014),0,Math.PI*2);ctx.fill()}}else{ctx.fillRect(-size*.17,-size*.22,size*.34,size*.44);ctx.strokeStyle='#e8e4cf';ctx.lineWidth=1;ctx.strokeRect(-size*.17,-size*.22,size*.34,size*.44)}}ctx.restore()
    }
  }
  function flashlight(){
    if(!state.flash||state.battery<=0){ctx.fillStyle='rgba(0,0,0,.52)';ctx.fillRect(0,0,W,H);return}
    const x=W/2+viewSway*.35,y=H/2+viewBob*.2,g=ctx.createRadialGradient(x,y,22*SCALE,x,y,H*.76);g.addColorStop(0,'rgba(244,232,190,.035)');g.addColorStop(.34,'rgba(12,14,11,.02)');g.addColorStop(.72,'rgba(0,0,0,.34)');g.addColorStop(1,'rgba(0,0,0,.82)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalCompositeOperation='screen';const glow=ctx.createRadialGradient(x,y,0,x,y,H*.4);glow.addColorStop(0,'rgba(238,218,159,.105)');glow.addColorStop(.45,'rgba(185,166,116,.035)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);ctx.restore();
    ctx.save();ctx.translate(W*.83+viewSway*.4,H*.96+Math.max(0,viewBob)*.2);ctx.rotate(-.08);const body=ctx.createLinearGradient(0,-22*SCALE,0,12*SCALE);body.addColorStop(0,'#313532');body.addColorStop(.45,'#111412');body.addColorStop(1,'#030404');ctx.fillStyle=body;ctx.shadowBlur=12*SCALE;ctx.shadowColor='#000';ctx.beginPath();ctx.roundRect(-9*SCALE,-25*SCALE,72*SCALE,31*SCALE,7*SCALE);ctx.fill();ctx.fillStyle='#454a45';ctx.beginPath();ctx.ellipse(-8*SCALE,-9*SCALE,15*SCALE,18*SCALE,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#77796d';ctx.lineWidth=1*SCALE;ctx.stroke();ctx.restore();
  }
  function update(dt){
    if(state.mode!=='play')return;
    player.crouched=Boolean((keys.KeyC||keys.ControlLeft||keys.ControlRight)&&player.grounded);
    const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),strafe=(keys.KeyD?1:0)-(keys.KeyA?1:0),running=keys.ShiftLeft&&forward>0&&state.stamina>1&&!player.crouched;
    const speed=(running?3.1:player.crouched?1.05:1.65)*dt;
    if(running)state.stamina=Math.max(0,state.stamina-28*dt);else state.stamina=Math.min(100,state.stamina+15*dt);
    let dx,dy;
    if(state.viewMode==='2d'){dx=strafe*speed;dy=forward*speed*-1}
    else{const rightAngle=player.a+(babylonView?.ready?-Math.PI/2:Math.PI/2);dx=(Math.cos(player.a)*forward+Math.cos(rightAngle)*strafe)*speed;dy=(Math.sin(player.a)*forward+Math.sin(rightAngle)*strafe)*speed}
    if(!playerBlocked(player.x+dx,player.y))player.x+=dx;
    if(!playerBlocked(player.x,player.y+dy))player.y+=dy;

    const previousZ=player.z;
    player.jumpVelocity-=6.8*dt;
    player.z+=player.jumpVelocity*dt;
    const supportHeight=surfaceHeightAt(player.x,player.y,player.floor,previousZ);
    if(player.jumpVelocity<=0&&previousZ>=supportHeight-.035&&player.z<=supportHeight){player.z=supportHeight;player.jumpVelocity=0;player.grounded=true}
    else player.grounded=false;

    if(state.flash)state.battery=Math.max(0,state.battery-1.3*dt);else state.battery=Math.min(100,state.battery+.85*dt);if(state.battery<=0)state.flash=false;
    const moving=Math.abs(forward)+Math.abs(strafe)>0;moveBlend+=(Number(moving)-moveBlend)*Math.min(1,dt*9);if(moving)walkPhase+=dt*(running?7.8:player.crouched?3.2:5.3);
    if(state.viewMode==='2d'){const pp=screenPoint(player.x,player.y);player.a=Math.atan2(mouseY-pp.y,mouseX-pp.x);viewBob=0;viewSway=0}
    else{viewBob=Math.sin(walkPhase*2)*3.2*SCALE*moveBlend+player.z*28*SCALE-(player.crouched?18*SCALE:0);viewSway=Math.sin(walkPhase)*2.1*SCALE*moveBlend}
    nearObj=null;let best=1.05;for(const o of objects){if(!o.active||o.floor!==player.floor)continue;const d=Math.hypot(o.x-player.x,o.y-player.y),facing=Math.abs(norm(Math.atan2(o.y-player.y,o.x-player.x)-player.a));if(d<best&&(state.viewMode==='2d'||facing<.75)){best=d;nearObj=o}}$('#interact').style.display=nearObj?'block':'none';if(nearObj){const door=nearObj.type==='door'&&doors.find(d=>d.id===nearObj.doorId);$('#interact-key').textContent=door?'[ E / L ]':'[ E ]';$('#interact span').textContent=door?`${door.name} // ${door.locked?'LOCKED':door.open?'OPEN':'UNLOCKED'}`:nearObj.label}
    for(const w of workers){if(!w.alive)continue;const hunter=monsters.find(m=>m.active&&m.victim===w.id);if(!hunter)continue;w.pathTimer-=dt;if(w.pathTimer<=0){w.target=nextStep(w,{x:w.escapeX,y:w.escapeY,floor:w.escapeFloor});w.pathTimer=.38}moveEntity(w,w.target,w.speed*dt)}
    let nearest=99;const noise=running?8:state.flash?5:2.7;
    for(const m of monsters){if(!m.active)continue;const victim=workers.find(w=>w.id===m.victim&&w.alive),prey=victim||player,sameFloor=m.floor===player.floor,md=sameFloor?Math.hypot(player.x-m.x,player.y-m.y):99;if(sameFloor)nearest=Math.min(nearest,md);if(victim||(sameFloor&&md<noise)||m.seen>0||state.alarm>0){m.seen=Math.max(m.seen,2.5);m.pathTimer-=dt;if(m.pathTimer<=0){m.target=nextStep(m,prey);m.pathTimer=m.kind==='crawler'?.18:.28}moveEntity(m,m.target,m.speed*dt*(running&&!victim?1.15:1))}m.seen=Math.max(0,m.seen-dt);
      if(victim&&victim.floor===m.floor&&Math.hypot(victim.x-m.x,victim.y-m.y)<.48){victim.alive=false;state.deaths++;m.seen=999;message(`${victim.name} WAS KILLED BY ${m.kind==='crawler'?'THE CRAWLER':m.kind==='overseer'?'THE OVERSEER':'THE GEARED MAN'}`,4200);tone(105,.7,.14,'sawtooth')}
      if(sameFloor&&md<.52){die();break}}
    state.beat-=dt;if(nearest<5&&state.beat<=0){tone(nearest<2.3?62:48,.08,nearest<2.3?.07:.035,'sine');state.beat=Math.max(.28,nearest*.16)}$('#threat').classList.toggle('near',nearest<4);
    state.alarm=Math.max(0,state.alarm-dt);state.pressPulse=Math.max(0,state.pressPulse-dt);if(state.power){state.machineTimer-=dt;if(state.machineTimer<=0){tone(72+Math.random()*45,.12,.018,'square');state.machineTimer=1.8+Math.random()*3.2}}
    state.msgTimer-=dt*1000;if(state.msgTimer<=0)$('#message').classList.remove('show');updateHud();
  }
  function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
  function moveEntity(entity,target,amount){if(!target)return;const a=Math.atan2(target.y-entity.y,target.x-entity.x),distance=Math.hypot(target.x-entity.x,target.y-entity.y);if(target.floor!==entity.floor&&distance<.09){entity.floor=target.floor;entity.x=target.x;entity.y=target.y;entity.target=null;entity.pathTimer=0;return}const mx=Math.cos(a)*Math.min(amount,distance),my=Math.sin(a)*Math.min(amount,distance);if(!entityWall(entity,entity.x+mx,entity.y,entity.floor)){breachDoor(entity,entity.x+mx,entity.y,entity.floor);entity.x+=mx}if(!entityWall(entity,entity.x,entity.y+my,entity.floor)){breachDoor(entity,entity.x,entity.y+my,entity.floor);entity.y+=my}}
  function nextStep(entity,destination){
    const start=[entity.floor,Math.floor(entity.x),Math.floor(entity.y)],goal=[destination.floor??entity.floor,Math.floor(destination.x),Math.floor(destination.y)],key=n=>n.join(','),q=[start],seen=new Set([key(start)]),parent=new Map(),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    while(q.length){const cur=q.shift();if(cur[0]===goal[0]&&cur[1]===goal[1]&&cur[2]===goal[2]){let node=cur,prev=cur;while(parent.has(key(node))){prev=node;node=parent.get(key(node));if(key(node)===key(start))return{x:prev[1]+.5,y:prev[2]+.5,floor:prev[0]}}return{x:goal[1]+.5,y:goal[2]+.5,floor:goal[0]}}
      for(const d of dirs){const n=[cur[0],cur[1]+d[0],cur[2]+d[1]],k=key(n);if(!seen.has(k)&&!entityWall(entity,n[1]+.5,n[2]+.5,n[0])){seen.add(k);parent.set(k,cur);q.push(n)}}
      const connector=connectors.find(c=>c.x===cur[1]&&c.y===cur[2]);if(connector&&(connector.type==='stairs'||state.power)){const n=[1-cur[0],cur[1],cur[2]],k=key(n);if(!seen.has(k)&&!entityWall(entity,n[1]+.5,n[2]+.5,n[0])){seen.add(k);parent.set(k,cur);q.push(n)}}}
    return null;
  }
  function updateHud(){const st=Math.round(state.stamina),ba=Math.round(state.battery);$('#stamina-value').textContent=st;$('#stamina-bar').style.width=st+'%';$('#battery-value').textContent=ba;$('#battery-bar').style.width=ba+'%';$('#stance').textContent=player.crouched?'CROUCHED':!player.grounded?'AIRBORNE':player.z>.08?'ON MACHINERY':'STANDING';$('.meter').classList.toggle('low',st<20);$('.meter.battery').classList.toggle('low',ba<20);const z=zones.find(z=>z.floor===player.floor&&player.x>=z.x&&player.x<z.x+z.w&&player.y>=z.y&&player.y<z.y+z.h);$('#location').textContent=`L${player.floor+1} // ${z?.n||'FACTORY ACCESS'}`;const sec=Math.floor((performance.now()-state.start));const base=(2*3600+17*60)*1000+sec;$('#clock').textContent=new Date(base).toISOString().slice(11,19)}
  function loop(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;update(dt);if(state.viewMode==='2d')render2D();else{const view=ensureBabylonView();view.ready?view.render():render()}requestAnimationFrame(loop)}

  $('#start-btn').onclick=()=>{show('#menu',false);show('#briefing')};$('#enter-btn').onclick=begin;$('#how-btn').onclick=()=>show('#how');$('#how-close').onclick=()=>show('#how',false);$('#resume-btn').onclick=()=>{state.mode='play';show('#pause',false);if(state.viewMode==='3d')activeCanvas().requestPointerLock?.()};$('#restart-btn').onclick=()=>location.reload();$('#view-toggle').onclick=toggleView;
  const keysEl=$('#keys');[1,2,3,4,5,6,7,8,9,'C',0].forEach(n=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>codePress(String(n));keysEl.appendChild(b)});
  document.querySelectorAll('.pressure-dial[data-pressure]').forEach(el=>el.onclick=()=>pressurePress(Number(el.dataset.pressure)));$('#pressure-submit').onclick=submitPressure;document.querySelectorAll('.vent-dial').forEach(el=>el.onclick=()=>ventilationPress(Number(el.dataset.vent)));$('#ventilation-submit').onclick=submitVentilation;document.querySelectorAll('[data-line]').forEach(el=>el.onclick=()=>linePress(Number(el.dataset.line)));document.querySelectorAll('[data-crane]').forEach(el=>el.onclick=()=>cranePress(Number(el.dataset.crane)));document.querySelectorAll('[data-close-puzzle]').forEach(el=>el.onclick=closePuzzle);
  addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){e.preventDefault();if(state.mode==='play'&&!e.repeat&&player.grounded&&!player.crouched){player.jumpVelocity=3.65;player.grounded=false;tone(120,.12,.035,'sine')}}if(e.code==='KeyV'&&!e.repeat)toggleView();if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='KeyL'&&!e.repeat)toggleDoorLock();if(e.code==='KeyF'&&state.mode==='play'&&!e.repeat){state.flash=!state.flash;tone(state.flash?390:170,.06,.025)}if(e.code==='Escape'&&state.mode==='keypad'){state.mode='play';show('#keypad',false)}else if(e.code==='Escape'&&['pressure','conveyor','ventilation','crane'].includes(state.mode))closePuzzle();else if(e.code==='Escape'&&state.mode==='play'){state.mode='paused';show('#pause')}else if(e.code==='Escape'&&state.mode==='paused'){state.mode='play';show('#pause',false)}});addEventListener('keyup',e=>keys[e.code]=false);
  addEventListener('mousemove',e=>{if(state.viewMode==='3d'&&document.pointerLockElement===activeCanvas()&&state.mode==='play')player.a=norm(player.a+e.movementX*.0024*(babylonView?.ready?-1:1));else if(state.viewMode==='2d'){const r=canvas.getBoundingClientRect();mouseX=(e.clientX-r.left)*W/r.width;mouseY=(e.clientY-r.top)*H/r.height}});for(const target of [canvas,$('#babylon-game')])target.addEventListener('click',()=>{if(state.viewMode==='3d'&&state.mode==='play'&&document.pointerLockElement!==activeCanvas())activeCanvas().requestPointerLock?.()});
  render2D();requestAnimationFrame(loop);
})();
