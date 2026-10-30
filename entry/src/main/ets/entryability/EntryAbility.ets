import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';

const DOMAIN = 0x0000;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    AppStorage.setOrCreate('starPetBackground', 0);
    hilog.info(DOMAIN, 'StarPetEnglish', 'EntryAbility created');
  }

  onBackground(): void {
    AppStorage.setOrCreate('starPetBackground', Date.now());
  }

  onForeground(): void {
    AppStorage.setOrCreate('starPetBackground', 0);
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, 'StarPetEnglish', 'Failed to load page: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, 'StarPetEnglish', 'Main page loaded');
    });
  }
}
