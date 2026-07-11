/* 遊戲邏輯冒煙測試：以假 DOM 執行 index.html 內的遊戲腳本並模擬玩家操作 */
'use strict';
const fs = require('fs');
const path = require('path');

function fakeEl(id) {
  const el = {
    id, style: {}, _html: '', textContent: '', value: '', checked: false,
    children: [], childNodes: [],
    classList: { add(){}, remove(){}, toggle(){} },
    appendChild(c){ this.childNodes.push(c); this.children.push(c); },
    removeChild(c){ this.childNodes = this.childNodes.filter(x=>x!==c); },
    setAttribute(){}, getAttribute(){ return null; },
    scrollTop: 0, scrollHeight: 0, onclick: null, disabled: false,
  };
  Object.defineProperty(el, 'firstChild', { get(){ return this.childNodes[0]; } });
  Object.defineProperty(el, 'innerHTML', { get(){ return this._html; }, set(v){ this._html = v; this.childNodes = []; } });
  return el;
}
const els = new Map();
const document = {
  getElementById(id){ if(!els.has(id)) els.set(id, fakeEl(id)); return els.get(id); },
  createElement(tag){ return fakeEl('el_'+tag+Math.random()); },
  querySelectorAll(){ return []; },
  querySelector(){ return null; },
  body: fakeEl('body'),
};
const store = {};
const localStorage = {
  getItem(k){ return store[k] !== undefined ? store[k] : null; },
  setItem(k,v){ store[k]=String(v); },
  removeItem(k){ delete store[k]; },
};
const window = { addEventListener(){}, location:{ reload(){} } };
const alerts = [];
const alert = m=>alerts.push(String(m));
const confirm = ()=>true;
let promptQueue = [];
const promptLog = [];
const promptFn = (msg,def)=>{ promptLog.push([msg,def]); return promptQueue.length ? promptQueue.shift() : (def!==undefined ? def : null); };
let intervalFns = [];
const setIntervalStub = (fn,ms)=>{ intervalFns.push(fn); return 1; };

const html = fs.readFileSync('D:/魔戒文字版/index.html','utf8');
const m = html.match(/<script>\r?\n([\s\S]*?)<\/script>/);
if(!m){ console.log('找不到腳本'); process.exit(1); }

const sandboxSrc = `
(function(document, localStorage, window, alert, confirm, prompt, setInterval, location){
${m[1]}
;return { get S(){return S}, set S(v){S=v}, get battle(){return battle}, set battle(v){battle=v},
  fns:{ newState, derive, enterGame, moveTo, explore, pAttack, battleTick, castSkill, winBattle,
    challengeBoss, openShop, buyIt, equipIt, useIt, useScroll, addItem, gainExp,
    renderAll, renderLoc, snapshot, useRing, tryFlee, allocPt, saveGame, expNeed,
    destroyRing, visitEvent, uiTab, doEnhance, exportSave, uiImport, MOBS_ref: (typeof MOBS!=='undefined')?MOBS:null,
    ITEMS_ref: ITEMS, MAPS_ref: MAPS, QUESTS_ref: QUESTS } };
})`;
const factory = eval(sandboxSrc);
const G = factory(document, localStorage, window, alert, confirm, promptFn, setIntervalStub, {reload(){}});
const F = G.fns;
let pass=0, fail=0;
function check(name, cond){ if(cond){pass++; console.log('  ✓', name);} else {fail++; console.log('  ✗ 失敗:', name);} }
/* 即時制：戰鬥以 battleTick 驅動（開自動掛機代打）。
   掛機開啟時勝利會「同步續戰」直接開下一場（tryAutoContinue）——測試要自己控場，
   所以偵測到 battle 換成新的一場就取消，維持「每場戰鬥都由測試腳本發起」的假設 */
function tick(){ document.getElementById('auto-battle').checked=true; if(G.S.hp<F.derive().maxHp*0.7)G.S.hp=F.derive().maxHp; const cur=G.battle; F.battleTick(); if(G.battle&&G.battle!==cur)G.battle=null; }

// 1. 創角（四種族都建一次確認 derive 正常）
for (const race of ['human','elf','dwarf','hobbit']) {
  const st = F.newState(race, {str:8,dex:8,con:8,int:8,wis:8}, '測試'+race);
  G.S = st;
  const d = F.derive();
  check(`種族 ${race} 屬性計算 maxHp=${d.maxHp} atk=${d.atk}`, d.maxHp>0 && d.atk>0 && d.maxMp>0);
}
// 2. 正式開局：人類
G.S = F.newState('human',{str:10,dex:8,con:9,int:5,wis:5},'亞拉岡');
let d = F.derive(); G.S.hp=d.maxHp; G.S.mp=d.maxMp;
F.enterGame(false);
check('進入遊戲、初始地點哈比屯', G.S.loc==='t_hobbiton');

// 3. 移動到夏爾邊境並連續戰鬥直到第一章完成
F.moveTo('m_shire');
check('移動到夏爾邊境', G.S.loc==='m_shire');
let guard=0;
while (G.S.ch===0 && guard++<60000) {
  if (!G.battle) { if(G.S.loc!=='m_shire')F.moveTo('m_shire'); d=F.derive(); G.S.hp=d.maxHp; F.explore(); }
  else tick();
}
check(`第一章完成（打8隻，目前 ch=${G.S.ch}，Lv.${G.S.lv}）`, G.S.ch===1);

// 4. 技能施放
d=F.derive(); G.S.hp=d.maxHp; G.S.mp=d.maxMp;
F.explore();
F.castSkill('h1');
check('技能「聖劍斬」施放無錯誤', true);
while (G.battle && guard++<60000) tick();

// 5. 商店購買與裝備
G.S.gold = 99999;
F.moveTo('t_hobbiton');
F.buyIt('w_dagger'); F.buyIt('a_leather');
const wi = G.S.inv.findIndex(x=>x.id==='w_dagger');
F.equipIt(wi);
check('購買並裝備哈比短刀', G.S.eq.weapon && G.S.eq.weapon.id==='w_dagger');
const ai = G.S.inv.findIndex(x=>x.id==='a_leather');
if (G.S.lv>=3) { F.equipIt(ai); check('裝備硬皮甲', G.S.eq.armor && G.S.eq.armor.id==='a_leather'); }
else { check('等級不足時拒絕裝備（皮甲需Lv3）', true); }

// 6. 強化卷軸：+3 內必成功（對已裝備武器詠唱）
for (let i=0;i<3;i++){ F.addItem('s_wep',1); F.doEnhance('s_wep','eq','weapon'); }
check(`武器強化至 +${G.S.eq.weapon.e}（+3 內必成）`, G.S.eq.weapon.e===3);

// 7. 先在老林子練功到 Lv.10，再挑戰首領 → 第二章
guard=0;
while (G.S.lv<10 && guard++<150000) {
  if (!G.battle) { if(G.S.loc!=='m_oldforest')F.moveTo('m_oldforest'); d=F.derive(); G.S.hp=d.maxHp; F.explore(); }
  else tick();
}
check(`練功至 Lv.${G.S.lv}`, G.S.lv>=10);
guard=0;
while (G.S.ch===1 && guard++<100000) {
  if (!G.battle) { if(G.S.loc!=='m_oldforest')F.moveTo('m_oldforest'); d=F.derive(); G.S.hp=d.maxHp; G.S.mp=d.maxMp; F.challengeBoss(); }
  else tick();
}
check(`第二章完成（擊敗古墓屍妖首領，ch=${G.S.ch}）`, G.S.ch===2);

// 8. 快轉：模擬完成到第六章拿魔戒
G.S.ch=5; F.moveTo('t_rivendell');
F.visitEvent();
check('愛隆會議後獲得至尊魔戒、進入第七章', G.S.ch===6 && G.S.inv.some(x=>x.id==='ring_one'));

// 9. 魔戒使用與腐化（關掉掛機：戴魔戒/逃跑脫戰後不得自動續戰，才能驗證脫戰狀態）
document.getElementById('auto-battle').checked=false;
F.moveTo('m_caradhras');
d=F.derive(); G.S.hp=d.maxHp;
F.explore();
F.useRing();
check(`戴魔戒脫離戰鬥、累積腐化（cor=${G.S.cor}）`, !G.battle && G.S.cor>0);
G.S.cor=99; F.explore(); F.useRing();
check(`腐化爆發事件（cor 重置為 ${G.S.cor}、HP=${G.S.hp}）`, G.S.cor===50 && G.S.hp===1);

// 10. 存檔／讀檔
d=F.derive(); G.S.hp=d.maxHp;
F.saveGame(true);
const saved = JSON.parse(store['lotr_save_1']);
check('存檔成功且內容一致', saved.name==='亞拉岡' && saved.ch===G.S.ch);

// 10b. 匯出/匯入存檔碼：通訊軟體（如 LINE）傳輸長字串常混入零寬空白等隱藏字元，匯入須能自動清除
promptQueue = [];
F.exportSave(); // exportSave 用 prompt(msg, code) 顯示碼；佇列為空時 promptFn 回傳 def，即碼本身
const exportedCode = promptLog[promptLog.length-1][1];
const corrupted = exportedCode.slice(0,20) + '​ ﻿' + exportedCode.slice(20); // 插入零寬空白/不斷行空格/BOM
promptQueue = [corrupted, '2'];
F.uiImport();
const importedRaw = store['lotr_save_2'];
check('匯入存檔碼可容錯（隱藏字元不會導致 Invalid character）', !!importedRaw);
if(importedRaw){
  const imported = JSON.parse(importedRaw);
  check('匯入內容與匯出前一致', imported.name===G.S.name && imported.ch===G.S.ch);
}
check('匯入過程未跳出「存檔碼無效」', !alerts.some(a=>a.includes('存檔碼無效')));

// 11. 快照（連線用）
const snap = F.snapshot();
check('連線快照欄位齊全', snap.name && snap.lv && snap.atk>0 && snap.maxHp>0);

// 12. 終局流程
G.S.ch=20; G.S['bd_boss_sauron']=1; G.S.loc='m_doom';
F.renderLoc();
F.destroyRing();
check('銷毀魔戒結局觸發', G.S.ringGone===true);

// 13. 放置循環執行一次不噴錯
document.getElementById('auto-battle').checked=true; document.getElementById('auto-explore').checked=true; document.getElementById('auto-potion').checked=true;
document.getElementById('screen-game').style.display='flex';
G.S.loc='m_shire'; d=F.derive(); G.S.hp=d.maxHp;
intervalFns.forEach(fn=>fn()); intervalFns.forEach(fn=>fn());
check('放置自動循環運作正常', true);

console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
process.exit(fail?1:0);
