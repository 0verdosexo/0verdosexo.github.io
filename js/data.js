/* data.js — every weapon, throwable, special, perk and game mode in one place.
   Damage is against 100 HP. Spread is in degrees. Ranges in metres. */
'use strict';
const CATS={ar:'돌격소총',smg:'기관단총',lmg:'기관총',sg:'산탄총',dmr:'지정사수',sr:'저격총',other:'특수 화기',pistol:'권총',melee:'근접'};
/* the order categories are listed in (loadout lists, the range's weapon menu, the armory) */
const CAT_ORDER=['ar','smg','lmg','sg','dmr','sr','pistol','other'];
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
 m249:{name:'M249',cat:'lmg',dmg:14,rpm:800,mag:100,res:200,reload:4.5,spread:2.3,range:22,far:55,recoil:0.75,speed:0.88,sw:0.7,snd:'rifle_ak',sndRate:1.06,desc:'100발 기관총. 무거워요.'},
 // ---------- shotguns ----------
 pump:{name:'펌프 샷건',cat:'sg',dmg:13,rpm:70,mag:6,res:30,reload:0.5,shell:true,mode:'pump',pellets:8,spread:5.5,ads:0.75,range:8,far:22,min:0.3,recoil:3,snd:'shotgun',pumpSnd:true,desc:'가까우면 한 방.'},
 sawed:{name:'소드오프',cat:'sg',dmg:12,rpm:320,mag:2,res:30,reload:1.8,mode:'semi',pellets:10,spread:9,ads:0.85,range:5,far:14,min:0.25,recoil:4,speed:1.03,snd:'shotgun2',desc:'두 발, 초근접 폭발력.'},
 autosg:{name:'자동 샷건',cat:'sg',dmg:9,rpm:300,mag:8,res:40,reload:2.6,mode:'auto',pellets:6,spread:6.5,ads:0.8,range:7,far:18,min:0.3,recoil:1.8,snd:'shotgun2',sndRate:1.1,desc:'연사되는 산탄총.'},
 // ---------- precision ----------
 m1:{name:'M1',cat:'dmr',dmg:32,rpm:260,mag:8,res:48,reload:2.0,mode:'semi',spread:0.45,ads:0.25,range:45,far:90,min:0.8,recoil:1.9,zoom:0.6,snd:'battle_rifle',sndRate:0.95,desc:'반자동 소총. 네 발.'},
 lightsr:{name:'경량 저격총',cat:'dmr',dmg:34,rpm:240,mag:5,res:30,reload:2.2,mode:'semi',spread:0.35,ads:0.15,range:60,far:120,min:0.85,recoil:2,zoom:0.42,scope:true,snd:'sniper',sndRate:1.12,desc:'빠르게 세 발.'},
 heavysr:{name:'중저격총',cat:'sr',dmg:75,rpm:45,mag:5,res:25,reload:3.0,mode:'bolt',spread:0.2,ads:0.05,move:3,range:80,far:150,min:0.9,recoil:4.5,zoom:0.3,scope:true,speed:0.9,sw:0.7,snd:'sniper_heavy',desc:'두 발이면 끝. 머리는 한 방.'},
 piercesr:{name:'관통 저격총',cat:'sr',dmg:60,rpm:55,mag:5,res:25,reload:3.0,mode:'bolt',spread:0.2,ads:0.05,move:3,range:80,far:150,min:0.9,recoil:4,zoom:0.34,scope:true,pierce:3,speed:0.9,sw:0.7,snd:'sniper',sndRate:0.9,desc:'사람과 얇은 엄폐물을 꿰뚫어요.'},
 mrl:{name:'초소형 로켓',cat:'sr',dmg:35,rpm:240,mag:6,res:24,reload:2.8,mode:'semi',proj:'microrocket',pspeed:55,pgrav:0,spread:0.6,recoil:1.6,splash:{r:2.6,dmg:35},revFall:true,speed:0.95,snd:'rocket',desc:'멀리 날아갈수록 세져요.'},
 // ---------- other ----------
 shield:{name:'방탄 방패',cat:'other',dmg:35,rate:0.8,reach:2.2,arc:0.9,mode:'melee',shield:true,knock:12,speed:0.9,sw:0.6,desc:'앞에서 오는 총알을 막아요. 휘두르면 밀쳐내요.'},
 tagpistol:{name:'술래 권총',cat:'pistol',slot:'tag',dmg:10,head:1.5,rpm:280,mag:10,res:9999,reload:3,mode:'semi',spread:0.8,range:30,far:60,min:1,recoil:1.2,sw:0.3,snd:'pistol',desc:'술래 전용. 몸 10, 머리 15.'},
 snowcan:{name:'눈 대포',cat:'other',dmg:12,rpm:400,mag:40,res:160,reload:2.5,proj:'snow',pspeed:48,pgrav:7,spread:1.5,recoil:0.5,slow:0.4,knock:4,snd:'snow',desc:'맞으면 느려지고 밀려나요.'}
};

/* ---------- v7.10.0: a hundred more guns. Names are changed from the real makes (like P50 and Falcon); military designations stay.
   rfam = reload animation family (reloadanim.js), rc = its options, icon = kill feed picture ---------- */
const A_=(o)=>o, AR=o=>Object.assign({cat:'ar',snd:'rifle_ar',rfam:'ar',res:150},o), SM=o=>Object.assign({cat:'smg',snd:'smg',rfam:'ar',rc:{ea:'rackL'},res:150,move:0.8,speed:1.03},o),
  SG=o=>Object.assign({cat:'sg',snd:'shotgun',ads:0.75,min:0.3,res:40},o), DM=o=>Object.assign({cat:'dmr',mode:'semi',snd:'battle_rifle',rfam:'ar',ads:0.22,min:0.8,res:60},o),
  SR=o=>Object.assign({cat:'sr',mode:'bolt',snd:'sniper',rfam:'bolt',ads:0.05,move:3,range:80,far:150,min:0.9,spread:0.2,res:30,speed:0.92,sw:0.7},o),
  LM=o=>Object.assign({cat:'lmg',snd:'rifle_ak',rfam:'lmg',res:200,range:24,far:58,speed:0.88,sw:0.75,icon:'lmg'},o), PI=o=>Object.assign({cat:'pistol',slot:'side',mode:'semi',snd:'pistol',rfam:'pistol',res:60,range:18,far:40,sw:0.3},o),
  SP_=o=>Object.assign({cat:'other'},o);
const WPN_ADD={
 // 돌격소총 · 전투소총 (18)
 r416:AR({name:'R416',dmg:15,rpm:740,mag:30,reload:2.1,spread:1.2,range:25,far:60,recoil:0.7,sndRate:1.02,desc:'M4보다 묵직하고 안정적인 소총.'}),
 m16:AR({name:'M16A4',dmg:16,rpm:300,mode:'burst',burst:3,burstRpm:900,mag:30,reload:2.2,spread:1.0,range:28,far:66,recoil:0.7,sndRate:1.04,desc:'3점사 전용. 사거리가 길어요.'}),
 k2:AR({name:'K2',dmg:15,rpm:700,mag:30,reload:2.1,spread:1.2,range:25,far:60,recoil:0.72,sndRate:0.98,desc:'국산 소총. 반동이 고르고 무난해요.'}),
 k1a:AR({name:'K1A',dmg:13,rpm:750,mag:30,reload:1.9,spread:1.6,range:18,far:45,recoil:0.65,move:1.3,speed:1.02,sndRate:1.08,desc:'짧은 카빈. 움직이며 쏘기 좋아요.'}),
 ak74:AR({name:'AK74',dmg:15,rpm:650,mag:30,reload:2.2,spread:1.4,range:23,far:56,recoil:0.85,snd:'rifle_ak',sndRate:1.08,rfam:'ak',desc:'AK보다 반동이 작고 탄이 빨라요.'}),
 ak12:AR({name:'AK12',dmg:16,rpm:700,mag:30,reload:2.2,spread:1.3,range:24,far:58,recoil:0.9,snd:'rifle_ak',sndRate:1.04,rfam:'ak',desc:'현대형 AK. 레일이 많아 부품을 자유롭게 달아요.'}),
 augur:AR({name:'Augur',dmg:15,rpm:680,mag:30,reload:2.3,spread:1.0,range:27,far:62,recoil:0.65,sndRate:1.05,rc:{ea:'rackL',bp:true},desc:'불펍. 2배율 조준경이 달려 나와요.'}),
 s550:AR({name:'S550',dmg:14,rpm:700,mag:30,reload:2.2,spread:0.9,range:28,far:64,recoil:0.6,sndRate:1.1,desc:'연사는 보통, 아주 정확해요.'}),
 gallant:AR({name:'Gallant',dmg:15,rpm:690,mag:35,reload:2.3,spread:1.35,range:23,far:56,recoil:0.8,snd:'rifle_ak',sndRate:1.02,rfam:'ak',desc:'AK 계열 개량형. 탄창 35발.'}),
 arc7:AR({name:'ARC-7',dmg:15,rpm:700,mag:30,reload:1.9,spread:1.25,range:25,far:60,recoil:0.75,desc:'모듈형 소총. 장전이 빨라요.'}),
 t21:AR({name:'T21',dmg:14,rpm:900,mag:30,reload:2.0,spread:1.6,range:18,far:46,recoil:0.7,speed:1.02,sndRate:1.06,rc:{ea:'rackL',bp:true},desc:'짧은 불펍. 근거리에 강해요.'}),
 qbz:AR({name:'QBZ-95',dmg:14,rpm:650,mag:30,reload:2.3,spread:1.2,range:24,far:58,recoil:0.7,sndRate:1.06,rc:{ea:'rackL',bp:true},desc:'불펍. 정확하지만 장전이 느려요.'}),
 l85:AR({name:'L85A2',dmg:15,rpm:650,mag:30,reload:2.6,spread:0.95,range:27,far:62,recoil:0.6,rc:{ea:'rackL',bp:true},desc:'불펍. 아주 정확하지만 장전이 느려요.'}),
 f2k:AR({name:'F2K',dmg:14,rpm:850,mag:30,reload:2.2,spread:1.3,range:23,far:55,recoil:0.72,sndRate:1.12,rc:{ea:'rackL',bp:true},desc:'미래형 불펍. 연사가 빨라요.'}),
 asv:AR({name:'AS-V',dmg:18,rpm:900,mag:20,res:120,reload:2.0,spread:1.4,range:14,far:32,recoil:0.8,silent:true,snd:'smg',sndRate:0.8,rfam:'ak',desc:'소음기 내장. 근·중거리에서 강하고 조용해요.'}),
 groza:AR({name:'Groza',dmg:18,rpm:700,mag:20,res:120,reload:2.3,spread:1.5,range:16,far:36,recoil:0.9,snd:'rifle_ak',sndRate:0.95,rc:{ea:'rackL',bp:true},desc:'짧은 불펍. 한 발이 세요.'}),
 g3:AR({name:'G3',dmg:24,rpm:500,mag:20,res:120,reload:2.4,spread:1.3,range:30,far:70,recoil:1.4,snd:'battle_rifle',desc:'7.62mm 전투소총. 다섯 발이면 쓰러져요.'}),
 m14:AR({name:'M14',dmg:25,rpm:420,mag:20,res:120,reload:2.4,spread:1.2,range:32,far:72,recoil:1.6,snd:'battle_rifle',sndRate:0.96,desc:'연사도 되는 전투소총. 반동이 커요.'}),
 // 기관단총 (15)
 u45:SM({name:'U45',dmg:16,rpm:650,mag:25,reload:2.0,spread:1.9,range:14,far:34,recoil:0.5,sndRate:0.9,desc:'느리지만 한 발이 센 기관단총.'}),
 mx7:SM({name:'MX7',dmg:12,rpm:950,mag:40,res:200,reload:1.9,spread:1.8,range:16,far:38,recoil:0.45,snd:'smg2',sndRate:1.1,rfam:'pistol',desc:'탄속이 빠르고 40발.'}),
 px9:SM({name:'PX9',dmg:13,rpm:850,mag:30,reload:1.8,spread:1.8,range:15,far:36,recoil:0.4,rc:null,desc:'반동이 적은 만능 기관단총.'}),
 mps9:SM({name:'MPS9',dmg:11,rpm:1000,mag:30,reload:1.6,spread:2.4,range:11,far:28,recoil:0.45,speed:1.05,snd:'smg2',sndRate:1.15,rfam:'pistol',desc:'작고 빠른 기관단총.'}),
 evo3:SM({name:'EVO-3',dmg:11,rpm:1150,mag:30,reload:1.8,spread:2.6,range:10,far:26,recoil:0.5,speed:1.05,snd:'smg2',sndRate:1.2,desc:'초근접 고연사.'}),
 sk61:SM({name:'Sk61',dmg:10,rpm:850,mag:20,reload:1.3,spread:2.8,range:9,far:24,recoil:0.5,speed:1.06,sw:0.3,snd:'pistol_light',sndRate:1.1,desc:'권총처럼 작아 바로 꺼내 쏴요.'}),
 bison:SM({name:'Bison',dmg:11,rpm:700,mag:64,res:192,reload:2.8,spread:2.2,range:12,far:30,recoil:0.45,rfam:null,desc:'64발 나선 탄창.'}),
 ppsh:SM({name:'PPSh-41',dmg:11,rpm:1000,mag:71,res:213,reload:3.2,spread:2.6,range:11,far:28,recoil:0.55,snd:'smg2',sndRate:0.95,desc:'71발 드럼. 끝없이 쏴요.'}),
 tommy:SM({name:'토미 건',dmg:14,rpm:700,mag:50,reload:3.0,spread:2.2,range:13,far:30,recoil:0.6,speed:0.97,sndRate:0.85,desc:'드럼 탄창, 묵직한 연사.'}),
 mp40:SM({name:'MP40',dmg:13,rpm:520,mag:32,reload:2.2,spread:1.6,range:15,far:36,recoil:0.35,sndRate:0.88,desc:'연사가 느리고 아주 안정적이에요.'}),
 m10:SM({name:'M10',dmg:10,rpm:1150,mag:30,reload:1.6,spread:3.2,range:8,far:22,recoil:0.8,speed:1.06,snd:'smg2',sndRate:1.25,rfam:'pistol',desc:'연사도 반동도 최고.'}),
 k7:SM({name:'K7',dmg:13,rpm:800,mag:30,reload:1.9,spread:1.9,range:14,far:32,recoil:0.5,silent:true,desc:'국산. 소음기가 내장돼 있어요.'}),
 ap9:SM({name:'AP9',dmg:13,rpm:900,mag:30,reload:1.8,spread:1.7,range:15,far:36,recoil:0.45,sndRate:1.05,desc:'정확한 기관단총.'}),
 sten:SM({name:'Sten',dmg:12,rpm:550,mag:32,reload:2.3,spread:2.4,range:12,far:30,recoil:0.45,sndRate:0.85,rfam:null,desc:'값싼 옛 기관단총. 탄창이 옆으로 꽂혀요.'}),
 wraith:SM({name:'Wraith',dmg:13,rpm:880,mag:30,reload:1.8,spread:1.8,range:15,far:36,recoil:0.42,snd:'smg2',rc:null,desc:'AR 모양 기관단총. 손에 익숙해요.'}),
 // 산탄총 (10)
 s90:SG({name:'S90',dmg:11,rpm:300,mode:'semi',mag:7,reload:0.5,shell:true,pellets:8,spread:5.5,range:8,far:22,recoil:2.2,snd:'shotgun2',rfam:'pump',desc:'반자동 산탄총. 균형형.'}),
 sps12:SG({name:'SPS-12',dmg:13,rpm:80,mode:'pump',mag:8,reload:0.5,shell:true,pellets:8,spread:5,range:9,far:24,recoil:3,pumpSnd:true,rfam:'pump',desc:'펌프식. 묵직하고 멀리 가요.'}),
 ax12:SG({name:'AX-12',dmg:8,rpm:330,mode:'auto',mag:20,res:60,reload:3.2,pellets:7,spread:6.5,range:7,far:18,recoil:1.4,snd:'shotgun2',sndRate:1.05,rfam:'ar',desc:'완전자동, 드럼 탄창.'}),
 ks14:SG({name:'KS-14',dmg:12,rpm:75,mode:'pump',mag:14,res:42,reload:0.45,shell:true,pellets:8,spread:5.6,range:8,far:22,recoil:2.8,pumpSnd:true,rfam:'pump',desc:'튜브 두 개, 14발.'}),
 lever87:SG({name:'레버 1887',dmg:13,rpm:90,mode:'pump',mag:5,reload:0.55,shell:true,pellets:9,spread:6,range:7,far:20,recoil:3.2,speed:1.02,rfam:'pump',desc:'레버액션. 손잡이를 돌려 장전해요.'}),
 usas:SG({name:'USAS-12',dmg:10,rpm:360,mode:'auto',mag:10,res:50,reload:2.6,pellets:7,spread:6,range:7,far:20,recoil:1.8,snd:'shotgun2',rfam:'ar',desc:'국산 자동 산탄총. 탄창 10발.'}),
 ou:SG({name:'오버언더',dmg:13,rpm:400,mode:'semi',mag:2,res:30,reload:1.9,pellets:9,spread:4.2,range:10,far:28,recoil:3.4,rfam:'break',desc:'두 발. 산탄이 덜 퍼져 멀리 가요.'}),
 db12:SG({name:'DB-12',dmg:12,rpm:140,mode:'pump',mag:14,res:42,reload:0.45,shell:true,pellets:8,spread:5.6,range:8,far:22,recoil:2.6,pumpSnd:true,rfam:'pump',desc:'총열 두 개 펌프식. 빠르게 두 발씩.'}),
 striker:SG({name:'스트라이커',dmg:10,rpm:260,mode:'semi',mag:12,res:48,reload:0.6,shell:true,pellets:7,spread:6,range:7,far:19,recoil:2,snd:'shotgun2',desc:'회전 탄창 12발.'}),
 slug:SG({name:'슬러그건',dmg:70,rpm:70,mode:'pump',mag:5,reload:0.55,shell:true,pellets:1,spread:1.2,ads:0.2,range:25,far:55,min:0.5,recoil:3.4,pumpSnd:true,rfam:'pump',desc:'산탄 대신 큰 탄 한 발. 멀리까지 강해요.'}),
 // 지정사수 소총 (10)
 sks:DM({name:'SKS',dmg:30,rpm:300,mag:10,res:50,reload:2.0,spread:0.5,ads:0.25,range:40,far:85,recoil:1.7,sndRate:1.02,rfam:'clip',desc:'옛 반자동 소총. 클립으로 장전해요.'}),
 mk14:DM({name:'Mk14',dmg:31,rpm:330,mag:20,res:80,reload:2.3,spread:0.45,range:42,far:88,recoil:1.9,desc:'전투소총을 저격용으로 고친 총.'}),
 svd:DM({name:'SVD',dmg:38,rpm:240,mag:10,res:40,reload:2.5,spread:0.35,ads:0.15,range:55,far:110,min:0.85,recoil:2.3,snd:'sniper',sndRate:1.15,desc:'4배율이 달려 나오는 반자동 저격총.'}),
 m110:DM({name:'M110',dmg:34,rpm:300,mag:20,res:80,reload:2.4,spread:0.38,ads:0.18,range:50,far:100,recoil:1.9,sndRate:1.06,desc:'빠르게 연속으로 쏘는 반자동 저격총.'}),
 g28:DM({name:'G28',dmg:36,rpm:260,mag:20,res:80,reload:2.5,spread:0.32,ads:0.15,range:52,far:105,recoil:2,speed:0.95,sndRate:0.98,desc:'정확하지만 무거워요.'}),
 ranch14:DM({name:'Ranch-14',dmg:27,rpm:360,mag:20,res:80,reload:1.9,spread:0.55,ads:0.3,range:36,far:78,recoil:1.3,speed:1.02,sndRate:1.12,desc:'가볍고 조준이 빨라요.'}),
 vss:DM({name:'VSS',dmg:30,rpm:600,mode:'auto',mag:10,res:50,reload:2.1,spread:0.8,range:24,far:50,min:0.6,recoil:1.2,silent:true,snd:'smg',rfam:'ak',desc:'소음기 내장. 조용한 연사 저격총.'}),
 mk12:DM({name:'Mk12',dmg:28,rpm:380,mag:30,res:90,reload:2.1,spread:0.45,ads:0.2,range:42,far:88,recoil:1.0,snd:'rifle_ar',sndRate:0.95,desc:'반동이 가장 적은 지정사수 소총.'}),
 svu:DM({name:'SVU',dmg:36,rpm:260,mag:10,res:40,reload:2.4,spread:0.4,ads:0.18,range:48,far:100,recoil:2.2,snd:'sniper',sndRate:1.2,rc:{ea:'rackL',bp:true},desc:'불펍 SVD. 짧고 가벼워요.'}),
 qbu:DM({name:'QBU-88',dmg:33,rpm:300,mag:10,res:40,reload:2.2,spread:0.38,range:48,far:98,recoil:1.7,sndRate:1.1,rc:{ea:'rackL',bp:true},desc:'불펍 지정사수 소총.'}),
 // 저격총 (10)
 m24:SR({name:'M24',dmg:70,rpm:48,mag:5,reload:3.0,recoil:4.2,snd:'sniper_heavy',sndRate:1.05,desc:'표준 볼트액션 저격총.'}),
 kar98:SR({name:'Kar98k',dmg:68,rpm:50,mag:5,reload:2.8,recoil:4,sndRate:0.9,speed:0.95,desc:'클래식 볼트액션. 머리는 한 방.'}),
 mosin:SR({name:'모신나강',dmg:72,rpm:44,mag:5,reload:3.4,recoil:4.4,sndRate:0.86,speed:0.93,desc:'옛 볼트액션. 장전이 느려요.'}),
 enfield:SR({name:'리엔필드',dmg:62,rpm:65,mag:10,res:40,reload:3.0,recoil:3.8,sndRate:0.95,speed:0.95,desc:'볼트가 빠르고 10발이에요.'}),
 scout:SR({name:'스카우트',dmg:58,rpm:55,mag:5,reload:2.4,spread:0.25,recoil:3.4,speed:1,sw:0.5,sndRate:1.08,desc:'가벼운 저격총. 들고 빨리 움직여요.'}),
 lrr:SR({name:'롱레인지 408',dmg:85,rpm:38,mag:7,res:28,reload:3.6,range:100,far:190,recoil:5,speed:0.86,sw:0.8,snd:'sniper_heavy',sndRate:0.9,desc:'초장거리용. 가장 멀리까지 세요.'}),
 bp1:SR({name:'BP-1',dmg:72,rpm:50,mag:5,reload:2.7,recoil:4.2,speed:0.93,sndRate:1.02,desc:'불펍 저격총. 짧은데 정확해요.'}),
 sv98:SR({name:'SV-98',dmg:78,rpm:42,mag:10,res:30,reload:3.2,recoil:5,speed:0.9,snd:'sniper_heavy',desc:'반동이 크고 피해도 커요.'}),
 k14:SR({name:'K14',dmg:74,rpm:46,mag:5,reload:3.0,recoil:4.4,sndRate:0.97,desc:'국산 저격총.'}),
 lever94:SR({name:'레버 94',dmg:44,rpm:110,mode:'semi',mag:8,res:48,reload:0.5,shell:true,spread:0.35,ads:0.2,range:40,far:85,min:0.8,recoil:2.4,speed:1,sw:0.45,snd:'rifle_lever',rfam:'pump',desc:'레버액션. 한 발씩 빠르게 이어 쏴요.'}),
 // 기관총 (8)
 m60:LM({name:'M60',dmg:18,rpm:600,mag:100,reload:5.0,spread:2.4,recoil:0.95,speed:0.86,sndRate:0.9,desc:'묵직한 7.62mm 기관총.'}),
 pkm:LM({name:'PKM',dmg:17,rpm:680,mag:100,reload:4.8,spread:2.3,recoil:0.9,speed:0.87,sndRate:0.94,desc:'탄통으로 오래 쏴요.'}),
 rpk:LM({name:'RPK',dmg:16,rpm:620,mag:75,res:225,reload:3.4,spread:2.0,recoil:0.85,speed:0.92,rfam:'ak',desc:'AK 계열 경기관총. 덜 느려요.'}),
 mg42:LM({name:'MG42',dmg:15,rpm:1150,mag:100,reload:5.2,spread:2.8,recoil:1.2,speed:0.85,sndRate:1.2,desc:'연사가 아주 빠르고 반동이 커요.'}),
 ng7:LM({name:'NG7',dmg:14,rpm:850,mag:150,res:300,reload:5.0,spread:2.5,recoil:0.8,snd:'rifle_ar',sndRate:1.04,desc:'150발 탄띠.'}),
 k3:LM({name:'K3',dmg:14,rpm:750,mag:100,reload:4.4,spread:2.3,recoil:0.75,speed:0.89,snd:'rifle_ar',desc:'국산 경기관총.'}),
 u100:LM({name:'U100',dmg:14,rpm:600,mag:100,reload:3.8,spread:1.9,recoil:0.45,speed:0.91,snd:'rifle_ar',sndRate:1.08,desc:'반동이 가장 작은 기관총.'}),
 rpd:LM({name:'RPD',dmg:15,rpm:700,mag:100,reload:4.6,spread:2.4,recoil:0.85,speed:0.89,desc:'드럼 탄띠, 옛 기관총.'}),
 // 권총 (17)
 p17:PI({name:'P17',dmg:18,rpm:400,mag:17,res:85,reload:1.4,spread:1.1,recoil:1.0,desc:'표준 권총. 17발.'}),
 p18c:PI({name:'P18C',dmg:13,rpm:1100,mode:'auto',mag:33,res:99,reload:1.7,spread:2.8,range:11,far:28,recoil:0.8,snd:'pistol_light',sndRate:1.15,desc:'완전자동, 33발 확장 탄창.'}),
 usx:PI({name:'USX',dmg:24,rpm:330,mag:12,reload:1.5,spread:1.0,range:20,far:42,recoil:1.5,snd:'pistol_heavy',desc:'정확한 45구경.'}),
 s226:PI({name:'S226',dmg:20,rpm:380,mag:15,reload:1.4,spread:0.95,range:19,far:42,recoil:1.1,desc:'정확한 균형형.'}),
 m9:PI({name:'M9',dmg:18,rpm:400,mag:15,reload:1.5,spread:1.1,recoil:1.0,desc:'15발, 무난해요.'}),
 pk:PI({name:'PK',dmg:16,rpm:420,mag:7,res:49,reload:1.2,spread:1.3,range:14,far:32,recoil:0.9,speed:1.02,sw:0.2,snd:'pistol_light',desc:'작은 권총. 가장 빨리 꺼내요.'}),
 makarov:PI({name:'마카로프',dmg:17,rpm:380,mag:8,res:48,reload:1.3,spread:1.3,range:15,far:34,recoil:1.0,snd:'pistol_light',sndRate:0.95,desc:'옛 소형 권총.'}),
 tt33:PI({name:'TT-33',dmg:21,rpm:360,mag:8,res:48,reload:1.4,spread:1.0,range:20,far:44,recoil:1.3,pierce:1,desc:'사람 하나를 뚫고 지나가요.'}),
 f57:PI({name:'F57',dmg:16,rpm:450,mag:20,res:100,reload:1.5,spread:1.0,range:20,far:44,recoil:0.7,pierce:1,snd:'pistol_light',sndRate:1.1,desc:'20발, 사람 하나를 뚫어요.'}),
 c96:PI({name:'C96',dmg:22,rpm:420,mag:10,res:50,reload:2.4,spread:0.9,range:22,far:48,recoil:1.3,desc:'앞에 탄창이 있는 옛 권총. 멀리까지 정확해요.'}),
 mark22:PI({name:'Mark 22',dmg:12,rpm:520,mag:10,res:70,reload:1.3,spread:0.7,range:20,far:44,recoil:0.3,silent:true,snd:'pistol_light',desc:'22구경. 조용하고 반동이 거의 없어요.'}),
 k5:PI({name:'K5',dmg:18,rpm:400,mag:13,reload:1.4,spread:1.05,recoil:1.0,desc:'국산 권총.'}),
 aps:PI({name:'APS',dmg:13,rpm:750,mode:'auto',mag:20,res:100,reload:1.6,spread:2.4,range:12,far:30,recoil:0.9,snd:'pistol_light',sndRate:1.05,desc:'자동 권총. 20발.'}),
 peace:PI({name:'피스메이커',dmg:48,rpm:170,mag:6,res:36,reload:2.6,spread:0.9,range:22,far:50,recoil:3.4,snd:'revolver',sndRate:0.95,rfam:'rev',desc:'싱글액션 리볼버. 빠르게 연타해요.'}),
 viper:PI({name:'바이퍼',dmg:50,rpm:160,mag:6,res:36,reload:2.3,spread:0.8,range:25,far:55,recoil:3.4,snd:'revolver',rfam:'rev',desc:'정확한 리볼버.'}),
 m500:PI({name:'500 매그넘',dmg:75,rpm:100,mag:5,res:25,reload:2.8,spread:1.2,range:24,far:52,recoil:5,snd:'magnum',sndRate:0.9,rfam:'rev',desc:'초대구경 리볼버, 5발. 몸에 맞아도 아파요.'}),
 derr:PI({name:'데린저',dmg:40,rpm:300,mag:2,res:20,reload:1.8,spread:2,range:8,far:18,recoil:2.4,sw:0.2,snd:'pistol_heavy',rfam:'break',desc:'두 발. 숨겨 두는 마지막 수단.'}),
 // 특수 화기 (12)
 m79:SP_({name:'M79',dmg:40,rpm:60,mode:'semi',mag:1,res:12,reload:2.4,proj:'microrocket',pspeed:36,pgrav:9,splash:{r:3.6,dmg:100},spread:0.6,recoil:2,snd:'rocket',rfam:'break',icon:'rocket',desc:'유탄 한 발. 포물선으로 날아가 터져요.'}),
 gl6:SP_({name:'GL6',dmg:35,rpm:120,mode:'semi',mag:6,res:18,reload:4.0,proj:'microrocket',pspeed:34,pgrav:9,splash:{r:3.4,dmg:85},spread:0.7,recoil:1.8,speed:0.9,snd:'rocket',icon:'rocket',desc:'6연발 유탄발사기.'}),
 cbow:SP_({name:'콤파운드 보우',dmg:85,rpm:70,mode:'semi',mag:1,res:15,reload:1.0,proj:'bolt',pspeed:75,pgrav:5,spread:0.25,recoil:1,silent:true,snd:'bow',icon:'bow',desc:'소리 없는 화살. 머리에 맞으면 한 방.'}),
 flamer:SP_({name:'화염방사기',dmg:5,rpm:900,mode:'auto',pellets:3,spread:7,range:5,far:9,min:0.3,mag:100,res:200,reload:3.6,slow:0.25,recoil:0.2,speed:0.9,snd:'snow',sndRate:0.6,desc:'가까이에서 쉬지 않고 쏟아 부어요. 맞으면 느려져요.'}),
 minigun:SP_({name:'미니건',dmg:9,rpm:1800,mode:'auto',mag:200,res:400,reload:6.5,spread:3.0,range:18,far:45,recoil:0.45,speed:0.76,sw:1.0,snd:'smg2',sndRate:1.3,icon:'lmg',desc:'엄청난 연사. 아주 느리게 움직여요.'}),
 flare:SP_({name:'플레어건',slot:'side',dmg:45,rpm:60,mode:'semi',mag:1,res:12,reload:1.6,proj:'bolt',pspeed:55,pgrav:4,spread:0.6,recoil:1.6,snd:'pistol_heavy',sndRate:0.7,rfam:'break',icon:'pistol',desc:'한 발씩 쏘는 조명탄 권총.'}),
 harpoon:SP_({name:'작살총',dmg:60,rpm:50,mode:'semi',mag:1,res:10,reload:2.2,proj:'bolt',pspeed:50,pgrav:3,knock:-14,spread:0.3,recoil:1.2,silent:true,snd:'bow',sndRate:0.7,icon:'bow',desc:'맞히면 쏜 사람 쪽으로 끌려와요.'}),
 blunder:SP_({name:'블런더버스',dmg:12,pellets:10,spread:8,range:6,far:16,min:0.3,rpm:60,mode:'semi',mag:1,res:12,reload:3.0,recoil:5,smokePuff:true,snd:'flintlock',sndRate:0.8,rfam:'flint',icon:'shotgun',desc:'옛 나팔총. 한 발에 산탄이 넓게 퍼져요.'}),
 taser:SP_({name:'스턴건',slot:'side',dmg:15,rpm:60,mode:'semi',mag:1,res:15,reload:1.8,range:7,far:9,spread:0.5,slow:0.75,recoil:0.2,snd:'pistol_light',sndRate:1.8,icon:'pistol',desc:'가까이에서 맞히면 크게 느려져요.'}),
 railgun:SP_({name:'레일건',dmg:95,rpm:40,mode:'semi',mag:3,res:15,reload:3.2,spread:0.1,ads:0.05,range:90,far:160,min:1,pierce:4,recoil:4,speed:0.9,sw:0.7,snd:'sniper_heavy',sndRate:1.5,icon:'sniper',desc:'사람과 엄폐물을 꿰뚫는 한 발 (가상 무기).'}),
 nail:SP_({name:'네일건',slot:'side',dmg:12,rpm:600,mode:'auto',mag:40,res:160,reload:2.0,proj:'bolt',pspeed:55,pgrav:3,spread:1.2,recoil:0.3,snd:'pistol_light',sndRate:1.6,icon:'pistol',desc:'못을 빠르게 박아요.'}),
 paint:SP_({name:'페인트볼 건',dmg:8,rpm:500,mode:'auto',mag:20,res:200,reload:2.0,proj:'snow',pspeed:45,pgrav:6,slow:0.15,knock:2,spread:1.4,recoil:0.2,snd:'snow',sndRate:1.4,icon:'snow',desc:'맞으면 살짝 느려져요 (재미용).'})
};
Object.assign(WPN,WPN_ADD);
/* v7.11 emplaced weapons (a map's mounts): fired from the gun itself, never in a loadout or a shop */
Object.assign(WPN,{
 mnt_maxim:{name:'맥심 M1910',cat:'mount',slot:'mount',dmg:30,rpm:580,mag:9999,res:0,reload:1,spread:0.55,range:45,far:120,min:0.65,recoil:0.32,snd:'rifle_ak',sndRate:0.84,head:1.6,desc:'수랭식 중기관총.'},
 mnt_mg42:{name:'MG42',cat:'mount',slot:'mount',dmg:25,rpm:1150,mag:9999,res:0,reload:1,spread:0.8,range:40,far:110,min:0.6,recoil:0.42,snd:'rifle_ar',sndRate:1.28,head:1.6,desc:'매우 빠른 연사.'},
 mnt_at45:{name:'45mm 대전차포',cat:'mount',slot:'mount',dmg:120,rpm:20,mode:'semi',mag:9999,res:0,reload:1,proj:'microrocket',pspeed:95,pgrav:2.5,splash:{r:4.2,dmg:150},spread:0.2,recoil:3,snd:'rocket',sndRate:0.7,desc:'고폭탄 한 발씩.'},
 mnt_pak40:{name:'Pak 40',cat:'mount',slot:'mount',dmg:140,rpm:18,mode:'semi',mag:9999,res:0,reload:1,proj:'microrocket',pspeed:110,pgrav:2.5,splash:{r:4.6,dmg:165},spread:0.15,recoil:3.2,snd:'rocket',sndRate:0.62,desc:'75mm 고폭탄.'}
});
for(const id in WPN){ const w=Object.assign({},WDEF,WPN[id]); w.id=id; if(w.mode==="melee"){ w.mag=0; w.res=0; } WPN[id]=w; }
/* two-axis recoil (same unit as the old single recoil value): rv vertical, rh horizontal,
   rb horizontal bias (-1 always left … +1 always right), rf vertical multiplier on the first shot of a string.
   w.recoil is kept equal to rv for the stats screen and the first-person kick animation; gameplay uses only rv/rh/rb/rf. */
const RECOIL={
  smg9:[0.55,0.25,0.10,1.10], microsmg:[0.40,0.34,0,1], p50:[0.40,0.22,0,1], vector:[0.30,0.23,0.05,1],
  m4:[0.75,0.26,0.15,1.15], ak47:[1.15,0.52,-0.15,1.30], scar:[1.10,0.28,0,1.25], falcon:[1.60,0.48,0.35,1], famas:[0.65,0.20,0,1], g36:[0.66,0.20,0,1.10], m249:[0.62,0.43,0,1],
  pump:[3.00,0.45,0,1], sawed:[4.00,0.80,0,1], autosg:[1.70,0.43,0,1],
  m1:[1.90,0.38,0,1], lightsr:[2.00,0.44,0,1], heavysr:[4.50,0.68,0,1], piercesr:[4.00,0.60,0,1], mrl:[1.60,0.40,0,1], snowcan:[0.50,0.15,0,1],
  p1912:[1.40,0.35,0,1], deagle:[3.40,0.51,0,1], auto75:[0.70,0.56,0,1], revolver:[3.80,0.57,0,1], burst9:[0.95,0.38,0,1],
  crossbow:[1.20,0.12,0,1], flintlock:[5.00,1.00,0,1], shuriken:[0.30,0.05,0,1],
  shield:[0,0,0,1], fists:[0,0,0,1], knife:[0,0,0,1], axe:[0,0,0,1]};
for(const id in WPN){ const w=WPN[id], r=RECOIL[id];
  if(r){ [w.rv,w.rh,w.rb,w.rf]=r; }
  else { w.rv=w.recoil; w.rh=+(w.recoil*0.3).toFixed(3); w.rb=0; w.rf=1; } // not in the table (the tag-mode seeker pistol): same feel as before
  w.recoil=w.rv; }
/* ---------- attachments (gunsmith) ----------
   Five slots per gun. Each option changes the model (guns.js) and the numbers below. Multipliers stack. */
const ATT_SLOTS=['scope','muzzle','barrel','grip','stock','mag'];
const ATT_SLOT_NAMES={scope:'조준경',muzzle:'총구',barrel:'총열',grip:'하부 부착물',stock:'개머리판',mag:'탄창'};
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
  comp:{name:'보정기',desc:'수직 반동 -24%, 수평 반동 -16%.',rv:0.76,rh:0.84},
  flash:{name:'소염기',desc:'총구 화염이 안 보이고 반동 -10%.',rv:0.9,rh:0.9,noFlash:true},
  sup:{name:'소음기',desc:'총소리가 작아지고 미니맵에 잠깐만 보여요. 유효 사거리 -10%.',silent:true,noFlash:true,range:0.9,far:0.92},
  brake:{name:'머즐 브레이크',desc:'수직 반동 -24%, 수평 반동 -32%. 대신 총소리가 커서 미니맵에 오래 보여요.',rv:0.76,rh:0.68,loud:true},
  choke:{name:'초크',desc:'산탄이 덜 퍼져요 (-25%).',spread:0.75}},
 barrel:{
  std:{name:'기본 총열',desc:'균형 잡힌 기본형.'},
  long:{name:'긴 총열',desc:'사거리 +20%, 정확도 +10%. 조금 무거워요.',range:1.2,far:1.2,spread:0.9,speed:0.97,sw:1.12,adsSpd:0.93},
  short:{name:'짧은 총열',desc:'가볍고 빠른 조준. 사거리 -15%.',range:0.85,far:0.85,spread:1.1,speed:1.03,sw:0.85,adsSpd:1.15},
  heavy:{name:'헤비 총열',desc:'반동 -15%, 이동 속도 -4%.',rv:0.85,rh:0.85,speed:0.96,sw:1.1}},
 grip:{
  none:{name:'없음',desc:'아무것도 달지 않아요.'},
  vert:{name:'수직 손잡이',desc:'수직 반동 -22%, 수평 반동 -7%. 조준 속도 -5%.',rv:0.78,rh:0.93,adsSpd:0.95},
  angled:{name:'앵글 손잡이',desc:'조준 속도 +15%, 수평 반동 -13%, 수직 반동 -1%.',adsSpd:1.15,rv:0.99,rh:0.87},
  half:{name:'하프 그립',desc:'반동 -10%, 움직이며 쏠 때 덜 퍼져요.',rv:0.9,rh:0.9,move:0.8},
  thumb:{name:'엄지 그립',desc:'조준 속도 +25%, 무기 교체 -10%.',adsSpd:1.25,sw:0.9},
  laser:{name:'레이저 사이트',desc:'조준하지 않고 쏠 때 탄 퍼짐 -30%. 화면 가운데에 빨간 점이 보여요.',hip:0.7,laser:true},
  bipod:{name:'양각대',desc:'수직 반동 -16%, 수평 반동 -20%. 이동 속도 -3%.',rv:0.84,rh:0.8,speed:0.97}},
 stock:{
  std:{name:'기본 개머리판',desc:'기본형.'},
  light:{name:'경량 개머리판',desc:'조준 속도 +25%, 이동 +3%. 수직 반동 +5%, 수평 반동 +11%.',adsSpd:1.25,speed:1.03,rv:1.05,rh:1.11},
  heavy:{name:'전술 개머리판',desc:'수직 반동 -10%, 수평 반동 -14%, 움직이며 쏠 때 덜 퍼져요.',rv:0.9,rh:0.86,move:0.7,adsSpd:0.95},
  cheek:{name:'칙패드',desc:'조준 사격 정확도 +20%, 수직 반동 -10%, 수평 반동 -2%.',adsAcc:0.8,rv:0.9,rh:0.98},
  loops:{name:'탄띠',desc:'개머리판에 탄을 꽂아 둬요. 장전 시간 -20%.',reload:0.8},
  none:{name:'개머리판 제거',desc:'무기 교체 -25%, 이동 +5%. 수직 반동 +12%, 수평 반동 +29%.',sw:0.75,speed:1.05,rv:1.12,rh:1.29,move:1.15}},
 mag:{
  std:{name:'기본 탄창',desc:'기본형.'},
  ext:{name:'대용량 탄창',desc:'탄창 +40%. 장전 +10%.',mag:1.4,reload:1.1},
  quick:{name:'퀵드로우 탄창',desc:'장전 시간 -25%.',reload:0.75},
  extq:{name:'대용량 퀵드로우',desc:'탄창 +25%, 장전 -12%.',mag:1.25,reload:0.88},
  drum:{name:'드럼 탄창',desc:'탄창 2배. 장전 +35%, 이동 -3%.',mag:2,reload:1.35,speed:0.97}}
};
/* which options each gun accepts (first entry = what it ships with) */
(()=>{ const set=(w,o)=>{ w.att=o; };
  for(const id in WPN){ const w=WPN[id]; if(w.mode==='melee'||w.proj||w.slot==='tag'||['flintlock','sawed','ou','derr'].includes(id)){ w.att=null; continue; }
    const c=w.cat;
    if(c==='ar') set(w,{scope:['iron','reddot','holo','x2','x3','x4','x6'],muzzle:['none','comp','flash','sup','brake'],barrel:['std','long','short','heavy'],grip:['none','vert','angled','half','thumb','laser'],stock:['std','light','heavy','none'],mag:['std','ext','quick','extq','drum']});
    else if(c==='smg') set(w,{scope:['iron','reddot','holo','x2','x3'],muzzle:['none','comp','flash','sup'],barrel:['std','long','short'],grip:['none','vert','angled','half','thumb','laser'],stock:['std','light','heavy','none'],mag:['std','ext','quick','extq','drum']});
    else if(c==='sg') set(w,{scope:['iron','reddot','holo','x2'],muzzle:['none','choke','comp','sup'],barrel:['std','long','short'],grip:['none','laser'],stock:['std','light','heavy','loops','none'],mag:id==='autosg'?['std','ext','quick']:['std']});
    else if(c==='sr') set(w,{scope:['iron','reddot','holo','x2','x3','x4','x6','x8'],muzzle:['none','comp','flash','sup','brake'],barrel:['std','long','short','heavy'],grip:['none','bipod','angled','laser'],stock:['std','light','heavy','cheek'],mag:['std','ext','quick','extq']});
    else if(c==='pistol') set(w,{scope:['iron','reddot'],muzzle:['none','comp','sup'],barrel:['std','long'],grip:['none','laser'],stock:['std'],mag:['std','ext','quick']});
    else if(c==='lmg') set(w,{scope:['iron','reddot','holo','x2','x3','x4'],muzzle:['none','comp','flash','sup','brake'],barrel:['std','long','short','heavy'],grip:['none','bipod','vert','angled'],stock:['std','light','heavy','none'],mag:['std','ext']});
    else if(c==='dmr') set(w,{scope:['iron','reddot','holo','x2','x3','x4','x6'],muzzle:['none','comp','flash','sup','brake'],barrel:['std','long','short','heavy'],grip:['none','bipod','vert','angled','laser'],stock:['std','light','heavy','cheek'],mag:['std','ext','quick','extq']});
    else w.att=null; }
  const only=(id,slot,list)=>{ if(WPN[id]&&WPN[id].att) WPN[id].att[slot]=list; };
  only('famas','stock',['std']); only('p50','stock',['std']); only('p50','mag',['std','ext']); only('m249','mag',['std','ext']); only('m249','stock',['std','heavy']);
  only('microsmg','mag',['std','ext','quick','extq']); only('vector','mag',['std','ext','quick','extq']); only('p50','barrel',['std','long']);
  only('m1','mag',['std']); only('m1','stock',['std','loops']); only('m1','grip',['none']); only('famas','grip',['none','vert','laser']); only('p50','grip',['none','laser']); only('microsmg','grip',['none','laser']); only('m249','grip',['none','bipod','vert']);
  only('revolver','grip',['none']); only('auto75','grip',['none']); only('burst9','grip',['none']); only('heavysr','stock',['std','light','heavy','cheek','loops']); only('heavysr','grip',['none','bipod','laser']); only('piercesr','grip',['none','bipod']); only('m1','scope',['iron','reddot','x2','x3','x4']); only('heavysr','mag',['std','ext','quick']); only('piercesr','mag',['std','ext','quick']);
  only('lightsr','scope',['x3','iron','reddot','holo','x2','x4','x6','x8']); only('heavysr','scope',['x4','iron','reddot','holo','x2','x3','x6','x8']); only('piercesr','scope',['x4','iron','reddot','holo','x2','x3','x6','x8']);
  only('revolver','muzzle',['none']); only('revolver','mag',['std']); only('revolver','barrel',['std','long','short']); only('deagle','muzzle',['none','comp']); only('deagle','scope',['iron','reddot','x2']);
  for(const id of ['lightsr','heavysr','piercesr']){ WPN[id].scope=false; WPN[id].zoom=0.72; }
  /* v7.10.0 guns */
  const many=(ids,slot,list)=>{ for(const id of ids) only(id,slot,list); };
  many(['augur','t21','qbz','l85','f2k','groza','svu','qbu','bp1','ks14','db12','p18c'],'stock',['std']);
  many(['asv','k7','vss','mark22'],'muzzle',['none']);                        /* suppressor built in */
  only('augur','scope',['x2','iron','reddot','holo','x3','x4']); only('svd','scope',['x4','iron','reddot','holo','x2','x3','x6']);
  many(['m24','kar98','mosin','enfield','scout','lrr','bp1','sv98','k14'],'scope',['x4','iron','reddot','holo','x2','x3','x6','x8']);
  for(const id of ['m24','kar98','mosin','enfield','scout','lrr','bp1','sv98','k14']){ WPN[id].scope=false; WPN[id].zoom=0.72; }
  many(['kar98','mosin','sks','lever94'],'mag',['std']); many(['kar98','mosin'],'grip',['none','bipod']); many(['kar98','mosin','sks'],'stock',['std','cheek']);
  only('lever94','scope',['iron','reddot','x2','x3']); only('lever94','grip',['none']); only('lever94','stock',['std','loops']); only('lever94','muzzle',['none','sup']);
  only('lever87','scope',['iron','reddot']); only('lever87','stock',['std','loops']); only('slug','muzzle',['none','comp','sup']); only('striker','stock',['std','light','none']);
  many(['ax12','usas'],'mag',['std','ext']); many(['ks14','db12'],'grip',['none','laser']);
  many(['peace','viper','m500'],'muzzle',['none']); many(['peace','viper','m500'],'mag',['std']); many(['peace','viper','m500'],'grip',['none']); many(['peace','viper','m500'],'barrel',['std','long','short']);
  only('peace','scope',['iron']); many(['c96','pk','makarov','tt33'],'grip',['none']); only('mark22','barrel',['std','long']);
  many(['ppsh','tommy'],'mag',['std','ext']); many(['ppsh','tommy','mp40','sten','sk61','bison'],'grip',['none','laser']); many(['bison','ppsh'],'stock',['std','none']);
  many(['mg42','pkm','rpd','m60'],'grip',['none','bipod']); only('rpk','grip',['none','bipod','vert']);
})();
const attKey=a=>a?ATT_SLOTS.map(k=>a[k]||'').join(','):'';
/* a complete, valid attachment set for a gun (unknown or unsupported choices fall back to what it ships with) */
function attClean(id,a){ const w=WPN[id]; if(!w||!w.att) return null; const o={}; for(const k of ATT_SLOTS){ const list=w.att[k]||[]; o[k]=a&&list.includes(a[k])?a[k]:(list[0]||null); } return o; }
/* the gun with its attachments applied: a copy of the weapon with changed numbers (cached) */
const _wCache=new Map();
function wpnWith(id,att){ const base=WPN[id]; if(!base) return null; if(!base.att) return base; const a=attClean(id,att), key=id+'|'+attKey(a); let w=_wCache.get(key); if(w) return w;
  w=Object.assign({},base); w.attSet=a; w.attKey=key; w.adsSpd=1; w.hip=1; let magMul=1, mulV=1, mulH=1;
  for(const k of ATT_SLOTS){ const o=ATT[k][a[k]]; if(!o) continue;
    for(const s of ['range','far','spread','speed','sw','reload','move']) if(o[s]) w[s]=w[s]*o[s];
    if(o.rv) mulV*=o.rv; if(o.rh) mulH*=o.rh;
    if(o.adsSpd) w.adsSpd*=o.adsSpd; if(o.mag) magMul*=o.mag; if(o.silent) w.silent=true; if(o.noFlash) w.noFlash=true;
    if(o.hip) w.hip=(w.hip||1)*o.hip; if(o.adsAcc) w.ads=w.ads*o.adsAcc; if(o.loud) w.loud=true; if(o.laser) w.laser=true;
    if(k==='scope'){ if(o.zoom) w.zoom=o.zoom; else if(o.z) w.zoom=base.zoom*o.z; w.scope=!!o.scope; w.optic=a[k]; } }
  if(magMul!==1&&w.mag){ w.mag=Math.max(w.mag+1,Math.round(base.mag*magMul)); }
  /* parts can cut recoil to at most 45% of the gun's own on each axis */
  w.mulV=Math.max(mulV,0.45); w.mulH=Math.max(mulH,0.45); w.rv=base.rv*w.mulV; w.rh=base.rh*w.mulH; w.recoil=w.rv;
  w.speed=+w.speed.toFixed(3); w.reload=+w.reload.toFixed(2); _wCache.set(key,w); return w; }
const MAINS=Object.keys(WPN).filter(k=>WPN[k].slot==='main'), SIDES=Object.keys(WPN).filter(k=>WPN[k].slot==='side'), MELEES=Object.keys(WPN).filter(k=>WPN[k].slot==='melee');
/* slot 1 and slot 2 take any firearm (the riot shield counts as one) */
const GUNS=MAINS.concat(SIDES);
const gunsByCat=list=>list.slice().sort((a,b)=>CAT_ORDER.indexOf(WPN[a].cat)-CAT_ORDER.indexOf(WPN[b].cat));

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
 snd:{name:'수색과 파괴',team:true,desc:'라운드마다 돈으로 총을 사요(카운터스트라이크 방식). 공격팀은 폭탄 설치, 수비팀은 막기. 부활 없음, 4라운드 후 진영 교체, 5승이면 승리.',limit:()=>5,time:0,unit:'라운드',rounds:true},
 upl:{name:'업로드',team:true,desc:'중앙의 데이터 드라이브를 적 업로드 기지로 옮겨요.',limit:()=>5,time:9,unit:'업로드'},
 pk:{name:'파쿠르',team:false,desc:'바닥은 용암! 체크포인트를 따라 먼저 도착하면 승리.',limit:()=>1,time:6,unit:'바퀴',noDamage:true},
 range:{name:'훈련장',team:false,hidden:true,desc:'표적과 더미로 사격 연습. 총은 바로 바꿀 수 있고 초당 피해량을 재요.',limit:()=>1e9,time:0,unit:''}
};
const BMODE_IDS=Object.keys(BMODES).filter(k=>!BMODES[k].hidden);
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
