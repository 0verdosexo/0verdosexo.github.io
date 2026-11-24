/* relay.js — how online rooms reach each other. Two ways, same use from net.js (Relay.T):
     server  our own relay server (Cloudflare Workers + Durable Objects, see server/): one WebSocket per room, a room list over HTTPS.
             Used whenever a server address is set: SERVER_URL below, or ?server=https://… in the page address (tests).
     mqtt    public MQTT brokers (no server of our own). Used when no server is set, or with ?server=mqtt.
   Every player in a room must use the same way, so all builds carry the same SERVER_URL. */
'use strict';
const Relay=(()=>{
  /* ===== the address of our relay server (filled in after `npx wrangler deploy`) ===== */
  const SERVER_URL='https://codename-relay.code-name.workers.dev';
  const Q=new URLSearchParams(location.search);
  const qs=Q.get('server');
  const server=(qs==='mqtt'?'':(qs||SERVER_URL)).replace(/\/+$/,'');
  const CODE_CH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randCode=()=>{ let c=''; for(let i=0;i<5;i++) c+=CODE_CH[(Math.random()*CODE_CH.length)|0]; return c; };

  /* ================= public MQTT brokers ================= */
  const OVERRIDE=Q.get('broker');
  const BROKERS=OVERRIDE?[OVERRIDE]:['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt','wss://test.mosquitto.org:8081/mqtt'];
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

  const PRE='st5/';
  const MqttT={ kind:'mqtt', tries:BROKERS.length,
    newCode:i=>newCode(i),
    async open(code,o){ const C=await connect(brokerOf(code),o.host?{will:{topic:PRE+'lobby/'+code,payload:'',retain:true,qos:0}}:undefined);
      const R={C,code,onmsg:null}; sub(C,PRE+'r/'+code+'/m',d=>{ R.onmsg&&R.onmsg(d); }); return R; },
    send(R,obj){ if(R) pub(R.C,PRE+'r/'+R.code+'/m',obj); },
    advertise(R,info){ if(R) pub(R.C,PRE+'lobby/'+R.code,info,true); },
    close(R){ if(R) close(R.C); },
    /* onRoom(code, info|null) for every change */
    browse(onRoom){ const conns=[]; let stopped=false;
      for(const url of BROKERS) connect(url).then(c=>{ if(stopped){ close(c); return; } conns.push(c); sub(c,PRE+'lobby/+',(d,topic)=>onRoom(topic.split('/').pop(),d)); }).catch(()=>{});
      return ()=>{ stopped=true; for(const c of conns) close(c); }; } };

  /* ================= our relay server ================= */
  const WS=server.replace(/^http/,'ws');
  const WHY={4001:'이미 쓰는 방 코드예요',4003:'방이 가득 찼어요',4004:'방을 찾을 수 없어요. 코드를 확인해 주세요',4400:'잘못된 요청이에요'};
  const ServerT={ kind:'server', tries:4,
    newCode:()=>randCode(),
    /* resolves when connected; after that it reconnects by itself (same player id, the room keeps the place for 8 s) */
    open(code,o){ return new Promise((res,rej)=>{
      const R={code,host:!!o.host,id:o.id,ws:null,ok:false,closed:false,onmsg:null,retry:0,queue:[],adv:null,advKey:'',advT:0,ping:0};
      let first=true;
      const go=()=>{ let ws; try{ ws=new WebSocket(WS+'/room/'+code+'?id='+encodeURIComponent(o.id)+(o.host?'&host=1':'')); }catch(e){ if(first){ first=false; rej(e); } return; }
        R.ws=ws; const to=setTimeout(()=>{ if(ws.readyState!==1){ try{ ws.close(); }catch(_){} } },9000);
        /* the room says "#ok" once it has taken us in; a refused socket opens and then closes with a reason code */
        const ready=()=>{ clearTimeout(to); R.ok=true; R.retry=0; for(const m of R.queue.splice(0)) ws.send(m); if(R.adv) ws.send('#adv'+R.adv);
          Bus.emit('relay',{up:true,url:server}); if(first){ first=false; res(R); } };
        ws.onmessage=e=>{ const s=e.data; if(typeof s!=='string'||s==='pong') return; if(s==='#ok'){ ready(); return; } if(s[0]==='#') return;
          let d; try{ d=JSON.parse(s); }catch(_){ return; } R.onmsg&&R.onmsg(d); };
        ws.onerror=()=>{};
        ws.onclose=e=>{ clearTimeout(to); const was=R.ok; R.ok=false; if(R.ws!==ws) return;
          if(first){ first=false; R.closed=true; clearInterval(R.ping); rej(Object.assign(new Error(WHY[e.code]||'온라인 서버에 연결할 수 없어요'),{code:e.code})); return; }
          if(was) Bus.emit('relay',{up:false,url:server});
          if(R.closed||e.code===4000||WHY[e.code]){ R.closed=true; clearInterval(R.ping); return; }
          setTimeout(()=>{ if(!R.closed) go(); },Math.min(8000,400*2**R.retry++)); }; };
      go();
      R.ping=setInterval(()=>{ if(R.ok&&R.ws.readyState===1){ try{ R.ws.send('ping'); }catch(_){} } },25000);
    }); },
    /* volatile messages (positions) are dropped while reconnecting; others wait for the connection */
    send(R,obj,volatile){ if(!R||R.closed) return; const s=JSON.stringify(obj); if(R.ok&&R.ws.readyState===1){ try{ R.ws.send(s); }catch(_){} } else if(!volatile&&R.queue.length<60) R.queue.push(s); },
    /* the public list: sent when something changed, otherwise every 8 s */
    advertise(R,info){ if(!R) return; let key='null', s='null';
      if(info){ const {ts,...rest}=info; key=JSON.stringify(rest); s=JSON.stringify(info); }
      const now=Date.now(); if(key===R.advKey&&now-R.advT<8000) return; R.advKey=key; R.advT=now; R.adv=info?s:null;
      if(R.ok&&R.ws.readyState===1){ try{ R.ws.send('#adv'+s); }catch(_){} } },
    close(R){ if(!R) return; R.closed=true; clearInterval(R.ping); try{ R.ws&&R.ws.close(1000,'bye'); }catch(_){} },
    browse(onRoom){ let stopped=false, known=new Set(), t=0;
      const poll=async()=>{ if(stopped) return;
        try{ const r=await fetch(server+'/rooms',{cache:'no-store'}); const list=await r.json(); if(stopped) return; const now=Date.now(), seen=new Set();
          for(const x of list){ if(!x||!x.code) continue; seen.add(x.code); const {age,...info}=x; info.ts=now-(age||0); onRoom(x.code,info); }
          for(const k of known) if(!seen.has(k)) onRoom(k,null); known=seen; }catch(_){}
        if(!stopped) t=setTimeout(poll,3000); };
      poll(); return ()=>{ stopped=true; clearTimeout(t); }; } };

  const T=server?ServerT:MqttT;
  return {T,server,BROKERS,brokerOf,newCode,connect,sub,unsub,pub,close,CODE_CH};
})();
