/* relay.js — tiny MQTT pub/sub wrapper over public WebSocket brokers (no accounts, no server of our own).
   A room lives on one broker, chosen by the first letter of its code. ?broker=ws://host:port overrides (tests). */
'use strict';
const Relay=(()=>{
  const OVERRIDE=new URLSearchParams(location.search).get('broker');
  const BROKERS=OVERRIDE?[OVERRIDE]:['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt','wss://test.mosquitto.org:8081/mqtt'];
  const CODE_CH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const brokerOf=code=>BROKERS[CODE_CH.indexOf(code[0])%BROKERS.length]||BROKERS[0];
  function newCode(bi){ const n=BROKERS.length, opts=[...CODE_CH].filter((c,i)=>i%n===((bi||0)%n)); let c=opts[(Math.random()*opts.length)|0];
    for(let i=0;i<4;i++) c+=CODE_CH[(Math.random()*CODE_CH.length)|0]; return c; }
  /* one connection = {client, url, subs:Map(topic→fn)} */
  function connect(url,opts){ return new Promise((res,rej)=>{
    let done=false; const cid='st5_'+uid(10);
    const c=mqtt.connect(url,Object.assign({clientId:cid,clean:true,connectTimeout:7000,reconnectPeriod:2500,keepalive:20,protocolVersion:4},opts||{}));
    const C={client:c,url,subs:new Map(),id:cid,ok:false};
    c.on('connect',()=>{ C.ok=true; for(const t of C.subs.keys()) c.subscribe(t,{qos:0}); if(!done){ done=true; res(C); } Bus.emit('relay',{up:true,url}); });
    c.on('message',(topic,buf)=>{ const s=buf.toString(); for(const [t,fn] of C.subs){ if(match(t,topic)){ let d=null; if(s.length){ try{ d=JSON.parse(s); }catch(_){ continue; } } fn(d,topic); } } });
    c.on('close',()=>{ C.ok=false; Bus.emit('relay',{up:false,url}); });
    c.on('error',e=>{ if(!done){ done=true; try{ c.end(true); }catch(_){} rej(e); } });
    setTimeout(()=>{ if(!done){ done=true; try{ c.end(true); }catch(_){} rej(new Error('timeout')); } },9000);
  }); }
  function match(f,t){ if(f===t) return true; const a=f.split('/'), b=t.split('/'); for(let i=0;i<a.length;i++){ if(a[i]==='#') return true; if(a[i]!=='+'&&a[i]!==b[i]) return false; } return a.length===b.length; }
  function sub(C,topic,fn){ C.subs.set(topic,fn); if(C.ok) C.client.subscribe(topic,{qos:0}); }
  function unsub(C,topic){ C.subs.delete(topic); if(C.ok) C.client.unsubscribe(topic); }
  function pub(C,topic,obj,retain){ if(!C||!C.client) return; C.client.publish(topic,obj==null?'':JSON.stringify(obj),{qos:0,retain:!!retain}); }
  function close(C){ if(C&&C.client){ try{ C.client.end(true); }catch(_){} } }
  return {BROKERS,brokerOf,newCode,connect,sub,unsub,pub,close,CODE_CH};
})();
