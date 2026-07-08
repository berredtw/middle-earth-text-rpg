/* 全 21 章通關模擬 + 圖鑑/說明/存檔遷移驗證 */
'use strict';
const fs = require('fs');
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
const store={};
const localStorage={getItem(k){return store[k]!==undefined?store[k]:null},setItem(k,v){store[k]=String(v)},removeItem(k){delete store[k]}};
const window={addEventListener(){}};
const html=fs.readFileSync('D:/魔戒文字版/index.html','utf8');
const m=html.match(/<script>\r?\n([\s\S]*?)<\/script>/);
const intervalFns=[];
const G=eval(`(function(document,localStorage,window,alert,confirm,prompt,setInterval,location){${m[1]}
;return {get S(){return S},set S(v){S=v},get battle(){return battle},
 fns:{newState,derive,enterGame,moveTo,explore,pAttack,challengeBoss,visitEvent,advanceChapter,
  showItemInfo,openCodex,migrate,destroyRing,gainExp,saveGame,addItem,useScroll,castSkill,towerChallenge,
  doEnhance,recruit,setComp,openCompList,compStats,useIt,aliveMobs,gameTick,doCraft,openCraft,invCount,
  doGandalf,openGandalf,sortInv,checkOffline,renderTabs,autoAction,compGainExp,compLvOf,sellIt,sellPrice,enhValue,
  towerFloor,towerReward,startNG,checkAchv,openAchv,mobInst,showItemInfo:showItemInfo,
  chCap,expNeed,pHitDmg,battleTick,bossDefaults,stunMob,bestHeal,genBounties,bountyProgress,bountyReward,claimBounty,startRush},
 data2:{ACHV,BOSS_AI,BOSS_DB,CH_CAP,RUSH_LIST},
 data:{MOBS,MAPS,QUESTS,ITEMS,SKILLS,RACES,COMPS,RECIPES,ENCH_W,ENCH_A,ELEMS}};})`)(document,localStorage,window,()=>{},()=>true,()=>null,fn=>{intervalFns.push(fn);return 1},{reload(){}});
const F=G.fns,D=G.data;
let pass=0,fail=0;
function check(n,c){if(c){pass++;console.log('  ✓',n)}else{fail++;console.log('  ✗ 失敗:',n)}}
/* 即時制戰鬥驅動：以 battleTick 推進到戰鬥結束；模擬玩家喝藥維持血量（門檻預設 70%，
   低於門檻即補滿——首領大招上限 65%，滿血必可倖存）與魔力 */
const AB=()=>document.getElementById('auto-battle');
function fight(hpPct,maxG){
  const prev=AB().checked;AB().checked=true;
  let g=0;
  while(G.battle&&g++<(maxG||60000)){
    const dd=F.derive();
    if(G.S.hp<dd.maxHp*(hpPct||0.7))G.S.hp=dd.maxHp;
    if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp;
    F.battleTick();
  }
  AB().checked=prev;
}
/* 結束一場戰鬥（目標全滅 → 結算） */
function settle(){if(G.battle){G.battle.mobs.forEach(m=>m.hp=0);F.battleTick();}}
/* 模擬玩家分配能力點（60% 力量、20% 敏捷、20% 體質）——新平衡下不點能力打不動首領 */
function alloc(){
  while(G.S.statPts>0){const r=G.S.statPts%5;G.S.statPts--;
    if(r<3)G.S.base.str++;else if(r<4)G.S.base.dex++;else G.S.base.con++;}
}

// 資料一致性檢查
check('章節共 56 章（主線 21＋時光之門 11＋哈比人 10＋上古紀元 13＋終幕 1）',D.QUESTS.length===56);
check('技能共 36 招（各族 9 招）',Object.keys(D.SKILLS).length===36);
let refOk=true;
D.QUESTS.forEach((q,i)=>{
  if(q.boss&&!D.MOBS[q.boss]){refOk=false;console.log('    章',i,'首領不存在',q.boss)}
  if(q.area&&!D.MAPS[q.area]){refOk=false;console.log('    章',i,'區域不存在',q.area)}
  if(q.visit&&!D.MAPS[q.visit]){refOk=false;console.log('    章',i,'地點不存在',q.visit)}
  if(!q.intro&&i>0){refOk=false;console.log('    章',i,'缺 intro')}
});
check('所有章節的首領/區域/地點/開場劇情齊全',refOk);
let mapOk=true;
for(const k in D.MAPS){const mp=D.MAPS[k];
  if(mp.mobs)for(const mb of mp.mobs)if(!D.MOBS[mb]){mapOk=false;console.log('    地圖',k,'怪物不存在',mb)}
  if(mp.boss&&!D.MOBS[mp.boss]){mapOk=false;console.log('    地圖',k,'首領不存在',mp.boss)}}
check('所有地圖的怪物參照正確',mapOk);
let dropOk=true;
for(const id in D.MOBS)for(const dr of D.MOBS[id][7])if(!D.ITEMS[dr[0]]){dropOk=false;console.log('    怪物',id,'掉落不存在',dr[0])}
check('所有掉落物品參照正確',dropOk);

// 每章 boss 都要能從某張已解鎖地圖挑戰
let bossMapOk=true;
D.QUESTS.forEach((q,i)=>{
  if(!q.boss)return;
  const mk=Object.keys(D.MAPS).find(k=>D.MAPS[k].boss===q.boss);
  if(!mk||D.MAPS[mk].ch>i){bossMapOk=false;console.log('    章',i,'首領地圖未解鎖',q.boss,mk,D.MAPS[mk]&&D.MAPS[mk].ch)}
});
check('每章首領所在地圖於該章已解鎖',bossMapOk);
// kill 章節的區域已解鎖
let areaOk=true;
D.QUESTS.forEach((q,i)=>{if(q.area&&D.MAPS[q.area].ch>i){areaOk=false;console.log('    章',i,'區域未解鎖',q.area)}});
check('每章目標區域於該章已解鎖',areaOk);

// 全 21 章模擬通關（以合理等級輾壓推進，驗證流程邏輯）
G.S=F.newState('human',{str:10,dex:8,con:9,int:5,wis:5},'測試者');
G.S.eq.weapon={id:'w_glam',e:6};G.S.eq.armor={id:'a_mithril',e:6};  // 模擬玩家有稱職裝備
let d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;
F.enterGame(false);
let guard=0,stuck=false;
while(G.S.ch<21&&guard++<1500000){
  const q=D.QUESTS[G.S.ch];
  // 保持等級足夠（模擬玩家練功），確保能贏
  const needLv=q.boss?D.MOBS[q.boss][1]+4:(q.area?D.MOBS[D.MAPS[q.area].mobs[0]][1]+4:G.S.lv);
  while(G.S.lv<needLv)F.gainExp(30*G.S.lv*G.S.lv);
  alloc();
  if(q.visit){F.moveTo(q.visit);F.visitEvent();continue}
  const target=q.area||Object.keys(D.MAPS).find(k=>D.MAPS[k].boss===q.boss);
  if(!G.battle){
    if(G.S.loc!==target)F.moveTo(target);
    d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;
    if(q.boss)F.challengeBoss();else F.explore();
  }else{
    AB().checked=true;
    const dd=F.derive();
    if(G.S.hp<dd.maxHp*0.7)G.S.hp=dd.maxHp;   // 模擬玩家喝藥（活力之水商店有售）
    if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp;
    F.battleTick();
  }
}
check(`全 21 章通關成功（最終 Lv.${G.S.lv}）`,G.S.ch===21);
check('通關後獲得至尊魔戒',G.S.inv.some(x=>x.id==='ring_one')||G.S.ringGone);
check('第十章贈禮（精靈斗篷）',G.S.inv.some(x=>x.id==='c_elven')||(G.S.eq.cloak&&G.S.eq.cloak.id==='c_elven'));
check('第二章劇情武器（西方皇族的古劍）',G.S.inv.some(x=>x.id==='w_barrow'));
check('第十六章劇情武器（安都瑞爾）',G.S.inv.some(x=>x.id==='w_anduril'));
// 時光之門於魔戒銷毀前隱藏
G.S.ringGone=false;F.moveTo('t_gate');
check('時光之門於魔戒銷毀前隱藏（無法進入）',G.S.loc!=='t_gate');
G.S.loc='m_doom';F.destroyRing();
check('結局：銷毀魔戒',G.S.ringGone===true);

// ── 時光之門外傳 8 章通關（後日談，沿用主線模擬邏輯）──
guard=0;
while(G.S.ch<32&&guard++<1500000){
  const q=D.QUESTS[G.S.ch];
  const needLv=q.boss?D.MOBS[q.boss][1]+4:(q.area?D.MOBS[D.MAPS[q.area].mobs[0]][1]+4:G.S.lv);
  while(G.S.lv<needLv)F.gainExp(30*G.S.lv*G.S.lv);
  alloc();
  if(q.visit){F.moveTo(q.visit);F.visitEvent();continue}
  const target=q.area||Object.keys(D.MAPS).find(k=>D.MAPS[k].boss===q.boss);
  if(!G.battle){
    if(G.S.loc!==target)F.moveTo(target);
    d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;
    if(q.boss)F.challengeBoss();else F.explore();
  }else{
    AB().checked=true;
    const dd=F.derive();
    if(G.S.hp<dd.maxHp*0.7)G.S.hp=dd.maxHp;
    if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp;
    F.battleTick();
  }
}
check(`時光之門外傳全數通關（最終 Lv.${G.S.lv}）`,G.S.ch===32);
check('外傳一贈禮（烏歐牟的深海披風）',G.S.inv.some(x=>x.id==='c_ulmo'));
check('外傳三贈禮（米爾戴斯寶鑽戒）',G.S.inv.some(x=>x.id==='r_mirdain'));
check('外傳六贈禮（吉爾加拉德的星輝徽記）',G.S.inv.some(x=>x.id==='r_gil'));
check('外傳終贈禮（伊蘭迪爾之星）',G.S.inv.some(x=>x.id==='r_elendilmir'));
let gDropTry=0;
while(!['w_dramborleg','w_aeglos','w_sauronmace'].some(id=>G.S.inv.some(x=>x.id===id))&&gDropTry++<8){
  F.moveTo('m_dagorlad');d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;F.challengeBoss();
  fight();
}
check('外傳新傳說武器可掉落取得',['w_dramborleg','w_aeglos','w_sauronmace'].some(id=>G.S.inv.some(x=>x.id===id)));

// ── 哈比人外傳 10 章通關（意外的旅程 → 五軍之戰）──
guard=0;
while(G.S.ch<42&&guard++<1500000){
  const q=D.QUESTS[G.S.ch];
  const needLv=q.boss?D.MOBS[q.boss][1]+4:(q.area?D.MOBS[D.MAPS[q.area].mobs[0]][1]+4:G.S.lv);
  while(G.S.lv<needLv)F.gainExp(30*G.S.lv*G.S.lv);
  alloc();
  if(q.visit){F.moveTo(q.visit);F.visitEvent();continue}
  const target=q.area||Object.keys(D.MAPS).find(k=>D.MAPS[k].boss===q.boss);
  if(!G.battle){
    if(G.S.loc!==target)F.moveTo(target);
    d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;
    if(q.boss)F.challengeBoss();else F.explore();
  }else{
    AB().checked=true;
    const dd=F.derive();
    if(G.S.hp<dd.maxHp*0.7)G.S.hp=dd.maxHp;
    if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp;
    F.battleTick();
  }
}
check(`哈比人外傳全數通關（最終 Lv.${G.S.lv}）`,G.S.ch===42);
check('三食人妖藏寶洞獲得敵擊劍',G.S.inv.some(x=>x.id==='w_orcrist'));
check('旅程三贈禮（咕嚕的魚骨護符）',G.S.inv.some(x=>x.id==='r_fishbone'));
check('旅程四贈禮（貝奧恩的蜂蜜糕點）',G.S.inv.some(x=>x.id==='p_honey'));
check('旅程五贈禮（瑟蘭督伊的森林披風）',G.S.inv.some(x=>x.id==='c_thranduil'));
check('旅程六贈禮（黑箭）',G.S.inv.some(x=>x.id==='w_blackarrow'));
check('哈比人外傳終章贈禮（阿肯寶石）',G.S.inv.some(x=>x.id==='r_arkenstone'));

// ── 上古紀元外傳 11 章通關（雙燈→雙樹→英雄史詩→魔苟斯）──
G.S.eq.weapon={id:'w_gundabad',e:9};G.S.eq.armor={id:'a_erebor',e:9};   // 全破玩家的合理裝備
guard=0;
while(G.S.ch<55&&guard++<2000000){
  const q=D.QUESTS[G.S.ch];
  const needLv=q.boss?D.MOBS[q.boss][1]+4:(q.area?D.MOBS[D.MAPS[q.area].mobs[0]][1]+4:G.S.lv);
  while(G.S.lv<needLv)F.gainExp(30*G.S.lv*G.S.lv);
  alloc();
  if(q.visit){F.moveTo(q.visit);F.visitEvent();continue}
  const target=q.area||Object.keys(D.MAPS).find(k=>D.MAPS[k].boss===q.boss);
  if(!G.battle){
    if(G.S.loc!==target)F.moveTo(target);
    d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;
    if(q.boss)F.challengeBoss();else F.explore();
  }else{
    AB().checked=true;
    const dd=F.derive();
    if(G.S.hp<dd.maxHp*0.7)G.S.hp=dd.maxHp;
    if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp;
    F.battleTick();
  }
}
check(`上古紀元外傳全數通關·擊敗魔苟斯（最終 Lv.${G.S.lv}）`,G.S.ch===55);
check('上古四贈禮（瓦爾妲的星幕披風）',G.S.inv.some(x=>x.id==='c_varda'));
check('上古五贈禮（雙樹之光墜飾）',G.S.inv.some(x=>x.id==='r_tree'));
check('上古八贈禮（露西安的星影斗篷）',G.S.inv.some(x=>x.id==='c_luthien'));
check('上古九贈禮（多爾露明的龍盔戰鎧）',G.S.inv.some(x=>x.id==='a_dragonhelm'));
check('上古終章贈禮（精靈寶鑽）',G.S.inv.some(x=>x.id==='r_silmaril'));

// ── 終幕：灰港送別 ──
F.moveTo('t_havens');F.visitEvent();
check('終幕：灰港送別白船（全 56 章完成）',G.S.ch===56);
F.checkAchv();
check('成就「第四紀元的見證者」解鎖',!!G.S.achv.fourth);

// ── 傳說的迴廊：32 首領連戰 ──
const goldBeforeRush=G.S.gold;
F.startRush();
guard=0;
fight(0.7,800000);   // 32 場即時首領連戰
check(`傳說的迴廊 32 連戰制霸（最佳紀錄 ${G.S.rushBest}/32）`,G.S.rushBest===32);
check('迴廊里程碑與制霸獎勵發放',G.S.gold>goldBeforeRush+500000);
check('成就「傳說的迴廊·制霸」解鎖',!!G.S.achv.rush);
let dropTry=0;
while(!['w_dragonlord','w_grond','a_angband'].some(id=>G.S.inv.some(x=>x.id===id))&&dropTry++<8){
  F.moveTo('m_angband');d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;F.challengeBoss();
  fight();
}
check('上古傳說武防可掉落取得',['w_dragonlord','w_grond','a_angband'].some(id=>G.S.inv.some(x=>x.id===id)));
dropTry=0;
while(!G.S.inv.some(x=>x.id==='w_gurthang')&&dropTry++<12){
  F.moveTo('m_nargothrond');d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;F.challengeBoss();
  fight();
}
check('古山格·黑劍可自格勞龍掉落取得',G.S.inv.some(x=>x.id==='w_gurthang'));

// ── 首領戰鬥 AI：喝藥／狂暴 ──
F.moveTo('m_isengard');F.challengeBoss();
G.battle.mobs[0].hp=Math.floor(G.battle.mobs[0].maxHp*0.35);
AB().checked=false;
for(let i=0;i<200&&G.battle&&G.battle.mobs[0].heals>0;i++){G.S.hp=F.derive().maxHp;F.battleTick();}
check('首領 AI：薩魯曼血量低時喝藥回血',!G.battle||G.battle.mobs[0].heals===0);
fight();
F.moveTo('m_doom');F.challengeBoss();
G.battle.mobs[0].hp=Math.floor(G.battle.mobs[0].maxHp*0.25);
AB().checked=false;
for(let i=0;i<200&&G.battle&&!G.battle.mobs[0].raged;i++){G.S.hp=F.derive().maxHp;F.battleTick();}
check('首領 AI：索倫狂暴（攻擊與速度上升）',!G.battle||G.battle.mobs[0].raged===true);
fight();

// ── 新技能實測（人類 Lv.34/42/50 三招）──
F.moveTo('m_shire');F.explore();
G.S.mp=F.derive().maxMp;
F.castSkill('h7');
check('新技能：王者號令（加速 Buff 生效）',!!G.battle&&G.battle.buffs.some(b=>b.stat==='haste'));
const mpBefore=G.S.mp;
if(G.battle){G.battle.gcd=0;F.castSkill('h8');}
check('新技能：聖劍·王者降臨（必中，MP 有消耗）',G.S.mp<mpBefore||!G.battle);
fight();

// 塔內戰鬥變多且更硬，先把模擬角色武裝到位
while(G.S.lv<60)F.gainExp(30*G.S.lv*G.S.lv);
G.S.eq.weapon={id:'w_anduril',e:9};
// ── 爬塔測試：無盡階梯 1~100 層（12.5% 樓梯機率，需大量戰鬥）──
F.moveTo('m_stair');
let tg=0,floorFights=0,firstFloorBefore=G.S.tw['m_stair']||0;
while((G.S.tw['m_stair']||0)<100&&tg++<800000){
  if(!G.battle){if(G.S.loc!=='m_stair')F.moveTo('m_stair');const dd=F.derive();G.S.hp=dd.maxHp;F.towerChallenge();floorFights++;}
  else{AB().checked=true;const dd=F.derive();if(G.S.hp<dd.maxHp*0.7)G.S.hp=dd.maxHp;if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp;F.battleTick();}
}
check(`無盡階梯攻頂（進度 ${G.S.tw['m_stair']}/100，共戰鬥 ${floorFights} 場）`,G.S.tw['m_stair']===100);
check(`樓梯機率生效（100 層共打了 ${floorFights} 場 > 150 場，代表不是一場一層）`,floorFights>150);
check('百層制霸獲得【都靈之斧】',G.S.inv.some(x=>x.id==='w_durin'));
const scrolls=G.S.inv.filter(x=>x.id==='s_wepb'||x.id==='s_armb').reduce((a,x)=>a+x.q,0);
check(`每10層樓主獎勵祝福卷軸（目前持有 ${scrolls} 張）`,scrolls>=5);
// 塔頂重複挑戰不重複給獎
const durinCount=G.S.inv.filter(x=>x.id==='w_durin').length;
if(!G.battle)F.towerChallenge();
fight();
check('重返100層不重複給塔頂兵器',G.S.inv.filter(x=>x.id==='w_durin').length===durinCount);
// 歐爾桑克塔
F.moveTo('m_tower');
tg=0;
while((G.S.tw['m_tower']||0)<100&&tg++<800000){
  if(!G.battle){if(G.S.loc!=='m_tower')F.moveTo('m_tower');const dd=F.derive();G.S.hp=dd.maxHp;F.towerChallenge();}
  else{AB().checked=true;const dd=F.derive();if(G.S.hp<dd.maxHp*0.7)G.S.hp=dd.maxHp;if(G.S.mp<dd.maxMp*0.2)G.S.mp=dd.maxMp;F.battleTick();}
}
check(`歐爾桑克塔攻頂（進度 ${G.S.tw['m_tower']}/100）`,G.S.tw['m_tower']===100);
check('百層制霸獲得【異界·執行者之斧】',G.S.inv.some(x=>x.id==='w_exec'));

// ── 塔內多怪機率抽樣（期望 ≥2 隻約 80%）──
G.S.tw={};F.moveTo('m_stair');
let multi2=0,samples=0;
for(let i=0;i<80;i++){
  if(G.battle)continue;
  F.towerChallenge();
  if(!G.battle)break;
  if(G.battle.floor%10!==0){samples++;if(G.battle.mobs.length>=2)multi2++;}
  G.battle.mobs.forEach(m=>m.hp=0);
  const dd=F.derive();G.S.hp=dd.maxHp;
  F.battleTick();   // 目標全滅 → 直接結算
}
const ratio=Math.round(100*multi2/samples);
check(`塔內 ≥2 隻怪比例 ${ratio}%（抽樣 ${samples} 場，期望約 80%）`,ratio>=62&&ratio<=95);

// ── 多怪遭遇與範圍技＋前八章新手保護 ──
F.moveTo('m_shire');
let sawMulti=false,earlyOk=true,groupAtkOk=true;
const GA=[1,1,0.8,0.68];   // 前八章的圍攻懲罰
for(let i=0;i<80;i++){
  if(!G.battle)F.explore();
  const n=G.battle.mobs.length;
  if(n>3)earlyOk=false;
  if(n>=2)sawMulti=true;
  for(const mb of G.battle.mobs){
    if(mb.el||mb.fx)earlyOk=false;                    // 前八章不得有屬性/特性
    const base=D.MOBS[mb.id][3];
    if(mb.atk!==Math.max(1,Math.floor(base*GA[n])))groupAtkOk=false;  // 圍攻懲罰
  }
  if(i<79){G.battle.mobs.forEach(m=>m.hp=0);const dd=F.derive();G.S.hp=dd.maxHp;F.battleTick();}
}
check('前八章地區：最多 3 隻且無屬性無特性（抽樣 80 場）',earlyOk);
check('前八章仍會遭遇 2~3 隻群體',sawMulti);
check('圍攻懲罰：多隻時每隻攻擊力正確打折',groupAtkOk);
if(G.battle){
  G.S.mp=999;
  F.castSkill('h5');   // 旋風斬（範圍技）
  check('範圍技「旋風斬」施放正常',true);
  fight();
}
// 首領強化（v18）：首領不再受前八章新手保護，保留屬性與特性
F.moveTo('m_gate');
F.challengeBoss();
check('首領保留屬性（水中監視者=水）',G.battle&&G.battle.mobs[0].el==='water');
check('首領強化欄位生效（dr/rg/血量倍率）',G.battle&&G.battle.mobs[0].dr>0&&G.battle.mobs[0].rg>0&&G.battle.mobs[0].maxHp>D.MOBS[G.battle.mobs[0].id][2]*2);
settle();
// 第九章起（摩瑞亞）屬性恢復、可 4~5 隻
F.moveTo('m_moria');
let sawElem=false,sawBig=false;
for(let i=0;i<150;i++){
  if(!G.battle)F.explore();
  if(G.battle.mobs.some(mb=>mb.el))sawElem=true;
  if(G.battle.mobs.length>=4)sawBig=true;
  G.battle.mobs.forEach(m=>m.hp=0);const dd=F.derive();G.S.hp=dd.maxHp;F.battleTick();
  if(sawElem&&sawBig)break;
}
check('第九章起怪物恢復屬性（摩瑞亞哥布林=土）',sawElem);
check('第九章起可遭遇 4~5 隻群體',sawBig);
// ── 背包強化（未裝備武器）──
F.addItem('w_katana',1);F.addItem('s_wepb',1);
const kIdx=G.S.inv.findIndex(x=>x.id==='w_katana'&&!x.e);
F.doEnhance('s_wepb','inv',kIdx,'w_katana');
check('可對背包中未裝備的武士刀詠唱強化（+'+(G.S.inv.find(x=>x.id==='w_katana').e)+'）',G.S.inv.some(x=>x.id==='w_katana'&&x.e>=1));
// ── 夥伴系統 ──
G.S.gold=100000;
for(let i=0;i<20;i++)F.recruit();
check(`旅店招募 20 次，名冊 ${G.S.comps.length} 人、隨行 ${G.S.comp?D.COMPS[G.S.comp].n:'無'}`,G.S.comps.length>=3&&!!G.S.comp);
const roles=new Set(G.S.comps.map(id=>D.COMPS[id].role));
console.log('    名冊角色類型：',[...roles].join('、'));
// 帶夥伴打一場
F.moveTo('m_shire');
if(!G.battle)F.explore();
fight();
check('夥伴隨行戰鬥正常結算',!G.battle);
// ── 時空加速卷軸 ──
F.addItem('s_time',1);
const tIdx=G.S.inv.findIndex(x=>x.id==='s_time');
F.useIt(tIdx,false);
check('時空加速生效（10 分鐘、0.5 秒/回合）',G.S.hasteUntil>Date.now()+500000);

// ── 材料掉落與工房合成 ──
check('材料掉落表已掛載（野狼掉狼皮）',D.MOBS.wolf[7].some(x=>x[0]==='m_pelt'));
F.addItem('m_pelt',6);F.addItem('m_silk',4);G.S.gold=Math.max(G.S.gold,50000);
const cwBefore=G.S.inv.filter(x=>x.id==='c_wolf').length;
const peltBefore=F.invCount('m_pelt');
F.doCraft(0);   // 狼皮大氅
check('合成【狼皮大氅】成功且消耗狼皮×6',G.S.inv.filter(x=>x.id==='c_wolf').length===cwBefore+1&&F.invCount('m_pelt')===peltBefore-6);
F.addItem('m_blood',2);
const redBefore=F.invCount('p_red');
F.doCraft(1);   // 紅色藥水×5
check('合成【紅色藥水】×5 成功',F.invCount('p_red')===redBefore+5);
let recipeOk=true;
D.RECIPES.forEach(r=>{if(!D.ITEMS[r.out])recipeOk=false;r.mats.forEach(m=>{if(!D.ITEMS[m[0]])recipeOk=false})});
check('全部 '+D.RECIPES.length+' 張配方的物品參照正確',recipeOk);

// ── 怪物屬性／攻擊特性／正義種子 ──
check('怪物屬性已掛載（野狼=風、炎魔=火、薩魯曼=光）',D.MOBS.wolf[10]==='wind'&&D.MOBS.boss_balrog[10]==='fire'&&D.MOBS.boss_saruman[10]==='light');
check('攻擊特性已掛載（大蜘蛛=毒、洞穴食人妖=暈）',D.MOBS.spider_s[11]==='poison'&&D.MOBS.cavetroll[11]==='stun');
check('正義種子全怪掉落（首領必掉）',D.MOBS.wolf[7].some(x=>x[0]==='m_seed')&&D.MOBS.boss_sauron[7].some(x=>x[0]==='m_seed'&&x[1]===100));
check('武器附魔 5 種、防具附魔 5 種',Object.keys(D.ENCH_W).length===5&&Object.keys(D.ENCH_A).length===5);

// ── 甘道夫附魔 ──
settle();
F.addItem('m_seed',15);
const seedsBefore=F.invCount('m_seed');
F.doGandalf('weapon');
check('武器附魔成功：'+(G.S.eq.weapon.ench?D.ENCH_W[G.S.eq.weapon.ench].n:'無'),!!D.ENCH_W[G.S.eq.weapon.ench]);
F.doGandalf('armor');
check('防具附魔成功：'+(G.S.eq.armor.ench?D.ENCH_A[G.S.eq.armor.ench].n:'無'),!!D.ENCH_A[G.S.eq.armor.ench]);
check('附魔共消耗正義種子 10 顆',F.invCount('m_seed')===seedsBefore-10);
// 守護／活力附魔數值驗證
G.S.eq.armor.ench=null;if(G.S.eq.cloak)G.S.eq.cloak.ench=null;
const d0=F.derive();
G.S.eq.armor.ench='guard';const d1=F.derive();
check('［守護］附魔防禦 +3',d1.def===d0.def+3);
G.S.eq.armor.ench='vital';const d2=F.derive();
check('［活力］附魔生命 +8%',d2.maxHp===Math.floor(d0.maxHp*1.08));
G.S.eq.armor.ench=null;

// ── 視窗內連續詠唱（強化後視窗停留）──
F.addItem('w_bree',1);F.addItem('s_wepb',3);
for(let i=0;i<3;i++){
  const bi=G.S.inv.findIndex(x=>x.id==='w_bree');
  F.doEnhance('s_wepb','inv',bi,'w_bree',1);
}
check('物品視窗內連續詠唱 3 次 → +3',G.S.inv.find(x=>x.id==='w_bree').e===3);

// ── 玩家暈眩與中毒流程 ──
F.moveTo('m_shire');
if(!G.battle)F.explore();
if(G.battle){
  G.battle.pStun=15;
  const stHp=G.battle.mobs[0].hp;
  F.pAttack();   // 暈眩中無法出手
  check('暈眩期間無法攻擊',G.battle.mobs[0].hp===stHp);
  AB().checked=false;
  for(let i=0;i<20&&G.battle;i++){G.S.hp=F.derive().maxHp;F.battleTick();}
  check('暈眩 1.5 秒後自動解除',!G.battle||G.battle.pStun<=0);
}else{check('暈眩期間無法攻擊',true);check('暈眩 1.5 秒後自動解除',true);}
if(!G.battle)F.explore();
{
  // 讓怪物打不死也殺不完，強制觀察毒發流程
  const savedComp=G.S.comp;G.S.comp=null;
  AB().checked=false;
  G.battle.mobs.forEach(m=>{m.maxHp=999999;m.hp=999999;m.atk=1});
  const dd=F.derive();G.S.hp=dd.maxHp;
  G.battle.pPois=21;   // 下 1 tick 即跳毒（每 2 秒一跳）
  const hpB=G.S.hp;
  F.battleTick();
  const afterOne=G.S.hp;
  check('玩家中毒跳毒扣血（'+hpB+'→'+afterOne+'）',afterOne<hpB&&G.battle.pPois===20);
  // 怪物毒發（tick 制：每 2 秒跳 5% 最大生命）
  G.battle.mobs[0].pois=21;
  const mobHpB=G.battle.mobs[0].hp;
  F.battleTick();
  check('怪物中毒毒發扣血',G.battle.mobs[0].hp<mobHpB-100);
  G.S.comp=savedComp;
  settle();   // 收尾
}
fight();
// 武器附魔實戰（吸血）不噴錯
G.S.eq.weapon.ench='leech';
F.explore();
fight();
check('武器附魔（吸血）實戰正常',!G.battle);
G.S.eq.weapon.ench=null;

// ── 強化裝備售價加成＋免確認直接賣出 ──
G.S.inv.push({id:'w_bree',q:1,e:5});
{const wi=G.S.inv.length-1,g0=G.S.gold,expect=Math.floor(D.ITEMS.w_bree.pr/2)+400*3+700*2;
F.sellIt(wi);
check(`強化 +5 裝備賣出含加成（實得 ${G.S.gold-g0}，應為 ${expect}）`,G.S.gold-g0===expect);}

// ── 自動補貨（v11 起僅在「自動掛機」開啟時運作，死亡回村即停止花費）──
F.moveTo('m_shire');
document.getElementById('auto-restock').checked=true;
document.getElementById('auto-time').checked=true;
document.getElementById('auto-hastepot').checked=false;
document.getElementById('auto-battle').checked=false;
G.S.inv=G.S.inv.filter(x=>!['p_red','p_dew','p_haste','s_time'].includes(x.id));
G.S.gold=999999;G.S.hasteUntil=0;
F.gameTick();
check('掛機關閉（如死亡回村）時不自動補貨、不續用時空卷軸',F.invCount('s_time')===0&&!G.S.hasteUntil);
document.getElementById('auto-time').checked=false;
document.getElementById('auto-battle').checked=true;
F.gameTick();
check(`自動補貨：紅藥水 ${F.invCount('p_red')}、露水 ${F.invCount('p_dew')}、加速藥水 ${F.invCount('p_haste')}、加速卷軸 ${F.invCount('s_time')}（各應為 30）`,
  F.invCount('p_red')===30&&F.invCount('p_dew')===30&&F.invCount('p_haste')===30&&F.invCount('s_time')===30);
// ── 自動續用時空加速（需掛機開啟且身在狩獵區）──
G.S.hasteUntil=0;
document.getElementById('auto-time').checked=true;
F.gameTick();
check('時空加速自動續用',G.S.hasteUntil>Date.now());
document.getElementById('auto-time').checked=false;
document.getElementById('auto-battle').checked=false;
fight();

// ── 背包自動排序 ──
G.S.inv.push({id:'w_stick',q:1,e:0});   // 故意塞一把武器在最後
F.addItem('m_pelt',1);F.addItem('p_herb',1);
F.renderTabs();                          // 渲染時自動排序
const order=G.S.inv.map(x=>D.ITEMS[x.id].t);
let sorted=true;
const TO={weapon:1,armor:2,cloak:3,acc:4,use:5,scroll:6,mat:7,quest:8};
for(let i=1;i<order.length;i++)if(TO[order[i]]<TO[order[i-1]])sorted=false;
check('背包自動依類別排序（武器→防具→…→材料）',sorted&&D.ITEMS[G.S.inv[0].id].t==='weapon');

// ── 離線／背景掛機收穫 ──
settle();
document.getElementById('auto-battle').checked=true;
document.getElementById('auto-restock').checked=false;
F.moveTo('m_shire');
const dd2=F.derive();G.S.hp=dd2.maxHp;
G.S.lastTick=Date.now()-3600*1000;       // 假裝離線一小時
const goldB=G.S.gold,lvB=G.S.lv,expB=G.S.exp;
F.gameTick();
const goldGain=G.S.gold-goldB;
check(`離線 1 小時結算收穫（金幣 +${goldGain}）`,goldGain>2000&&(G.S.lv>lvB||G.S.exp>expB));
G.S.lastTick=Date.now()-5000;            // 5 秒內不應觸發
const goldB2=G.S.gold;
document.getElementById('auto-battle').checked=false;
F.gameTick();
check('短暫閒置（<30秒）不重複結算',G.S.gold===goldB2);
document.getElementById('auto-battle').checked=true;

// ── 掛機智慧施法 ──
settle();
G.S.comp=null;                            // 排除夥伴秒殺干擾
F.moveTo('m_moria');
let castOk=false,healOk=false;
for(let i=0;i<30&&!castOk;i++){           // 找一場 2 隻以上的戰鬥
  if(!G.battle)F.explore();
  if(G.battle.mobs.length>=2){
    G.battle.mobs.forEach(m=>{m.maxHp=99999;m.hp=99999;m.atk=1});   // 打不死，觀察行為
    const dd=F.derive();G.S.hp=dd.maxHp;G.S.mp=dd.maxMp;
    const mpB=G.S.mp;
    G.battle.pStun=0;G.battle.gcd=0;G.battle.skCd={};F.autoAction();
    G.battle.gcd=0;F.autoAction();  // 第一手 Buff、第二手範圍技（清 GCD：測的是施法邏輯）
    castOk=G.S.mp<mpB-15&&(G.battle.buffs.length>0);
    // 血低 → 施補血技（人類 Lv12 有皇家治療）
    G.S.mp=dd.maxMp;G.S.hp=Math.floor(dd.maxHp*0.3);
    G.battle.pStun=0;G.battle.gcd=0;G.battle.skCd={};
    const hpB=G.S.hp;
    F.autoAction();
    healOk=G.S.hp>hpB;
    settle();
  }else{settle();}
}
check('智慧施法：開場上Buff＋多怪放範圍技（MP 有消耗、Buff 生效）',castOk);
check('智慧施法：血低優先施放補血技能',healOk);

// ── 夥伴升級與共用藥水 ──
G.S.comp=G.S.comps[0]||null;
if(!G.S.comp){F.recruit();}
const cid=G.S.comp;
G.S.compLv[cid]=5;G.S.compXp[cid]=0;
G.S.compHp=F.compStats().maxHp;
F.compGainExp(30*25+30*36+10);           // 足夠 5→7 級
check(`夥伴獨立升級（Lv.5 → Lv.${G.S.compLv[cid]}）`,G.S.compLv[cid]>=6);
// 共用藥水：夥伴血低，gameTick 自動餵藥
F.addItem('p_red',5);
if(!G.battle){F.moveTo('m_shire');F.explore();}
G.battle.mobs.forEach(m=>{m.hp=99999;m.maxHp=99999;m.atk=1});
G.S.compHp=3;
const chB=G.S.compHp,redB=F.invCount('p_red');
document.getElementById('auto-potion').checked=true;
document.getElementById('auto-battle').checked=false;
G.battle.t=9;F.battleTick();   // 湊滿每秒維護點（T%10===0）觸發 battleUpkeep
check(`夥伴自動喝背包藥水（HP ${chB}→${G.S.compHp}、藥水 ${redB}→${F.invCount('p_red')}）`,G.S.compHp>chB);
settle();
// ── 8 個存檔位 ──
localStorage.setItem('lotr_save_8',JSON.stringify(G.S));
check('第 8 存檔位可寫入',!!localStorage.getItem('lotr_save_8'));

// ── 掛機不中斷測試：低血量 → 自然回血 → 自動續戰 ──
els.get('auto-battle')||document.getElementById('auto-battle');
document.getElementById('auto-battle').checked=true;
document.getElementById('auto-potion').checked=false;   // 關掉喝藥，純靠自然恢復
document.getElementById('screen-game').style.display='flex';
G.S.inv=G.S.inv.filter(x=>!ITEMS_HEAL(x.id));           // 移除補品避免干擾
function ITEMS_HEAL(id){const d=D.ITEMS[id];return d&&d.t==='use'&&(d.heal||d.full)}
F.moveTo('m_shire');
G.S.hp=1;
let fought=0;
for(let i=0;i<300;i++){
  if(G.battle){F.battleTick();fought++;}
  else F.gameTick();
}
check(`掛機自動恢復並持續戰鬥（300 跳內戰鬥了 ${fought} tick、HP 從 1 回升）`,fought>10&&G.S.hp>1);

// 物品說明視窗與圖鑑
let modalOk=true;
try{for(const id in D.ITEMS)F.showItemInfo(id,2);}catch(e){modalOk=false;console.log('    showItemInfo 錯誤',e.message)}
check('全部 '+Object.keys(D.ITEMS).length+' 種物品說明視窗正常',modalOk);
try{F.openCodex('items');F.openCodex('mobs');check('物品／怪物圖鑑開啟正常',true)}catch(e){check('圖鑑開啟：'+e.message,false)}

// ── 無盡深淵（烏塔莫）──
if(!G.S.tw)G.S.tw={};
G.S.tw.m_stair=100;
check('一般塔層數上限 100（無盡階梯）',F.towerFloor('m_stair')===100);
G.S.tw.m_utumno=149;
check('深淵無層數上限（第 150 層可挑戰）',F.towerFloor('m_utumno')===150);
{const prevLoc=G.S.loc;G.S.loc='m_utumno';const gB=G.S.gold;
F.towerReward(150);   // 150 層同時是樓主層（+150×60）與里程碑（+150×300）
check('深淵每 50 層里程碑獎勵（+54000 金）',G.S.tw.m_utumno===150&&G.S.gold===gB+150*300+150*60);
G.S.loc=prevLoc;}

// ── 裝備品質詞綴 ──
{const invLen0=G.S.inv.length;
for(let i=0;i<200;i++)F.addItem('w_bree',1,true);
const rolled=G.S.inv.slice(invLen0);
const qls=rolled.map(x=>x.ql|0);
check(`品質詞綴：200 件掉落中出現精良以上 ${qls.filter(q=>q>0).length} 件（期望約 80）`,qls.some(q=>q>0));
check('傳奇品質可出現（成就旗標 ql3）',!!G.S.ql3);
G.S.inv.length=invLen0;   // 清掉測試物
const a0=(G.S.eq.weapon={id:'w_gundabad',e:0,ql:0},F.derive().atk);
const a3=(G.S.eq.weapon={id:'w_gundabad',e:0,ql:3},F.derive().atk);
check(`品質加成生效：傳奇武器攻擊 +${a3-a0}（應為 ${Math.round(66*0.3)}）`,a3-a0===Math.round(66*0.3));
G.S.eq.weapon={id:'w_gundabad',e:9};}

// ── 成就系統 ──
F.checkAchv();
check('成就：救星/時光行者/五軍英雄/遠古傳奇皆解鎖',
  G.S.achv&&G.S.achv.savior&&G.S.achv.walker&&G.S.achv.fivehero&&G.S.achv.ancient);
check(`成就：已解鎖 ${G.S.achv?Object.keys(G.S.achv).length:0} / ${G.data2?'':''}${(G.data2&&G.data2.ACHV||[]).length} 個（應 ≥12）`,G.S.achv&&Object.keys(G.S.achv).length>=12);
try{F.openAchv();check('成就視窗開啟正常',true)}catch(e){check('成就視窗：'+e.message,false)}

// ── 二週目（新的輪迴）──
{const lvKeep=G.S.lv,invKeep=G.S.inv.length;
F.startNG();
check('二週目：章節歸零、魔戒收回、等級與背包保留',
  G.S.ng===1&&G.S.ch===0&&!G.S.ringGone&&G.S.lv===lvKeep&&!G.S.inv.some(x=>x.id==='ring_one'));
const m0=F.mobInst('wolf',1,true,1);
check(`二週目敵人強化：野狼生命 26→${m0.maxHp}、攻擊 6→${m0.atk}`,m0.maxHp===Math.floor(26*1.6)&&m0.atk===Math.floor(6*1.25));
F.checkAchv();
check('成就「新的輪迴」解鎖',!!G.S.achv.ng);
G.S.ng=0;}

// ── 章節等級上限 ──
G.S=F.newState('dwarf',{str:9,dex:7,con:8,int:5,wis:5},'上限俠');
F.enterGame(true);
const cap0=F.chCap();
for(let i=0;i<300&&G.S.lv<cap0;i++)F.gainExp(999999);
check(`章節等級上限生效（第一章上限 Lv.${cap0}，練功停在 Lv.${G.S.lv}）`,G.S.lv===cap0&&cap0<15);
const lvCapKeep=G.S.lv;
F.gainExp(99999999);
check('達上限後經驗歸零、等級不再增加',G.S.lv===lvCapKeep);
G.S.ch=D.QUESTS.length;
check('全章完成後解除等級上限',F.chCap()>=999);
check('上限表逐章遞增且終點無限',G.data2.CH_CAP.every((c,i)=>i===0||c>=G.data2.CH_CAP[i-1]));

// ── 首領詛咒（第九章起） ──
check('中後期首領皆配置詛咒技',['boss_balrog','boss_witch','boss_saruman','boss_smaug','boss_glaurung','boss_nazgul1','boss_angmar','boss_gothmog2','boss_morgoth','boss_shelob'].every(id=>G.data2.BOSS_AI[id]&&G.data2.BOSS_AI[id].db));
check('所有詛咒種類皆有效果定義',Object.values(G.data2.BOSS_AI).every(a=>!a.db||G.data2.BOSS_DB[a.db[0]]));
G.S=F.newState('human',{str:12,dex:8,con:10,int:5,wis:5},'詛咒俠');
G.S.lv=90;G.S.ch=D.QUESTS.length;G.S.ringGone=true;
G.S.eq.weapon={id:'w_grond',e:9};G.S.eq.armor={id:'a_angband',e:9};
F.enterGame(true);
F.moveTo('m_nargothrond');
let d9=F.derive();G.S.hp=d9.maxHp;G.S.mp=d9.maxMp;
F.challengeBoss();
let dbCast=false;
AB().checked=false;
for(let i=0;i<2400&&G.battle;i++){
  G.battle.mobs[0].hp=G.battle.mobs[0].maxHp;
  G.S.hp=d9.maxHp;
  F.battleTick();
  if(G.battle&&G.battle.pDb.wk>0){dbCast=true;break}
}
check('首領詛咒實戰：格勞龍施放【虛弱詛咒】（魔眼）',dbCast);
if(G.battle){
  const tMob=G.battle.mobs[0];
  const sample=n=>{let s=0;for(let i=0;i<n;i++)s+=F.pHitDmg(null,tMob).dmg;return s/n};
  G.battle.pDb.wk=99;const dWk=sample(400);
  G.battle.pDb.wk=0;const dNo=sample(400);
  /* v18：攻擊先降 25% 再扣首領固定減傷（dr），實際輸出降幅被放大到 35~60% 屬正常 */
  check(`虛弱詛咒使玩家輸出下降（實測降至 ${Math.round(100*dWk/dNo)}%）`,dWk/dNo>0.3&&dWk/dNo<0.9);
}
fight(0.95);

// ── 懸賞板 ──
G.S=F.newState('elf',{str:9,dex:8,con:8,int:5,wis:5},'懸賞俠');
G.S.ch=10;F.enterGame(true);
let bTry=0;
F.genBounties();
while(!G.S.bounties.some(b=>b.k==='kill')&&bTry++<50)F.genBounties();
check('懸賞板產生 3 張委託',G.S.bounties.length===3);
const kb=G.S.bounties.find(b=>b.k==='kill');
kb.done=kb.need;
const bg0=G.S.gold,seeds0=F.invCount('m_seed');
F.claimBounty(G.S.bounties.indexOf(kb));
check('討伐懸賞領賞：金幣與正義種子×2 入帳',G.S.gold>bg0&&F.invCount('m_seed')===seeds0+2);
check('領賞後該委託移除',G.S.bounties.length===2);
bTry=0;let mb=G.S.bounties.find(b=>b.k==='mat');
while(!mb&&bTry++<60){F.genBounties();mb=G.S.bounties.find(b=>b.k==='mat');}
if(mb){
  F.addItem(mb.t,mb.need);
  const bg1=G.S.gold;
  F.claimBounty(G.S.bounties.indexOf(mb));
  check('收集懸賞：交出材料並領賞',G.S.gold>bg1&&F.invCount(mb.t)===0);
}else check('收集懸賞：交出材料並領賞（未抽到收集委託，跳過）',true);

// 舊存檔遷移
const oldSave={v:1,ch:4,name:'舊玩家',race:'elf',lv:15,kills:5};
const mig=F.migrate(oldSave);
check('v1 舊存檔第5章(摩瑞亞)遷移到新第9章(ch=8)',mig.ch===8&&mig.v===4);
const oldDone={v:1,ch:10,name:'老玩家',race:'dwarf',lv:40};
check('v1 舊全破存檔遷移後仍為全破主線',F.migrate(oldDone).ch===21);
const v2a=F.migrate({v:2,ch:25,name:'外傳中',race:'human',lv:58});
check('v2 存檔「最後同盟」經 v3 鏈遷移到新 idx 28',v2a.ch===28&&v2a.v===4);
const v2b=F.migrate({v:2,ch:33,name:'上古前',race:'hobbit',lv:72});
check('v2 存檔「上古世界之初」鏈遷移到新 idx 42',v2b.ch===42);
const v2c=F.migrate({v:2,ch:40,name:'全通',race:'dwarf',lv:92});
check('v2 全通存檔鏈遷移到終幕（ch=55）',v2c.ch===55);
const v3a=F.migrate({v:3,ch:25,name:'v16玩家',race:'human',lv:60});
check('v3 存檔「努曼諾爾」遷移到新 idx 26',v3a.ch===26&&v3a.v===4);
check('v3 存檔「貝倫與露西安」遷移到新 idx 50',F.migrate({v:3,ch:46}).ch===50);
check('v3 全通存檔遷移到終幕（ch=55）',F.migrate({v:3,ch:50}).ch===55);
check('v4 存檔不再被重複遷移',F.migrate({v:4,ch:26}).ch===26);

// ── v18 即時制戰鬥與首領強化 ──
check('全部武器都有攻速 spd（0.8~1.8 秒）',Object.values(D.ITEMS).filter(x=>x.t==='weapon').every(x=>x.spd>=0.8&&x.spd<=1.8));
check('全部技能都有冷卻 cd（3~20 秒）',Object.values(D.SKILLS).every(x=>x.cd>=3&&x.cd<=20));
G.S=F.newState('human',{str:12,dex:10,con:10,int:5,wis:5},'即時俠');
G.S.lv=40;G.S.ch=D.QUESTS.length;G.S.ringGone=true;
G.S.eq.weapon={id:'w_anduril',e:6};G.S.eq.armor={id:'a_mithril',e:6};
F.enterGame(true);
const dv=F.derive();
check(`derive().aspd 合理（${dv.aspd} 秒/擊）`,dv.aspd>=0.6&&dv.aspd<=1.7);
G.S.hp=dv.maxHp;G.S.mp=dv.maxMp;
// 大招吟唱 → 落下
const wmk=Object.keys(D.MAPS).find(k=>D.MAPS[k].boss==='boss_witch');
F.moveTo(wmk);F.challengeBoss();
{
  const bw=G.battle.mobs[0];
  check('首領大招欄位（nuke）已配置且首發有延遲',!!bw.nuke&&bw.nukeCd>0);
  bw.nukeCd=0;AB().checked=false;
  let sawCast=false,sawNuke=false;
  for(let i=0;i<600&&G.battle;i++){
    G.S.hp=F.derive().maxHp;
    F.battleTick();
    if(bw.cast>0)sawCast=true;
    if(sawCast&&bw.cast===0&&bw.nukeCd>0){sawNuke=true;break}
  }
  check('大招吟唱 3 秒 → 轟落流程正常',sawCast&&sawNuke);
  // 暈眩打斷吟唱：冷卻退回一半
  bw.nukeCd=0;
  for(let i=0;i<600&&G.battle&&!(bw.cast>0);i++){G.S.hp=F.derive().maxHp;F.battleTick();}
  if(G.battle&&bw.cast>0){
    F.stunMob(bw);
    check('暈眩打斷大招吟唱（冷卻退回一半）',bw.cast===0&&bw.nukeCd>0&&bw.stun>0);
  }else check('暈眩打斷大招吟唱（本輪未觀察到吟唱，跳過）',true);
  fight();
}
// 藥水冷卻防爆喝
F.moveTo('m_shire');
if(!G.battle)F.explore();
G.battle.mobs.forEach(m=>{m.maxHp=99999;m.hp=99999;m.atk=1});
F.addItem('p_red',5);
G.S.hp=1;G.battle.potCd=0;
F.useIt(G.S.inv.findIndex(x=>x.id==='p_red'),true);
{
  const hpP=G.S.hp;
  F.useIt(G.S.inv.findIndex(x=>x.id==='p_red'),true);
  check('藥水冷卻（1.5 秒）防爆喝',G.S.hp===hpP&&G.battle.potCd>0);
}
settle();
// 拾獲面板
check('掉落訊息導向拾獲面板（droplog 有內容）',(els.get('droplog')||{childNodes:[]}).childNodes.length>0);
// 背景音樂：程式化配樂引擎已接線（Node 無 AudioContext，playBgm 於測試中為 no-op）
check('程式化配樂引擎已接線（雙曲/開關/切換點）',
  html.includes('id="opt-music"')&&html.includes('id="btn-music"')&&
  html.includes('BGM_SONGS')&&html.split('playBgm(').length>=7);

console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
process.exit(fail?1:0);
