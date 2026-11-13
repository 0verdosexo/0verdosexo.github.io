/* relay.js — RELAY TRANSPORT (MQTT over WebSocket, PeerJS-like API) =====================
   Every message goes through a public relay broker, so no device-to-device link is needed. */
const BROKERS=['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt','wss://test.mosquitto.org:8081/mqtt'];
const CODE_CH='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const brokerOf=code=>Math.max(0,CODE_CH.indexOf(String(code||'').toUpperCase()[0]))%BROKERS.length;
const RTOPIC='sandtag3r/';
class REm{ constructor(){ this._h={}; } on(e,f){ (this._h[e]=this._h[e]||[]).push(f); return this; } emit(e,...a){ (this._h[e]||[]).slice().forEach(f=>{ try{ f(...a); }catch(err){ console.error(err); } }); } }
class RConn extends REm{
  constructor(peer,cid,remote){ super(); this.peer=peer; this.cid=cid; this.remote=remote; this.open=false; this._closed=false; peer._conns.set(cid,this); }
  send(d){ if(this.open) this.peer._pub(this.remote,{k:'data',cid:this.cid,d}); }
  close(){ if(this._closed) return; this._closed=true; const was=this.open; this.open=false; clearTimeout(this._t); clearTimeout(this._r); this.peer._conns.delete(this.cid);
    if(was) this.peer._pub(this.remote,{k:'close',cid:this.cid}); setTimeout(()=>this.emit('close'),0); }
}
class RPeer extends REm{
  constructor(a,b){ super();
    const id=typeof a==='string'?a:null, o=(typeof a==='string'?b:a)||{};
    this.id=id||('g'+Math.random().toString(36).slice(2,12)); this.claim=!!id; this.open=false; this.disconnected=false; this.destroyed=false; this._conns=new Map();
    if(typeof mqtt==='undefined'||!mqtt.connect){ setTimeout(()=>this.emit('error',{type:'browser-incompatible'}),0); return; }
    const bi=o.broker!=null?o.broker:brokerOf(id?id.slice(-6):'');
    this.broker=bi;
    this.c=mqtt.connect(BROKERS[bi],{clientId:'st3_'+Math.random().toString(36).slice(2,12),keepalive:15,reconnectPeriod:2000,connectTimeout:7000,clean:true});
    this._t=setTimeout(()=>{ if(!this.open&&!this.destroyed) this.emit('error',{type:'server-error'}); },10000);
    this.c.on('connect',()=>this._onConnect());
    this.c.on('message',(t,p)=>{ let m; try{ m=JSON.parse(typeof p==='string'?p:p.toString()); }catch(_){ return; } if(m&&typeof m==='object') this._onMsg(t,m); });
    this.c.on('offline',()=>this._down()); this.c.on('error',()=>{});
    this.c.on('close',()=>{ if(!this.open&&this.claim&&!this.destroyed&&!this._failed){ this._failed=true; clearTimeout(this._t); this.emit('error',{type:'server-error'}); return; } this._down(); });
  }
  _down(){ if(this.destroyed||!this.open||this.disconnected) return; this.disconnected=true; this.emit('disconnected'); }
  _onConnect(){
    if(this.destroyed) return; const me=RTOPIC+this.id;
    this.c.subscribe(me,{qos:0},()=>{
      if(this.destroyed) return;
      if(this.open){ if(this.disconnected){ this.disconnected=false; this.emit('open',this.id); } return; }
      if(!this.claim){ this._ready(); return; }
      this._nonce=Math.random().toString(36).slice(2,12); this._taken=false;
      this.c.subscribe(RTOPIC+'n/'+this._nonce,{qos:0},()=>{
        this.c.publish(me,JSON.stringify({k:'claim',n:this._nonce}));
        setTimeout(()=>{ if(this.destroyed) return; if(this._taken){ this.emit('error',{type:'unavailable-id'}); this.destroy(); } else this._ready(); },1300); });
    });
  }
  _ready(){ clearTimeout(this._t); this.open=true; this.disconnected=false; this.emit('open',this.id); }
  _pub(to,m){ if(this.destroyed||!this.c) return; m.from=this.id; try{ this.c.publish(RTOPIC+to,JSON.stringify(m)); }catch(_){} }
  _onMsg(topic,m){
    if(topic.indexOf(RTOPIC+'n/')===0){ if(m.k==='taken') this._taken=true; return; }
    if(m.k==='claim'){ if(this.open&&m.n!==this._nonce) try{ this.c.publish(RTOPIC+'n/'+m.n,JSON.stringify({k:'taken'})); }catch(_){} return; }
    if(!this.open||typeof m.from!=='string'||typeof m.cid!=='string') return;
    if(m.k==='conn'){
      if(this._conns.has(m.cid)){ this._pub(m.from,{k:'ack',cid:m.cid}); return; }
      const c=new RConn(this,m.cid,m.from); c.open=true; this.emit('connection',c); this._pub(m.from,{k:'ack',cid:m.cid}); setTimeout(()=>{ if(c.open) c.emit('open'); },0); return; }
    const c=this._conns.get(m.cid); if(!c||c.remote!==m.from) return;
    if(m.k==='ack'){ if(!c.open&&!c._closed){ c.open=true; clearTimeout(c._t); clearTimeout(c._r); c.emit('open'); } return; }
    if(m.k==='data'){ if(c.open) c.emit('data',m.d); return; }
    if(m.k==='close'){ if(!c._closed){ c._closed=true; c.open=false; this._conns.delete(c.cid); c.emit('close'); } }
  }
  connect(id){ const cid=Math.random().toString(36).slice(2,12), c=new RConn(this,cid,id);
    const send=()=>{ if(!c.open&&!c._closed) this._pub(id,{k:'conn',cid}); }; send(); c._r=setTimeout(send,1200);
    c._t=setTimeout(()=>{ if(!c.open&&!c._closed){ c._closed=true; this._conns.delete(cid); this.emit('error',{type:'peer-unavailable'}); } },4000);
    return c; }
  reconnect(){ if(this.destroyed||!this.c) return; try{ if(!this.c.connected&&!this.c.reconnecting) this.c.reconnect(); }catch(_){} }
  destroy(){ if(this.destroyed) return; this.destroyed=true; for(const c of [...this._conns.values()]) c.close(); this.open=false; try{ this.c&&this.c.end(true); }catch(_){} }
}
const Peer=RPeer;
