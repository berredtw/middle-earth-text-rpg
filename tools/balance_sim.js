/* 掛機可行性模擬：各地圖以「合理等級＋該階段商店裝備＋自動喝藥」掛機，統計死亡率
   用途：調整難度後跑一次，前八章每張圖死亡數應為 0~1（偶發），後期圖可接受略高 */
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
const localStorage={_s:{},getItem(k){return this._s[k]||null},setItem(k,v){this._s[k]=String(v)},removeItem(k){delete this._s[k]}};
const html=fs.readFileSync('D:/魔戒文字版/index.html','utf8');
const m=html.match(/<script>\r?\n([\s\S]*?)<\/script>/);
const G=eval(`(function(document,localStorage,window,alert,confirm,prompt,setInterval,location){${m[1]}
;return {get S(){return S},set S(v){S=v},get battle(){return battle},set battle(v){battle=v},
 fns:{newState,derive,enterGame,moveTo,gameTick,battleTick,addItem,gainExp,mobInst,startBattle},data:{MAPS}};})`)(
 document,localStorage,{addEventListener(){}},()=>{},()=>true,()=>null,()=>1,{reload(){}});
const F=G.fns;

/* 各地圖的「合理玩家」設定：抵達該圖時的等級與該階段買得到/打得到的裝備（不含夥伴、不含附魔） */
const SCENARIOS=[
  ['m_shire',     2, {weapon:['w_dagger',0], armor:['a_cloth',0],  cloak:null},        'p_herb'],
  ['m_oldforest', 6, {weapon:['w_bree',0],   armor:['a_leather',0],cloak:['c_travel',0]},'p_red'],
  ['m_weathertop',9, {weapon:['w_axe',2],    armor:['a_chain',0],  cloak:['c_travel',0]},'p_red'],
  ['m_ford',     11, {weapon:['w_ranger',0], armor:['a_chain',2],  cloak:['c_travel',0]},'p_red'],
  ['m_caradhras',13, {weapon:['w_sting',0],  armor:['a_rohan',0],  cloak:['c_travel',0]},'p_red'],
  ['m_gate',     15, {weapon:['w_sting',3],  armor:['a_rohan',2],  cloak:['c_elven',0]},'p_red'],
  // 第九章起（完整難度）對照組：預期玩家有夥伴與更好裝備，這裡先看無夥伴底線
  ['m_moria',    18, {weapon:['w_rohan',3],  armor:['a_rohan',3],  cloak:['c_elven',0]},'p_lembas'],
  ['m_rohan',    22, {weapon:['w_katana',3], armor:['a_lorien',3], cloak:['c_elven',0]},'p_lembas'],
  // 時光之門（後日談）：全破玩家＝約 Lv.45+ 起、傳說裝備＋能力點有分配（仍無夥伴無附魔，看底線）
  ['m_gondolin', 46, {weapon:['w_anduril',7],armor:['a_mithril',7],cloak:['c_galad',0]},'p_lembas',{str:22,dex:18,con:26,int:5,wis:8}],
  ['m_eregion',  48, {weapon:['w_anduril',8],armor:['a_mithril',8],cloak:['c_galad',0]},'p_lembas',{str:23,dex:19,con:27,int:5,wis:8}],
  ['m_ninekings',52, {weapon:['w_dramborleg',7],armor:['a_gondolin',7],cloak:['c_ulmo',0]},'p_lembas',{str:24,dex:20,con:28,int:5,wis:8}],
  ['m_numenor',  50, {weapon:['w_dramborleg',7],armor:['a_gondolin',7],cloak:['c_ulmo',0]},'p_lembas',{str:24,dex:20,con:28,int:5,wis:8}],
  ['m_barad',    52, {weapon:['w_dramborleg',8],armor:['a_gondolin',8],cloak:['c_ulmo',0]},'p_lembas',{str:25,dex:20,con:29,int:5,wis:8}],
  ['m_dagorlad', 53, {weapon:['w_dramborleg',8],armor:['a_numenor',7],cloak:['c_ulmo',0]},'p_lembas',{str:26,dex:21,con:29,int:5,wis:8}],
  ['m_gladden',  56, {weapon:['w_aeglos',7],   armor:['a_numenor',7], cloak:['c_ulmo',0]},'p_lembas',{str:27,dex:22,con:30,int:5,wis:8}],
  ['m_fornost',  62, {weapon:['w_aeglos',8],   armor:['a_numenor',8], cloak:['c_ulmo',0]},'p_lembas',{str:29,dex:23,con:32,int:5,wis:8}],
  // 哈比人外傳（Lv.55~66）
  ['m_trollshaw',57, {weapon:['w_aeglos',7],   armor:['a_numenor',8], cloak:['c_ulmo',0]},'p_lembas',{str:28,dex:22,con:31,int:5,wis:8}],
  ['m_goblintown',59,{weapon:['w_aeglos',8],   armor:['a_numenor',8], cloak:['c_ulmo',0]},'p_lembas',{str:29,dex:23,con:32,int:5,wis:8}],
  ['m_carrock',  60, {weapon:['w_aeglos',8],   armor:['a_numenor',8], cloak:['c_ulmo',0]},'p_lembas',{str:29,dex:23,con:32,int:5,wis:8}],
  ['m_mirkwood', 60, {weapon:['w_aeglos',8],   armor:['a_mirkwood',7],cloak:['c_ulmo',0]},'p_lembas',{str:30,dex:23,con:33,int:5,wis:8}],
  ['m_erebor',   62, {weapon:['w_blackarrow',7],armor:['a_mirkwood',8],cloak:['c_thranduil',0]},'p_lembas',{str:31,dex:24,con:34,int:5,wis:8}],
  ['m_dolout',   63, {weapon:['w_blackarrow',7],armor:['a_mirkwood',8],cloak:['c_thranduil',0]},'p_lembas',{str:31,dex:24,con:34,int:5,wis:8}],
  ['m_five',     64, {weapon:['w_thror',8],    armor:['a_erebor',7],  cloak:['c_thranduil',0]},'p_lembas',{str:32,dex:25,con:35,int:5,wis:8}],
  // 上古紀元（Lv.67~85）
  ['m_lamps',    68, {weapon:['w_gundabad',7], armor:['a_erebor',8],  cloak:['c_thranduil',0]},'p_lembas',{str:34,dex:26,con:37,int:5,wis:8}],
  ['m_cuivienen',70, {weapon:['w_gundabad',8], armor:['a_erebor',8],  cloak:['c_thranduil',0]},'p_lembas',{str:35,dex:27,con:38,int:5,wis:8}],
  ['m_march',    71, {weapon:['w_gundabad',8], armor:['a_erebor',8],  cloak:['c_thranduil',0]},'p_lembas',{str:35,dex:27,con:38,int:5,wis:8}],
  ['m_ezellohar',73, {weapon:['w_valinor',7],  armor:['a_valinor',7], cloak:['c_varda',0]},'p_lembas',{str:36,dex:28,con:39,int:5,wis:8}],
  ['m_mithrim',  77, {weapon:['w_dragonlord',7],armor:['a_voidsilk',7],cloak:['c_varda',0]},'p_lembas',{str:38,dex:29,con:41,int:5,wis:8}],
  ['m_bragollach',78,{weapon:['w_dragonlord',7],armor:['a_voidsilk',7],cloak:['c_varda',0]},'p_lembas',{str:38,dex:29,con:41,int:5,wis:8}],
  ['m_angbandgate',78,{weapon:['w_dragonlord',7],armor:['a_voidsilk',7],cloak:['c_luthien',0]},'p_lembas',{str:38,dex:29,con:41,int:5,wis:8}],
  ['m_nirnaeth', 79, {weapon:['w_gurthang',7], armor:['a_dragonhelm',7],cloak:['c_luthien',0]},'p_lembas',{str:39,dex:30,con:41,int:5,wis:8}],
  ['m_nargothrond',79,{weapon:['w_gurthang',7], armor:['a_voidsilk',8],cloak:['c_luthien',0]},'p_lembas',{str:39,dex:30,con:41,int:5,wis:8}],
  ['m_warwrath', 77, {weapon:['w_dragonlord',7],armor:['a_voidsilk',7],cloak:['c_varda',0]},'p_lembas',{str:38,dex:29,con:41,int:5,wis:8}],
  ['m_angband',  80, {weapon:['w_dragonlord',8],armor:['a_voidsilk',8],cloak:['c_varda',0]},'p_lembas',{str:39,dex:30,con:42,int:5,wis:8}],
];
const TICKS=1500;
console.log('地圖               等級  死亡  勝場   （'+TICKS+' 跳掛機、自動喝藥、無夥伴無附魔）');
let worstEarly=0;
for(const [mk,lv,eq,pot,base] of SCENARIOS){
  G.battle=null;   // 清掉上一場景殘留的戰鬥，否則移動被擋、死亡數會灌水
  G.S=F.newState('human',base||{str:9,dex:7,con:8,int:5,wis:5},'模擬俠');
  G.S.lv=lv;G.S.gold=0;G.S.ch=56;G.S.ringGone=true;   // 全圖解鎖以便測試（含全部三段外傳＋終幕）
  G.S.eq.weapon=eq.weapon?{id:eq.weapon[0],e:eq.weapon[1]}:null;
  G.S.eq.armor=eq.armor?{id:eq.armor[0],e:eq.armor[1]}:null;
  G.S.eq.cloak=eq.cloak?{id:eq.cloak[0],e:eq.cloak[1]}:null;
  G.S.comp=null;G.S.comps=[];
  F.addItem(pot,999);
  F.addItem('p_dew',999);   // 真實掛機玩家有自動補露水（魔力<30% 自動喝），基準模擬比照
  const d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;
  F.enterGame(true);
  document.getElementById('screen-game').style.display='flex';
  document.getElementById('auto-battle').checked=true;
  document.getElementById('auto-potion').checked=true;
  document.getElementById('auto-explore')&&0;
  document.getElementById('auto-hastepot').checked=false;
  document.getElementById('auto-time').checked=false;
  document.getElementById('auto-restock').checked=false;
  F.moveTo(mk);
  let deaths=0,wins=0,lastExp=0;
  for(let t=0;t<TICKS;t++){
    /* 即時制：戰鬥中一跳＝0.8 秒＝8 個戰鬥 tick；非戰鬥走放置循環 */
    if(G.battle){for(let k=0;k<8&&G.battle;k++)F.battleTick();}
    else F.gameTick();
    if(G.S.loc!==mk){                        // 死亡被送回城鎮
      deaths++;
      G.battle=null;
      document.getElementById('auto-battle').checked=true;   // 重新開掛（模擬玩家回來再掛）
      const dd=F.derive();G.S.hp=dd.maxHp;
      F.moveTo(mk);
    }
    if(G.S.exp>lastExp||G.S.lv>lv){wins++;lastExp=G.S.exp;}  // 粗略勝場計數
  }
  const early=G.data.MAPS[mk].ch<8, post=G.data.MAPS[mk].post;
  if(early)worstEarly=Math.max(worstEarly,deaths);
  console.log(`${mk.padEnd(14)} Lv.${String(lv).padEnd(3)} ${String(deaths).padEnd(4)} ${String(wins).padEnd(5)} ${early?'(前八章)':post?'(時光之門)':'(完整難度)'}`);
}
console.log(worstEarly<=1?'\n✓ 前八章掛機可行（死亡 ≤1）':'\n✗ 前八章仍會掛機暴斃，需再調整（最多死 '+worstEarly+' 次）');
if(worstEarly>1)process.exitCode=1;

/* ── v18 首領強化牆驗證：巫王——弱裝應打不過、適正+6 應穩過 ── */
function bossTrial(gear){
  G.battle=null;
  G.S=F.newState('human',{str:10,dex:8,con:9,int:5,wis:5},'牆測俠');
  G.S.lv=36;G.S.ch=56;G.S.ringGone=true;
  const pts=35;
  G.S.base.str+=Math.floor(pts*0.6);G.S.base.con+=Math.floor(pts*0.2);G.S.base.dex+=Math.floor(pts*0.2);
  G.S.eq.weapon={id:gear[0],e:gear[2]};G.S.eq.armor={id:gear[1],e:gear[2]};
  G.S.comp=null;G.S.comps=[];
  F.addItem('p_lembas',999);F.addItem('p_dew',999);
  const d=F.derive();G.S.hp=d.maxHp;G.S.mp=d.maxMp;
  F.enterGame(true);
  document.getElementById('auto-battle').checked=true;
  document.getElementById('auto-potion').checked=true;
  F.startBattle([F.mobInst('boss_witch',1,false,1)]);
  let t=0;while(G.battle&&t++<6000)F.battleTick();
  return !G.battle&&!(G.S.deaths>0);
}
let weakWins=0,propWins=0;
for(let i=0;i<3;i++){
  if(bossTrial(['w_rohan','a_rohan',0]))weakWins++;
  if(bossTrial(['w_numenor','a_tower',6]))propWins++;
}
console.log('\n首領牆驗證（巫王×3 場）：弱裝+0 勝 '+weakWins+'/3（期望 ≤1）、適正+6 勝 '+propWins+'/3（期望 ≥2）');
const wallOk=weakWins<=1&&propWins>=2;
console.log(wallOk?'✓ 首領強化牆生效':'✗ 首領牆失衡，需調 bossDefaults 的 dr/rg');
if(!wallOk)process.exitCode=1;
