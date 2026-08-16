(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const canvas = $('#game'), ctx = canvas.getContext('2d', { alpha:false });
  const W=canvas.width,H=canvas.height,SCALE=H/270,FOV=Math.PI/3,MAX=20;
  ctx.imageSmoothingEnabled=true;
  const map=[
    '1111111111111111',
    '10000001000000E1',
    '1002000100111001',
    '1000000000000001',
    '1011100111011101',
    '1000100001000001',
    '1000111001011101',
    '1000000B00000001',
    '1011100000110101',
    '1000101110000101',
    '1000001000000001',
    '1011001001111001',
    '1000000000000001',
    '1001110111100001',
    '1000000000000001',
    '1111111111111111'
  ].map(r=>r.split(''));
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
  const zones=[
    {x:0,y:0,w:8,h:5,n:'RECEIVING'}, {x:8,y:0,w:8,h:5,n:'ASSEMBLY A'},
    {x:0,y:5,w:8,h:6,n:'PRESS HALL'}, {x:8,y:5,w:8,h:6,n:'TURBINE FLOOR'},
    {x:0,y:11,w:8,h:5,n:'MAINTENANCE'}, {x:8,y:11,w:8,h:5,n:'FOREMAN WING'}
  ];
  const state={mode:'menu',start:0,power:false,fuse:false,pressureSolved:false,lineSolved:false,card:false,flash:true,battery:100,stamina:100,secrets:0,deaths:0,code:'',pressure:[0,0,0],lineSequence:[],msgTimer:0,step:0,beat:0,machineTimer:2,alarm:0,pressPulse:0,won:false};
  const player={x:1.5,y:3.5,a:0,health:100};
  const monsters=[
    {id:'geared',kind:'geared',sx:13.5,sy:8.5,x:13.5,y:8.5,speed:.5,seen:0,pathTimer:0,target:null,active:false,victim:'elias'},
    {id:'crawler',kind:'crawler',sx:13.5,sy:3.5,x:13.5,y:3.5,speed:.72,seen:0,pathTimer:0,target:null,active:false,victim:'ren'},
    {id:'warden',kind:'warden',sx:14.5,sy:14.5,x:14.5,y:14.5,speed:.6,seen:0,pathTimer:0,target:null,active:false,victim:null}
  ];
  const workers=[
    {id:'elias',name:'ELIAS',sx:12.5,sy:12.5,x:12.5,y:12.5,escapeX:1.5,escapeY:14.5,speed:.31,pathTimer:0,target:null,alive:true},
    {id:'ren',name:'REN',sx:12.5,sy:3.5,x:12.5,y:3.5,escapeX:1.5,escapeY:3.5,speed:.38,pathTimer:0,target:null,alive:true}
  ];
  const objects=[
    {id:'note',x:4.5,y:3.91,mount:'S',type:'note',label:'READ MAINTENANCE NOTE',active:true},
    {id:'fuse',x:2.5,y:13.5,floorItem:true,type:'fuse',label:'TAKE LINE FUSE',active:true},
    {id:'breaker',x:6.5,y:7.09,mount:'N',type:'breaker',label:'USE MAIN BREAKER',active:true},
    {id:'pressureChart',x:9.5,y:3.91,mount:'S',type:'diagram',label:'READ PRESSURE CHART',active:true},
    {id:'pressurePanel',x:13.5,y:5.91,mount:'S',type:'pressure',label:'OPERATE STEAM MANIFOLD',active:true},
    {id:'linePanel',x:10.5,y:7.91,mount:'S',type:'conveyorPanel',label:'OPERATE LINE CONTROLS',active:true},
    {id:'card',x:11.09,y:13.5,mount:'W',type:'card',label:"TAKE FOREMAN'S KEYCARD",active:false},
    {id:'exit',x:14.45,y:1.5,type:'exit',label:'OPEN SECURITY GATE',active:true},
    {id:'alarm',x:7.5,y:3.09,mount:'N',type:'alarm',label:'PULL EMERGENCY ALARM',active:true},
    {id:'locker',x:2.5,y:10.91,mount:'S',type:'locker',label:'SEARCH SUPPLY LOCKER',active:true},
    {id:'pressSwitch',x:5.91,y:10.5,mount:'E',type:'pressSwitch',label:'CYCLE HYDRAULIC PRESS',active:true},
    {id:'secret1',x:1.09,y:8.5,mount:'W',type:'secret',label:'INSPECT WORKER BADGE',active:true},
    {id:'secret2',x:11.5,y:3.09,mount:'N',type:'secret',label:'LISTEN TO RECORDER',active:true},
    {id:'secret3',x:8.5,y:14.91,mount:'S',type:'secret',label:'READ LAST WILL',active:true}
  ];
  const scenery=[
    {x:6.55,y:3.2,type:'machine'}, {x:9.35,y:2.15,type:'conveyor'},
    {x:1.35,y:6.5,type:'pipe'}, {x:3.65,y:8.65,type:'barrels'},
    {x:6.65,y:10.45,type:'sign',text:'PRESS 04'}, {x:12.55,y:6.25,type:'machine'},
    {x:14.55,y:9.5,type:'pipe'}, {x:9.25,y:12.3,type:'boiler'},
    {x:12.5,y:14.65,type:'barrels'}, {x:10.5,y:7.35,type:'conveyor'},
    {x:5.55,y:12.2,type:'steam'}, {x:13.65,y:4.35,type:'steam'},
    {x:2.25,y:5.3,type:'crate'}, {x:5.45,y:5.7,type:'robotarm'},
    {x:8.35,y:10.55,type:'fan'}, {x:13.45,y:10.4,type:'cabinet'},
    {x:4.5,y:14.65,type:'pallet'}, {x:11.5,y:3.25,type:'hook'},
    {x:8.35,y:3.3,type:'pressMachine'}, {x:2.35,y:12.3,type:'cabinet'}
  ];
  const keys={}; let zBuffer=new Float32Array(W),nearObj=null,last=0,audio=null,walkPhase=0,moveBlend=0,viewBob=0,viewSway=0;

  function wall(x,y){const t=map[Math.floor(y)]?.[Math.floor(x)];return !t||t==='1'||t==='2'||(t==='B'&&!state.power)||(t==='E'&&!state.won)}
  function reset(){Object.assign(state,{mode:'play',start:performance.now(),power:false,fuse:false,pressureSolved:false,lineSolved:false,card:false,flash:true,battery:100,stamina:100,secrets:0,deaths:0,code:'',pressure:[0,0,0],lineSequence:[],msgTimer:0,beat:0,machineTimer:2,alarm:0,pressPulse:0,won:false});Object.assign(player,{x:1.5,y:3.5,a:0,health:100});monsters.forEach(m=>Object.assign(m,{x:m.sx,y:m.sy,seen:0,pathTimer:0,target:null,active:false}));workers.forEach(w=>Object.assign(w,{x:w.sx,y:w.sy,pathTimer:0,target:null,alive:true}));objects.forEach(o=>o.active=o.id!=='card');$('#inv-fuse').className='';$('#inv-card').className='';setObjective('Find a replacement line fuse');}
  function setObjective(t){$('#objective-text').textContent=t;$('#objective').classList.remove('complete');void $('#objective').offsetWidth;$('#objective').classList.add('complete')}
  function message(t,ms=2600){$('#message').textContent=t;$('#message').classList.add('show');state.msgTimer=ms}
  function show(id,on=true){$(id).classList.toggle('visible',on)}
  function begin(){show('#briefing',false);show('#menu',false);show('#hud',true);reset();initAudio();canvas.requestPointerLock?.();}
  function initAudio(){if(audio)return;audio=new (window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sawtooth';osc.frequency.value=44;gain.gain.value=.018;osc.connect(gain).connect(audio.destination);osc.start()}
  function tone(freq,dur=.12,vol=.05,type='square'){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}
  function activateMonster(id){const m=monsters.find(m=>m.id===id);if(m&&!m.active){m.active=true;m.seen=999;tone(m.kind==='crawler'?75:48,.7,.1,'sawtooth')}}
  function openPuzzle(id){state.mode=id.slice(1);show(id);document.exitPointerLock?.()}
  function closePuzzle(){for(const id of ['#pressure','#conveyor'])show(id,false);state.mode='play';canvas.requestPointerLock?.()}
  function interact(){if(state.mode!=='play'||!nearObj)return;const o=nearObj;
    if(o.type==='note'){message('MAINT. NOTE: “Wake the line: FOUR — THREE — ONE.”',4500);o.active=false;tone(500)}
    else if(o.type==='diagram'){message('PRESSURE CHART: INTAKE 4 // PRESS 7 // EXHAUST 2',5200);tone(510)}
    else if(o.type==='fuse'){state.fuse=true;o.active=false;$('#inv-fuse').classList.add('found');setObjective('Install the fuse at the main breaker');message('LINE FUSE ACQUIRED // SOMETHING HEARD THAT');activateMonster('geared')}
    else if(o.type==='breaker'){if(state.power){message('THE MAIN LINE IS LIVE')}else if(!state.fuse){message('A REPLACEMENT LINE FUSE IS REQUIRED')}else{state.mode='keypad';show('#keypad');document.exitPointerLock?.();state.code='';drawCode()}}
    else if(o.type==='pressure'){if(!state.power)message('THE STEAM MANIFOLD HAS NO POWER');else if(state.pressureSolved)message('PRESSURE HOLDING AT SAFE OPERATING LEVELS');else openPuzzle('#pressure')}
    else if(o.type==='conveyorPanel'){if(!state.power)message('LINE CONTROLS HAVE NO POWER');else if(!state.pressureSolved)message('STEAM PRESSURE MUST BE EQUALIZED FIRST');else if(state.lineSolved)message('PRODUCTION LINE RUNNING');else openPuzzle('#conveyor')}
    else if(o.type==='card'){state.card=true;o.active=false;$('#inv-card').classList.add('found');setObjective('Reach the north security gate');message("FOREMAN'S KEYCARD ACQUIRED // ALL CREATURES ALERTED");monsters.forEach(m=>{if(m.active)m.seen=999});tone(620,.2,.05)}
    else if(o.type==='exit'){if(!state.power)message('SECURITY GATE HAS NO POWER');else if(!state.lineSolved)message('SECURITY INTERLOCK: PRODUCTION LINE OFFLINE');else if(!state.card)message("FOREMAN'S KEYCARD REQUIRED");else win()}
    else if(o.type==='alarm'){state.alarm=8;monsters.forEach(m=>{if(m.active)m.seen=999});message('EMERGENCY ALARM PULLED // THEY ARE COMING');tone(170,1,.12,'sawtooth')}
    else if(o.type==='locker'){o.active=false;state.battery=100;message('FOUND: FRESH BATTERY + SHIFT ROSTER');tone(650)}
    else if(o.type==='pressSwitch'){state.pressPulse=2;monsters.forEach(m=>{if(m.active)m.seen=999});message('HYDRAULIC PRESS CYCLED // THE IMPACT ECHOES');tone(52,.8,.13,'square')}
    else if(o.type==='secret'){o.active=false;state.secrets++;message(['BADGE 044: “M. VALE — DECEASED.”','RECORDER: “It came off the line wearing a man.”','THE WILL IS DATED TOMORROW.'][Math.max(0,state.secrets-1)%3],4000);tone(440)}
  }
  function codePress(n){if(n==='C')state.code='';else if(state.code.length<3)state.code+=n;drawCode();tone(250+Number(n||0)*25,.05,.025);if(state.code.length===3)setTimeout(()=>{if(state.code==='431'){state.power=true;state.mode='play';show('#keypad',false);setObjective('Read the pressure chart and equalize steam');message('MAIN POWER RESTORED // STEAM PRESSURE CRITICAL');activateMonster('crawler');tone(55,1,.13,'sawtooth');canvas.requestPointerLock?.()}else{message('INVALID SEQUENCE // ALARM SIGNAL TRANSMITTED');monsters.forEach(m=>{if(m.active)m.seen=999});state.code='';drawCode();tone(70,.35,.08)}},180)}
  function pressurePress(index){state.pressure[index]=(state.pressure[index]+1)%10;const el=$(`.pressure-dial[data-pressure="${index}"]`);el.querySelector('b').textContent=state.pressure[index];el.querySelector('i').style.transform=`translateX(-50%) rotate(${-135+state.pressure[index]*27}deg)`;tone(210+index*70,.05,.025)}
  function submitPressure(){if(state.pressure.join('')==='472'){state.pressureSolved=true;closePuzzle();setObjective('Restart the production line');message('STEAM PRESSURE EQUALIZED // ACCESS LINE CONTROLS');activateMonster('warden');tone(90,1,.1,'sawtooth')}else{message('PRESSURE IMBALANCE // MANIFOLD RESET');state.pressure=[0,0,0];document.querySelectorAll('.pressure-dial').forEach((el,i)=>{el.querySelector('b').textContent='0';el.querySelector('i').style.transform='translateX(-50%) rotate(-135deg)'});monsters.forEach(m=>{if(m.active)m.seen=999});tone(65,.5,.1)}}
  function linePress(n){if(state.lineSequence.length>=3)return;state.lineSequence.push(n);document.querySelectorAll('#sequence-display i')[state.lineSequence.length-1].classList.add('on');document.querySelector(`[data-line="${n}"]`).classList.add('pressed');tone(260+n*75,.12,.04);if(state.lineSequence.length===3)setTimeout(()=>{if(state.lineSequence.join('')==='213'){state.lineSolved=true;closePuzzle();objects.find(o=>o.id==='card').active=true;setObjective("Take the foreman's released keycard");message('PRODUCTION LINE RUNNING // KEYCARD CABINET RELEASED');tone(58,1.2,.12,'sawtooth')}else{$('#line-status').textContent='INTERLOCK FAULT — SEQUENCE RESET';state.lineSequence=[];document.querySelectorAll('#sequence-display i').forEach(i=>i.classList.remove('on'));document.querySelectorAll('.line-buttons button').forEach(b=>b.classList.remove('pressed'));monsters.forEach(m=>{if(m.active)m.seen=999});tone(58,.6,.1)}},300)}
  function drawCode(){$('#keypad-display').textContent=[0,1,2].map(i=>state.code[i]||'_').join(' ')}
  function win(){state.won=true;state.mode='end';document.exitPointerLock?.();show('#hud',false);show('#ending');const s=Math.floor((performance.now()-state.start)/1000);$('#stat-time').textContent=`${String(s/60|0).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;$('#stat-secrets').textContent=`${state.secrets} / 3`;$('#stat-deaths').textContent=`${state.deaths} / 2`;tone(523,.8,.07,'sine')}
  function die(){state.mode='end';document.exitPointerLock?.();show('#hud',false);show('#ending');$('#end-label').textContent='SHIFT TERMINATED';$('#end-title').textContent='YOU JOINED THE LINE.';$('#end-copy').textContent='At 02:17, your timecard punches itself.';$('#stat-time').textContent='—';$('#stat-secrets').textContent=`${state.secrets} / 3`;$('#stat-deaths').textContent=`${state.deaths} / 2`;$('#damage').classList.add('hit');tone(38,1.5,.2,'sawtooth')}

  function castRay(a){const dx=Math.cos(a),dy=Math.sin(a);let mx=Math.floor(player.x),my=Math.floor(player.y);const ddx=Math.abs(1/(dx||.0001)),ddy=Math.abs(1/(dy||.0001));let sx,sy,sdx,sdy;if(dx<0){sx=-1;sdx=(player.x-mx)*ddx}else{sx=1;sdx=(mx+1-player.x)*ddx}if(dy<0){sy=-1;sdy=(player.y-my)*ddy}else{sy=1;sdy=(my+1-player.y)*ddy}let side=0,t='1',d=MAX;for(let i=0;i<40;i++){if(sdx<sdy){sdx+=ddx;mx+=sx;side=0}else{sdy+=ddy;my+=sy;side=1}t=map[my]?.[mx]||'1';if(t!=='0'&&!(t==='B'&&state.power)&&!(t==='E'&&state.won)){d=side===0?(mx-player.x+(1-sx)/2)/(dx||.001):(my-player.y+(1-sy)/2)/(dy||.001);break}}let wallX=side===0?player.y+d*dy:player.x+d*dx;wallX-=Math.floor(wallX);return{d:Math.abs(d),side,t,mx,my,wallX}}
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
      const industrial=Math.abs(r.mx*17+r.my*31)%5,kind=r.t==='2'?'machine':(r.t==='B'||r.t==='E')?'hazard':industrial===0?'rust':industrial<3?'steel':'concrete',tex=wallTextures[kind];let tx=Math.floor(r.wallX*95);if((r.side===0&&Math.cos(ra)>0)||(r.side===1&&Math.sin(ra)<0))tx=95-tx;ctx.drawImage(tex,tx,0,1,96,x,top,1,wh);
      let shade=Math.max(.12,1-d/16)*(r.side?.77:1);if(state.power)shade=Math.min(1,shade*1.12);const beam=state.flash?Math.max(0,1-Math.abs(x-W/2)/(W*.38))*Math.max(0,1-d/11):0;ctx.fillStyle=`rgba(0,4,3,${Math.max(0,1-shade)*.9})`;ctx.fillRect(x,top,1,wh);if(beam>0){ctx.fillStyle=`rgba(221,207,158,${beam*.13})`;ctx.fillRect(x,top,1,wh)}
    }
    renderSprites();ctx.restore();renderAtmosphere();flashlight();
  }
  function drawFactoryProp(s,size){
    const t=performance.now()/1000;ctx.lineJoin='round';
    if(s.type==='machine'){
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
    }else if(s.type==='boiler'){
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
    const actors=monsters.filter(m=>m.active).map(m=>({...m,type:'monster'})).concat(workers.map(w=>({...w,type:'worker'})));
    const sprites=scenery.concat(objects.filter(o=>o.active),actors).map(o=>({...o,d:Math.hypot(o.x-player.x,o.y-player.y)})).sort((a,b)=>b.d-a.d);
    const propTypes=new Set(['machine','conveyor','pipe','barrels','boiler','sign','steam','crate','pallet','fan','cabinet','robotarm','hook','pressMachine']);
    const controlTypes=new Set(['breaker','pressure','conveyorPanel','alarm','locker','pressSwitch','diagram']);
    for(const s of sprites){let da=Math.atan2(s.y-player.y,s.x-player.x)-player.a;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;if(Math.abs(da)>FOV*.72)continue;const sx=(.5+da/FOV)*W,sourceSize=(propTypes.has(s.type)?125:s.type==='monster'?190:s.type==='worker'?150:controlTypes.has(s.type)?105:70)*SCALE,size=Math.min(H*1.4,sourceSize/s.d);if(zBuffer[Math.max(0,Math.min(W-1,sx|0))]<s.d*.8)continue;ctx.save();ctx.translate(sx,H/2+(s.floorItem?size*.37:0));if(!s.mount&&s.type!=='steam'&&s.type!=='hook'){ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(0,size*.48,size*.4,size*.075,0,0,Math.PI*2);ctx.fill()}
      if(propTypes.has(s.type))drawFactoryProp(s,size);
      else if(s.type==='monster')drawMonster(s,size);
      else if(s.type==='worker')drawWorker(s,size);
      else if(controlTypes.has(s.type)){
        ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(-size*.35,-size*.48,size*.7,size*.96);ctx.strokeStyle='#2b302c';ctx.lineWidth=Math.max(2,size*.045);ctx.beginPath();ctx.moveTo(0,-size*.72);ctx.lineTo(0,-size*.47);ctx.stroke();
        ctx.fillStyle=s.type==='alarm'?'#772c26':'#323934';ctx.fillRect(-size*.3,-size*.43,size*.6,size*.86);ctx.strokeStyle='#8a8d81';ctx.lineWidth=Math.max(1,size*.012);ctx.strokeRect(-size*.3,-size*.43,size*.6,size*.86);
        ctx.fillStyle='#b5aa81';for(const x of [-.25,.25])for(const y of [-.38,.38]){ctx.beginPath();ctx.arc(size*x,size*y,Math.max(1,size*.018),0,Math.PI*2);ctx.fill()}
        ctx.fillStyle='#111411';ctx.fillRect(-size*.2,-size*.3,size*.4,size*.22);ctx.fillStyle=state.power?'#bdc64d':'#793027';ctx.beginPath();ctx.arc(0,-size*.19,size*.055,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a58c35';ctx.font=`bold ${Math.max(5,size*.1)}px monospace`;ctx.textAlign='center';ctx.fillText({breaker:'MAIN',pressure:'PSI',conveyorPanel:'LINE',alarm:'ALARM',locker:'SUPPLY',pressSwitch:'PRESS',diagram:'4·7·2'}[s.type],0,size*.18)
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
  function update(dt){if(state.mode!=='play')return;const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),strafe=(keys.KeyD?1:0)-(keys.KeyA?1:0),running=keys.ShiftLeft&&forward>0&&state.stamina>1;let speed=(running?3.1:1.65)*dt;if(running)state.stamina=Math.max(0,state.stamina-28*dt);else state.stamina=Math.min(100,state.stamina+15*dt);let dx=(Math.cos(player.a)*forward+Math.cos(player.a+Math.PI/2)*strafe)*speed,dy=(Math.sin(player.a)*forward+Math.sin(player.a+Math.PI/2)*strafe)*speed;if(!wall(player.x+dx,player.y))player.x+=dx;if(!wall(player.x,player.y+dy))player.y+=dy;if(state.flash)state.battery=Math.max(0,state.battery-1.3*dt);else state.battery=Math.min(100,state.battery+.85*dt);if(state.battery<=0)state.flash=false;const moving=Math.abs(forward)+Math.abs(strafe)>0;moveBlend+=(Number(moving)-moveBlend)*Math.min(1,dt*9);if(moving)walkPhase+=dt*(running?7.8:5.3);viewBob=Math.sin(walkPhase*2)*3.2*SCALE*moveBlend;viewSway=Math.sin(walkPhase)*2.1*SCALE*moveBlend;
    nearObj=null;let best=1.05;for(const o of objects){if(!o.active)continue;const d=Math.hypot(o.x-player.x,o.y-player.y),ang=Math.abs(norm(Math.atan2(o.y-player.y,o.x-player.x)-player.a));if(d<best&&ang<.7){best=d;nearObj=o}}$('#interact').style.display=nearObj?'block':'none';if(nearObj)$('#interact span').textContent=nearObj.label;
    for(const w of workers){if(!w.alive)continue;const hunter=monsters.find(m=>m.active&&m.victim===w.id);if(!hunter)continue;w.pathTimer-=dt;if(w.pathTimer<=0){w.target=nextStep(w,{x:w.escapeX,y:w.escapeY});w.pathTimer=.38}moveEntity(w,w.target,w.speed*dt)}
    let nearest=99;const noise=running?8:state.flash?5:2.7;
    for(const m of monsters){if(!m.active)continue;const victim=workers.find(w=>w.id===m.victim&&w.alive),prey=victim||player,md=Math.hypot(player.x-m.x,player.y-m.y);nearest=Math.min(nearest,md);if(victim||md<noise||m.seen>0||state.alarm>0){m.seen=Math.max(m.seen,2.5);m.pathTimer-=dt;if(m.pathTimer<=0){m.target=nextStep(m,prey);m.pathTimer=m.kind==='crawler'?.18:.28}moveEntity(m,m.target,m.speed*dt*(running&&!victim?1.15:1))}m.seen=Math.max(0,m.seen-dt);
      if(victim&&Math.hypot(victim.x-m.x,victim.y-m.y)<.48){victim.alive=false;state.deaths++;m.seen=999;message(`${victim.name} WAS KILLED BY ${m.kind==='crawler'?'THE CRAWLER':'THE GEARED MAN'}`,4200);tone(105,.7,.14,'sawtooth')}
      if(md<.52){die();break}}
    state.beat-=dt;if(nearest<5&&state.beat<=0){tone(nearest<2.3?62:48,.08,nearest<2.3?.07:.035,'sine');state.beat=Math.max(.28,nearest*.16)}$('#threat').classList.toggle('near',nearest<4);
    state.alarm=Math.max(0,state.alarm-dt);state.pressPulse=Math.max(0,state.pressPulse-dt);if(state.power){state.machineTimer-=dt;if(state.machineTimer<=0){tone(72+Math.random()*45,.12,.018,'square');state.machineTimer=1.8+Math.random()*3.2}}
    state.msgTimer-=dt*1000;if(state.msgTimer<=0)$('#message').classList.remove('show');updateHud();
  }
  function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
  function moveEntity(entity,target,amount){if(!target)return;const a=Math.atan2(target.y-entity.y,target.x-entity.x),mx=Math.cos(a)*amount,my=Math.sin(a)*amount;if(!wall(entity.x+mx,entity.y))entity.x+=mx;if(!wall(entity.x,entity.y+my))entity.y+=my}
  function nextStep(entity,destination){
    const start=[Math.floor(entity.x),Math.floor(entity.y)], goal=[Math.floor(destination.x),Math.floor(destination.y)];
    const q=[start], seen=new Set([start.join(',')]), parent=new Map(), dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    while(q.length){const cur=q.shift();if(cur[0]===goal[0]&&cur[1]===goal[1]){let node=cur,prev=cur;while(parent.has(node.join(','))){prev=node;node=parent.get(node.join(','));if(node[0]===start[0]&&node[1]===start[1])return{x:prev[0]+.5,y:prev[1]+.5}}return{x:goal[0]+.5,y:goal[1]+.5}}
      for(const d of dirs){const n=[cur[0]+d[0],cur[1]+d[1]],k=n.join(',');if(!seen.has(k)&&!wall(n[0]+.5,n[1]+.5)){seen.add(k);parent.set(k,cur);q.push(n)}}}
    return null;
  }
  function updateHud(){const st=Math.round(state.stamina),ba=Math.round(state.battery);$('#stamina-value').textContent=st;$('#stamina-bar').style.width=st+'%';$('#battery-value').textContent=ba;$('#battery-bar').style.width=ba+'%';$('.meter').classList.toggle('low',st<20);$('.meter.battery').classList.toggle('low',ba<20);const z=zones.find(z=>player.x>=z.x&&player.x<z.x+z.w&&player.y>=z.y&&player.y<z.y+z.h);if(z)$('#location').textContent=z.n;const sec=Math.floor((performance.now()-state.start));const base=(2*3600+17*60)*1000+sec;$('#clock').textContent=new Date(base).toISOString().slice(11,19)}
  function loop(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;update(dt);render();requestAnimationFrame(loop)}

  $('#start-btn').onclick=()=>{show('#menu',false);show('#briefing')};$('#enter-btn').onclick=begin;$('#how-btn').onclick=()=>show('#how');$('#how-close').onclick=()=>show('#how',false);$('#resume-btn').onclick=()=>canvas.requestPointerLock?.();$('#restart-btn').onclick=()=>location.reload();
  const keysEl=$('#keys');[1,2,3,4,5,6,7,8,9,'C',0].forEach(n=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>codePress(String(n));keysEl.appendChild(b)});
  document.querySelectorAll('.pressure-dial').forEach(el=>el.onclick=()=>pressurePress(Number(el.dataset.pressure)));$('#pressure-submit').onclick=submitPressure;document.querySelectorAll('[data-line]').forEach(el=>el.onclick=()=>linePress(Number(el.dataset.line)));document.querySelectorAll('[data-close-puzzle]').forEach(el=>el.onclick=closePuzzle);
  addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'&&state.mode==='play'){state.flash=!state.flash;tone(state.flash?390:170,.06,.025)}if(e.code==='Escape'&&state.mode==='keypad'){state.mode='play';show('#keypad',false);canvas.requestPointerLock?.()}else if(e.code==='Escape'&&(state.mode==='pressure'||state.mode==='conveyor'))closePuzzle()});addEventListener('keyup',e=>keys[e.code]=false);
  addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&state.mode==='play')player.a=norm(player.a+e.movementX*.0024)});
  document.addEventListener('pointerlockchange',()=>{if(state.mode==='play'){const paused=document.pointerLockElement!==canvas;show('#pause',paused);if(paused){state.mode='paused'}}else if(state.mode==='paused'&&document.pointerLockElement===canvas){state.mode='play';show('#pause',false)}});
  canvas.addEventListener('click',()=>{if(state.mode==='play')canvas.requestPointerLock?.()});
  render();requestAnimationFrame(loop);
})();
