/* 最小 WebSocket 測試客戶端：模擬兩位玩家測試伺服器全流程 */
'use strict';
const net = require('net');
const crypto = require('crypto');

function wsClient(name, onMsg) {
  const sock = net.connect(2941, '127.0.0.1');
  const key = crypto.randomBytes(16).toString('base64');
  let handshaken = false, buf = Buffer.alloc(0);
  const api = { sock, send(obj) {
    const p = Buffer.from(JSON.stringify(obj), 'utf8');
    const mask = crypto.randomBytes(4);
    let head;
    if (p.length < 126) head = Buffer.from([0x81, 0x80 | p.length]);
    else { head = Buffer.alloc(4); head[0]=0x81; head[1]=0x80|126; head.writeUInt16BE(p.length,2); }
    const mp = Buffer.from(p);
    for (let i=0;i<mp.length;i++) mp[i]^=mask[i%4];
    sock.write(Buffer.concat([head, mask, mp]));
  }};
  sock.on('connect', () => {
    sock.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1:2941\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
  });
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    if (!handshaken) {
      const idx = buf.indexOf('\r\n\r\n');
      if (idx < 0) return;
      if (!buf.slice(0,idx).toString().includes('101')) { console.log(name,'交握失敗'); process.exit(1); }
      handshaken = true; buf = buf.slice(idx+4);
    }
    while (buf.length >= 2) {
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length<4) return; len = buf.readUInt16BE(2); off = 4; }
      if (buf.length < off+len) return;
      const payload = buf.slice(off, off+len).toString('utf8');
      buf = buf.slice(off+len);
      try { onMsg(name, JSON.parse(payload), api); } catch(e){}
    }
  });
  return api;
}

const seen = [];
function note(s){ seen.push(s); console.log('  ✓', s); }
let A, B, idA, idB;
let duelDone=false, huntDone=false;

function router(who, m, api) {
  if (m.t==='welcome'){ if(who==='A'){idA=m.id;} else {idB=m.id;} note(`${who} 通過密語進入大廳 (id=${m.id})`); }
  if (m.t==='deny'){ console.log('  ✗ 被拒絕：', m.reason); }
  if (who==='B' && m.t==='chat' && m.msg==='哈囉中土'){ note('B 收到 A 的聊天訊息'); B.send({t:'invite',to:idA? idA:'?'}); }
  if (who==='A' && m.t==='invite'){ note('A 收到組隊邀請'); A.send({t:'accept',from:m.from}); }
  if (who==='A' && m.t==='party' && m.members && m.members.length===2 && !router.partyOK){
    router.partyOK=true; note('組隊成功，成員 2 人，隊長='+m.leader);
    // 測決鬥：A 挑戰 B
    A.send({t:'duel_req',to:idB});
  }
  if (who==='B' && m.t==='duel_req'){ note('B 收到決鬥挑戰'); B.send({t:'duel_acc',to:m.from}); }
  if (who==='A' && m.t==='duel_go'){ note('A 收到 duel_go（含對手快照 lv='+m.oppSnap.lv+'）'); A.send({t:'duel_result',to:m.oppId,lines:['測試戰報'],winner:'甲'}); }
  if (who==='B' && m.t==='duel_result'){ note('B 收到決鬥戰報，勝者='+m.winner); duelDone=true;
    // 測隊伍狩獵轉發：隊長是 B（B 先邀請 → partyId = B）
    B.send({t:'hunt_log',lines:['狩獵測試行']});
    B.send({t:'hunt_result',reward:{[idA]:{exp:10,gold:5,drop:null,hpLeft:20},[idB]:{exp:10,gold:5,drop:null,hpLeft:30}}});
  }
  if (who==='A' && m.t==='hunt_result'){ note('A 收到隊伍狩獵獎勵 exp='+m.reward[idA].exp); huntDone=true; finish(); }
}
function finish(){
  if (duelDone && huntDone){
    console.log('全部通過：密語/聊天/組隊/決鬥/狩獵轉發 ✓');
    process.exit(0);
  }
}
// 錯誤密語測試
const X = wsClient('X', (w,m)=>{ if(m.t==='deny') note('錯誤密語被正確拒絕'); });
X.send && setTimeout(()=>X.send({t:'hello',name:'壞人',code:'wrong',snap:{lv:1,race:'human'}}),300);

setTimeout(()=>{
  A = wsClient('A', router);
  B = wsClient('B', router);
  setTimeout(()=>{
    A.send({t:'hello',name:'甲',code:'mellon',snap:{lv:5,race:'human',hp:50,maxHp:50,atk:20,def:5,dex:8,crit:7,eva:9}});
    B.send({t:'hello',name:'乙',code:'mellon',snap:{lv:6,race:'elf',hp:45,maxHp:45,atk:22,def:4,dex:12,crit:9,eva:11}});
    setTimeout(()=>{ A.send({t:'chat',msg:'哈囉中土'}); }, 400);
  },300);
},700);
setTimeout(()=>{ console.log('逾時：未完成全部流程'); process.exit(1); }, 8000);
