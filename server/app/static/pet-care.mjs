// No hunger, decay, or absence penalties. Bond rewards are bounded per calendar day.
export const SNACKS = {apple:{emoji:'🍎',en:'apple',zh:'苹果',cost:0},milk:{emoji:'🥛',en:'milk',zh:'牛奶',cost:1},banana:{emoji:'🍌',en:'banana',zh:'香蕉',cost:2}};
export const ACCESSORIES = {none:{label:'自然模样',icon:'',bond:0},scarf:{label:'星星围巾',icon:'🧣',bond:3},crown:{label:'小皇冠',icon:'👑',bond:8}};
export function careDay(date=new Date()){return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`}
export function normalizeCare(raw={},day=careDay()){
  const bond=Number.isSafeInteger(raw?.bond)?Math.max(0,Math.min(100000,raw.bond)):0;
  const same=raw?.day===day,accessory=ACCESSORIES[raw?.accessory]?.bond<=bond?raw.accessory:'none';
  return {day,bond,accessory,feeds:same&&Number.isInteger(raw.feeds)?Math.max(0,Math.min(3,raw.feeds)):0,
    freeApple:same&&raw.freeApple===true,actions:same&&Array.isArray(raw.actions)?[...new Set(raw.actions.filter(x=>['touch','groom','play'].includes(x)))]:[]};
}
export function careAction(raw,stars,action,value,day=careDay()){
  const state=normalizeCare(raw,day);stars=Number.isSafeInteger(stars)?Math.max(0,stars):0;
  const fail=message=>({state,stars,ok:false,message});
  if(action==='feed'){
    const snack=SNACKS[value];if(!snack)return fail('请选择一种小点心。');
    if(state.feeds>=3)return fail('今天的点心够啦，一起来陪玩吧！');
    if(value==='apple'&&state.freeApple)return fail('今日免费苹果已吃过，明天还有哦。');
    if(stars<snack.cost)return fail('星星还不够；免费摸摸头、梳毛和陪玩随时都可以。');
    state.feeds++;state.bond++;if(value==='apple')state.freeApple=true;
    return {state,stars:stars-snack.cost,ok:true,message:`Yummy! ${snack.zh}真好吃！亲密度 +1`,speech:snack.en,animation:'eating'};
  }
  if(action==='dress'){
    const accessory=ACCESSORIES[value];if(!accessory||state.bond<accessory.bond)return fail('再陪伴波波几次，就能解锁啦。');
    state.accessory=value;return {state,stars,ok:true,message:`换好啦：${accessory.label}！`,animation:'happy'};
  }
  if(!['touch','groom','play'].includes(action))return fail('来和波波玩一会儿吧。');
  const fresh=!state.actions.includes(action);if(fresh){state.actions.push(action);state.bond++}
  const message={touch:'摸摸头，好开心！',groom:'毛毛变整齐啦！',play:'你听懂啦！一起击掌！'}[action];
  return {state,stars,ok:true,message:message+(fresh?' 亲密度 +1':' 今天已获得陪伴奖励，可以继续玩。'),animation:action==='groom'?'grooming':'happy'};
}
