/* 從 index.html 的遊戲資料自動產生「物品與怪物圖鑑.md」 */
'use strict';
const fs = require('fs');
function fakeEl(id){ const el={id,style:{},_html:'',textContent:'',value:'',checked:false,children:[],childNodes:[],
  classList:{add(){},remove(){},toggle(){}},appendChild(c){this.childNodes.push(c)},removeChild(){},
  scrollTop:0,scrollHeight:0,disabled:false};
  Object.defineProperty(el,'innerHTML',{get(){return this._html},set(v){this._html=v;this.childNodes=[]}});
  Object.defineProperty(el,'firstChild',{get(){return this.childNodes[0]}});
  return el; }
const els=new Map();
const document={getElementById(id){if(!els.has(id))els.set(id,fakeEl(id));return els.get(id)},
  createElement(){return fakeEl('x'+Math.random())},querySelectorAll(){return[]},querySelector(){return null},
  body:fakeEl('body')};
const localStorage={getItem(){return null},setItem(){},removeItem(){}};
const window={addEventListener(){}};
const html=fs.readFileSync('D:/魔戒文字版/index.html','utf8');
const m=html.match(/<script>\r?\n([\s\S]*?)<\/script>/);
const G=eval(`(function(document,localStorage,window,alert,confirm,prompt,setInterval){${m[1]}
;return {RACES,SKILLS,ITEMS,MOBS,MAPS,QUESTS,SHOP_TIER,STAT_N,RECIPES,ELEMS,ENCH_W,ENCH_A};})`)(document,localStorage,window,()=>{},()=>true,()=>null,()=>1);

const {ITEMS,MOBS,MAPS,SHOP_TIER,STAT_N,RACES,SKILLS,RECIPES,ELEMS,ENCH_W,ENCH_A}=G;
const TYPE_N={weapon:'武器',armor:'鎧甲',cloak:'斗篷',acc:'飾品',use:'消耗品',scroll:'卷軸',mat:'材料',quest:'任務道具'};
function stats(d){const L=[];
  if(d.atk)L.push('攻擊 +'+d.atk);if(d.t==='weapon')L.push('攻速 '+(d.spd||1.2)+'s');if(d.def)L.push('防禦 +'+d.def);if(d.mag)L.push('魔力 +'+d.mag);
  for(const k in STAT_N)if(d[k])L.push(STAT_N[k]+' +'+d[k]);
  if(d.eva)L.push('閃避 +'+d.eva+'%');
  if(d.orcbane)L.push('對半獸人類傷害 +50%');
  if(d.dbl)L.push(Math.round(d.dbl*100)+'% 連擊');
  if(d.heal)L.push('恢復 '+d.heal+' HP');if(d.mp)L.push('恢復 '+d.mp+' MP');
  if(d.full)L.push('完全恢復');
  if(d.buff==='haste')L.push((d.turns*2)+' 秒內攻擊速度大幅提升');
  if(d.home)L.push('回到最近城鎮');
  if(d.en)L.push('強化'+(d.en==='weapon'?'武器':'鎧甲')+(d.bless?'（失敗不損毀）':''));
  return L.join('、')||'—';}
function source(id){const src=[];
  for(const tier in SHOP_TIER)if(SHOP_TIER[tier].includes(id)){
    const towns=Object.keys(MAPS).filter(k=>MAPS[k].town&&MAPS[k].tier==tier).map(k=>MAPS[k].n.split(' ·')[0]);
    src.push('商店（'+towns.join('、')+'）');}
  const from=[];
  for(const mid in MOBS)for(const dr of MOBS[mid][7])if(dr[0]===id)from.push(`${MOBS[mid][0]} ${dr[1]}%`);
  if(from.length)src.push('掉落：'+from.join('、'));
  if(id==='ring_one')src.push('主線第六章獲得');
  if(id==='c_elven')src.push('主線第十章獲得');
  for(const r of RECIPES)if(r.out===id)src.push('工房合成');
  return src.join('；')||'—';}

let out='# 魔戒 · 中土遠征 — 物品與怪物圖鑑\n\n（本檔由遊戲資料自動產生，遊戲內背包分頁的「📖 圖鑑」按鈕也可隨時查閱）\n';

out+='\n## 一、種族與技能\n';
for(const r in RACES){
  out+=`\n### ${RACES[r].n}\n${RACES[r].d}\n\n| 技能 | 習得等級 | 消耗MP | 效果 |\n|---|---|---|---|\n`;
  for(const id in SKILLS){const s=SKILLS[id];if(s.race!==r)continue;
    out+=`| ${s.n} | Lv.${s.lv} | ${s.mp} | ${s.d} |\n`;}
}
out+='\n## 二、物品\n';
for(const t of ['weapon','armor','cloak','acc','use','scroll','mat','quest']){
  out+=`\n### ${TYPE_N[t]}\n\n| 名稱 | 需求 | 效果 | 價格 | 取得方式 |\n|---|---|---|---|---|\n`;
  for(const id in ITEMS){const d=ITEMS[id];if(d.t!==t)continue;
    out+=`| ${d.n} | ${d.lv>1?'Lv.'+d.lv:'—'} | ${stats(d)} | ${d.pr||'非賣品'} | ${source(id)} |\n`;}
}
out+='\n各物品背景故事請見遊戲內點選說明。\n\n## 三、怪物\n\n**新手保護**：前八章地區（夏爾～摩瑞亞西門）出沒的敵人一律不帶屬性與特性、一次最多 3 隻；第九章摩瑞亞起表列屬性／特性完整生效、最多 5 隻成群。多隻圍攻時每隻攻擊力打折（2隻85%／3隻75%／4隻66%／5隻60%），經驗金幣照拿。\n\n屬性效果：🔥火＝攻擊+12%｜💧水＝持續再生｜🌪風＝較難命中且攻速較快｜⛰土＝防禦+25%｜☀光＝攻擊必中（無視閃避）｜🌑暗＝攻擊吸取生命。\n特性：☠毒／💫暈＝攻擊 25% 機率使你中毒（持續 6 秒扣血）／暈眩（1.5 秒無法行動），可用防具附魔抵抗。\n\n| 怪物 | 等級 | 屬性 | 特性 | HP | 攻 | 防 | 經驗 | 金幣 | 出沒地 | 掉落 |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const id in MOBS){const mo=MOBS[id];
  const hab=Object.keys(MAPS).filter(k=>(MAPS[k].mobs&&MAPS[k].mobs.includes(id))||MAPS[k].boss===id).map(k=>MAPS[k].n).join('、');
  const drops=mo[7].map(d=>`${ITEMS[d[0]].n} ${d[1]}%`).join('、');
  const el=mo[10]?ELEMS[mo[10]].ic+ELEMS[mo[10]].n:'—';
  const fx=mo[11]==='poison'?'☠毒':(mo[11]==='stun'?'💫暈':'—');
  out+=`| ${mo[9]?'☠ ':''}${mo[0]} | ${mo[1]} | ${el} | ${fx} | ${mo[2]} | ${mo[3]} | ${mo[4]} | ${mo[5]} | ${mo[6]} | ${hab||'—'} | ${drops||'—'} |\n`;}
out+='\n## 三之二、甘道夫的附魔（各城鎮，正義種子×5／次，效果隨機）\n\n**武器附魔（5 種）**\n\n';
for(const k in ENCH_W)out+=`- ［${ENCH_W[k].n}］${ENCH_W[k].d}\n`;
out+='\n**防具附魔（5 種，鎧甲與斗篷皆可）**\n\n';
for(const k in ENCH_A)out+=`- ［${ENCH_A[k].n}］${ENCH_A[k].d}\n`;
out+='\n正義種子由所有怪物掉落（22%，首領 100%）。重複附魔會覆蓋舊效果，可反覆洗到想要的。\n';

out+='\n## 四、工房合成配方（各城鎮「🔨 工房合成」）\n\n| 成品 | 材料 | 費用 |\n|---|---|---|\n';
for(const r of RECIPES){
  out+=`| ${ITEMS[r.out].n}${r.q>1?' ×'+r.q:''} | ${r.mats.map(m=>ITEMS[m[0]].n+'×'+m[1]).join('、')} | ${r.gold} 金 |\n`;
}
out+='\n## 五、主線章節一覽（共 '+G.QUESTS.length+' 章）\n\n';
G.QUESTS.forEach((q,i)=>{out+=`${i+1}. **${q.t}** — ${q.d}\n`;});
out+='\n## 六、強化規則（天堂式）\n\n- +1 ~ +3：必定成功\n- +4 ~ +6：60% 成功，失敗不損毀\n- +7 以上：33% 成功，**失敗裝備直接消失**（祝福卷軸失敗不損毀）\n- 武器每 +1 增加 2 攻擊；鎧甲每 +1 增加 1 防禦\n';
fs.writeFileSync('D:/魔戒文字版/物品與怪物圖鑑.md',out,'utf8');
console.log('圖鑑已產生，長度',out.length,'字');
