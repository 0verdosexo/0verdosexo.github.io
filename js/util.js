/* util.js — small helpers shared by every other file, saved preferences, loadouts */
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const angDiff=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[(Math.random()*a.length)|0];
const fin=v=>typeof v==='number'&&isFinite(v);
function mulberry(a){ return function(){ a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296; }; }
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; }
function uid(n){ const ch='abcdefghijkmnpqrstuvwxyz23456789'; let s=''; for(let i=0;i<(n||8);i++) s+=ch[(Math.random()*ch.length)|0]; return s; }
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,12)||'플레이어';
const LS={ get(k,d){ try{ const v=localStorage.getItem('sandtag5-'+k); return v===null?d:JSON.parse(v); }catch(_){ return d; } },
           set(k,v){ try{ localStorage.setItem('sandtag5-'+k,JSON.stringify(v)); }catch(_){} } };
const isTouch=(()=>{ try{ return matchMedia('(pointer: coarse)').matches; }catch(_){ return false; } })();
/* one loadout: gun slot 1 and gun slot 2 take any firearm; attachments are remembered per gun in prefs.gunAtt */
const DEFAULT_LOADOUT={name:'기본',main:'m4',side:'p1912',melee:'knife',thr:'frag',spec:'ammo',perks:['kevlar','sprinter']};
const DEFAULT_LOADOUTS=[DEFAULT_LOADOUT];
const prefs=Object.assign({
  name:'', ctrl:'auto', sens:1, fov:78, gfx:isTouch?'medium':'high', vol:0.8, sound:true, invertY:false, showFps:false, gfxAuto:true, autoFire:true, crossColor:'#ffffff',
  tag:{map:'factory',players:6,diff:'normal',seekerGun:false,theme:'auto'},
  battle:{mode:'tdm',map:'factory',bots:7,diff:'normal'},
  loadout:null, gunAtt:{}, glow:1, char:0, lobbyKind:'battle', xp:0
},LS.get('prefs',{}));
prefs.tag=Object.assign({map:'factory',players:6,diff:'normal',seekerGun:false,time:10,role:'any'},prefs.tag||{}); prefs.battle=Object.assign({mode:'tdm',map:'factory',bots:7,diff:'normal'},prefs.battle||{});
if(!['auto','kb','touch'].includes(prefs.ctrl)) prefs.ctrl='auto';
if(!prefs.name) prefs.name='플레이어'+String((Math.random()*900+100)|0);
/* older saves had three presets (돌격/근접/저격): keep the one that was selected */
if(!prefs.loadout&&Array.isArray(prefs.loadouts)&&prefs.loadouts.length) prefs.loadout=prefs.loadouts[prefs.cur||0]||prefs.loadouts[0];
delete prefs.loadouts; delete prefs.cur;
prefs.loadout=Object.assign({},DEFAULT_LOADOUT,prefs.loadout||{}); if(!prefs.gunAtt||typeof prefs.gunAtt!=='object') prefs.gunAtt={};
/* the loadout as it goes into a match (and over the network): the two guns carry their attachments */
function myLoad(){ const L=prefs.loadout; return {name:L.name,main:L.main,side:L.side,melee:L.melee,thr:L.thr,spec:L.spec,perks:L.perks.slice(),att:[attClean(L.main,prefs.gunAtt[L.main]),attClean(L.side,prefs.gunAtt[L.side])]}; }
/* attachments of the gun an actor is holding (null = as shipped) */
function attOf(a,id){ const L=a&&a.load; if(!L||!Array.isArray(L.att)) return null; return id===L.main?L.att[0]:id===L.side?L.att[1]:null; }
function savePrefs(){ LS.set('prefs',prefs); }
/* tiny event bus */
const Bus={ h:{}, on(e,f){ (this.h[e]=this.h[e]||[]).push(f); }, emit(e,...a){ (this.h[e]||[]).forEach(f=>{ try{ f(...a); }catch(err){ console.error(err); } }); } };
