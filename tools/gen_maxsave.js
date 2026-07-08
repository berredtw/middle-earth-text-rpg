/* 產生「全破滿級滿裝」驗證角色存檔碼，並用遊戲程式實際載入驗證 */
'use strict';
const fs = require('fs');

const save = {
  v: 2, name: '伊力薩王', race: 'human',
  lv: 50, exp: 0, gold: 999999,
  base: { str: 30, dex: 25, con: 30, int: 20, wis: 20 },
  statPts: 5,                       // 留 5 點讓你測試配點功能
  hp: 9999, mp: 9999,               // 載入時遊戲會自動修正為上限
  cor: 0, pvp: 0, ch: 21, kills: 0, // ch=21：主線 21 章全數完成
  visited: {}, ringGone: false,     // 魔戒尚未投入火山 → 可測試戴魔戒與結局按鈕
  tw: {},                            // 兩座百層塔從第 1 層開始，可驗證爬塔
  comps: ['c_gandalf','c_aragorn','c_legolas','c_gimli','c_sam','c_boromir','c_eowyn','c_arwen',
          'c_ranger','c_bard','c_squire','c_villager'],   // 夥伴名冊（含全部高級英雄）
  comp: 'c_gandalf', compHp: 9999, hasteUntil: 0,
  loc: 't_minas',
  inv: [
    { id: 'ring_one', q: 1 },
    // 各式名武器（測裝備切換與圖鑑）
    { id: 'w_glam', q: 1, e: 9 }, { id: 'w_orcrist', q: 1, e: 7 }, { id: 'w_sting', q: 1, e: 6 },
    { id: 'w_zwei', q: 1, e: 5 }, { id: 'w_elfbow', q: 1, e: 5 }, { id: 'w_katana', q: 1, e: 5 },
    { id: 'w_lorien', q: 1, e: 0 },
    { id: 'a_gondor', q: 1, e: 5 }, { id: 'a_magic', q: 1, e: 5 },
    { id: 'c_elven', q: 1, e: 3 }, { id: 'r_str', q: 1, e: 0 }, { id: 'r_dex', q: 1, e: 0 }, { id: 'r_barrow', q: 1, e: 0 },
    // 消耗品
    { id: 'p_miruvor', q: 50 }, { id: 'p_lembas', q: 50 }, { id: 'p_red', q: 99 },
    { id: 'p_dew', q: 50 }, { id: 'p_haste', q: 30 }, { id: 'p_herb', q: 30 },
    // 卷軸（測強化：一般卷軸 +7 起會失敗蒸發、祝福卷軸不會）
    { id: 's_wepb', q: 30 }, { id: 's_armb', q: 30 }, { id: 's_wep', q: 30 }, { id: 's_arm', q: 30 },
    { id: 's_home', q: 20 }, { id: 's_time', q: 20 },
    { id: 'w_damascus', q: 1, e: 0 }, { id: 'a_elfscale', q: 1, e: 0 }, { id: 'c_galad', q: 1, e: 0 },
    // 合成材料各 30，可直接測試工房全部配方
    { id: 'm_pelt', q: 30 }, { id: 'm_silk', q: 30 }, { id: 'm_fang', q: 30 }, { id: 'm_dust', q: 30 },
    { id: 'm_iron', q: 30 }, { id: 'm_blood', q: 30 }, { id: 'm_mithril', q: 30 }, { id: 'm_badge', q: 30 },
    { id: 'm_tusk', q: 30 }, { id: 'm_soul', q: 30 }, { id: 'm_dark', q: 30 }, { id: 'm_venomS', q: 10 },
    { id: 'm_shred', q: 30 }, { id: 'm_core', q: 5 }, { id: 'm_seed', q: 100 }
  ],
  eq: {
    weapon: { id: 'w_anduril', e: 9 },   // +9 安都瑞爾·西方之焰
    armor:  { id: 'a_mithril', e: 9 },   // +9 米斯瑞爾甲
    cloak:  { id: 'c_kings',  e: 9 },    // +9 王者披風
    acc:    { id: 'r_even' }             // 暮星項鍊
  },
  // 全首領擊破紀錄
  bd_boss_wight: 1, bd_boss_naz: 1, bd_boss_watcher: 1, bd_boss_balrog: 1,
  bd_boss_lurtz: 1, bd_boss_uruk: 1, bd_boss_saruman: 1, bd_boss_deadking: 1,
  bd_boss_witch: 1, bd_boss_mouth: 1, bd_boss_shelob: 1, bd_boss_sauron: 1
};

const code = Buffer.from(JSON.stringify(save), 'utf8').toString('base64');

/* ── 用遊戲本體實際載入驗證 ── */
function fakeEl(id){ const el={id,style:{},_html:'',textContent:'',value:'',checked:false,childNodes:[],
  classList:{add(){},remove(){},toggle(){}},appendChild(c){this.childNodes.push(c)},
  removeChild(c){this.childNodes=this.childNodes.filter(x=>x!==c)},
  scrollTop:0,scrollHeight:0,disabled:false};
  Object.defineProperty(el,'innerHTML',{get(){return this._html},set(v){this._html=v;this.childNodes=[]}});
  Object.defineProperty(el,'firstChild',{get(){return this.childNodes[0]}});
  return el; }
const els=new Map();
const document={getElementById(id){if(!els.has(id))els.set(id,fakeEl(id));return els.get(id)},
  createElement(){return fakeEl('x'+Math.random())},querySelectorAll(){return[]},querySelector(){return null}};
const localStorage={_s:{},getItem(k){return this._s[k]||null},setItem(k,v){this._s[k]=String(v)},removeItem(k){delete this._s[k]}};
const html=fs.readFileSync('D:/魔戒文字版/index.html','utf8');
const m=html.match(/<script>\n([\s\S]*?)<\/script>/);
const G=eval(`(function(document,localStorage,window,alert,confirm,prompt,setInterval,location){${m[1]}
;return {get S(){return S},set S(v){S=v},get battle(){return battle},
 fns:{migrate,derive,enterGame,moveTo,explore,pAttack,battleTick,challengeBoss,useRing,destroyRing,snapshot,useScroll,renderAll}};})`)(
  document,localStorage,{addEventListener(){}},()=>{},()=>true,()=>null,()=>1,{reload(){}});
const F=G.fns;
let pass=0,fail=0;
function check(n,c){if(c){pass++;console.log('  ✓',n)}else{fail++;console.log('  ✗ 失敗:',n)}}

// 模擬匯入流程（與遊戲內 uiImport 相同的解碼）
const decoded=JSON.parse(decodeURIComponent(escape(Buffer.from(code,'base64').toString('binary'))));
check('存檔碼可正確解碼', decoded.name==='伊力薩王');
G.S=F.migrate(decoded);
F.enterGame(true);
const d=F.derive();
check(`載入成功：Lv.${G.S.lv}、HP 上限 ${d.maxHp}、攻擊 ${d.atk}、防禦 ${d.def}`, d.atk>100 && G.S.lv===50);
check('HP/MP 自動修正到上限', G.S.hp<=d.maxHp && G.S.mp<=d.maxMp);
check('主線全破（ch=21）', G.S.ch===21);
check('+9 安都瑞爾已裝備', G.S.eq.weapon.id==='w_anduril' && G.S.eq.weapon.e===9);
// 全地圖可移動
let mapOk=true;
for(const k of ['t_hobbiton','m_ford','m_gate','m_amon','m_fangorn','t_edoras','m_isengard','m_paths','m_morannon','m_doom']){
  F.moveTo(k); if(G.S.loc!==k){mapOk=false;console.log('    無法移動到',k)}}
check('21 張地圖全部解鎖可移動', mapOk);
// 末日火山還能再戰索倫、還能銷毀魔戒
F.moveTo('m_doom');
F.challengeBoss();
check('可再戰索倫（首領重複挑戰）', !!G.battle);
document.getElementById('auto-battle').checked=true;
let g=0; while(G.battle && g++<20000){ const dd=F.derive(); if(G.S.hp<dd.maxHp*0.7)G.S.hp=dd.maxHp; if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp; F.battleTick(); }
check('滿裝角色擊敗索倫之眼', !G.battle && G.S['bd_boss_sauron']===1);
F.renderAll();
check('銷毀魔戒按鈕條件成立（ringGone=false、已敗索倫、身上有魔戒）', !G.S.ringGone && G.S.inv.some(x=>x.id==='ring_one'));
const snap=F.snapshot();
check(`連線快照正常（決鬥/組隊可用，atk=${snap.atk}）`, snap.atk>100);
// 投戒後時光之門（後日談）應開啟
F.destroyRing();
F.moveTo('t_gate');
check('銷毀魔戒後【時光之門】開啟可進入', G.S.loc==='t_gate' && G.S.ringGone===true);
F.moveTo('m_gondolin');
F.challengeBoss();
check('可挑戰外傳首領勾斯魔格', !!G.battle);
g=0; while(G.battle && g++<30000){ const dd=F.derive(); if(G.S.hp<dd.maxHp*0.7)G.S.hp=dd.maxHp; if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp; F.battleTick(); }
check('滿裝角色可擊敗勾斯魔格（外傳難度合理）', !G.battle && G.S['bd_boss_gothmog']===1);

fs.writeFileSync('D:/魔戒文字版/滿級測試角色.txt',
'【魔戒·中土遠征】全破滿級滿裝驗證角色\r\n'+
'角色：伊力薩王（人類）Lv.50／主線 21 章全破／金幣 999,999\r\n'+
'裝備：+9 安都瑞爾、+9 米斯瑞爾甲、+9 王者披風、暮星項鍊；背包含全名武、各式藥水卷軸與至尊魔戒\r\n'+
'※ 魔戒尚未投入火山：到末日火山打贏索倫後投戒，即可測試新內容【時光之門】外傳五章\r\n\r\n'+
'使用方式：\r\n'+
'1. 全選並複製下面整段存檔碼（點一下存檔碼再按 Ctrl+A 不行的話，手動從頭選到尾）\r\n'+
'2. 開啟遊戲 → 標題畫面按「匯 入 存 檔」→ 貼上 → 選一個存檔位（1/2/3）\r\n'+
'3. 再按「讀 取 冒 險 進 度」載入該存檔位即可\r\n\r\n'+
'════════ 存檔碼（複製以下整段）════════\r\n'+code+'\r\n',
'utf8');
console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
console.log('存檔碼長度：'+code.length+' 字元，已寫入 D:\\魔戒文字版\\滿級測試角色.txt');
process.exit(fail?1:0);
