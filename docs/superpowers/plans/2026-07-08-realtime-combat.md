# 即時制戰鬥＋首領強化 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把回合制戰鬥改成 100ms tick 的即時制（含攻速），並全面強化首領（固定減傷／回血／大招吟唱），使「不強化就打不過」。

**Architecture:** 沿用陸吼放置版骨架——固定 100ms tick、每個作戰單位（玩家／夥伴／每隻怪）各持攻速冷卻計數器，歸零出手；狀態（毒/暈/buff/詛咒）由回合改為 tick 計時。掛機＝全自動（普攻＋智慧施法＋喝藥）；手動＝純手動（按鈕受冷卻限制）。掉落物訊息移到獨立「拾獲」面板。

**Tech Stack:** 純 vanilla JS 單檔 `index.html`；Node 測試工具 `tools/*.js`。

## Global Constraints

- 遊戲全部在 `index.html` 單檔內（無外部資源，file:// 可玩）。
- 訊息一律繁體中文、劇情語氣；異界物品掛「異界·」前綴。
- `S`（存檔）**本次不新增欄位**；`battle` 為暫時物件不入存檔。快照 `snapshot()` 新增 `aspd`，舊快照缺欄用 `||1.2` 守衛。
- 修改 index.html 後必跑 `/run-tests`（52 項全綠）；資料變動後跑 `/update-codex`、`/gen-maxsave`。
- 使用者決定：①掛機全自動含技能、手動純手動；②戰鬥訊息照跳、掉落另開視窗；③全部王一次到位。

## 核心數值規格（所有 Task 共用）

- **1 tick = 100ms**。攻速單位＝秒/次；tick 數 = `Math.max(4,Math.round(秒*10))`。
- 玩家攻速：`aspd = 武器spd × (1 - min(0.30, dex*0.004))`；徒手 spd=1.2。加速 buff（stat==='haste'）攻擊間隔 ×0.6。
- 怪物攻速：普通怪 1.6s、風屬性 ×0.85、王預設 2.4s（BOSS_AI 可覆蓋）；塔怪 1.7s、樓主 2.2s；狂暴後 ×0.75。
- 舊「回合」換算：1 回合 = 2 秒（20 tick）。毒每 20 tick 跳一次共 3 跳；暈眩 15 tick；詛咒 3 回合 → 80 tick。
- 技能：共用 GCD 10 tick；各技能 `cd` 欄（秒）。藥水冷卻 15 tick；逃跑失敗後 50 tick 不能再逃。
- 首領預設（`bossDefaults(lv)`，BOSS_AI 個別覆蓋）：
  - `hpm`（血量倍率）：lv<15→3、15~29→4、30~49→5、50+→5.5
  - `dr`（固定減傷）：`Math.floor(lv*0.5)`
  - `rg`（每 3 秒回最大血 %）：lv<15→0.006、15~29→0.008、30~49→0.010、50+→0.012
  - `nuke`（大招）：lv≥15 才有，`{cd:25, mult:2.8}`，吟唱 30 tick，傷害 `atk*mult - 玩家防/4`（半穿防、不可閃避）
  - 王被暈眩/麻痺機率減半；暈眩會打斷吟唱（大招冷卻退回一半）。

---

### Task 1: 資料層——武器攻速、技能冷卻、derive 攻速、怪物攻速

**Files:**
- Modify: `index.html:297-334`（SKILLS 加 `cd`）、`index.html:363-398`（武器加 `spd`）、`index.html:1111-1131`（derive）、`index.html:1167`（snapshot）、`index.html:1539-1550`（mobInst）、`index.html:1567-1584`（towerMob）

**Interfaces:**
- Produces: `derive()` 回傳物件新增 `aspd`（秒）；`mobInst()`/`towerMob()` 回傳的 mob 新增 `spd`（秒）；`SKILLS[id].cd`（秒）；`snapshot()` 新增 `aspd`。

- [x] **Step 1: 武器加 spd 欄**（逐一在每個 `t:'weapon'` 條目加 `spd:` 值）

| id | spd | id | spd | id | spd |
|---|---|---|---|---|---|
| w_stick 1.2 | w_dagger 0.9 | w_barrow 1.0 | w_bree 1.2 | w_axe 1.3 | w_mirkwood 1.1 |
| w_ranger 1.2 | w_silveraxe 1.3 | w_sting 1.0 | w_rohan 1.2 | w_lorien 1.1 | w_katana 1.0 |
| w_claymore 1.5 | w_gondor 1.2 | w_elfbow 1.1 | w_damascus 1.0 | w_orcrist 1.1 | w_zwei 1.6 |
| w_numenor 1.4 | w_glam 1.2 | w_durin 1.4 | w_anduril 1.2 | w_exec 1.5 | w_dramborleg 1.5 |
| w_aeglos 1.3 | w_sauronmace 1.6 | w_dragontooth 1.2 | w_blackarrow 1.3 | w_gurthang 1.3 | w_thror 1.5 |
| w_necro 1.2 | w_gundabad 1.3 | w_lamplight 1.3 | w_valinor 1.2 | w_dragonlord 1.4 | w_grond 1.7 |

設計原則：快刀清雜兵、慢重武單發高（吃固定減傷 dr 時有優勢）。說明文字順手補「攻速快/沉重」語感的不改，只加數值。

- [x] **Step 2: SKILLS 每招加 `cd` 欄（秒）並更新敘述**（「N 回合」→「N×2 秒」）

單體傷害技 cd:5～8（越高階越長）、AOE cd:8～10、治療 cd:6、buff cd:12～15。逐招：
h1:5 h2:12 h3:6 h4:6 h5:8 h6:9 h7:15 h8:8 h9:10；e1:5 e2:6 e3:6 e4:7 e5:8 e6:9 e7:8 e8:8 e9:10；d1:5 d2:12 d3:6 d4:6 d5:8 d6:9 d7:12 d8:8 d9:10；b1:5 b2:12 b3:6 b4:6 b5:8 b6:9 b7:8 b8:8 b9:10。
敘述文字：h2「持續 6 回合」→「持續 12 秒」；h7「4 回合內每回合多攻擊一次」→「8 秒內攻擊速度大幅提升」；d2/d7/b2 同法；d3/d8「下回合無法行動」→「短暫暈眩」。

- [x] **Step 3: derive() 加 aspd**

```js
/* 於 derive() 內 critDmg 之後加入 */
const wspd=w?(w.spd||1.2):1.2;
const aspd=Math.round(wspd*(1-Math.min(0.30,b.dex*0.004))*100)/100;
```
回傳物件加 `aspd`。`snapshot()`（index.html:1167）回傳加 `aspd:d.aspd`。

- [x] **Step 4: mobInst / towerMob 加 spd**

```js
/* mobInst，ngScale(mob) 之前 */
mob.spd=(BOSS_AI[id]&&BOSS_AI[id].spd)||(m[9]?2.4:1.6);
if(mob.el==='wind')mob.spd=Math.round(mob.spd*0.85*100)/100;
/* towerMob 的 mob 物件字面量內 */
spd:lord?2.2:1.7,
```

- [x] **Step 5: 驗證**：`node -e` 載入測試 harness（仿 fulltest.js 前 30 行）檢查：全部武器有 spd>0、全部 SKILLS 有 cd>0、`derive().aspd>0`、`mobInst('boss_witch').spd===2.4`。

- [x] **Step 6: Commit** `git commit -m "feat: 攻速資料層——武器spd/技能cd/derive aspd/怪物spd"`

---

### Task 2: battleTick 核心——即時計時器與怪物攻擊抽離

**Files:**
- Modify: `index.html:1630-1635`（startBattle）、`1714-1733`（pStunned/pAttack）、`1768-1884`（afterPlayerTurn/compTurn/mobTurn → 全部改寫）、`2531-2539`（主 interval）、`2625-2680`（gameTick 瘦身）

**Interfaces:**
- Consumes: Task 1 的 `derive().aspd`、`mob.spd`。
- Produces: `battleTick()`（每 100ms 推進一個戰鬥 tick，全域可呼叫——測試靠它驅動）、`mobAttack(mob,d,cs)`、`compAct(cs,d)`、`checkBattleEnd()`、`pAtkItv()`。**刪除** `afterPlayerTurn/compTurn/mobTurn/pStunned`。

- [x] **Step 1: startBattle 新欄位**

```js
function startBattle(mobs,floor){
  battle={mobs,tgt:0,buffs:[],t:0,floor:floor||0,pDb:{wk:0,ab:0,fe:0},
    pCd:5,gcd:0,skCd:{},potCd:0,fleeCd:0,pPois:0,pStun:0,compCd:15,dirty:0};
  for(const mb of mobs){
    mb.cd=Math.max(4,Math.round(mb.spd*10))+R(0,8);          /* 錯開首擊 */
    if(mb.ai&&mb.ai.nuke)mb.nukeCd=Math.round(mb.ai.nuke.cd*10*0.6);
  }
  const names=mobs.map(x=>`【${x.n}】Lv.${x.lv}`).join('、');
  log(`<span class="red">遭遇了${mobs.length>1?' '+mobs.length+' 個敵人：':''}${names}！</span>`);
  renderLoc();renderStatus();
}
```

- [x] **Step 2: 主 interval 改造（index.html:2531）**

```js
let nextTickAt=0;
setInterval(()=>{
  if(!S||$('screen-game').style.display==='none')return;
  const now=Date.now();
  const fast=S.hasteUntil&&now<S.hasteUntil;
  if(battle){const n=fast?2:1;for(let i=0;i<n&&battle;i++)battleTick();return}
  if(now<nextTickAt)return;
  nextTickAt=now+(fast?500:800);
  gameTick();
},100);
```
時空加速卷軸在戰鬥中＝1.6 倍快轉（雙方等比例加速，掛機效率提升）；非戰鬥維持原節奏。

- [x] **Step 3: pAttack 改冷卻制、pStunned 刪除**

```js
function pAtkItv(){const d=derive();let v=d.aspd*10;if(battle&&buffVal('haste')>1)v*=0.6;return Math.max(4,Math.round(v))}
function pAttack(){
  if(!battle||battle.pCd>0||battle.pStun>0)return;
  const t=curTarget();if(!t){checkBattleEnd();return}
  const d=derive();
  dealTo(t,null,'攻擊');
  if(t.hp>0&&d.dbl&&Math.random()<d.dbl)dealTo(t,null,'連擊');
  battle.pCd=pAtkItv();
  battle.dirty=1;
  checkBattleEnd();
}
function checkBattleEnd(){
  if(!battle)return true;
  if(!aliveMobs().length){winBattle();return true}
  if(S.hp<=0){playerDie();return true}
  return false;
}
```
「加速追擊」邏輯刪除（haste 已改為加攻速）。

- [x] **Step 4: mobAttack／compAct 抽離**（邏輯自 mobTurn/compTurn 原樣搬移，回合字眼改掉）

```js
function compAct(cs,d){
  if(cs.role==='heal'&&S.hp<d.maxHp*0.9){
    S.hp=Math.min(d.maxHp,S.hp+cs.heal);
    log(`<span class="green">${cs.n} 治療了你 ${cs.heal} 點生命。</span>`);return;
  }
  const t=curTarget();if(!t)return;
  const mult=cs.role==='dps'?1:0.5;
  let dmg=Math.max(1,Math.floor(cs.atk*mult-t.def/2+R(-2,2)));
  if(t.dr)dmg=Math.max(1,dmg-t.dr);
  t.hp-=dmg;
  log(`${cs.n} 攻擊 ${t.n}，造成 <b class="gold">${dmg}</b> 傷害。`);
  battle.dirty=1;
}
function mobAttack(mob,d,cs){
  /* 盾衛掩護 60% */
  if(cs&&cs.role==='tank'&&S.compHp>0&&R(1,100)<=60){
    let dmg=Math.max(1,Math.floor(mob.atk-cs.def/2+R(-2,2)));
    S.compHp-=dmg;
    log(`${cs.n} 挺身格擋！${mob.n} 對他造成 <b class="red">${dmg}</b> 傷害。`);
    if(S.compHp<=0){S.compHp=0;log(`<span class="red">${cs.n} 倒下了！（回到城鎮休息可恢復）</span>`);}
    return;
  }
  const evaP=mob.el==='light'?0:Math.min(75,d.eva*buffVal('eva'));
  if(R(1,100)<=evaP){log(`<span class="green">${mob.n} 的攻擊被你敏捷地閃開了！</span>`);return}
  let pdef=d.def*buffVal('def');
  if(battle.pDb&&battle.pDb.ab>0)pdef*=0.7;
  let dmg=Math.max(1,Math.floor(mob.atk-pdef/2+R(-2,2)));
  let bcrit=false;
  if(mob.ai&&mob.ai.crit&&R(1,100)<=mob.ai.crit){bcrit=true;dmg=Math.floor(dmg*1.6);}
  if(mob.el&&hasEnchA('resist'))dmg=Math.max(1,Math.floor(dmg*0.8));
  S.hp-=dmg;
  log(`${mob.n} ${mob.el==='light'?'的必中聖光':''}攻擊你，造成 <b class="red">${dmg}</b> 傷害${bcrit?'<span class="red">（爆擊！）</span>':''}。`);
  if(mob.el==='dark'){
    const dr2=Math.max(1,Math.floor(dmg/2));
    mob.hp=Math.min(mob.maxHp,mob.hp+dr2);
    log(`<span class="purple">${mob.n} 汲取了你的生命（自身回復 ${dr2}）。</span>`);
  }
  if(mob.fx==='poison'&&R(1,100)<=25){
    if(hasEnchA('antipoison')&&R(1,100)<=75)log('<span class="green">［抗毒］附魔抵擋了毒素！</span>');
    else if(battle.pPois<=0){battle.pPois=60;log('<span class="purple">☠ 你中毒了！（持續 6 秒）</span>');}
  }
  if(mob.fx==='stun'&&R(1,100)<=25){
    if(hasEnchA('antistun')&&R(1,100)<=75)log('<span class="green">［抗暈］附魔穩住了你的意識！</span>');
    else{battle.pStun=15;log('<span class="purple">💫 你被震得眼冒金星，短暫無法行動！</span>');}
  }
}
```

- [x] **Step 5: battleTick 主體**（取代 afterPlayerTurn/mobTurn；首領 AI 掛鉤 `bossAct` 於 Task 5 實作，本 Task 先留呼叫點）

```js
function battleTick(){
  if(!battle)return;
  const d=derive();
  battle.t++;const T=battle.t;
  /* 玩家計時 */
  if(battle.pStun>0)battle.pStun--;else if(battle.pCd>0)battle.pCd--;
  if(battle.gcd>0)battle.gcd--;
  if(battle.potCd>0)battle.potCd--;
  if(battle.fleeCd>0)battle.fleeCd--;
  for(const k in battle.skCd)if(battle.skCd[k]>0)battle.skCd[k]--;
  /* 玩家中毒（每 2 秒一跳） */
  if(battle.pPois>0){
    battle.pPois--;
    if(battle.pPois%20===0){
      let pd=Math.max(1,Math.floor(d.maxHp*0.04));
      if(hasEnchA('antipoison'))pd=Math.max(1,Math.floor(pd/2));
      S.hp-=pd;
      log(`<span class="purple">毒素侵蝕著你，損失 ${pd} 生命${battle.pPois?'':'，毒性已解'}。</span>`);
      if(checkBattleEnd())return;
    }
  }
  /* buff／詛咒倒數 */
  let uiSt=false;
  battle.buffs.forEach(b=>b.t--);
  battle.buffs=battle.buffs.filter(b=>{if(b.t>0)return true;log(`<span class="dim">「${b.n}」的效果消退了。</span>`);uiSt=true;return false});
  for(const k in battle.pDb)if(battle.pDb[k]>0){battle.pDb[k]--;
    if(battle.pDb[k]===0){log(`<span class="dim">${BOSS_DB[k].ic}【${BOSS_DB[k].n}】的效果消退了。</span>`);uiSt=true;}}
  if(uiSt)battle.dirty=1;
  /* 掛機：自動普攻＋每秒決策 */
  const auto=$('auto-battle').checked;
  if(auto&&battle.pCd<=0&&battle.pStun<=0){pAttack();if(!battle)return}
  if(T%10===0){
    battleUpkeep(d);if(!battle)return;
    if(auto){autoAction();if(!battle)return}
  }
  /* 夥伴（2 秒一動） */
  const cs=compStats();
  if(cs&&S.compHp>0&&--battle.compCd<=0){compAct(cs,d);battle.compCd=20;if(checkBattleEnd())return}
  /* 怪物迴圈：各自計時 */
  for(const mob of battle.mobs){
    if(mob.hp<=0)continue;
    if(mob.pois>0){
      mob.pois--;
      if(mob.pois%20===0){
        const pd=Math.max(1,Math.floor(mob.maxHp*0.05));
        mob.hp-=pd;
        log(`<span class="purple">${mob.n} 毒發，損失 ${pd} 生命。</span>`);
        if(mob.hp<=0){log(`<span class="gold">${mob.n} 被毒液侵蝕而倒下！</span>`);battle.dirty=1;continue}
      }
    }
    if(mob.el==='water'&&T%20===0&&mob.hp<mob.maxHp)
      mob.hp=Math.min(mob.maxHp,mob.hp+Math.max(1,Math.floor(mob.maxHp*0.02)));
    if(mob.rg&&T%30===0&&mob.hp<mob.maxHp){
      const hv=Math.max(1,Math.floor(mob.maxHp*mob.rg));
      mob.hp=Math.min(mob.maxHp,mob.hp+hv);
      log(`<span class="red">${mob.n} 體內的黑暗力量湧動，恢復了 ${hv} 生命！</span>`);
    }
    if(mob.stun>0){mob.stun--;continue}
    if(mob.cast>0){mob.cast--;if(mob.cast===0){nukeHit(mob,d);if(checkBattleEnd())return}continue}
    if(mob.nukeCd>0)mob.nukeCd--;
    if(--mob.cd<=0){
      mob.cd=Math.max(4,Math.round(mob.spd*10));
      if(mob.ai&&bossAct(mob))continue;      /* 首領 AI 佔用行動則跳過普攻 */
      mobAttack(mob,d,cs);
      if(checkBattleEnd())return;
    }
  }
  if(checkBattleEnd())return;
  /* 重繪：狀態變化→全量；否則每 0.2 秒輕量 */
  if(battle.dirty){battle.dirty=0;renderBattle();renderStatus();renderComp();}
  else if(T%2===0)renderBattleDyn();
  if(T%10===0)renderStatus();
}
```
`battleUpkeep(d)`＝原 gameTick 戰鬥分支的自動喝藥／魔力藥水／餵夥伴／加速藥水，整段搬入（喝藥處尊重 `battle.potCd`）；`bossAct`/`nukeHit`/`renderBattleDyn` 本 Task 先放空殼（`function bossAct(){return false}` 等），Task 4/5 填實。

- [x] **Step 6: gameTick 瘦身**：刪除 `if(battle){...}` 整個分支（battleTick 接手），保留非戰鬥分支（自然恢復、自動探索、autoRestock、時空續用）。

- [x] **Step 7: dealTo 支援 dr 與吟唱打斷**（dr 在 pHitDmg 減防後、保底前：`if(mob.dr)dmg-=mob.dr;`；`sk.stun`／麻痺附魔命中時：王機率減半、若 `mob.cast>0` 則 `mob.cast=0;mob.nukeCd=Math.round(mob.ai.nuke.cd*5);log('打斷吟唱！')`；暈眩值 `mob.stun=15`）。

- [x] **Step 8: tryFlee／useIt 解耦**（tryFlee 失敗→`battle.fleeCd=50`、不再呼叫 mobTurn；useIt 戰鬥中 heal/mp/full 檢查 `battle.potCd>0` 則提示「喝得太急」並 return，成功後 `battle.potCd=15`；haste buff push 改 `{n:'加速',stat:'haste',mult:2,t:def.turns*20}`；移除 `afterPlayerTurn()` 呼叫）。castSkill 改 GCD/CD 制（見規格；buff push `t:sk.turns*20`；不再呼叫 afterPlayerTurn；施放後 `battle.dirty=1;checkBattleEnd()`）。

- [x] **Step 9: 驗證**：node harness 開一場戰鬥，勾 auto-battle 後 `while(battle&&n++<20000)battleTick()` 能勝利結束；手動模式 `pAttack()` 連點兩次第二次無效（pCd>0）。

- [x] **Step 10: Commit** `git commit -m "feat: 即時制戰鬥核心——battleTick/攻速冷卻/狀態時間化"`

---

### Task 3: 戰鬥 UI——靜態骨架＋輕量動態更新

**Files:**
- Modify: `index.html:1645-1672`（renderBattle）＋新增 `renderBattleDyn()`

**Interfaces:**
- Consumes: `battle.pCd/gcd/skCd/pStun`、`mob.cast/stun/pois/dr/rg`。
- Produces: `renderBattleDyn()`（每 0.2 秒被 battleTick 呼叫）；動態元素 id：`btn-atk`、`btn-sk-<id>`、`mobhp-<i>`、`mobst-<i>`。

- [x] **Step 1: renderBattle 加 id 與冷卻顯示**：攻擊鈕 `id="btn-atk"`、技能鈕 `id="btn-sk-${id}"`（disabled 條件加上 `battle.gcd>0||(battle.skCd[id]||0)>0`）；怪卡血條外層 `id="mobhp-${i}"`、狀態列 `id="mobst-${i}"`；吟唱中怪卡顯示 `⚠ 凝聚力量`；提示文字更新（「點下方敵人卡片可切換目標；技能有冷卻；手動模式請自行點擊攻擊」）。

- [x] **Step 2: renderBattleDyn 實作**

```js
function renderBattleDyn(){
  if(!battle)return;
  battle.mobs.forEach((mob,i)=>{
    const bar=$('mobhp-'+i),st=$('mobst-'+i);
    if(!bar)return;
    if(mob.hp<=0){battle.dirty=1;return}
    bar.innerHTML=`<div style="background:#7a2f2f;width:${100*mob.hp/mob.maxHp}%"></div><span style="line-height:11px;font-size:10px">${mob.hp} / ${mob.maxHp}</span>`;
    st.innerHTML=(mob.boss?'<span class="red">☠首領 </span>':'')+(mob.cast>0?`<span class="red">⚠凝聚力量 ${(mob.cast/10).toFixed(1)}s </span>`:'')+
      (mob.stun>0?'<span class="purple">暈眩 </span>':'')+(mob.pois>0?'<span class="purple">中毒 </span>':'');
  });
  const ab=$('btn-atk');
  if(ab){const rdy=battle.pCd<=0&&battle.pStun<=0;ab.disabled=!rdy;
    ab.textContent=battle.pStun>0?'💫 暈眩':(rdy?'⚔ 攻擊':`⚔ ${(battle.pCd/10).toFixed(1)}s`);}
  for(const id in SKILLS){const btn=$('btn-sk-'+id);if(!btn)continue;
    const cd=Math.max(battle.gcd,battle.skCd[id]||0);
    btn.disabled=S.mp<SKILLS[id].mp||cd>0;}
  const hp=$('st-hpbar');/* 若玩家血條有獨立元素則同步；否則靠 renderStatus 每秒更新 */
}
```
（實作時以現有 renderStatus 的血條元素 id 為準，沒有就略過玩家列。）

- [x] **Step 3: 驗證**：瀏覽器 file:// 開遊戲實戰一場——血條流暢更新、按鈕冷卻倒數顯示、點擊切換目標仍有效、怪死亡觸發全量重繪不殘留。

- [x] **Step 4: Commit** `git commit -m "feat: 戰鬥UI即時化——冷卻顯示與輕量重繪"`

---

### Task 4: autoAction 即時化＋battleUpkeep

**Files:**
- Modify: `index.html:2592-2611`（autoAction）＋ battleUpkeep 填實（Task 2 空殼）

**Interfaces:**
- Consumes: `battle.gcd/skCd/potCd`、`mob.cast`。
- Produces: `autoAction()`（每秒由 battleTick 呼叫）、`battleUpkeep(d)`。

- [x] **Step 1: battleUpkeep**（原 gameTick 戰鬥分支搬入，喝藥處加 `battle.potCd<=0` 條件；新增吟唱應對：`if(battle.mobs.some(m=>m.cast>0)&&S.hp<d.maxHp*0.9)` 提前喝藥）。

- [x] **Step 2: autoAction 調整**：開場 buff 條件 `battle.turn<1` → `battle.t<30`；每個 castSkill 前檢查 `battle.gcd<=0&&(battle.skCd[id]||0)<=0`（過濾可用技能清單）；其餘優先序邏輯保留（補血→開場 buff→AOE→單體→普攻改為不做事，普攻由 battleTick 自動）。

- [x] **Step 3: 驗證**：node harness 掛機打首領戰，確認技能有施放（MP 有消耗）、藥水有喝、戰鬥能勝利。

- [x] **Step 4: Commit** `git commit -m "feat: 掛機智慧施法即時化"`

---

### Task 5: 首領全面改版——hpm/dr/rg/大招吟唱（32 王一次到位）

**Files:**
- Modify: `index.html:684-701`（BOSS_AI）、`1539-1550`（mobInst 套用 bossDefaults）＋ `bossAct()`/`nukeHit()` 填實

**Interfaces:**
- Consumes: Task 2 的 `bossAct(mob)`（回傳 true＝本次行動被 AI 佔用）、`nukeHit(mob,d)` 呼叫點。
- Produces: `bossDefaults(lv)`；mob 新欄位 `dr/rg/hpm 已乘入 maxHp/nukeCd/cast`。

- [x] **Step 1: bossDefaults 與 mobInst 套用**

```js
function bossDefaults(lv){
  return {hpm:lv<15?3:lv<30?4:lv<50?5:5.5,
          dr:Math.floor(lv*0.5),
          rg:lv<15?0.006:lv<30?0.008:lv<50?0.010:0.012,
          nuke:lv>=15?{cd:25,mult:2.8}:null};
}
/* mobInst 內，boss 時（plain 亦套用——首領戰不因前期地圖而弱化）： */
if(m[9]){
  const bd=bossDefaults(m[1]),ai=BOSS_AI[id]||{};
  mob.maxHp=Math.floor(mob.maxHp*(ai.hpm||bd.hpm));mob.hp=mob.maxHp;
  mob.dr=ai.dr!=null?ai.dr:bd.dr;
  mob.rg=ai.rg!=null?ai.rg:bd.rg;
  mob.nuke=ai.nuke!==undefined?ai.nuke:bd.nuke;
  mob.ai=mob.ai||{};                    /* 確保 boss 都走 bossAct */
}
```
注意：mobInst 的 `plain` 參數目前會把 boss 的 ai 淘空——首領（m[9]）一律保留 ai 與上述強化（修改 `ai:plain?null:...` 為 boss 例外）。

- [x] **Step 2: 個別王覆蓋與大招風味名**（BOSS_AI 追加欄位；未列者用 bossDefaults）

```js
/* 覆蓋原則：招牌王更兇、劇情前期王溫和。nuke.n 為大招名。 */
boss_witch:{...現有,spd:2.2,nuke:{cd:22,mult:3.0,n:'魔窟殘影'}},
boss_sauron:{...現有,nuke:{cd:22,mult:3.0,n:'巴拉多的注視'}},
boss_smaug:{...現有,spd:2.6,nuke:{cd:20,mult:3.4,n:'烈焰吐息',aoe:1}},
boss_balrog:{...現有,nuke:{cd:24,mult:2.8,n:'炎魔火鞭'}},
boss_glaurung:{...現有,nuke:{cd:20,mult:3.2,n:'龍父魔眼'}},
boss_ancalagon:{...現有,spd:2.8,nuke:{cd:18,mult:3.6,n:'遮天龍炎',aoe:1}},
boss_morgoth:{...現有,spd:2.8,hpm:6,rg:0.014,nuke:{cd:18,mult:3.6,n:'格龍德碎地錘'}},
/* 其餘 25 王沿用 bossDefaults，nuke.n 預設『毀滅重擊』 */
```

- [x] **Step 3: bossAct / nukeHit**

```js
function bossAct(mob){         /* 行動點到時呼叫；回傳 true＝佔用本次攻擊 */
  const ai=mob.ai;
  if(ai.hl&&mob.heals>0&&mob.hp<mob.maxHp*ai.hl[1]/100){
    mob.heals--;
    const hv=Math.floor(mob.maxHp*ai.hl[2]/100);
    mob.hp=Math.min(mob.maxHp,mob.hp+hv);
    log(`<span class="red">${mob.n} 灌下一瓶藥水，恢復了 ${hv} 生命！${mob.heals?'':'（藥水喝完了）'}</span>`);
    battle.dirty=1;return true;
  }
  if(ai.rage&&!mob.raged&&mob.hp<mob.maxHp*ai.rage/100){
    mob.raged=true;mob.atk=Math.floor(mob.atk*1.35);mob.spd=Math.round(mob.spd*0.75*100)/100;
    log(`<span class="red">${mob.n} 陷入狂暴，攻擊與速度大幅上升！</span>`);battle.dirty=1;
  }
  if(mob.nuke&&mob.nukeCd<=0){
    mob.cast=30;mob.nukeCd=mob.nuke.cd*10;
    log(`<span class="red">⚠ ${mob.n} 開始凝聚毀滅的力量——「${mob.nuke.n||'毀滅重擊'}」即將落下（3 秒）！</span>`);
    battle.dirty=1;return true;
  }
  if(ai.db&&battle.pDb[ai.db[0]]<=0&&R(1,100)<=ai.db[1]){
    const t=ai.db[0],info=BOSS_DB[t];
    battle.pDb[t]=80;
    log(`<span class="red">${mob.n} ${info.cast[mob.id]||'施放了'+info.n}！${info.ic}【${info.n}】——${info.d}（8 秒）！</span>`);
    battle.dirty=1;return true;
  }
  return false;
}
function nukeHit(mob,d){
  let pdef=d.def*buffVal('def');
  let dmg=Math.max(1,Math.floor(mob.atk*mob.nuke.mult-pdef/4));
  S.hp-=dmg;
  log(`<span class="red" style="font-size:15px">💥 「${mob.nuke.n||'毀滅重擊'}」轟然落下！你受到 ${dmg} 傷害！</span>`);
  battle.dirty=1;
}
```
詛咒持續時間文字「3 回合」→「8 秒」（BOSS_DB 的 d 不用改，log 處已改）。

- [x] **Step 4: 平衡驗證（balance_sim 重寫前的粗檢）**：node harness 以「該章適正等級＋不強化裝備」與「＋6 強化」各打 boss_witch／boss_smaug／boss_morgoth，記錄擊殺秒數；目標：不強化 DPS 追不上回血（打不死）或 120 秒以上，+6 強化 60~120 秒內獲勝。調 `rg`/`hpm` 至達標。

- [x] **Step 5: Commit** `git commit -m "feat: 首領全面改版——血量/固定減傷/回血/大招吟唱"`

---

### Task 6: 掉落物獨立視窗

**Files:**
- Modify: `index.html:223-226`（log-panel 後加 drop-panel）、`log()` 附近新增 `dropMsg()`、`winBattle()`、`rollQl()`、`checkOffline()`、`applyHunt()`

**Interfaces:**
- Produces: `dropMsg(html)`；HTML 元素 `#droplog`。

- [x] **Step 1: HTML**（中欄 log-panel 之後）

```html
<div class="panel" id="drop-panel">
  <div class="phead" style="font-size:13px">🎒 拾獲的戰利品</div>
  <div id="droplog" style="padding:6px 10px;overflow-y:auto;max-height:110px;font-size:13px"></div>
</div>
```
CSS：`#log-panel` 若有固定高度需讓出空間（實作時檢查 `#col-c` flex 設定，drop-panel 固定 ~150px）。

- [x] **Step 2: dropMsg**

```js
function dropMsg(html){const el=$('droplog');if(!el)return;const p=document.createElement('p');p.innerHTML=html;
  el.appendChild(p);while(el.childNodes.length>100)el.removeChild(el.firstChild);el.scrollTop=el.scrollHeight;}
```

- [x] **Step 3: 改道**：`winBattle` 掉落行、`rollQl` 品質詞綴行、`checkOffline` 拾獲行、`applyHunt` 隊伍掉落行 → `dropMsg(...)`（金幣/經驗/升級/劇情獎勵留主日誌）。

- [x] **Step 4: 驗證**：實戰擊殺有掉落的怪，確認掉落只出現在拾獲面板；離線結算同理。

- [x] **Step 5: Commit** `git commit -m "feat: 掉落物獨立拾獲面板"`

---

### Task 7: 週邊系統——離線公式、決鬥/組隊攻速加權

**Files:**
- Modify: `index.html:2542-2590`（checkOffline）、`2860-2891`（duel）、`2893-2939`（partyHunt）

**Interfaces:**
- Consumes: `snapshot().aspd`（舊快照守衛 `||1.2`）。

- [x] **Step 1: checkOffline**：`const secPerKill=hits*d.aspd+3;`（原 `(hits+3)*0.8`）。

- [x] **Step 2: 決鬥/狩獵攻速加權**（回合模擬保留，出手次數按攻速累積）

```js
/* runDuel 迴圈改： */
me.acc=0;op.acc=0;me.aspd=me.aspd||1.2;op.aspd=op.aspd||1.2;
for(let t=0;t<60&&me.chp>0&&op.chp>0;t++){
  for(const f of [a,b]){
    if(me.chp<=0||op.chp<=0)break;
    f.acc+=1.2/f.aspd;
    while(f.acc>=1&&me.chp>0&&op.chp>0){f.acc--;simAttack(f,f===me?op:me,lines);}
  }
}
/* partyHunt 同法：每輪 f.acc+=1.2/(f.aspd||1.2)，怪物每輪一擊不變 */
```

- [x] **Step 3: 驗證**：wstest 連線協定測試照跑；手動模擬 runDuel（快照帶/不帶 aspd 各一）不拋錯。

- [x] **Step 4: Commit** `git commit -m "feat: 離線/決鬥/組隊狩獵接上攻速"`

---

### Task 8: 測試工具全面更新

**Files:**
- Modify: `tools/fulltest.js`、`tools/gametest.js`、`tools/balance_sim.js`

**Interfaces:**
- Consumes: `battleTick()`、`battle.skCd/gcd`、`mob.dr/rg/nuke`。

- [x] **Step 1: fulltest.js 驅動改造**：exports 的 `mobTurn` 換成 `battleTick,mobAttack,bossAct`；開頭設 `document.getElementById('auto-battle').checked=true`；所有 `F.pAttack()` 戰鬥迴圈改：

```js
function fight(keepHp){let g=0;while(G.battle&&g++<60000){
  const dd=F.derive();if(keepHp&&G.S.hp<dd.maxHp*0.5)G.S.hp=dd.maxHp;F.battleTick();}}
```
首領 AI 測試（喝藥/狂暴）改為壓血後 `fight(true)` 完再驗旗標；技能測試在戰鬥中直接 `F.castSkill` 前先歸零 `G.battle.gcd`。

- [x] **Step 2: 新增測試項**：全武器有 spd、全技能有 cd、`derive().aspd` 合理（0.6~1.7）、王有 dr/rg/hpm 生效（`mobInst('boss_witch').maxHp>MOBS 原值*3`）、大招吟唱會發動（強制 `nukeCd=0` 跑 tick 後 `cast>0`）、藥水冷卻擋連喝、掉落走 dropMsg（fakeEl 檢查 droplog 有子節點）。

- [x] **Step 3: gametest.js（冒煙）同步改驅動**。

- [x] **Step 4: balance_sim.js 重寫為即時模擬**：對 RUSH_LIST 每王，以「適正等級（王 lv+2）＋該章商店最佳裝 ±強化 0/+6」模擬（直接用 battleTick 驅動，掛機全開、藥水無限），輸出表：王名｜不強化結果（勝/敗/超時）｜+6 秒數。目標分佈：不強化多數打不過、+6 全過且 <150 秒。以此表微調 BOSS_AI。

- [x] **Step 5: 跑 `/run-tests` 全綠。Commit** `git commit -m "test: 測試工具即時制改造＋首領平衡模擬"`

---

### Task 9: 文件與收尾

**Files:**
- Modify: `index.html`（能力頁顯示攻速）、`遊戲說明.md`、`開發紀錄.md`
- 執行：`/update-codex`、`/gen-maxsave`、`/run-tests`

- [x] **Step 1: 能力頁顯示攻速**（renderTabs stats 區加「攻擊速度：X.XX 秒/擊（每秒 Y 次）」）。
- [x] **Step 2: 遊戲說明.md**：戰鬥章節改寫（即時制、攻速、技能冷卻、大招吟唱與打斷、手動/掛機差異、拾獲面板）。
- [x] **Step 3: 開發紀錄.md 加 v18 條目**（含教訓：回合→即時的狀態時間換算表）。
- [x] **Step 4: `/update-codex`（圖鑑加武器攻速欄）、`/gen-maxsave` 重產驗證檔。**
- [x] **Step 5: `/run-tests` 全綠後 Commit** `git commit -m "v18 即時制戰鬥＋首領改版＋拾獲面板"`
- [x] **Step 6: 瀏覽器實測**：新角開場打前兩章、讀滿級檔打魔苟斯（大招/回血/打斷全流程）、傳說的迴廊前 3 戰、手動模式體感。

---

## Self-Review 紀錄

- 規格覆蓋：使用者三決定（掛機全自動含技能=Task 2/4；手動純手動=Task 2 Step 3；掉落視窗=Task 6；全王一次到位=Task 5）✓；即時制＋攻速=Task 1/2 ✓；王耐玩=Task 5 ✓。
- 相依順序：Task 1→2→(3,4,5,6 可並行)→7→8→9。Task 2 留 bossAct/nukeHit/renderBattleDyn 空殼避免前向引用。
- 型別一致：`battle.pPois/pStun/pCd/gcd/skCd/potCd/fleeCd/compCd/t/dirty`、`mob.spd/cd/cast/nukeCd/dr/rg/nuke/pois/stun` 全計畫統一。
- 存檔相容：S 無新欄位；battle 不入檔；快照 aspd 有守衛——無需 migrate。
