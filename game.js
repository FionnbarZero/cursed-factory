(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const canvas = $('#game'), ctx = canvas.getContext('2d', { alpha:false });
  const W=canvas.width,H=canvas.height,FOV=Math.PI/3,MAX=20;
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
  const zones=[
    {x:0,y:0,w:8,h:5,n:'RECEIVING'}, {x:8,y:0,w:8,h:5,n:'ASSEMBLY A'},
    {x:0,y:5,w:8,h:6,n:'PRESS HALL'}, {x:8,y:5,w:8,h:6,n:'TURBINE FLOOR'},
    {x:0,y:11,w:8,h:5,n:'MAINTENANCE'}, {x:8,y:11,w:8,h:5,n:'FOREMAN WING'}
  ];
  const state={mode:'menu',start:0,power:false,fuse:false,card:false,flash:true,battery:100,stamina:100,secrets:0,code:'',msgTimer:0,step:0,beat:0,monsterAwake:false,won:false};
  const player={x:1.5,y:3.5,a:0,health:100};
  const monster={x:13.5,y:8.5,a:Math.PI,speed:.45,seen:0,pathTimer:0,target:null};
  const objects=[
    {id:'note',x:4.6,y:3.5,type:'note',label:'READ MAINTENANCE NOTE',active:true},
    {id:'fuse',x:3.5,y:13.5,type:'fuse',label:'TAKE LINE FUSE',active:true},
    {id:'breaker',x:7.5,y:7.5,type:'breaker',label:'USE MAIN BREAKER',active:true},
    {id:'card',x:13.5,y:13.5,type:'card',label:"TAKE FOREMAN'S KEYCARD",active:true},
    {id:'exit',x:14.45,y:1.5,type:'exit',label:'OPEN SECURITY GATE',active:true},
    {id:'secret1',x:1.5,y:8.5,type:'secret',label:'INSPECT WORKER BADGE',active:true},
    {id:'secret2',x:11.5,y:3.5,type:'secret',label:'LISTEN TO RECORDER',active:true},
    {id:'secret3',x:8.5,y:14.5,type:'secret',label:'READ LAST WILL',active:true}
  ];
  const scenery=[
    {x:6.55,y:3.2,type:'machine'}, {x:9.35,y:2.15,type:'conveyor'},
    {x:1.35,y:6.5,type:'pipe'}, {x:3.65,y:8.65,type:'barrels'},
    {x:6.65,y:10.45,type:'sign',text:'PRESS 04'}, {x:12.55,y:6.25,type:'machine'},
    {x:14.55,y:9.5,type:'pipe'}, {x:9.25,y:12.3,type:'boiler'},
    {x:12.5,y:14.65,type:'barrels'}, {x:10.5,y:7.35,type:'conveyor'},
    {x:5.55,y:12.2,type:'steam'}, {x:13.65,y:4.35,type:'steam'}
  ];
  const keys={}; let zBuffer=new Float32Array(W),nearObj=null,last=0,audio=null;

  function wall(x,y){const t=map[Math.floor(y)]?.[Math.floor(x)];return !t||t==='1'||t==='2'||(t==='B'&&!state.power)||(t==='E'&&!state.won)}
  function reset(){Object.assign(state,{mode:'play',start:performance.now(),power:false,fuse:false,card:false,flash:true,battery:100,stamina:100,secrets:0,code:'',msgTimer:0,beat:0,monsterAwake:false,won:false});Object.assign(player,{x:1.5,y:3.5,a:0,health:100});Object.assign(monster,{x:13.5,y:8.5,speed:.45,seen:0,pathTimer:0,target:null});objects.forEach(o=>o.active=true);$('#inv-fuse').className='';$('#inv-card').className='';setObjective('Find a replacement line fuse');}
  function setObjective(t){$('#objective-text').textContent=t;$('#objective').classList.remove('complete');void $('#objective').offsetWidth;$('#objective').classList.add('complete')}
  function message(t,ms=2600){$('#message').textContent=t;$('#message').classList.add('show');state.msgTimer=ms}
  function show(id,on=true){$(id).classList.toggle('visible',on)}
  function begin(){show('#briefing',false);show('#menu',false);show('#hud',true);reset();initAudio();canvas.requestPointerLock?.();}
  function initAudio(){if(audio)return;audio=new (window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sawtooth';osc.frequency.value=44;gain.gain.value=.018;osc.connect(gain).connect(audio.destination);osc.start()}
  function tone(freq,dur=.12,vol=.05,type='square'){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}
  function interact(){if(state.mode!=='play'||!nearObj)return;const o=nearObj;if(o.type==='note'){message('MAINT. NOTE: “Wake the line: FOUR — THREE — ONE.”',4500);o.active=false;tone(500)}
    else if(o.type==='fuse'){state.fuse=true;o.active=false;$('#inv-fuse').classList.add('found');setObjective('Install the fuse at the main breaker');message('LINE FUSE ACQUIRED // SOMETHING HEARD THAT');state.monsterAwake=true;monster.seen=999;tone(90,.8,.12,'sawtooth')}
    else if(o.type==='breaker'){if(state.power){message('THE MAIN LINE IS LIVE')}else if(!state.fuse){message('A REPLACEMENT LINE FUSE IS REQUIRED')}else{state.mode='keypad';show('#keypad');document.exitPointerLock?.();state.code='';drawCode()}}
    else if(o.type==='card'){state.card=true;o.active=false;$('#inv-card').classList.add('found');setObjective('Reach the north security gate');message("FOREMAN'S KEYCARD ACQUIRED");monster.speed=.67;tone(620,.2,.05)}
    else if(o.type==='exit'){if(!state.power)message('SECURITY GATE HAS NO POWER');else if(!state.card)message("FOREMAN'S KEYCARD REQUIRED");else win()}
    else if(o.type==='secret'){o.active=false;state.secrets++;message(['BADGE 044: “M. VALE — DECEASED.”','RECORDER: “It came off the line wearing a man.”','THE WILL IS DATED TOMORROW.'][Math.max(0,state.secrets-1)%3],4000);tone(440)}
  }
  function codePress(n){if(n==='C')state.code='';else if(state.code.length<3)state.code+=n;drawCode();tone(250+Number(n||0)*25,.05,.025);if(state.code.length===3)setTimeout(()=>{if(state.code==='431'){state.power=true;state.mode='play';show('#keypad',false);setObjective("Find the foreman's keycard");message('MAIN POWER RESTORED // ASSEMBLY LINE ACTIVE');monster.speed=.58;tone(55,1,.13,'sawtooth');canvas.requestPointerLock?.()}else{message('INVALID SEQUENCE');state.code='';drawCode();tone(70,.35,.08)}},180)}
  function drawCode(){$('#keypad-display').textContent=[0,1,2].map(i=>state.code[i]||'_').join(' ')}
  function win(){state.won=true;state.mode='end';document.exitPointerLock?.();show('#hud',false);show('#ending');const s=Math.floor((performance.now()-state.start)/1000);$('#stat-time').textContent=`${String(s/60|0).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;$('#stat-secrets').textContent=`${state.secrets} / 3`;tone(523,.8,.07,'sine')}
  function die(){state.mode='end';document.exitPointerLock?.();show('#hud',false);show('#ending');$('#end-label').textContent='SHIFT TERMINATED';$('#end-title').textContent='YOU JOINED THE LINE.';$('#end-copy').textContent='At 02:17, your timecard punches itself.';$('#stat-time').textContent='—';$('#stat-secrets').textContent=`${state.secrets} / 3`;$('#damage').classList.add('hit');tone(38,1.5,.2,'sawtooth')}

  function castRay(a){const dx=Math.cos(a),dy=Math.sin(a);let mx=Math.floor(player.x),my=Math.floor(player.y);const ddx=Math.abs(1/(dx||.0001)),ddy=Math.abs(1/(dy||.0001));let sx,sy,sdx,sdy;if(dx<0){sx=-1;sdx=(player.x-mx)*ddx}else{sx=1;sdx=(mx+1-player.x)*ddx}if(dy<0){sy=-1;sdy=(player.y-my)*ddy}else{sy=1;sdy=(my+1-player.y)*ddy}let side=0,t='1',d=MAX;for(let i=0;i<40;i++){if(sdx<sdy){sdx+=ddx;mx+=sx;side=0}else{sdy+=ddy;my+=sy;side=1}t=map[my]?.[mx]||'1';if(t!=='0'&&!(t==='B'&&state.power)&&!(t==='E'&&state.won)){d=side===0?(mx-player.x+(1-sx)/2)/(dx||.001):(my-player.y+(1-sy)/2)/(dy||.001);break}}let wallX=side===0?player.y+d*dy:player.x+d*dx;wallX-=Math.floor(wallX);return{d:Math.abs(d),side,t,mx,my,wallX}}
  function renderArchitecture(){
    const sky=ctx.createLinearGradient(0,0,0,H/2);sky.addColorStop(0,state.power?'#191814':'#090d0d');sky.addColorStop(1,'#151713');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H/2);
    const floor=ctx.createLinearGradient(0,H/2,0,H);floor.addColorStop(0,'#20211d');floor.addColorStop(.6,'#0b0d0b');floor.addColorStop(1,'#030403');ctx.fillStyle=floor;ctx.fillRect(0,H/2,W,H/2);
    ctx.strokeStyle='rgba(114,119,106,.15)';ctx.lineWidth=1;
    for(let i=-4;i<=4;i++){ctx.beginPath();ctx.moveTo(W/2+i*8,H/2);ctx.lineTo(W/2+i*96,H);ctx.stroke()}
    for(const d of [1,1.35,1.8,2.5,3.5,5,7,10]){const y=H/2+H*.48/d;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.strokeStyle='rgba(117,92,45,.34)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W*.43,H/2);ctx.lineTo(W*.27,H);ctx.moveTo(W*.57,H/2);ctx.lineTo(W*.73,H);ctx.stroke();
    for(const d of [2.2,3,4.3,6.2,9]){const y=H/2-H*.52/d,h=Math.max(2,11/d);ctx.fillStyle='rgba(25,28,25,.86)';ctx.fillRect(0,y,W,h);ctx.fillStyle='rgba(105,92,65,.18)';ctx.fillRect(0,y+h-1,W,1)}
    const lampPulse=state.power?.6+.25*Math.sin(performance.now()/120):.28;
    for(const [x,y] of [[.22,46],[.51,68],[.79,38]]){ctx.fillStyle=`rgba(166,43,32,${lampPulse*.18})`;ctx.beginPath();ctx.arc(W*x,y,28,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(204,55,40,${lampPulse})`;ctx.fillRect(W*x-3,y-1,6,2);ctx.strokeStyle='rgba(30,32,29,.8)';ctx.beginPath();ctx.moveTo(W*x,0);ctx.lineTo(W*x,y-2);ctx.stroke()}
  }
  function render(){renderArchitecture();
    for(let x=0;x<W;x++){
      const ra=player.a-FOV/2+(x/W)*FOV,r=castRay(ra),d=r.d*Math.cos(ra-player.a);zBuffer[x]=d;const wh=Math.min(H*2,H/d),top=(H-wh)/2;
      const industrial=(r.mx*17+r.my*31)%4,base=r.t==='2'?[109,69,29]:r.t==='B'?[94,84,30]:r.t==='E'?[102,32,24]:industrial===0?[75,65,52]:industrial===1?[61,68,65]:[70,72,65];
      let shade=Math.max(.13,1-d/15)*(r.side?.72:1);if(state.power)shade*=1.18;const flicker=state.power&&Math.random()<.004?1.7:1,c=v=>Math.min(255,Math.floor(v*shade*flicker));
      ctx.fillStyle=`rgb(${base.map(c).join(',')})`;ctx.fillRect(x,top,1,wh);
      if(r.t==='B'||r.t==='E'){
        for(let yy=Math.max(0,top|0);yy<Math.min(H,top+wh);yy+=2){const band=(Math.floor(r.wallX*9+((yy-top)/wh)*8)&1);ctx.fillStyle=band?`rgba(19,18,14,${.58*shade})`:`rgba(190,145,32,${.42*shade})`;ctx.fillRect(x,yy,1,2)}
      }else{
        const seam=r.wallX<.025||r.wallX>.975;if(seam){ctx.fillStyle=`rgba(8,10,9,${.55*shade})`;ctx.fillRect(x,top,1,wh)}
        for(const level of [.28,.63]){ctx.fillStyle=`rgba(10,12,10,${.32*shade})`;ctx.fillRect(x,top+wh*level,1,Math.max(1,wh*.008))}
        if((r.wallX>.065&&r.wallX<.085)||(r.wallX>.915&&r.wallX<.935)){for(const level of [.1,.48,.88]){ctx.fillStyle=`rgba(183,170,127,${.55*shade})`;ctx.fillRect(x,top+wh*level,1,Math.max(1,wh*.012))}}
        const rust=(Math.sin(r.wallX*47+r.mx*8+r.my*13)+1)*.5;if(rust>.82){ctx.fillStyle=`rgba(83,38,17,${.34*shade})`;ctx.fillRect(x,top+wh*.7,1,wh*.22)}
      }
    }
    renderSprites();flashlight();
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
    }else if(s.type==='steam'){
      ctx.globalAlpha=.1;for(let i=0;i<5;i++){const drift=Math.sin(t*1.5+i*2.1)*size*.12,y=size*.35-((t*.25+i*.18)%1)*size;ctx.fillStyle='#d7ded8';ctx.beginPath();ctx.ellipse(drift,y,size*(.12+i*.015),size*.19,0,0,Math.PI*2);ctx.fill()}
    }
  }
  function renderSprites(){
    const sprites=scenery.concat(objects.filter(o=>o.active),state.monsterAwake?[{...monster,type:'monster',active:true}]:[]).flat().map(o=>({...o,d:Math.hypot(o.x-player.x,o.y-player.y)})).sort((a,b)=>b.d-a.d);
    const propTypes=new Set(['machine','conveyor','pipe','barrels','boiler','sign','steam']);
    for(const s of sprites){let da=Math.atan2(s.y-player.y,s.x-player.x)-player.a;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;if(Math.abs(da)>FOV*.72)continue;const sx=(.5+da/FOV)*W,sourceSize=propTypes.has(s.type)?125:s.type==='monster'?190:70,size=Math.min(H*1.4,sourceSize/s.d);if(zBuffer[Math.max(0,Math.min(W-1,sx|0))]<s.d*.8)continue;ctx.save();ctx.translate(sx,H/2);
      if(propTypes.has(s.type)){drawFactoryProp(s,size)}
      else if(s.type==='monster'){const bob=Math.sin(performance.now()/160)*2;ctx.fillStyle='rgba(2,2,2,.97)';ctx.beginPath();ctx.ellipse(0,-size*.2+bob,size*.16,size*.23,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-size*.13,-size*.08+bob,size*.26,size*.58);ctx.strokeStyle='#050505';ctx.lineWidth=Math.max(2,size*.08);ctx.beginPath();ctx.moveTo(-size*.1,size*.05);ctx.lineTo(-size*.28,size*.52);ctx.moveTo(size*.1,size*.05);ctx.lineTo(size*.28,size*.52);ctx.stroke();ctx.fillStyle='#b94535';ctx.fillRect(-size*.06,-size*.25+bob,size*.035,size*.018);ctx.fillRect(size*.025,-size*.25+bob,size*.035,size*.018)}
      else{const colors={fuse:'#d5db55',card:'#9ab0a4',breaker:'#b4a84d',exit:'#a33c32',note:'#c9c2a7',secret:'#8e9b8d'};ctx.globalAlpha=.75+.2*Math.sin(performance.now()/250+s.x);ctx.fillStyle=colors[s.type]||'#aaa';ctx.shadowBlur=10;ctx.shadowColor=ctx.fillStyle;if(s.type==='exit'){ctx.fillRect(-size*.35,-size*.7,size*.7,size*1.4);ctx.fillStyle='#111';ctx.fillRect(-size*.27,-size*.6,size*.54,size*1.2);ctx.fillStyle='#a88a2c';for(let i=-3;i<4;i+=2)ctx.fillRect(i*size*.1,-size*.68,size*.1,size*.08)}else{ctx.fillRect(-size*.17,-size*.22,size*.34,size*.44);ctx.strokeStyle='#e8e4cf';ctx.lineWidth=1;ctx.strokeRect(-size*.17,-size*.22,size*.34,size*.44)}}ctx.restore()
    }
  }
  function flashlight(){if(!state.flash||state.battery<=0){ctx.fillStyle='rgba(0,0,0,.46)';ctx.fillRect(0,0,W,H);return}const g=ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,H*.72);g.addColorStop(0,'rgba(230,225,190,.08)');g.addColorStop(.45,'rgba(0,0,0,.04)');g.addColorStop(1,'rgba(0,0,0,.72)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  function update(dt){if(state.mode!=='play')return;const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),strafe=(keys.KeyD?1:0)-(keys.KeyA?1:0),running=keys.ShiftLeft&&forward>0&&state.stamina>1;let speed=(running?3.1:1.65)*dt;if(running)state.stamina=Math.max(0,state.stamina-28*dt);else state.stamina=Math.min(100,state.stamina+15*dt);let dx=(Math.cos(player.a)*forward+Math.cos(player.a+Math.PI/2)*strafe)*speed,dy=(Math.sin(player.a)*forward+Math.sin(player.a+Math.PI/2)*strafe)*speed;if(!wall(player.x+dx,player.y))player.x+=dx;if(!wall(player.x,player.y+dy))player.y+=dy;if(state.flash)state.battery=Math.max(0,state.battery-1.3*dt);else state.battery=Math.min(100,state.battery+.85*dt);if(state.battery<=0)state.flash=false;
    nearObj=null;let best=1.05;for(const o of objects){if(!o.active)continue;const d=Math.hypot(o.x-player.x,o.y-player.y),ang=Math.abs(norm(Math.atan2(o.y-player.y,o.x-player.x)-player.a));if(d<best&&ang<.7){best=d;nearObj=o}}$('#interact').style.display=nearObj?'block':'none';if(nearObj)$('#interact span').textContent=nearObj.label;
    if(state.monsterAwake){const md=Math.hypot(player.x-monster.x,player.y-monster.y),noise=running?8:state.flash?5:2.7;if(md<noise||monster.seen>0){monster.seen=Math.max(monster.seen,2.5);monster.pathTimer-=dt;if(monster.pathTimer<=0){monster.target=nextMonsterStep();monster.pathTimer=.28}const target=monster.target||player,a=Math.atan2(target.y-monster.y,target.x-monster.x),ms=monster.speed*dt*(running?1.15:1),mx=Math.cos(a)*ms,my=Math.sin(a)*ms;if(!wall(monster.x+mx,monster.y))monster.x+=mx;if(!wall(monster.x,monster.y+my))monster.y+=my}monster.seen=Math.max(0,monster.seen-dt);state.beat-=dt;if(md<5&&state.beat<=0){tone(md<2.3?62:48,.08,md<2.3?.07:.035,'sine');state.beat=Math.max(.28,md*.16)}$('#threat').classList.toggle('near',md<4);if(md<.52)die()}
    state.msgTimer-=dt*1000;if(state.msgTimer<=0)$('#message').classList.remove('show');updateHud();
  }
  function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
  function nextMonsterStep(){
    const start=[Math.floor(monster.x),Math.floor(monster.y)], goal=[Math.floor(player.x),Math.floor(player.y)];
    const q=[start], seen=new Set([start.join(',')]), parent=new Map(), dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    while(q.length){const cur=q.shift();if(cur[0]===goal[0]&&cur[1]===goal[1]){let node=cur,prev=cur;while(parent.has(node.join(','))){prev=node;node=parent.get(node.join(','));if(node[0]===start[0]&&node[1]===start[1])return{x:prev[0]+.5,y:prev[1]+.5}}return{x:goal[0]+.5,y:goal[1]+.5}}
      for(const d of dirs){const n=[cur[0]+d[0],cur[1]+d[1]],k=n.join(',');if(!seen.has(k)&&!wall(n[0]+.5,n[1]+.5)){seen.add(k);parent.set(k,cur);q.push(n)}}}
    return null;
  }
  function updateHud(){const st=Math.round(state.stamina),ba=Math.round(state.battery);$('#stamina-value').textContent=st;$('#stamina-bar').style.width=st+'%';$('#battery-value').textContent=ba;$('#battery-bar').style.width=ba+'%';$('.meter').classList.toggle('low',st<20);$('.meter.battery').classList.toggle('low',ba<20);const z=zones.find(z=>player.x>=z.x&&player.x<z.x+z.w&&player.y>=z.y&&player.y<z.y+z.h);if(z)$('#location').textContent=z.n;const sec=Math.floor((performance.now()-state.start));const base=(2*3600+17*60)*1000+sec;$('#clock').textContent=new Date(base).toISOString().slice(11,19)}
  function loop(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;update(dt);render();requestAnimationFrame(loop)}

  $('#start-btn').onclick=()=>{show('#menu',false);show('#briefing')};$('#enter-btn').onclick=begin;$('#how-btn').onclick=()=>show('#how');$('#how-close').onclick=()=>show('#how',false);$('#resume-btn').onclick=()=>canvas.requestPointerLock?.();$('#restart-btn').onclick=()=>location.reload();
  const keysEl=$('#keys');[1,2,3,4,5,6,7,8,9,'C',0].forEach(n=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>codePress(String(n));keysEl.appendChild(b)});
  addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')interact();if(e.code==='KeyF'&&state.mode==='play'){state.flash=!state.flash;tone(state.flash?390:170,.06,.025)}if(e.code==='Escape'&&state.mode==='keypad'){state.mode='play';show('#keypad',false);canvas.requestPointerLock?.()}});addEventListener('keyup',e=>keys[e.code]=false);
  addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&state.mode==='play')player.a=norm(player.a+e.movementX*.0024)});
  document.addEventListener('pointerlockchange',()=>{if(state.mode==='play'){const paused=document.pointerLockElement!==canvas;show('#pause',paused);if(paused){state.mode='paused'}}else if(state.mode==='paused'&&document.pointerLockElement===canvas){state.mode='play';show('#pause',false)}});
  canvas.addEventListener('click',()=>{if(state.mode==='play')canvas.requestPointerLock?.()});
  render();requestAnimationFrame(loop);
})();
