import { openCharApp } from '../legacy/character-phone/apps.js'
import { openCharacterSelector, switchToCharHomeScreen, switchToCharScreen, switchToMyPhone } from '../legacy/character-phone/launcher.js'
import { openCharWallet } from '../legacy/character-phone/simulation.js'
import { handleListenTogetherClick } from '../legacy/music/player.js'
import { openNpcEditor } from '../legacy/npc/npcs.js'
import { openPresetScreen } from '../legacy/presets/presets.js'

export const screenActions = {
  openPresetScreen,
  openCharacterSelector,
  openCharApp,
  switchToMyPhone,
  switchToCharHomeScreen,
  switchToCharScreen,
  openCharWallet,
  openNpcEditor,
  handleListenTogetherClick,
}
