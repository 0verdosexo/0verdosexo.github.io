/* data.js — every weapon, throwable, special, perk and game mode in one place.
   Damage is against 100 HP. Spread is in degrees. Ranges in metres. */
'use strict';
const CATS={ar:'돌격소총',smg:'기관단총',sg:'산탄총',sr:'정밀 사격',other:'특수 화기',pistol:'권총',melee:'근접'};
/* defaults applied to every gun, then overridden per weapon */
const WDEF={slot:'main',mode:'auto',burst:0,burstRpm:0,pellets:1,spread:1.5,ads:0.45,move:1.6,recoil:0.9,range:20,far:55,min:0.6,proj:null,pspeed:0,pgrav:0,pierce:0,
  zoom:0.82,scope:false,speed:1,sw:0.45,shell:false,splash:null,revFall:false,slow:0,knock:0,shield:false,snd:'rifle_ar',sndRate:1,head:1.5,res:150};
const WPN={
 // ---------- melee ----------
 fists:{name:'주먹',cat:'melee',slot:'melee',dmg:25,rate:0.42,reach:1.9,arc:0.9,mode:'melee',speed:1.08,desc:'빠른 연타. 가장 가볍게 움직여요.'},
 knife:{name:'나이프',cat:'melee',slot:'melee',dmg:45,rate:0.5,reach:2.1,arc:0.8,mode:'melee',speed:1.08,backstab:100,desc:'등 뒤에서 찌르면 한 방.'},
 axe:{name:'소방 도끼',cat:'melee',slot:'melee',dmg:70,rate:0.95,reach:2.4,arc:1.0,mode:'melee',speed:1.0,desc:'느리지만 두 방에 쓰러뜨려요.'},
 // ---------- sidearms ----------
 p1912:{name:'1912',cat:'pistol',slot:'side',dmg:22,rpm:360,mag:8,res:48,reload:1.4,mode:'semi',spread:1.1,range:18,far:40,recoil:1.4,sw:0.3,snd:'pistol_heavy',desc:'믿음직한 반자동 권총.'},
 deagle:{name:'Deagle',cat:'pistol',slot:'side',dmg:45,rpm:200,mag:7,res:35,reload:1.7,mode:'semi',spread:1.5,range:22,far:50,recoil:3.4,sw:0.35,snd:'magnum',desc:'강력하지만 반동이 커요.'},
 auto75:{name:'75 Auto',cat:'pistol',slot:'side',dmg:13,rpm:900,mag:18,res:90,reload:1.5,mode:'auto',spread:2.6,range:12,far:30,recoil:0.7,sw:0.3,snd:'pistol_light',desc:'자동 권총. 근거리 순간 화력.'},
 revolver:{name:'리볼버',cat:'pistol',slot:'side',dmg:55,rpm:150,mag:6,res:36,reload:2.4,mode:'semi',spread:0.9,range:25,far:55,recoil:3.8,sw:0.35,snd:'revolver',desc:'권총 중 가장 센 한 방.'},
 burst9:{name:'9mm Burst',cat:'pistol',slot:'side',dmg:17,rpm:190,mag:21,res:105,reload:1.6,mode:'burst',burst:3,burstRpm:1100,spread:1.4,range:16,far:38,recoil:1.0,sw:0.3,snd:'pistol',desc:'3점사 권총.'},
 crossbow:{name:'석궁',cat:'pistol',slot:'side',dmg:80,rpm:60,mag:1,res:15,reload:1.3,mode:'semi',proj:'bolt',pspeed:70,pgrav:6,spread:0.3,recoil:1.2,sw:0.4,snd:'bow',silent:true,desc:'소리 없는 화살. 머리에 맞으면 한 방.'},
 flintlock:{name:'플린트락',cat:'pistol',slot:'side',dmg:95,rpm:60,mag:1,res:12,reload:2.8,mode:'semi',spread:0.6,range:20,far:45,recoil:5,sw:0.4,snd:'flintlock',smokePuff:true,desc:'한 발, 거대한 피해, 긴 장전.'},
 shuriken:{name:'수리검',cat:'pistol',slot:'side',dmg:30,rpm:240,mag:6,res:18,reload:1.2,mode:'semi',proj:'shuriken',pspeed:42,pgrav:3,spread:0.5,recoil:0.3,sw:0.25,snd:'throw',silent:true,desc:'빠르게 던지는 표창.'},
 // ---------- SMG ----------
 smg9:{name:'9mm SMG',cat:'smg',dmg:13,rpm:800,mag:30,res:150,reload:1.9,spread:2.1,range:14,far:35,recoil:0.55,move:0.8,speed:1.03,snd:'smg',desc:'균형 잡힌 기관단총.'},
 microsmg:{name:'Micro SMG',cat:'smg',dmg:11,rpm:1100,mag:25,res:150,reload:1.6,spread:3.0,range:10,far:28,recoil:0.45,move:0.6,speed:1.05,snd:'smg2',sndRate:1.15,desc:'연사력 최고, 근접 전용.'},
 p50:{name:'P50',cat:'smg',dmg:12,rpm:900,mag:50,res:200,reload:2.6,spread:2.3,range:14,far:34,recoil:0.45,move:0.8,speed:1.03,snd:'smg',sndRate:1.08,desc:'탄창 50발.'},
 vector:{name:'Vector',cat:'smg',dmg:12,rpm:1250,mag:25,res:150,reload:1.7,spread:2.0,range:12,far:30,recoil:0.4,move:0.7,speed:1.04,snd:'smg2',sndRate:1.25,desc:'엄청난 연사력.'},
 // ---------- AR ----------
 m4:{name:'M4',cat:'ar',dmg:14,rpm:750,mag:30,res:150,reload:2.1,spread:1.3,range:24,far:60,recoil:0.75,snd:'rifle_ar',desc:'기본기가 좋은 돌격소총.'},
 ak47:{name:'AK47',cat:'ar',dmg:17,rpm:600,mag:30,res:150,reload:2.3,spread:1.7,range:22,far:55,recoil:1.15,snd:'rifle_ak',desc:'강하지만 반동이 커요.'},
 scar:{name:'Scar',cat:'ar',dmg:19,rpm:550,mag:20,res:120,reload:2.3,spread:1.4,range:26,far:60,recoil:1.05,snd:'rifle_ak',sndRate:0.94,desc:'한 발이 묵직한 소총.'},
 falcon:{name:'Falcon',cat:'ar',dmg:24,rpm:330,mag:15,res:90,reload:2.2,mode:'semi',spread:0.7,range:32,far:70,recoil:1.6,snd:'battle_rifle',desc:'반자동 전투 소총. 다섯 발이면 쓰러져요.'},
 famas:{name:'FAMAS',cat:'ar',dmg:15,rpm:240,mag:30,res:150,reload:2.2,mode:'burst',burst:3,burstRpm:1000,spread:1.0,range:26,far:60,recoil:0.7,snd:'rifle_ar',sndRate:1.08,desc:'정확한 3점사.'},
 g36:{name:'G36',cat:'ar',dmg:15,rpm:700,mag:30,res:150,reload:2.2,spread:1.1,move:2.8,range:25,far:60,recoil:0.7,snd:'rifle_ar',sndRate:0.97,desc:'서서 쏘면 정확, 움직이면 부정확.'},
 m249:{name:'M249',cat:'ar',dmg:14,rpm:800,mag:100,res:200,reload:4.5,spread:2.3,range:22,far:55,recoil:0.75,speed:0.88,sw:0.7,snd:'rifle_ak',sndRate:1.06,desc:'100발 기관총. 무거워요.'},
 // ---------- shotguns ----------
 pump:{name:'펌프 샷건',cat:'sg',dmg:13,rpm:70,mag:6,res:30,reload:0.5,shell:true,mode:'pump',pellets:8,spread:5.5,ads:0.75,range:8,far:22,min:0.3,recoil:3,snd:'shotgun',pumpSnd:true,desc:'가까우면 한 방.'},
 sawed:{name:'소드오프',cat:'sg',dmg:12,rpm:320,mag:2,res:30,reload:1.8,mode:'semi',pellets:10,spread:9,ads:0.85,range:5,far:14,min:0.25,recoil:4,speed:1.03,snd:'shotgun2',desc:'두 발, 초근접 폭발력.'},
 autosg:{name:'자동 샷건',cat:'sg',dmg:9,rpm:300,mag:8,res:40,reload:2.6,mode:'auto',pellets:6,spread:6.5,ads:0.8,range:7,far:18,min:0.3,recoil:1.8,snd:'shotgun2',sndRate:1.1,desc:'연사되는 산탄총.'},
 // ---------- precision ----------
 m1:{name:'M1',cat:'sr',dmg:32,rpm:260,mag:8,res:48,reload:2.0,mode:'semi',spread:0.45,ads:0.25,range:45,far:90,min:0.8,recoil:1.9,zoom:0.6,snd:'battle_rifle',sndRate:0.95,desc:'반자동 소총. 네 발.'},
 lightsr:{name:'경량 저격총',cat:'sr',dmg:34,rpm:240,mag:5,res:30,reload:2.2,mode:'semi',spread:0.35,ads:0.15,range:60,far:120,min:0.85,recoil:2,zoom:0.42,scope:true,snd:'sniper',sndRate:1.12,desc:'빠르게 세 발.'},
 heavysr:{name:'중저격총',cat:'sr',dmg:75,rpm:45,mag:5,res:25,reload:3.0,mode:'bolt',spread:0.2,ads:0.05,move:3,range:80,far:150,min:0.9,recoil:4.5,zoom:0.3,scope:true,speed:0.9,sw:0.7,snd:'sniper_heavy',desc:'두 발이면 끝. 머리는 한 방.'},
 piercesr:{name:'관통 저격총',cat:'sr',dmg:60,rpm:55,mag:5,res:25,reload:3.0,mode:'bolt',spread:0.2,ads:0.05,move:3,range:80,far:150,min:0.9,recoil:4,zoom:0.34,scope:true,pierce:3,speed:0.9,sw:0.7,snd:'sniper',sndRate:0.9,desc:'사람과 얇은 엄폐물을 꿰뚫어요.'},
 mrl:{name:'초소형 로켓',cat:'sr',dmg:35,rpm:240,mag:6,res:24,reload:2.8,mode:'semi',proj:'microrocket',pspeed:55,pgrav:0,spread:0.6,recoil:1.6,splash:{r:2.6,dmg:35},revFall:true,speed:0.95,snd:'rocket',desc:'멀리 날아갈수록 세져요.'},
 // ---------- other ----------
 shield:{name:'방탄 방패',cat:'other',dmg:35,rate:0.8,reach:2.2,arc:0.9,mode:'melee',shield:true,knock:12,speed:0.9,sw:0.6,desc:'앞에서 오는 총알을 막아요. 휘두르면 밀쳐내요.'},
 tagpistol:{name:'술래 권총',cat:'pistol',slot:'tag',dmg:10,head:1.5,rpm:280,mag:10,res:9999,reload:3,mode:'semi',spread:0.8,range:30,far:60,min:1,recoil:1.2,sw:0.3,snd:'pistol',desc:'술래 전용. 몸 10, 머리 15.'},
 snowcan:{name:'눈 대포',cat:'other',dmg:12,rpm:400,mag:40,res:160,reload:2.5,proj:'snow',pspeed:48,pgrav:7,spread:1.5,recoil:0.5,slow:0.4,knock:4,snd:'snow',desc:'맞으면 느려지고 밀려나요.'}
};
for(const id in WPN){ const w=Object.assign({},WDEF,WPN[id]); w.id=id; if(w.mode==="melee"){ w.mag=0; w.res=0; } WPN[id]=w; }
/* ---------- attachments (gunsmith) ----------
   Five slots per gun. Each option changes the model (guns.js) and the numbers below. Multipliers stack. */
const ATT_SLOTS=['scope','muzzle','barrel','stock','mag'];
const ATT_SLOT_NAMES={scope:'조준경',muzzle:'총구',barrel:'총열',stock:'개머리판',mag:'탄창'};
const ATT={
 scope:{
  iron:{name:'기계식 조준기',desc:'가장 빠른 조준. 시야를 거의 가리지 않아요.',adsSpd:1.08},
  reddot:{name:'레드 도트',desc:'빨간 점 하나. 근·중거리에 좋아요.',z:0.97},
  holo:{name:'홀로그램',desc:'넓은 창과 원형 조준점.',z:0.95},
  x2:{name:'2배율',desc:'중거리용 저배율 조준경.',zoom:0.56,adsSpd:0.92},
  x3:{name:'3배율',desc:'중·장거리용.',zoom:0.42,adsSpd:0.86},
  x4:{name:'4배율',desc:'장거리 스코프. 조준하면 스코프 화면이 돼요.',zoom:0.31,adsSpd:0.78,scope:true},
  x6:{name:'6배율',desc:'더 멀리. 조준이 조금 느려요.',zoom:0.21,adsSpd:0.7,scope:true},
  x8:{name:'8배율',desc:'초장거리 저격용.',zoom:0.155,adsSpd:0.62,scope:true}},
 muzzle:{
  none:{name:'없음',desc:'기본 총구.'},
  comp:{name:'보정기',desc:'반동 -20%.',recoil:0.8},
  flash:{name:'소염기',desc:'총구 화염이 안 보이고 반동 -10%.',recoil:0.9,noFlash:true},
  sup:{name:'소음기',desc:'총소리가 작아지고 미니맵에 잠깐만 보여요. 유효 사거리 -10%.',silent:true,noFlash:true,range:0.9,far:0.92},
  choke:{name:'초크',desc:'산탄이 덜 퍼져요 (-25%).',spread:0.75}},
 barrel:{
  std:{name:'기본 총열',desc:'균형 잡힌 기본형.'},
  long:{name:'긴 총열',desc:'사거리 +20%, 정확도 +10%. 조금 무거워요.',range:1.2,far:1.2,spread:0.9,speed:0.97,sw:1.12,adsSpd:0.93},
  short:{name:'짧은 총열',desc:'가볍고 빠른 조준. 사거리 -15%.',range:0.85,far:0.85,spread:1.1,speed:1.03,sw:0.85,adsSpd:1.15},
  heavy:{name:'헤비 총열',desc:'반동 -15%, 이동 속도 -4%.',recoil:0.85,speed:0.96,sw:1.1}},
 stock:{
  std:{name:'기본 개머리판',desc:'기본형.'},
  light:{name:'경량 개머리판',desc:'조준 속도 +25%, 이동 +3%. 반동 +8%.',adsSpd:1.25,speed:1.03,recoil:1.08},
  heavy:{name:'전술 개머리판',desc:'반동 -12%, 움직이며 쏠 때 덜 퍼져요.',recoil:0.88,move:0.7,adsSpd:0.95},
  none:{name:'개머리판 제거',desc:'무기 교체 -25%, 이동 +5%. 반동 +20%.',sw:0.75,speed:1.05,recoil:1.2,move:1.15}},
 mag:{
  std:{name:'기본 탄창',desc:'기본형.'},
  ext:{name:'대용량 탄창',desc:'탄창 +40%. 장전 +10%.',mag:1.4,reload:1.1},
  quick:{name:'퀵드로우 탄창',desc:'장전 시간 -25%.',reload:0.75},
  extq:{name:'대용량 퀵드로우',desc:'탄창 +25%, 장전 -12%.',mag:1.25,reload:0.88},
  drum:{name:'드럼 탄창',desc:'탄창 2배. 장전 +35%, 이동 -3%.',mag:2,reload:1.35,speed:0.97}}
};
/* which options each gun accepts (first entry = what it ships with) */
(()=>{ const set=(w,o)=>{ w.att=o; };
  for(const id in WPN){ const w=WPN[id]; if(w.mode==='melee'||w.proj||w.slot==='tag'||['flintlock','sawed'].includes(id)){ w.att=null; continue; }
    const c=w.cat;
    if(c==='ar') set(w,{scope:['iron','reddot','holo','x2','x3','x4','x6'],muzzle:['none','comp','flash','sup'],barrel:['std','long','short','heavy'],stock:['std','light','heavy','none'],mag:['std','ext','quick','extq','drum']});
    else if(c==='smg') set(w,{scope:['iron','reddot','holo','x2','x3'],muzzle:['none','comp','flash','sup'],barrel:['std','long','short'],stock:['std','light','heavy','none'],mag:['std','ext','quick','extq','drum']});
    else if(c==='sg') set(w,{scope:['iron','reddot','holo','x2'],muzzle:['none','choke','comp','sup'],barrel:['std','long','short'],stock:['std','light','heavy','none'],mag:id==='autosg'?['std','ext','quick']:['std']});
    else if(c==='sr') set(w,{scope:['iron','reddot','holo','x2','x3','x4','x6','x8'],muzzle:['none','comp','flash','sup'],barrel:['std','long','short','heavy'],stock:['std','light','heavy'],mag:['std','ext','quick','extq']});
    else if(c==='pistol') set(w,{scope:['iron','reddot'],muzzle:['none','comp','sup'],barrel:['std','long'],stock:['std'],mag:['std','ext','quick']});
    else w.att=null; }
  const only=(id,slot,list)=>{ if(WPN[id]&&WPN[id].att) WPN[id].att[slot]=list; };
  only('famas','stock',['std']); only('p50','stock',['std']); only('p50','mag',['std','ext']); only('m249','mag',['std','ext']); only('m249','stock',['std','heavy']);
  only('microsmg','mag',['std','ext','quick','extq']); only('vector','mag',['std','ext','quick','extq']); only('p50','barrel',['std','long']);
  only('m1','mag',['std']); only('m1','stock',['std']); only('m1','scope',['iron','reddot','x2','x3','x4']); only('heavysr','mag',['std','ext','quick']); only('piercesr','mag',['std','ext','quick']);
  only('lightsr','scope',['x3','iron','reddot','holo','x2','x4','x6','x8']); only('heavysr','scope',['x4','iron','reddot','holo','x2','x3','x6','x8']); only('piercesr','scope',['x4','iron','reddot','holo','x2','x3','x6','x8']);
  only('revolver','muzzle',['none']); only('revolver','mag',['std']); only('revolver','barrel',['std','long','short']); only('deagle','muzzle',['none','comp']); only('deagle','scope',['iron','reddot','x2']);
  for(const id of ['lightsr','heavysr','piercesr']){ WPN[id].scope=false; WPN[id].zoom=0.72; }
})();
const attKey=a=>a?ATT_SLOTS.map(k=>a[k]||'').join(','):'';
/* a complete, valid attachment set for a gun (unknown or unsupported choices fall back to what it ships with) */
function attClean(id,a){ const w=WPN[id]; if(!w||!w.att) return null; const o={}; for(const k of ATT_SLOTS){ const list=w.att[k]||[]; o[k]=a&&list.includes(a[k])?a[k]:(list[0]||null); } return o; }
/* the gun with its attachments applied: a copy of the weapon with changed numbers (cached) */
const _wCache=new Map();
function wpnWith(id,att){ const base=WPN[id]; if(!base) return null; if(!base.att) return base; const a=attClean(id,att), key=id+'|'+attKey(a); let w=_wCache.get(key); if(w) return w;
  w=Object.assign({},base); w.attSet=a; w.attKey=key; w.adsSpd=1; let magMul=1;
  for(const k of ATT_SLOTS){ const o=ATT[k][a[k]]; if(!o) continue;
    for(const s of ['recoil','range','far','spread','speed','sw','reload','move']) if(o[s]) w[s]=w[s]*o[s];
    if(o.adsSpd) w.adsSpd*=o.adsSpd; if(o.mag) magMul*=o.mag; if(o.silent) w.silent=true; if(o.noFlash) w.noFlash=true;
    if(k==='scope'){ if(o.zoom) w.zoom=o.zoom; else if(o.z) w.zoom=base.zoom*o.z; w.scope=!!o.scope; w.optic=a[k]; } }
  if(magMul!==1&&w.mag){ w.mag=Math.max(w.mag+1,Math.round(base.mag*magMul)); }
  w.speed=+w.speed.toFixed(3); w.reload=+w.reload.toFixed(2); _wCache.set(key,w); return w; }
const MAINS=Object.keys(WPN).filter(k=>WPN[k].slot==='main'), SIDES=Object.keys(WPN).filter(k=>WPN[k].slot==='side'), MELEES=Object.keys(WPN).filter(k=>WPN[k].slot==='melee');
/* slot 1 and slot 2 take any firearm (the riot shield counts as one) */
const GUNS=MAINS.concat(SIDES);

const TH={
 rocket:{name:'로켓 발사기',count:2,armed:4,kind:'rocket',speed:45,r:4.5,dmg:110,desc:'바로 날아가는 로켓. 2발.'},
 frag:{name:'세열 수류탄',count:3,armed:7,kind:'grenade',fuse:2.4,r:5.5,dmg:105,desc:'튕기다가 터져요.'},
 mine:{name:'대전차 지뢰',count:3,armed:7,kind:'mine',r:3.5,dmg:150,trig:1.8,arm:1.2,desc:'바닥에 깔면 밟은 적이 쓰러져요.'},
 flash:{name:'섬광탄',count:3,armed:7,kind:'flash',fuse:1.6,r:18,blind:3,desc:'바라보던 사람의 눈을 멀게 해요. 아군도요.'},
 sticky:{name:'점착 폭탄',count:3,armed:7,kind:'sticky',fuse:2.0,r:4.5,dmg:110,desc:'벽이나 사람에 달라붙어요.'},
 smoke:{name:'연막탄',count:3,armed:7,kind:'smoke',fuse:1.2,r:7,life:12,desc:'시야를 가리는 연막.'},
 c4:{name:'C4',count:3,armed:7,kind:'c4',r:5.5,dmg:140,desc:'붙여 두고 원할 때 터뜨려요.'},
 repulse:{name:'반발 수류탄',count:3,armed:7,kind:'repulse',fuse:1.5,r:8,dmg:10,force:22,desc:'주변 사람을 날려 보내요.'},
 implode:{name:'흡입 수류탄',count:3,armed:7,kind:'implode',fuse:1.5,r:9,dmg:10,force:18,desc:'주변 사람을 끌어당겨요.'},
 stun:{name:'기절 수류탄',count:3,armed:7,kind:'stun',fuse:1.6,r:7,stun:2.5,desc:'느려지고 조준이 둔해져요.'}
};
const SP={
 ammo:{name:'탄약 상자',cd:60,life:25,r:3.5,desc:'주변 아군의 탄약을 채워요.'},
 health:{name:'구급 상자',cd:60,life:15,r:3.5,heal:15,desc:'주변 아군의 체력을 회복해요.'},
 repair:{name:'수리 도구',cd:0,rate:60,reach:5,desc:'설치물과 부서진 엄폐물을 고쳐요.'},
 wall:{name:'설치형 벽',cd:45,life:60,hp:400,desc:'눈앞에 엄폐용 벽을 세워요.'},
 trophy:{name:'트로피 시스템',cd:50,life:30,r:7,charges:3,desc:'날아오는 적 폭발물을 격추해요.'}
};
const PERKS={
 kevlar:{name:'방탄복',desc:'최대 체력 +10%'},
 sprinter:{name:'스프린터',desc:'이동 속도 +5%'},
 quick:{name:'빠른 손',desc:'무기 교체 시간 -50%'},
 armed:{name:'무장',desc:'투척물 2배 (로켓 2→4, 그 외 3→7)'},
 killregen:{name:'처치 회복',desc:'처치하면 즉시 체력 회복 시작'},
 extmag:{name:'확장 탄창',desc:'주무기 탄창 2배'},
 quickload:{name:'빠른 장전',desc:'재장전 시간 -40%'},
 pockets:{name:'두둑한 주머니',desc:'시작 예비 탄약 2배'},
 eagle:{name:'매의 눈',desc:'미니맵 범위 +25%, 적 표시가 더 오래'},
 ghost:{name:'유령',desc:'쏴도 미니맵에 안 보이고 총소리가 작아요'},
 steady:{name:'안정된 손',desc:'정확도 +40%'},
 under:{name:'압박 속 침착',desc:'쏘는 동안 덜 느려져요'},
 express:{name:'고속탄',desc:'무기 피해 +10%'},
 equip:{name:'장비 수집가',desc:'특수 장비 재사용 -60%'},
 ammocol:{name:'탄약 수집가',desc:'처치할 때마다 탄약을 얻어요'},
 berserk:{name:'광전사',desc:'근접 무기를 들면 20% 빠르게'},
 vampire:{name:'흡혈',desc:'처치하면 체력 +40'}
};
const PERK_IDS=Object.keys(PERKS);
const perkN=(p,id)=>p&&p.perks?p.perks.filter(x=>x===id).length:0;

/* ---------- battle modes ---------- */
const BMODES={
 tdm:{name:'팀 데스매치',team:true,desc:'상대 팀을 쓰러뜨려 점수를 모아요.',limit:n=>clamp(n*5,25,75),time:7,unit:'처치'},
 ffa:{name:'개인전',team:false,desc:'모두가 적. 가장 많이 쓰러뜨리면 승리.',limit:()=>20,time:7,unit:'처치'},
 duel:{name:'1:1',team:false,max:2,desc:'단 둘이 겨루는 결투.',limit:()=>10,time:5,unit:'처치'},
 gg:{name:'건게임',team:false,desc:'두 번 처치할 때마다 무기가 바뀌어요. 근접 처치는 2점.',limit:()=>30,time:8,unit:'점'},
 kc:{name:'킬 컨펌드',team:true,desc:'쓰러진 적의 인식표를 주워야 점수가 돼요.',limit:n=>clamp(n*4,20,60),time:8,unit:'인식표'},
 ctf:{name:'깃발 뺏기',team:true,desc:'적 본진의 데이터 코어를 훔쳐 우리 본진으로.',limit:()=>3,time:10,unit:'점령'},
 hp:{name:'하드포인트',team:true,desc:'1분마다 옮겨 가는 지점을 지켜요.',limit:()=>150,time:9,unit:'점'},
 dom:{name:'점령전',team:true,desc:'A·B·C 세 지점을 점령하고 지켜요.',limit:()=>200,time:10,unit:'점'},
 snd:{name:'수색과 파괴',team:true,desc:'공격팀은 폭탄 설치, 수비팀은 막기. 부활 없음.',limit:()=>4,time:0,unit:'라운드',rounds:true},
 upl:{name:'업로드',team:true,desc:'중앙의 데이터 드라이브를 적 업로드 기지로 옮겨요.',limit:()=>5,time:9,unit:'업로드'},
 pk:{name:'파쿠르',team:false,desc:'바닥은 용암! 체크포인트를 따라 먼저 도착하면 승리.',limit:()=>1,time:6,unit:'바퀴',noDamage:true}
};
const BMODE_IDS=Object.keys(BMODES);
const GG_LADDER=['m249','ak47','m4','scar','famas','g36','vector','p50','microsmg','smg9','autosg','pump','m1','heavysr','deagle'];
const TEAM_COLORS=['#3d8bff','#ff5a4e'], TEAM_NAMES=['블루','레드'];
const FFA_COLORS=['#3d8bff','#ff5a4e','#36d07a','#ffc23d','#b56bff','#38d5e0','#ff7ad1','#f4f1e8','#9cff4a','#ff9b3d','#7aa8ff','#c9a27a','#5ef0c3','#e86bff','#ffd95e','#8f99a8'];
function seekerCount(n){ return n<=7?1:n<=14?2:3; }

/* make sure the saved loadout only names things that exist (old saves, removed perks) */
const isGun=id=>!!WPN[id]&&WPN[id].slot!=='tag'&&(WPN[id].mode!=='melee'||id==='shield');
(()=>{ const D=DEFAULT_LOADOUT, L=prefs.loadout;
  if(!isGun(L.main)) L.main=D.main; if(!isGun(L.side)||L.side===L.main) L.side=L.main===D.side?'deagle':D.side; if(!WPN[L.melee]||WPN[L.melee].slot!=='melee') L.melee=D.melee;
  if(!TH[L.thr]) L.thr=D.thr; if(!SP[L.spec]) L.spec=D.spec;
  L.perks=(Array.isArray(L.perks)?L.perks:D.perks).slice(0,2); while(L.perks.length<2) L.perks.push(D.perks[L.perks.length]); L.perks=L.perks.map((p,i)=>PERKS[p]?p:D.perks[i]); })();
