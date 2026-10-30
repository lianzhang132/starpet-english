@Entry
@Component
struct PetCard {
  @LocalStorageProp('phrase') phrase: string = 'Hello, my friend!';
  @LocalStorageProp('meaning') meaning: string = '你好，我的朋友！';
  @State happy: boolean = false;

  build() {
    Column() {
      Row() {
        Text('星伴英语 · 波波').fontSize(12).fontColor('#6B5CF6').fontWeight(FontWeight.Bold)
        Blank()
        Text(this.happy ? '💜' : '✦').fontColor('#9B7DF2')
      }.width('100%')
      Image($r('app.media.bobo')).width('72%').layoutWeight(1).objectFit(ImageFit.Contain)
        .scale({ x: this.happy ? 1.06 : 1, y: this.happy ? 1.06 : 1 })
        .onClick(() => { this.happy = !this.happy; })
      Text(this.phrase).fontSize(15).fontWeight(FontWeight.Bold).fontColor('#332E55').textAlign(TextAlign.Center)
      Text(this.meaning).fontSize(11).fontColor('#857BA1').margin({ top: 4, bottom: 8 })
      Button('和波波学一句 →').fontSize(12).height(30).width('100%').backgroundColor('#6B5CF6')
        .onClick(() => { postCardAction(this, { action: 'router', abilityName: 'EntryAbility' }); })
    }.width('100%').height('100%').padding(12).borderRadius(22).backgroundColor('#EFEBFF')
  }
}
