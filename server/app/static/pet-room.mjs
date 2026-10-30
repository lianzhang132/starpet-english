import {SNACKS,ACCESSORIES,normalizeCare,careAction} from './pet-care.mjs';
export class PetRoom{
  constructor({root,getState,save,speak,toast,canAct}){
    Object.assign(this,{root,getState,save,speak,toast,canAct});this.busy=false;this.game=null;
    root.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;event.stopPropagation();if(!canAct())return;
      if(button.dataset.care==='game'){this.game={answer:['apple','dog','ball'][Math.floor(Math.random()*3)]};this.render();this.speak(this.game.answer);return}
      if(button.dataset.care==='listen'){if(this.game)this.speak(this.game.answer);return}
      if(button.dataset.pick){if(!this.game)return;if(button.dataset.pick!==this.game.answer){this.toast('再听一次，慢慢找。');this.speak(this.game.answer);return}this.game=null;this.act('play');return}
      this.act(button.dataset.care,button.dataset.value);
    });this.render();
  }
  act(action,value){
    if(!this.canAct()||this.busy)return;
    const app=this.getState(),result=careAction(app.petCare,app.stars,action,value);
    if(!result.ok){this.toast(result.message);return}
    app.petCare=result.state;app.stars=result.stars;this.busy=true;this.save();this.render();
    document.querySelector('#pet-message').textContent=result.message;
    const stage=document.querySelector('.pet-stage');stage.dataset.mood=result.animation;
    if(result.speech)this.speak(result.speech);
    this.toast(result.message);clearTimeout(this.timer);this.timer=setTimeout(()=>{this.busy=false;delete stage.dataset.mood;this.render()},1200);
  }
  render(){
    const app=this.getState(),care=normalizeCare(app.petCare),accessory=ACCESSORIES[care.accessory];
    document.querySelector('#pet-accessory').textContent=accessory.icon;
    document.querySelector('#pet-accessory').dataset.style=care.accessory;
    this.root.innerHTML=`<div class="section-heading"><div><small>BOBO'S LITTLE HOME</small><h2>一起照顾波波</h2></div><span>💜 亲密度 ${care.bond}</span></div><p class="care-note">陪伴解锁装扮。不来玩也不会挨饿、生病或掉亲密度。</p><div class="care-grid"><article><h3>🍽️ 点心时间 <small>今日 ${care.feeds}/3</small></h3><div class="care-buttons">${Object.entries(SNACKS).map(([id,s])=>`<button data-care="feed" data-value="${id}" ${this.busy||care.feeds>=3||(id==='apple'&&care.freeApple)||app.stars<s.cost?'disabled':''}><span>${s.emoji}</span>${s.zh}<small>${s.cost?s.cost+' ⭐':'每天免费 1 个'}</small></button>`).join('')}</div></article><article><h3>🫧 陪伴时光</h3><div class="care-buttons"><button data-care="touch" ${this.busy?'disabled':''}>🖐️ 摸摸头<small>${care.actions.includes('touch')?'今天已奖励':'亲密度 +1 / 天'}</small></button><button data-care="groom" ${this.busy?'disabled':''}>🪮 梳梳毛<small>${care.actions.includes('groom')?'今天已奖励':'亲密度 +1 / 天'}</small></button><button data-care="game">🎾 听音找礼物<small>玩中学英语</small></button></div></article><article><h3>🎀 波波衣橱</h3><div class="care-buttons">${Object.entries(ACCESSORIES).map(([id,a])=>`<button data-care="dress" data-value="${id}" aria-pressed="${care.accessory===id}" ${this.busy||care.bond<a.bond?'disabled':''}>${a.icon||'🐾'} ${a.label}<small>${care.bond<a.bond?'亲密度 '+a.bond+' 解锁':care.accessory===id?'已穿戴':'免费换装'}</small></button>`).join('')}</div></article></div>${this.game?`<div class="pet-game" role="group" aria-label="听音找礼物"><p>波波想找什么？先听，再选。<button data-care="listen">🔊 再听</button></p><div>${[['apple','🍎'],['dog','🐶'],['ball','⚽']].map(([id,icon])=>`<button data-pick="${id}" aria-label="${id}">${icon}</button>`).join('')}</div></div>`:''}`;
  }
}
