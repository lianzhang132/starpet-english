import { promptAction } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import { COURSE_WORLDS, CourseWorld, DAILY_WORDS, DIALOGUE_SCENES, DialogueScene, QUIZZES, QuizItem, WordItem } from '../data/CourseData';
import { LESSONS, LessonContent, LessonWord } from '../data/LessonLibrary';
import { DIALOGUE_TRANSLATIONS, SceneTranslation } from '../data/DialogueTranslations';
import { ApiService, PendingAnswer, SpeakingResult, SyncProgress } from '../services/ApiService';
import { PcmRecorder, SpeechCoach } from '../services/SpeechCoach';

PersistentStorage.persistProp('starPetXpV2', 0);
PersistentStorage.persistProp('starPetStarsV2', 0);
PersistentStorage.persistProp('starPetStreakV2', 0);
PersistentStorage.persistProp('starPetDevice', util.generateRandomUUID(true));
PersistentStorage.persistProp('starPetWords', '[]');
PersistentStorage.persistProp('starPetSentences', '[]');
PersistentStorage.persistProp('starPetLastDay', '');
PersistentStorage.persistProp('starPetDailyWords', '[]');
PersistentStorage.persistProp('starPetDailySentences', '[]');
PersistentStorage.persistProp('starPetDailyQuizzes', '[]');
PersistentStorage.persistProp('starPetCompletedLessons', '[]');
PersistentStorage.persistProp('starPetOutboxV1', '{"revision":0,"progress":null,"answers":[]}');
AppStorage.setOrCreate('starPetBackground', 0);

interface PendingSyncState {
  revision: number;
  progress: SyncProgress | null;
  answers: PendingAnswer[];
}

@Entry
@Component
struct Index {
  @State currentTab: number = 0;
  @StorageLink('starPetXpV2') xp: number = 0;
  @StorageLink('starPetStarsV2') stars: number = 0;
  @StorageLink('starPetStreakV2') streak: number = 0;
  @StorageLink('starPetDevice') deviceId: string = '';
  @StorageLink('starPetWords') learnedWords: string = '[]';
  @StorageLink('starPetSentences') learnedSentences: string = '[]';
  @StorageLink('starPetLastDay') lastDay: string = '';
  @StorageLink('starPetDailyWords') dailyWords: string = '[]';
  @StorageLink('starPetDailySentences') dailySentences: string = '[]';
  @StorageLink('starPetDailyQuizzes') dailyQuizzes: string = '[]';
  @StorageLink('starPetCompletedLessons') completedLessons: string = '[]';
  @StorageLink('starPetOutboxV1') outbox: string = '{"revision":0,"progress":null,"answers":[]}';
  @State dailyProgress: number = 0;
  @State petMood: number = 0;
  @State showQuiz: boolean = false;
  @State quizIndex: number = 0;
  @State selectedAnswer: number = -1;
  @State dialogueStep: number = 0;
  @State cloudOnline: boolean = false;
  @State syncMessage: string = '本机已保存';
  @State selectedScene: string = '';
  @State selectedWorld: string = '';
  @State selectedLesson: string = '';
  @State activeQuestions: QuizItem[] = QUIZZES;
  @State lessonCorrect: number = 0;
  @State showCards: boolean = false;
  @State cardIndex: number = 0;
  @State cardRevealed: boolean = false;
  @State listeningMode: boolean = false;
  @State activeCards: LessonWord[] = [];
  @State speechPhase: string = 'idle';
  @State speechFeedback: string = '';
  @State transcript: string = '';
  @State speechScore: number = -1;
  @State audioConsent: boolean = false;
  @StorageLink('starPetBackground') @Watch('onBackground') backgroundAt: number = 0;
  private speech: SpeechCoach = new SpeechCoach();
  private recorder: PcmRecorder = new PcmRecorder();
  private recordingTimer: number = -1;
  private speechGeneration: number = 0;
  private syncRunning: boolean = false;
  private syncTimer: number = -1;
  private syncActive: boolean = false;

  private petMessages: string[] = [
    'Hi，小探险家！今天一起收集 3 颗星星吧！',
    '摸摸头会让我更有精神～ Let’s go!',
    '每一次勇敢尝试都值得鼓励！You are amazing!',
    '学完今天的单词，我会送你一份小礼物！'
  ];

  aboutToAppear(): void {
    this.syncActive = true;
    this.refreshDay(false);
    this.sync();
    this.syncTimer = setInterval(() => {
      if (this.backgroundAt === 0) { this.flushSync(); }
    }, 30000);
  }

  aboutToDisappear(): void {
    this.syncActive = false;
    if (this.syncTimer >= 0) { clearInterval(this.syncTimer); this.syncTimer = -1; }
    this.clearSpeech(); this.speech.release();
  }
  private onBackground(): void {
    if (this.backgroundAt === 0) { this.flushSync(); }
    else { this.clearSpeech(); }
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Row() {
        this.Sidebar()
        Column() {
          this.TopBar()
          if (this.currentTab === 0) {
            this.HomePage()
          } else if (this.currentTab === 1) {
            this.CoursePage()
          } else if (this.currentTab === 2) {
            this.DialoguePage()
          } else {
            this.GrowthPage()
          }
        }
        .layoutWeight(1)
        .height('100%')
        .backgroundColor('#F7F6FC')
      }
      .width('100%')
      .height('100%')

      if (this.showQuiz) {
        this.QuizOverlay()
      }
      if (this.showCards) {
        this.CardOverlay()
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F7F6FC')
  }

  @Builder
  Sidebar() {
    Column() {
      Row() {
        Image($r('app.media.bobo'))
          .width(54)
          .height(54)
          .objectFit(ImageFit.Contain)
        Column() {
          Text('星伴英语')
            .fontSize(21)
            .fontWeight(FontWeight.Bold)
            .fontColor('#26233A')
          Text('StarPet English')
            .fontSize(11)
            .fontColor('#8A86A2')
        }
        .alignItems(HorizontalAlign.Start)
        .margin({ left: 8 })
      }
      .width('100%')
      .justifyContent(FlexAlign.Start)
      .margin({ bottom: 28 })

      this.NavButton(0, '⌂', '宠物家园')
      this.NavButton(1, '✦', '英语冒险')
      this.NavButton(2, '☏', '情景对话')
      this.NavButton(3, '♕', '我的成长')

      Blank()

      Column() {
        Text('今日连续学习')
          .fontSize(12)
          .fontColor('#77718F')
        Text(`${this.streak} 天 🔥`)
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FF795E')
          .margin({ top: 5 })
        Text('明天继续来，火苗会更旺！')
          .fontSize(11)
          .fontColor('#9A95AE')
          .textAlign(TextAlign.Center)
          .margin({ top: 6 })
      }
      .width('100%')
      .padding(14)
      .borderRadius(18)
      .backgroundColor('#FFF4EF')
    }
    .width(220)
    .height('100%')
    .padding({ left: 20, right: 20, top: 24, bottom: 22 })
    .backgroundColor('#FFFFFF')
    .border({ width: { right: 1 }, color: '#ECEAF4' })
  }

  @Builder
  NavButton(index: number, icon: string, label: string) {
    Row() {
      Text(icon)
        .fontSize(23)
        .fontColor(this.currentTab === index ? '#FFFFFF' : '#6D6882')
        .width(34)
        .textAlign(TextAlign.Center)
      Text(label)
        .fontSize(16)
        .fontWeight(this.currentTab === index ? FontWeight.Bold : FontWeight.Medium)
        .fontColor(this.currentTab === index ? '#FFFFFF' : '#4A465E')
        .margin({ left: 10 })
    }
    .width('100%')
    .height(54)
    .padding({ left: 12, right: 12 })
    .margin({ bottom: 10 })
    .borderRadius(17)
    .backgroundColor(this.currentTab === index ? '#6B5CF6' : '#FFFFFF')
    .shadow(this.currentTab === index ? { radius: 12, color: '#4D6B5CF6', offsetY: 5 } : { radius: 0, color: '#00FFFFFF' })
    .onClick(() => {
      this.clearSpeech();
      this.currentTab = index;
    })
  }

  @Builder
  TopBar() {
    Row() {
      Column() {
        Text(this.pageTitle())
          .fontSize(26)
          .fontWeight(FontWeight.Bold)
          .fontColor('#28243B')
        Text(this.pageSubtitle())
          .fontSize(13)
          .fontColor('#8B879D')
          .margin({ top: 3 })
      }
      .alignItems(HorizontalAlign.Start)

      Blank()

      Row() {
        Text('⚡')
          .fontSize(20)
        Text(`${this.xp} XP`)
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor('#554D86')
          .margin({ left: 5 })
      }
      .height(42)
      .padding({ left: 14, right: 14 })
      .borderRadius(21)
      .backgroundColor('#EFEDFF')
      .margin({ right: 10 })

      Row() {
        Text('⭐')
          .fontSize(19)
        Text(`${this.stars}`)
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor('#7B5C1E')
          .margin({ left: 5 })
      }
      .height(42)
      .padding({ left: 14, right: 14 })
      .borderRadius(21)
      .backgroundColor('#FFF6D9')
      .margin({ right: 10 })

      Row() {
        Circle({ width: 8, height: 8 })
          .fill(this.cloudOnline ? '#38C98B' : '#C7C3D3')
        Text(this.cloudOnline ? '已同步' : this.syncMessage)
          .fontSize(12)
          .fontColor('#6F6A82')
          .margin({ left: 6 })
      }
      .height(42)
      .padding({ left: 12, right: 12 })
      .borderRadius(21)
      .backgroundColor('#FFFFFF')
    }
    .width('100%')
    .height(86)
    .padding({ left: 28, right: 28 })
    .backgroundColor('#F7F6FC')
  }

  @Builder
  HomePage() {
    Scroll() {
      Column() {
        Row() {
          Stack({ alignContent: Alignment.BottomEnd }) {
            Column() {
              Row() {
                Text('波波想对你说')
                  .fontSize(12)
                  .fontColor('#6F69A2')
                  .fontWeight(FontWeight.Medium)
                Blank()
                Text('轻轻摸摸它')
                  .fontSize(11)
                  .fontColor('#9993B5')
              }
              .width('100%')

              Text(this.petMessages[this.petMood])
                .fontSize(21)
                .fontWeight(FontWeight.Bold)
                .fontColor('#332E55')
                .lineHeight(30)
                .width('100%')
                .margin({ top: 12 })

              Row() {
                Button('开始今日冒险  →')
                  .fontSize(15)
                  .fontWeight(FontWeight.Bold)
                  .fontColor('#FFFFFF')
                  .height(48)
                  .backgroundColor('#6B5CF6')
                  .borderRadius(16)
                  .onClick(() => {
                    this.startQuiz();
                  })
                Button('喂一颗星 ⭐')
                  .fontSize(14)
                  .fontColor('#6B5CF6')
                  .height(48)
                  .backgroundColor('#FFFFFF')
                  .border({ width: 1, color: '#DCD8FF' })
                  .borderRadius(16)
                  .margin({ left: 10 })
                  .onClick(() => this.feedPet())
              }
              .margin({ top: 22 })
            }
            .alignItems(HorizontalAlign.Start)
            .width('59%')
            .height('100%')
            .padding({ left: 28, top: 28, bottom: 25, right: 10 })

            Image($r('app.media.bobo'))
              .width(300)
              .height(300)
              .objectFit(ImageFit.Contain)
              .margin({ right: 15, bottom: -4 })
              .shadow({ radius: 24, color: '#356B5CF6', offsetY: 10 })
              .onClick(() => {
                this.petMood = (this.petMood + 1) % this.petMessages.length;
              })
          }
          .layoutWeight(2)
          .height(300)
          .borderRadius(28)
          .backgroundColor('#EAE7FF')
          .clip(true)

          Column() {
            Row() {
              Text('今日任务')
                .fontSize(18)
                .fontWeight(FontWeight.Bold)
                .fontColor('#302C45')
              Blank()
              Text(`${this.dailyProgress}/3`)
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor('#6B5CF6')
            }
            .width('100%')

            Stack({ alignContent: Alignment.Start }) {
              Row()
                .width('100%')
                .height(10)
                .borderRadius(5)
                .backgroundColor('#ECEAF3')
              Row()
                .width(`${this.dailyProgress * 33}%`)
                .height(10)
                .borderRadius(5)
                .backgroundColor('#6B5CF6')
            }
            .width('100%')
            .margin({ top: 15, bottom: 18 })

            this.TaskRow(this.count(this.dailyWords) >= 3 ? '✓' : '○', '听读 3 个单词', this.count(this.dailyWords) >= 3)
            this.TaskRow(this.count(this.dailyQuizzes) >= 3 ? '✓' : '○', '答对 3 道练习', this.count(this.dailyQuizzes) >= 3)
            this.TaskRow(this.count(this.dailySentences) >= 3 ? '✓' : '○', '开口说 3 句英语', this.count(this.dailySentences) >= 3)

            Blank()
            Text(this.dailyProgress >= 3 ? '今天的任务完成啦！🎁' : `还有 ${3 - this.dailyProgress} 项小任务`)
              .fontSize(12)
              .fontColor('#8C879D')
          }
          .layoutWeight(1)
          .height(300)
          .padding(24)
          .borderRadius(28)
          .backgroundColor('#FFFFFF')
          .margin({ left: 18 })
        }
        .width('100%')

        Row() {
          Text('快速开始')
            .fontSize(21)
            .fontWeight(FontWeight.Bold)
            .fontColor('#302C45')
          Blank()
          Text('每天 15 分钟，轻松养成英语力')
            .fontSize(12)
            .fontColor('#928DA5')
        }
        .width('100%')
        .margin({ top: 24, bottom: 14 })

        Row() {
          this.ActionCard('🃏', '单词闪卡', '6 个待复习', '#FFF0E9', '#E66E4C', 1)
          this.ActionCard('🎧', '听音辨词', '耳朵热身', '#E8F8FC', '#238CA5', 4)
          this.ActionCard('🎙️', '跟读挑战', '勇敢开口', '#F0ECFF', '#6B5CF6', 2)
          this.ActionCard('💬', '情景对话', '和波波聊一聊', '#EAF8F0', '#318C60', 2)
        }
        .width('100%')
        .justifyContent(FlexAlign.SpaceBetween)

        Row() {
          Column() {
            Row() {
              Text('今日单词')
                .fontSize(19)
                .fontWeight(FontWeight.Bold)
                .fontColor('#302C45')
              Blank()
              Text('滑动复习 →')
                .fontSize(12)
                .fontColor('#6B5CF6')
            }
            .width('100%')
            .margin({ bottom: 14 })

            Row() {
              ForEach(DAILY_WORDS.slice(0, 3), (item: WordItem) => {
                Column() {
                  Text(item.emoji).fontSize(34)
                  Text(item.word)
                    .fontSize(18)
                    .fontWeight(FontWeight.Bold)
                    .fontColor('#3D3854')
                    .margin({ top: 8 })
                  Text(item.meaning)
                    .fontSize(12)
                    .fontColor('#8E899F')
                    .margin({ top: 3 })
                }
                .layoutWeight(1)
                .height(126)
                .justifyContent(FlexAlign.Center)
                .borderRadius(18)
                .backgroundColor('#F8F7FC')
                .margin({ right: 10 })
                .onClick(() => {
                  this.playEnglish(item.word);
                  this.refreshDay(true);
                  this.learnedWords = this.addUnique(this.learnedWords, item.word);
                  this.dailyWords = this.addUnique(this.dailyWords, item.word);
                  this.updateDaily();
                  this.sync();
                })
              }, (item: WordItem) => item.word)
            }
            .width('100%')
          }
          .layoutWeight(2)
          .padding(22)
          .borderRadius(24)
          .backgroundColor('#FFFFFF')

          Column() {
            Text('词卡足迹')
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor('#302C45')
            Text(`${this.count(this.learnedWords)}`)
              .fontSize(42)
              .fontWeight(FontWeight.Bold)
              .fontColor('#6B5CF6')
              .margin({ top: 10 })
            Text('已听读单词')
              .fontSize(12)
              .fontColor('#8E899F')
            Text('每天复习，慢慢记牢')
              .fontSize(12)
              .fontColor('#36A76E')
              .margin({ top: 10 })
          }
          .layoutWeight(1)
          .height(204)
          .justifyContent(FlexAlign.Center)
          .padding(22)
          .borderRadius(24)
          .backgroundColor('#FFFFFF')
          .margin({ left: 18 })
        }
        .width('100%')
        .margin({ top: 22, bottom: 28 })
      }
      .width('100%')
      .padding({ left: 28, right: 28 })
    }
    .layoutWeight(1)
    .width('100%')
    .scrollBar(BarState.Off)
  }

  @Builder
  TaskRow(mark: string, label: string, done: boolean) {
    Row() {
      Text(mark)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor(done ? '#FFFFFF' : '#AAA5B8')
        .width(25)
        .height(25)
        .textAlign(TextAlign.Center)
        .backgroundColor(done ? '#42C78A' : '#F0EEF4')
        .borderRadius(13)
      Text(label)
        .fontSize(13)
        .fontColor(done ? '#4E495E' : '#8D889B')
        .decoration({ type: done ? TextDecorationType.LineThrough : TextDecorationType.None })
        .margin({ left: 10 })
    }
    .width('100%')
    .height(40)
  }

  @Builder
  ActionCard(icon: string, title: string, subtitle: string, background: string, foreground: string, targetTab: number) {
    Row() {
      Text(icon)
        .fontSize(27)
        .width(52)
        .height(52)
        .textAlign(TextAlign.Center)
        .backgroundColor('#FFFFFF')
        .borderRadius(17)
      Column() {
        Text(title)
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor(foreground)
        Text(subtitle)
          .fontSize(11)
          .fontColor('#8D8798')
          .margin({ top: 4 })
      }
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 10 })
    }
    .width('23.5%')
    .height(86)
    .padding(15)
    .borderRadius(22)
    .backgroundColor(background)
    .onClick(() => {
      if (targetTab === 1) {
        this.selectedLesson = '';
        this.activeCards = LESSONS[0].words.concat(LESSONS[1].words);
        this.cardIndex = 0; this.cardRevealed = false; this.showCards = true;
      } else if (targetTab === 4) {
        this.startQuiz();
        this.activeQuestions = LESSONS[0].questions.slice(0, 3).concat(LESSONS[1].questions.slice(0, 3));
        this.listeningMode = true;
        this.playEnglish(this.activeQuestions[0].answers[this.activeQuestions[0].correctIndex]);
      } else {
        this.currentTab = targetTab;
      }
    })
  }

  @Builder
  CoursePage() {
    Scroll() {
      Column() {
        Row() {
          Column() {
            Text('从会认单词，到敢说完整句子')
              .fontSize(22)
              .fontWeight(FontWeight.Bold)
              .fontColor('#FFFFFF')
            Text('6 个主题世界 · 24 节核心课 · 循序渐进达到日常交流')
              .fontSize(13)
              .fontColor('#E7E3FF')
              .margin({ top: 8 })
          }
          .alignItems(HorizontalAlign.Start)
          Blank()
          Text('🚀')
            .fontSize(58)
        }
        .width('100%')
        .height(126)
        .padding({ left: 25, right: 30 })
        .borderRadius(24)
        .linearGradient({ angle: 95, colors: [['#6B5CF6', 0.0], ['#9788FF', 1.0]] })
        .margin({ bottom: 20 })

        if (this.selectedWorld === '') {
          Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
            ForEach(COURSE_WORLDS, (world: CourseWorld, index: number) => {
              this.WorldCard(world, index)
            }, (world: CourseWorld) => world.id)
          }.width('100%')
        } else {
          Button('← 返回冒险地图').onClick(() => this.selectedWorld = '').margin({ bottom: 18 })
          ForEach(LESSONS.filter((lesson: LessonContent) => lesson.worldId === this.selectedWorld), (lesson: LessonContent, index: number) => {
            Column() {
              Text(`第 ${index + 1} 课 · ${lesson.words[0].emoji}`).fontSize(15).fontColor('#6B5CF6')
              Text(lesson.sentence).fontSize(22).fontWeight(FontWeight.Bold).fontColor('#302C45').margin({ top: 10 })
              Text(lesson.translation).fontSize(14).fontColor('#8B869C').margin({ top: 8 })
              Text(`${this.isLessonComplete(lesson.id) ? '✓ 已完成 · 再练一次' : '开始学习'} · 3 张词卡 + 4 道练习 →`)
                .fontSize(13).fontColor('#318C60').margin({ top: 12 })
            }.width('100%').alignItems(HorizontalAlign.Start).padding(22).borderRadius(22).backgroundColor('#FFFFFF')
              .margin({ bottom: 15 }).onClick(() => {
                this.selectedLesson = lesson.id;
                this.activeCards = lesson.words;
                this.activeQuestions = lesson.questions;
                this.cardIndex = 0; this.cardRevealed = false; this.showCards = true;
              })
          }, (lesson: LessonContent) => lesson.id)
        }
      }
      .width('100%')
      .padding({ left: 28, right: 28, bottom: 28 })
    }
    .layoutWeight(1)
    .width('100%')
    .scrollBar(BarState.Off)
  }

  @Builder
  WorldCard(world: CourseWorld, index: number) {
    Column() {
      Row() {
        Text(world.icon)
          .fontSize(38)
          .width(62)
          .height(62)
          .textAlign(TextAlign.Center)
          .backgroundColor('#18' + world.color.slice(1))
          .borderRadius(20)
        Column() {
          Text(world.title)
            .fontSize(19)
            .fontWeight(FontWeight.Bold)
            .fontColor('#302C45')
          Text(world.englishTitle)
            .fontSize(12)
            .fontColor(world.color)
            .margin({ top: 3 })
        }
        .alignItems(HorizontalAlign.Start)
        .margin({ left: 12 })
        Blank()
        Text('›')
          .fontSize(20)
          .fontColor('#AAA5B7')
      }
      .width('100%')

      Text(world.description)
        .fontSize(12)
        .fontColor('#8B869C')
        .width('100%')
        .margin({ top: 15 })

      Row() {
        Stack({ alignContent: Alignment.Start }) {
          Row()
            .width('100%')
            .height(8)
            .borderRadius(4)
            .backgroundColor('#EFEDF4')
          Row()
            .width(`${this.worldProgress(world.id)}%`)
            .height(8)
            .borderRadius(4)
            .backgroundColor(world.color)
        }
        .layoutWeight(1)
        Text(`${this.worldProgress(world.id)}%`)
          .fontSize(11)
          .fontWeight(FontWeight.Bold)
          .fontColor(world.color)
          .width(38)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .margin({ top: 17 })

      Row() {
        Text(`${world.lessons.length} 节课`)
          .fontSize(11)
          .fontColor('#9893A8')
        Blank()
        Text(this.worldProgress(world.id) > 0 ? '继续学习 →' : '开始探索 →')
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor(world.color)
      }
      .width('100%')
      .margin({ top: 14 })
    }
    .width('32%')
    .height(218)
    .padding(20)
    .borderRadius(23)
    .backgroundColor('#FFFFFF')
    .margin({ bottom: 16 })
    .shadow({ radius: 8, color: '#0D3C3555', offsetY: 3 })
    .onClick(() => {
      this.selectedWorld = world.id;
    })
  }

  @Builder
  DialoguePage() {
    Row() {
      Scroll() {
        Column() {
          ForEach(DIALOGUE_SCENES, (scene: DialogueScene) => {
            Row() {
              Text(scene.icon)
                .fontSize(34)
                .width(62)
                .height(62)
                .textAlign(TextAlign.Center)
                .backgroundColor('#18' + scene.color.slice(1))
                .borderRadius(20)
              Column() {
                Row() {
                  Text(scene.title)
                    .fontSize(17)
                    .fontWeight(FontWeight.Bold)
                    .fontColor('#342F49')
                  Text(scene.level)
                    .fontSize(10)
                    .fontColor(scene.color)
                    .padding({ left: 7, right: 7, top: 3, bottom: 3 })
                    .borderRadius(9)
                    .backgroundColor('#16' + scene.color.slice(1))
                    .margin({ left: 8 })
                }
                Text(scene.subtitle)
                  .fontSize(12)
                  .fontColor('#8F8A9F')
                  .margin({ top: 5 })
              }
              .alignItems(HorizontalAlign.Start)
              .margin({ left: 12 })
              Blank()
              Text('›').fontSize(22).fontColor('#AAA6B6')
            }
            .width('100%')
            .height(96)
            .padding({ left: 16, right: 18 })
            .borderRadius(21)
            .backgroundColor(this.selectedScene === scene.id ? '#F0EDFF' : '#FFFFFF')
            .margin({ bottom: 12 })
            .onClick(() => {
              this.clearSpeech();
              this.selectedScene = scene.id;
              this.dialogueStep = 0;
            })
          }, (scene: DialogueScene) => scene.id)
        }
        .width('100%')
      }
      .width('42%')
      .height('100%')
      .scrollBar(BarState.Off)
      .padding({ left: 28, bottom: 25 })

      Column() {
        if (this.selectedScene === '') {
          Image($r('app.media.bobo'))
            .width(230)
            .height(230)
            .objectFit(ImageFit.Contain)
          Text('选一个场景，和波波开口聊英语')
            .fontSize(21)
            .fontWeight(FontWeight.Bold)
            .fontColor('#37324C')
            .margin({ top: 12 })
          Text('不用怕说错，波波会给你中文提示和温柔鼓励。')
            .fontSize(13)
            .fontColor('#8B869D')
            .margin({ top: 8 })
        } else {
          this.ActiveDialogue()
        }
      }
      .layoutWeight(1)
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .padding(28)
      .borderRadius({ topLeft: 28 })
      .backgroundColor('#FFFFFF')
      .margin({ left: 22 })
    }
    .layoutWeight(1)
    .width('100%')
  }

  @Builder
  ActiveDialogue() {
    Column() {
      Row() {
        Image($r('app.media.bobo'))
          .width(76)
          .height(76)
          .objectFit(ImageFit.Contain)
          .backgroundColor('#EAE7FF')
          .borderRadius(38)
        Column() {
          Text('波波 · Bobo')
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor('#363149')
          Text('正在陪你练习 · 放轻松')
            .fontSize(11)
            .fontColor('#48A978')
            .margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .margin({ left: 12 })
        Blank()
        Button('结束')
          .fontSize(12)
          .fontColor('#7E788F')
          .height(36)
          .backgroundColor('#F3F1F7')
          .borderRadius(14)
          .onClick(() => { this.clearSpeech(); this.selectedScene = ''; })
      }
      .width('100%')

      Column() {
        Text(this.currentSceneLine())
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .fontColor('#342F49')
          .textAlign(TextAlign.Center)
        Text(this.dialogueHint())
          .fontSize(14)
          .fontColor('#88829B')
          .margin({ top: 12 })
        Button('🔊  听波波说一遍')
          .fontSize(13)
          .fontColor('#6B5CF6')
          .height(42)
          .backgroundColor('#F0EDFF')
          .borderRadius(16)
          .margin({ top: 20 })
          .enabled(this.speechPhase === 'idle')
          .onClick(() => this.playEnglish(this.currentSceneLine()))
        if (this.speechFeedback !== '') {
          Text(this.speechFeedback).fontSize(13).fontColor('#6B5CF6').textAlign(TextAlign.Center).margin({ top: 14 })
        }
        if (this.speechScore >= 0) {
          Text(`句子匹配度 ${this.speechScore}%`).fontSize(18).fontWeight(FontWeight.Bold).fontColor('#318C60').margin({ top: 10 })
          Text(this.transcript === '' ? '这次没有听清' : `听到：${this.transcript}`).fontSize(13).fontColor('#77718F').margin({ top: 8 })
          Text('识别可能有误；分数不是专业发音评测。').fontSize(11).fontColor('#9893A8').margin({ top: 6 })
        }
      }
      .layoutWeight(1)
      .width('100%')
      .justifyContent(FlexAlign.Center)
      .padding(30)
      .borderRadius(24)
      .backgroundColor('#FAF9FD')
      .margin({ top: 22, bottom: 20 })

      Row() {
        Checkbox().select(this.audioConsent).onChange((checked: boolean) => {
          this.audioConsent = checked;
          if (!checked) { this.clearSpeech(); }
        })
        Text('家长同意：本次录音临时发送至学习服务器识别，不保存录音。')
          .fontSize(11).fontColor('#898397').layoutWeight(1)
      }.width('100%').margin({ bottom: 10 })

      Row() {
        Button('💡 中文提示')
          .fontSize(14)
          .fontColor('#8A6480')
          .height(52)
          .backgroundColor('#FFF0F5')
          .borderRadius(18)
          .onClick(() => promptAction.showToast({ message: this.dialogueHint() }))
        Button(this.speechPhase === 'recording' ? '⏹ 说完了' : this.speechPhase === 'checking' ? '正在听…' : this.speechPhase === 'starting' ? '准备麦克风…' : '🎙️ 点击跟读')
          .layoutWeight(1)
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
          .height(52)
          .backgroundColor('#6B5CF6')
          .borderRadius(18)
          .margin({ left: 12, right: 12 })
          .enabled(this.speechPhase === 'recording' || (this.speechPhase === 'idle' && this.audioConsent))
          .onClick(() => this.toggleRecording())
        Button('下一句 →')
          .fontSize(14)
          .fontColor('#2F8C61')
          .height(52)
          .backgroundColor('#EAF8F0')
          .borderRadius(18)
          .onClick(() => {
            this.clearSpeech();
            this.dialogueStep = (this.dialogueStep + 1) % 3;
          })
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  GrowthPage() {
    Scroll() {
      Column() {
        Row() {
          Column() {
            Text(`英语小探险家 · Lv. ${Math.floor(this.xp / 100) + 1}`)
              .fontSize(23)
              .fontWeight(FontWeight.Bold)
              .fontColor('#FFFFFF')
            Text(`再获得 ${100 - this.xp % 100} XP，波波就会长大一点！`)
              .fontSize(13)
              .fontColor('#E9E5FF')
              .margin({ top: 8 })
            Stack({ alignContent: Alignment.Start }) {
              Row().width('100%').height(10).borderRadius(5).backgroundColor('#6AFFFFFF')
              Row().width(`${this.xp % 100}%`).height(10).borderRadius(5).backgroundColor('#FFFFFF')
            }
            .width(330)
            .margin({ top: 18 })
          }
          .alignItems(HorizontalAlign.Start)
          Blank()
          Image($r('app.media.bobo'))
            .width(170)
            .height(170)
            .objectFit(ImageFit.Contain)
        }
        .width('100%')
        .height(190)
        .padding({ left: 28, right: 35 })
        .borderRadius(28)
        .linearGradient({ angle: 100, colors: [['#6454E9', 0.0], ['#9184FF', 1.0]] })
        .clip(true)

        Row() {
          this.StatCard('📚', `${this.count(this.learnedWords)}`, '听读词卡', '#F0EDFF')
          this.StatCard('💬', `${this.count(this.learnedSentences)}`, '跟读通过句子', '#E8F8FC')
          this.StatCard('🔥', `${this.streak}`, '连续学习天数', '#FFF2E9')
          this.StatCard('⭐', `${this.stars}`, '宠物星星', '#FFF8DB')
        }
        .width('100%')
        .justifyContent(FlexAlign.SpaceBetween)
        .margin({ top: 20 })

        Row() {
          Column() {
            Row() {
              Text('今天的小目标')
                .fontSize(18)
                .fontWeight(FontWeight.Bold)
                .fontColor('#332E48')
              Blank()
              Text(`${this.dailyProgress}/3 已完成`)
                .fontSize(11)
                .fontColor('#9691A6')
            }
            .width('100%')
            Row() {
              this.DayBar('词卡', Math.min(100, this.count(this.dailyWords) / 3 * 100))
              this.DayBar('答题', Math.min(100, this.count(this.dailyQuizzes) / 3 * 100))
              this.DayBar('跟读', Math.min(100, this.count(this.dailySentences) / 3 * 100))
            }
            .layoutWeight(1)
            .width('100%')
            .alignItems(VerticalAlign.Bottom)
            .justifyContent(FlexAlign.SpaceAround)
            .margin({ top: 16 })
          }
          .layoutWeight(2)
          .height(250)
          .padding(22)
          .borderRadius(24)
          .backgroundColor('#FFFFFF')

          Column() {
            Text('家长小报告')
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor('#332E48')
              .width('100%')
            Text('根据本机实际练习记录')
              .fontSize(12)
              .fontColor('#8D879D')
              .width('100%')
              .margin({ top: 14 })
            Text(`累计听读 ${this.count(this.learnedWords)} 个单词，跟读通过 ${this.count(this.learnedSentences)} 句。每天花几分钟复习，比一次学很多更容易坚持。`)
              .fontSize(14)
              .fontColor('#4B465C')
              .lineHeight(22)
              .width('100%')
              .margin({ top: 7 })
            Button('一起练习 →')
              .fontSize(13)
              .fontColor('#6B5CF6')
              .height(42)
              .backgroundColor('#F0EDFF')
              .borderRadius(15)
              .margin({ top: 18 })
              .onClick(() => this.currentTab = 2)
          }
          .layoutWeight(1)
          .height(250)
          .alignItems(HorizontalAlign.Start)
          .padding(22)
          .borderRadius(24)
          .backgroundColor('#FFFFFF')
          .margin({ left: 18 })
        }
        .width('100%')
        .margin({ top: 20, bottom: 28 })
      }
      .width('100%')
      .padding({ left: 28, right: 28 })
    }
    .layoutWeight(1)
    .width('100%')
    .scrollBar(BarState.Off)
  }

  @Builder
  StatCard(icon: string, value: string, label: string, background: string) {
    Row() {
      Text(icon)
        .fontSize(26)
        .width(50)
        .height(50)
        .textAlign(TextAlign.Center)
        .backgroundColor(background)
        .borderRadius(16)
      Column() {
        Text(value)
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .fontColor('#352F4A')
        Text(label)
          .fontSize(11)
          .fontColor('#908A9F')
      }
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 10 })
    }
    .width('23.5%')
    .height(86)
    .justifyContent(FlexAlign.Center)
    .borderRadius(21)
    .backgroundColor('#FFFFFF')
  }

  @Builder
  DayBar(day: string, height: number) {
    Column() {
      Blank()
      Row()
        .width(22)
        .height(height)
        .borderRadius({ topLeft: 7, topRight: 7 })
        .backgroundColor(height > 0 ? '#6B5CF6' : '#E9E7EF')
      Text(day)
        .fontSize(11)
        .fontColor('#8F899D')
        .margin({ top: 7 })
    }
    .width(32)
    .height(170)
  }

  @Builder
  CardOverlay() {
    Column({ space: 16 }) {
      Row() {
        Text(`词卡 ${this.cardIndex + 1}/${this.activeCards.length}`).fontSize(14).fontColor('#77718E')
        Blank()
        Button('关闭').onClick(() => this.showCards = false)
      }.width('100%')
      Text(this.activeCards[this.cardIndex].emoji).fontSize(78)
      Text(this.activeCards[this.cardIndex].word).fontSize(34).fontWeight(FontWeight.Bold).fontColor('#302B45')
      Text(this.cardRevealed ? this.activeCards[this.cardIndex].meaning : '想一想意思，再翻卡看看。').fontSize(18).fontColor('#8B869C')
      Row({ space: 14 }) {
        Button('🔊 听发音').onClick(() => this.playEnglish(this.activeCards[this.cardIndex].word))
        Button('翻卡看中文').onClick(() => this.cardRevealed = !this.cardRevealed)
      }
      Button(this.cardIndex === this.activeCards.length - 1 && this.selectedLesson !== '' ? '开始闯关 →' : '下一张 →')
        .width('100%').height(50).backgroundColor('#6B5CF6').onClick(() => {
          const word = this.activeCards[this.cardIndex].word;
          this.refreshDay(true);
          this.learnedWords = this.addUnique(this.learnedWords, word);
          this.dailyWords = this.addUnique(this.dailyWords, word);
          this.updateDaily(); this.sync();
          if (this.cardIndex === this.activeCards.length - 1 && this.selectedLesson !== '') {
            this.showCards = false; this.quizIndex = 0; this.selectedAnswer = -1;
            this.lessonCorrect = 0; this.listeningMode = false; this.showQuiz = true;
          } else {
            this.cardIndex = (this.cardIndex + 1) % this.activeCards.length; this.cardRevealed = false;
          }
        })
    }.width(520).padding(30).borderRadius(28).backgroundColor('#FFFFFF')
      .shadow({ radius: 32, color: '#66322D4A', offsetY: 12 })
  }

  @Builder
  QuizOverlay() {
    Column() {
      Row() {
        Text(`第 ${this.quizIndex + 1} 题`)
          .fontSize(13)
          .fontColor('#77718E')
        Blank()
        Text('×')
          .fontSize(26)
          .fontColor('#8A8498')
          .onClick(() => this.showQuiz = false)
      }
      .width('100%')

      Text(this.listeningMode ? '🎧' : this.activeQuestions[this.quizIndex].emoji)
        .fontSize(70)
        .margin({ top: 10 })
        .onClick(() => {
          if (this.listeningMode) { this.playEnglish(this.activeQuestions[this.quizIndex].answers[this.activeQuestions[this.quizIndex].correctIndex]); }
        })
      Text(this.listeningMode ? '听一听，选出波波说的单词' : this.activeQuestions[this.quizIndex].prompt)
        .fontSize(25)
        .fontWeight(FontWeight.Bold)
        .fontColor('#302B45')
        .textAlign(TextAlign.Center)
        .margin({ top: 10 })
      Text(this.listeningMode ? '点耳机可以再听一次' : this.activeQuestions[this.quizIndex].hint)
        .fontSize(13)
        .fontColor('#908A9F')
        .textAlign(TextAlign.Center)
        .margin({ top: 8, bottom: 20 })

      ForEach(this.activeQuestions[this.quizIndex].answers, (answer: string, index: number) => {
        Row() {
          Text(String.fromCharCode(65 + index))
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.answerTextColor(index))
            .width(28)
            .height(28)
            .textAlign(TextAlign.Center)
            .borderRadius(14)
            .backgroundColor(this.answerBadgeColor(index))
          Text(answer)
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor('#403A53')
            .margin({ left: 13 })
          Blank()
          if (this.selectedAnswer === index) {
            Text(index === this.activeQuestions[this.quizIndex].correctIndex ? '✓' : '×')
              .fontSize(19)
              .fontWeight(FontWeight.Bold)
              .fontColor(index === this.activeQuestions[this.quizIndex].correctIndex ? '#2BA66D' : '#E15E5E')
          }
        }
        .width('100%')
        .height(56)
        .padding({ left: 14, right: 16 })
        .borderRadius(17)
        .backgroundColor(this.answerBackground(index))
        .border({ width: 1, color: this.answerBorder(index) })
        .margin({ bottom: 10 })
        .onClick(() => {
          if (this.selectedAnswer === -1) {
            this.selectedAnswer = index;
            this.queueAnswer(this.activeQuestions[this.quizIndex].id, index);
            if (index === this.activeQuestions[this.quizIndex].correctIndex) {
              this.lessonCorrect += 1;
              this.refreshDay(true);
              const key = this.activeQuestions[this.quizIndex].id;
              if (!(JSON.parse(this.dailyQuizzes) as string[]).includes(key)) {
                this.xp += 15;
                this.stars += 1;
                this.dailyQuizzes = this.addUnique(this.dailyQuizzes, key);
              }
              this.updateDaily();
            }
            this.sync();
          }
        })
      }, (answer: string) => answer)

      if (this.selectedAnswer >= 0) {
        Row() {
          Text(this.selectedAnswer === this.activeQuestions[this.quizIndex].correctIndex ? '答对啦！每天首次答对获得星星 ⭐' : '别灰心，正确答案已经标出来啦。')
            .fontSize(14)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.selectedAnswer === this.activeQuestions[this.quizIndex].correctIndex ? '#238A5B' : '#B15E4F')
          Blank()
          Button(this.quizIndex < this.activeQuestions.length - 1 ? '下一题 →' : '完成')
            .fontSize(14)
            .fontWeight(FontWeight.Bold)
            .fontColor('#FFFFFF')
            .height(44)
            .backgroundColor('#6B5CF6')
            .borderRadius(15)
            .onClick(() => {
              if (this.quizIndex < this.activeQuestions.length - 1) {
                this.quizIndex += 1;
                this.selectedAnswer = -1;
                if (this.listeningMode) { this.playEnglish(this.activeQuestions[this.quizIndex].answers[this.activeQuestions[this.quizIndex].correctIndex]); }
              } else {
                if (this.selectedLesson !== '' && this.lessonCorrect === this.activeQuestions.length) {
                  this.completedLessons = this.addUnique(this.completedLessons, this.selectedLesson);
                  this.sync();
                  promptAction.showToast({ message: '课程完成！波波为你骄傲！' });
                } else {
                  promptAction.showToast({ message: `完成练习，答对 ${this.lessonCorrect}/${this.activeQuestions.length} 题。错题可以再练一遍！` });
                }
                this.showQuiz = false;
                this.quizIndex = 0;
              }
            })
        }
        .width('100%')
        .padding(14)
        .borderRadius(16)
        .backgroundColor(this.selectedAnswer === this.activeQuestions[this.quizIndex].correctIndex ? '#EAF8F0' : '#FFF0EC')
        .margin({ top: 4 })
      }
    }
    .width(560)
    .padding(26)
    .borderRadius(28)
    .backgroundColor('#FFFFFF')
    .shadow({ radius: 32, color: '#66322D4A', offsetY: 12 })
  }

  private pageTitle(): string {
    const titles: string[] = ['早上好，小探险家！', '英语冒险地图', '和波波聊英语', '我的成长星球'];
    return titles[this.currentTab];
  }

  private pageSubtitle(): string {
    const subtitles: string[] = ['波波已经准备好陪你学习啦', '完成课程，让波波一步步长大', '在真实情景里练出开口的勇气', '每一次坚持都值得被看见'];
    return subtitles[this.currentTab];
  }

  private feedPet(): void {
    if (this.stars <= 0) {
      promptAction.showToast({ message: '先去完成练习，收集星星吧！' });
      return;
    }
    this.stars -= 1;
    this.sync();
    this.petMood = (this.petMood + 1) % this.petMessages.length;
    promptAction.showToast({ message: '波波吃得好开心！亲密度 +1' });
  }

  private currentSceneLine(): string {
    const scene = DIALOGUE_SCENES.find((item: DialogueScene) => item.id === this.selectedScene);
    if (scene === undefined) {
      return 'Hello!';
    }
    return scene.lines[this.dialogueStep];
  }

  private count(value: string): number { return (JSON.parse(value) as string[]).length; }

  private isLessonComplete(id: string): boolean { return (JSON.parse(this.completedLessons) as string[]).includes(id); }
  private worldProgress(id: string): number {
    return (JSON.parse(this.completedLessons) as string[]).filter((lesson: string) => lesson.startsWith(id + '-')).length * 25;
  }
  private startQuiz(): void {
    this.selectedLesson = ''; this.activeQuestions = QUIZZES; this.quizIndex = 0;
    this.selectedAnswer = -1; this.lessonCorrect = 0; this.listeningMode = false; this.showQuiz = true;
  }

  private addUnique(value: string, item: string): string {
    const items = JSON.parse(value) as string[];
    if (!items.includes(item)) { items.push(item); }
    return JSON.stringify(items);
  }

  private refreshDay(studying: boolean): void {
    const date = new Date();
    const today = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    if (today !== this.lastDay) {
      this.dailyWords = '[]'; this.dailySentences = '[]'; this.dailyQuizzes = '[]';
      if (studying) {
        const yesterday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
        const previous = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
        this.streak = this.lastDay === previous ? this.streak + 1 : 1;
        this.lastDay = today;
      }
    }
    this.updateDaily();
  }

  private updateDaily(): void {
    this.dailyProgress = (this.count(this.dailyWords) >= 3 ? 1 : 0) +
      (this.count(this.dailyQuizzes) >= 3 ? 1 : 0) + (this.count(this.dailySentences) >= 3 ? 1 : 0);
  }

  private sync(): void {
    const state = JSON.parse(this.outbox) as PendingSyncState;
    state.revision += 1;
    const progress: SyncProgress = { deviceId: this.deviceId, xp: this.xp, stars: this.stars, streak: this.streak,
      completedLessons: JSON.parse(this.completedLessons) as string[], learnedWords: JSON.parse(this.learnedWords) as string[],
      revision: state.revision };
    state.progress = progress;
    this.outbox = JSON.stringify(state);
    this.cloudOnline = false;
    this.syncMessage = '本机已保存 · 待同步';
    this.flushSync();
  }

  private queueAnswer(questionId: string, answerIndex: number): void {
    const state = JSON.parse(this.outbox) as PendingSyncState;
    const answer: PendingAnswer = { deviceId: this.deviceId, questionId: questionId,
      answerIndex: answerIndex, requestId: util.generateRandomUUID(true) };
    state.answers.push(answer);
    this.outbox = JSON.stringify(state);
  }

  private async flushSync(): Promise<void> {
    if (this.syncRunning || !this.syncActive || this.backgroundAt !== 0) { return; }
    this.syncRunning = true;
    try {
      for (let count = 0; count < 100 && this.syncActive && this.backgroundAt === 0; count++) {
        const state = JSON.parse(this.outbox) as PendingSyncState;
        if (state.progress === null && state.answers.length === 0) {
          this.cloudOnline = true;
          return;
        }
        const progress = state.progress;
        let responseCode: number = 0;
        if (progress !== null) { responseCode = await ApiService.syncProgress(progress); }
        else { responseCode = await ApiService.recordAnswer(state.answers[0]); }
        if (responseCode !== 200) {
          this.cloudOnline = false;
          this.syncMessage = responseCode === 409 ? '同步冲突 · 本机已保留' : '本机已保存 · 待同步';
          return;
        }
        const latest = JSON.parse(this.outbox) as PendingSyncState;
        if (progress !== null) {
          const latestProgress = latest.progress;
          if (latestProgress !== null && latestProgress.revision === progress.revision) { latest.progress = null; }
        } else {
          const requestId = state.answers[0].requestId;
          latest.answers = latest.answers.filter((answer: PendingAnswer) => answer.requestId !== requestId);
        }
        this.outbox = JSON.stringify(latest);
      }
    } catch (_) {
      this.cloudOnline = false;
      this.syncMessage = '同步未完成 · 请勿清除数据';
    } finally { this.syncRunning = false; }
  }

  private playEnglish(text: string): void {
    this.speech.speak(text, (message: string) => { promptAction.showToast({ message: message }); });
  }

  private clearSpeech(): void {
    ++this.speechGeneration;
    if (this.recordingTimer >= 0) { clearTimeout(this.recordingTimer); this.recordingTimer = -1; }
    this.recorder.cancel().catch(() => {});
    this.speech.stop();
    this.speechPhase = 'idle'; this.speechScore = -1; this.transcript = ''; this.speechFeedback = '';
  }

  private async toggleRecording(): Promise<void> {
    if (this.speechPhase === 'recording') { await this.finishRecording(); return; }
    if (this.speechPhase !== 'idle' || !this.audioConsent) { return; }
    const generation = ++this.speechGeneration;
    this.speechPhase = 'starting'; this.speechScore = -1; this.transcript = '';
    this.speech.stop();
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      await this.recorder.start(context);
      if (generation !== this.speechGeneration) { return; }
      this.speechPhase = 'recording';
      this.speechFeedback = '波波在听。说完点“说完了”，15 秒后自动结束。';
      this.recordingTimer = setTimeout(() => { this.finishRecording(); }, 15000);
    } catch (_) {
      if (generation !== this.speechGeneration) { return; }
      this.speechPhase = 'idle';
      this.speechFeedback = '麦克风暂不可用，请检查授权；也可以继续听音学习。';
    }
  }

  private async finishRecording(): Promise<void> {
    if (this.speechPhase !== 'recording') { return; }
    const generation = this.speechGeneration;
    const scene = this.selectedScene;
    const line = this.dialogueStep;
    this.speechPhase = 'checking';
    if (this.recordingTimer >= 0) { clearTimeout(this.recordingTimer); this.recordingTimer = -1; }
    this.speechFeedback = '波波正在听懂你的句子…';
    try {
      const pcm = await this.recorder.stop();
      if (generation !== this.speechGeneration) { return; }
      if (pcm.byteLength < 16000) { throw new Error('too_short'); }
      const result: SpeakingResult = await ApiService.evaluateSpeech(this.deviceId, scene, line, pcm);
      if (generation !== this.speechGeneration) { return; }
      this.speechScore = result.score; this.transcript = result.transcript; this.speechFeedback = result.feedback;
      this.refreshDay(true);
      if (result.passed) {
        this.xp += result.xpAwarded;
        this.learnedSentences = this.addUnique(this.learnedSentences, `${scene}:${line}`);
        this.dailySentences = this.addUnique(this.dailySentences, `${scene}:${line}`);
        this.updateDaily();
      }
      this.sync();
    } catch (_) {
      if (generation === this.speechGeneration) {
        this.speechFeedback = '这次没能完成识别。请说至少一秒，或检查网络后重试。';
      }
    } finally {
      if (generation === this.speechGeneration) { this.speechPhase = 'idle'; }
    }
  }

  private dialogueHint(): string {
    const scene = DIALOGUE_TRANSLATIONS.find((item: SceneTranslation) => item.id === this.selectedScene);
    return scene === undefined ? '先听一遍，再跟着波波说。' : scene.lines[this.dialogueStep];
  }

  private answerBackground(index: number): string {
    if (this.selectedAnswer === -1) {
      return '#FAF9FD';
    }
    if (index === this.activeQuestions[this.quizIndex].correctIndex) {
      return '#EAF8F0';
    }
    if (index === this.selectedAnswer) {
      return '#FFF0EC';
    }
    return '#FAF9FD';
  }

  private answerBorder(index: number): string {
    if (this.selectedAnswer !== -1 && index === this.activeQuestions[this.quizIndex].correctIndex) {
      return '#60C995';
    }
    if (index === this.selectedAnswer) {
      return '#ED8A79';
    }
    return '#E9E6F0';
  }

  private answerBadgeColor(index: number): string {
    if (this.selectedAnswer !== -1 && index === this.activeQuestions[this.quizIndex].correctIndex) {
      return '#3DB87A';
    }
    if (index === this.selectedAnswer) {
      return '#E77A68';
    }
    return '#ECE9F7';
  }

  private answerTextColor(index: number): string {
    return this.selectedAnswer !== -1 &&
      (index === this.activeQuestions[this.quizIndex].correctIndex || index === this.selectedAnswer) ? '#FFFFFF' : '#6B5CF6';
  }
}
