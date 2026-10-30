import { Want } from '@kit.AbilityKit';
import { FormExtensionAbility, formBindingData, formProvider } from '@kit.FormKit';

interface PetCardData { phrase: string; meaning: string; }

export default class PetFormAbility extends FormExtensionAbility {
  private dailyData(): formBindingData.FormBindingData {
    const phrases: string[] = ['Hello, my friend!', 'Have a nice day!', 'Let us play!', 'You can do it!', 'I am happy today.'];
    const meanings: string[] = ['你好，我的朋友！', '祝你今天愉快！', '我们一起玩吧！', '你可以做到！', '我今天很开心。'];
    const index = new Date().getDate() % phrases.length;
    const data: PetCardData = { phrase: phrases[index], meaning: meanings[index] };
    return formBindingData.createFormBindingData(data);
  }

  onAddForm(want: Want): formBindingData.FormBindingData { return this.dailyData(); }

  onUpdateForm(formId: string): void {
    formProvider.updateForm(formId, this.dailyData()).catch(() => {});
  }
}
