/* ═══════════════════════════════════════════════════════════
   魔戒文字版 · 連線伺服器（零相依，Node.js 內建模組即可執行）
   功能：受限定連線（通關密語）／聊天／組隊／隊伍狩獵轉發／PvP 決鬥轉發
   執行：node server.js [埠號] [通關密語]
   預設：埠 2941、密語 mellon（精靈語「朋友」）
   ═══════════════════════════════════════════════════════════ */
'use strict';
const http = require('http');
const crypto = require('crypto');

/* 埠號優先序：命令列參數 > PORT 環境變數（雲端平台如 Render 會指定）> 2941 */
const PORT = parseInt(process.argv[2], 10) || parseInt(process.env.PORT, 10) || 2941;
const CODE = process.argv[3] || process.env.CODE || 'mellon';
const MAX_PLAYERS = 20;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

let nextId = 1;
const clients = new Map();   // id -> {sock, name, snap, room, ready}
const parties = new Map();   // partyId -> Set(memberIds)，partyId = 隊長 id

/* ── 房間（大廳＝room null；房間限同房聊天/組隊/決鬥，空房自動消失）── */
let nextRoomId = 1;
const rooms = new Map();     // rid -> {name, pass, members:Set}
const MAX_ROOMS = 8;

/* ── WebSocket 訊框編碼（伺服器→客戶端，不加遮罩） ── */
function encodeFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}
function send(c, obj) {
  try { c.sock.write(encodeFrame(JSON.stringify(obj))); } catch (e) {}
}
function broadcast(obj, exceptId) {
  for (const [id, c] of clients) if (c.ready && id !== exceptId) send(c, obj);
}
function partyOf(id) {
  for (const [pid, set] of parties) if (set.has(id)) return pid;
  return null;
}
function partyBroadcast(pid, obj) {
  const set = parties.get(pid);
  if (!set) return;
  for (const mid of set) { const c = clients.get(mid); if (c) send(c, obj); }
}
function partyUpdate(pid) {
  const set = parties.get(pid);
  if (!set) return;
  const members = [...set].map(mid => {
    const c = clients.get(mid);
    return { id: mid, name: c.name, lv: c.snap.lv, race: c.snap.race, snap: c.snap };
  });
  partyBroadcast(pid, { t: 'party', leader: pid, members });
}
function leaveParty(id, silent) {
  const pid = partyOf(id);
  if (!pid) return;
  const set = parties.get(pid);
  set.delete(id);
  const me = clients.get(id);
  if (me && !silent) send(me, { t: 'party', leader: '', members: [] });
  if (set.size < 2 || pid === id) {
    // 隊長離開或隊伍只剩一人 → 解散
    for (const mid of set) { const c = clients.get(mid); if (c) send(c, { t: 'party', leader: '', members: [] }); }
    parties.delete(pid);
  } else {
    partyUpdate(pid);
  }
}
function playerList(room) {
  return [...clients.entries()].filter(([, c]) => c.ready && c.room === room)
    .map(([id, c]) => ({ id, name: c.name, lv: c.snap.lv, race: c.snap.race }));
}
function areaBroadcast(room, obj, exceptId) {
  for (const [id, c] of clients) if (c.ready && c.room === room && id !== exceptId) send(c, obj);
}
function roomList() {
  return [...rooms.entries()].map(([id, r]) => ({ id, name: r.name, n: r.members.size, lock: !!r.pass }));
}
function pushRooms() { broadcast({ t: 'rooms', list: roomList() }); }
function sysMsg(me, msg) { send(me, { t: 'chat', from: 'sys', name: '系統', msg }); }
/* 玩家移動到房間（room=null 即回大廳）：先退隊，兩邊區域各自更新名單 */
function moveRoom(id, room) {
  const me = clients.get(id);
  if (!me || me.room === room) return;
  leaveParty(id, false);
  const old = me.room;
  if (old !== null) {
    const r = rooms.get(old);
    if (r) { r.members.delete(id); if (r.members.size === 0) rooms.delete(old); }
  }
  me.room = room;
  if (room !== null) rooms.get(room).members.add(id);
  areaBroadcast(old, { t: 'quit', id, name: me.name });
  areaBroadcast(old, { t: 'plist', players: playerList(old) });
  areaBroadcast(room, { t: 'join', p: { id, name: me.name, lv: me.snap.lv, race: me.snap.race } }, id);
  send(me, { t: 'room_you', id: room, name: room !== null ? rooms.get(room).name : null });
  areaBroadcast(room, { t: 'plist', players: playerList(room) });
  pushRooms();
}

/* ── 訊息處理 ── */
function handle(id, msg) {
  const me = clients.get(id);
  if (!me) return;

  me.lastSeen = Date.now();
  if (!me.ready) {                       // 第一則訊息必須是 hello + 正確密語
    if (msg.t !== 'hello' || String(msg.code) !== CODE) {
      send(me, { t: 'deny', reason: '通關密語錯誤。提示：說「朋友」，進來吧。' });
      me.sock.end(); return;
    }
    if (clients.size > MAX_PLAYERS) {
      send(me, { t: 'deny', reason: '大廳已滿。' });
      me.sock.end(); return;
    }
    me.ready = true;
    me.name = String(msg.name || '無名旅人').slice(0, 12);
    me.snap = cleanSnap(msg.snap);
    me.room = null;                      // 進場先在大廳
    send(me, { t: 'welcome', id, players: playerList(null), rooms: roomList() });
    areaBroadcast(null, { t: 'join', p: { id, name: me.name, lv: me.snap.lv, race: me.snap.race } }, id);
    console.log(`[+] ${me.name} 上線（目前 ${clients.size} 人）`);
    return;
  }

  switch (msg.t) {
    case 'ping':                         // 心跳：維持連線不被雲端代理視為閒置切斷
      send(me, { t: 'pong' });
      break;
    case 'snap':
      me.snap = cleanSnap(msg.snap, me.snap);
      areaBroadcast(me.room, { t: 'plist', players: playerList(me.room) });
      { const pid = partyOf(id); if (pid) partyUpdate(pid); }
      break;
    case 'chat': {
      const text = String(msg.msg || '').slice(0, 120);
      if (text) areaBroadcast(me.room, { t: 'chat', from: id, name: me.name, msg: text });
      break;
    }
    case 'room_create': {
      const name = String(msg.name || '').trim().slice(0, 16);
      if (!name) { sysMsg(me, '房間名稱不可為空。'); break; }
      if (rooms.size >= MAX_ROOMS) { sysMsg(me, `房間數已達上限（${MAX_ROOMS} 間）。`); break; }
      const rid = 'r' + (nextRoomId++);
      rooms.set(rid, { name, pass: String(msg.pass || '').slice(0, 16), members: new Set() });
      moveRoom(id, rid);
      break;
    }
    case 'room_join': {
      const r = rooms.get(msg.id);
      if (!r) { sysMsg(me, '該房間已不存在。'); pushRooms(); break; }
      if (r.pass && String(msg.pass || '') !== r.pass) { sysMsg(me, '房間密碼錯誤。'); break; }
      moveRoom(id, msg.id);
      break;
    }
    case 'room_leave':
      if (me.room !== null) moveRoom(id, null);
      break;
    case 'invite': {
      const tgt = clients.get(msg.to);
      if (tgt && tgt.room === me.room) { invites.set(msg.to + '<-' + id, Date.now()); send(tgt, { t: 'invite', from: id, name: me.name }); }
      break;
    }
    case 'accept': {                     // 受邀者同意加入邀請者的隊伍（必須真的被邀請過）
      const inviter = clients.get(msg.from);
      if (!inviter || inviter.room !== me.room) break;
      if (!invites.delete(id + '<-' + msg.from)) break;   // 沒被邀請不能硬擠進隊伍
      let pid = partyOf(msg.from);
      if (!pid) { pid = msg.from; parties.set(pid, new Set([msg.from])); }
      const set = parties.get(pid);
      if (set.size >= 4) { send(me, { t: 'chat', from: 'sys', name: '系統', msg: '該遠征隊已滿（上限 4 人）。' }); break; }
      leaveParty(id, true);              // 先離開原隊伍
      set.add(id);
      partyUpdate(pid);
      break;
    }
    case 'party_leave':
      leaveParty(id, false);
      break;
    case 'duel_req': {
      const tgt = clients.get(msg.to);
      if (tgt && tgt.room === me.room) send(tgt, { t: 'duel_req', from: id, name: me.name });
      break;
    }
    case 'duel_acc': {                   // 應戰者同意 → 通知挑戰者開始模擬
      const challenger = clients.get(msg.to);
      if (challenger && challenger.room === me.room) send(challenger, { t: 'duel_go', oppId: id, oppName: me.name, oppSnap: me.snap });
      break;
    }
    case 'duel_result': {
      const tgt = clients.get(msg.to);
      if (tgt && tgt.room === me.room) send(tgt, { t: 'duel_result', lines: cleanLines(msg.lines), winner: String(msg.winner || '').slice(0, 20) });
      break;
    }
    case 'hunt_log': {
      const pid = partyOf(id);
      if (pid === id) partyBroadcast(pid, { t: 'hunt_log', lines: cleanLines(msg.lines) });
      break;
    }
    case 'hunt_result': {
      const pid = partyOf(id);
      if (pid === id) partyBroadcast(pid, { t: 'hunt_result', reward: msg.reward });
      break;
    }
  }
}

/* 快照欄位白名單：只收數字與已知字串，其他一律丟棄（防注入與超長字串） */
function cleanSnap(s, prev) {
  if (!s || typeof s !== 'object') return prev || { lv: 1, race: 'human' };
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? Math.floor(v) : d;
  return {
    name: String(s.name || '').slice(0, 12),
    lv: num(s.lv, 1), hp: num(s.hp, 1), maxHp: num(s.maxHp, 1),
    atk: num(s.atk, 1), def: num(s.def, 0), dex: num(s.dex, 5),
    crit: num(s.crit, 5), eva: num(s.eva, 5),
    aspd: (typeof s.aspd === 'number' && isFinite(s.aspd)) ? s.aspd : 1.2,
    race: ['human', 'elf', 'dwarf', 'hobbit'].includes(s.race) ? s.race : 'human',
  };
}
/* 戰報行清理：最多 200 行、每行 400 字（實際 HTML 淨化在客戶端 sanLine） */
function cleanLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.slice(0, 200).map(l => String(l).slice(0, 400));
}
const invites = new Map();               // 'to<-from' → 時間戳
/* 殭屍連線清掃：交握後 10 秒內沒完成 hello、或 75 秒無任何訊框（客戶端每 25 秒心跳）→ 踢除 */
setInterval(() => {
  const now = Date.now();
  for (const [cid, c] of clients) {
    if (!c.ready && now - (c.bornAt || 0) > 10000) { try { c.sock.end(); } catch (e) {} clients.delete(cid); }
    else if (c.ready && now - (c.lastSeen || 0) > 75000) { try { c.sock.end(); } catch (e) {} }
  }
  for (const [k, t] of invites) if (now - t > 120000) invites.delete(k);
}, 10000);

/* ── HTTP + WebSocket 交握 ── */
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('魔戒文字版連線伺服器運作中。請用遊戲內「連線」分頁加入。');
});

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.end(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  sock.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);

  const id = 'p' + (nextId++);
  const me = { sock, name: '', snap: { lv: 1, race: 'human' }, ready: false, bornAt: Date.now(), lastSeen: Date.now() };
  clients.set(id, me);
  let buf = Buffer.alloc(0);

  sock.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    // 逐一解析訊框（客戶端→伺服器必有遮罩）
    while (buf.length >= 2) {
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; const big = buf.readBigUInt64BE(2); if (big > 1000000n) { sock.end(); return; } len = Number(big); off = 10; }
      const maskLen = masked ? 4 : 0;
      if (buf.length < off + maskLen + len) return;      // 資料未到齊
      const mask = masked ? buf.slice(off, off + 4) : null;
      let payload = buf.slice(off + maskLen, off + maskLen + len);
      if (mask) { payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]; }
      buf = buf.slice(off + maskLen + len);

      if (opcode === 8) { sock.end(); return; }           // close
      if (opcode === 9) { const pong = Buffer.concat([Buffer.from([0x8a, payload.length]), payload]); sock.write(pong); continue; }
      if (opcode === 1) {
        try { handle(id, JSON.parse(payload.toString('utf8'))); } catch (e) {}
      }
    }
  });

  const bye = () => {
    if (!clients.has(id)) return;
    const name = me.name, room = me.room;
    leaveParty(id, true);
    if (room !== undefined && room !== null) {
      const r = rooms.get(room);
      if (r) { r.members.delete(id); if (r.members.size === 0) rooms.delete(room); }
    }
    clients.delete(id);
    if (me.ready) {
      areaBroadcast(room, { t: 'quit', id, name });
      areaBroadcast(room, { t: 'plist', players: playerList(room) });
      pushRooms();
      console.log(`[-] ${name} 離線（目前 ${clients.size} 人）`);
    }
  };
  sock.on('close', bye);
  sock.on('error', bye);
});

server.listen(PORT, () => {
  console.log('══════════════════════════════════════════');
  console.log('  魔戒文字版 · 連線伺服器已啟動');
  console.log(`  埠號　　：${PORT}`);
  console.log(`  通關密語：${CODE}`);
  console.log('  同一台電腦連線位址：ws://localhost:' + PORT);
  console.log('  區域網路請改用本機 IP，例如 ws://192.168.x.x:' + PORT);
  console.log('  （關閉此視窗即關閉伺服器）');
  console.log('══════════════════════════════════════════');
});
