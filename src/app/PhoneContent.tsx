import type { LocalDatabase } from '../storage/database'
import { AvatarLibraries } from '../features/avatars/AvatarLibraries'
import { FilePicker } from '../components/phone'
import { BackupScreen } from '../features/backup/BackupScreen'
import { BankNotice, BankScreen } from '../features/bank/BankScreen'
import { MarketScreen } from '../features/shopping/MarketScreen'
import { StatusBar, NotificationBar, BatteryAlertModal } from '../features/home/StatusBar'
import { CharacterEditScreen } from '../features/characters/CharacterEditScreen'
import { LorebookScreen } from '../features/world-book/LorebookScreen'
import { SocialScreen } from '../features/social/SocialScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { CharacterSelectionScreen } from '../features/character-phone/CharacterSelectionScreen'
import { CharacterPhoneScreen } from '../features/character-phone/CharacterPhoneScreen'
import { WorldBookEditorScreen } from '../features/world-book/WorldInfoEditor'
import { WorldBookScreen } from '../features/world-book/WorldInfoScreens'
import { PresetScreen, PresetEditorScreen, PresetActionsModal } from '../features/presets/PresetScreens'
import { TutorialScreen } from '../features/home/TutorialScreen'
import { ApiSettingsScreen } from '../features/api/ApiSettingsScreen'
import { DataClearWizardModal } from '../features/backup/DataClearWizardModal'
import { ChatListScreen } from '../features/chat/ChatListScreen'
import { AlbumScreen, AlbumPhotosScreen } from '../features/album/AlbumScreens'
import { NpcEditorModal } from '../features/npc/NpcEditorModal'
import { ClearPostsModal, PostActionsModal, RepostModal, CreatePostModal, QzoneStickerPanel } from '../features/qzone/PostDialogs'
import { ChatInterfaceScreen } from '../features/chat/ChatInterfaceScreen'
import { WallpaperScreen } from '../features/appearance/WallpaperScreen'
import { BrowserScreen } from '../features/browser/BrowserScreen'
import { FontSettingsScreen } from '../features/appearance/FontSettingsScreen'
import { ContactPickerScreen, MemberManagementScreen, MemberSettingsModal, GroupManagementModal } from '../features/chat/GroupManagement'
import { StickerLibraryScreen } from '../features/stickers/StickerLibraryScreen'
import { ContextScreen } from '../features/context/ContextScreen'
import { IncomingCallModal, CallTranscriptModal, CallMessageActionsModal } from '../features/calls/CallDialogs'
import { VideoCallScreen, OutgoingCallScreen, CallHistoryScreen } from '../features/calls/CallScreens'
import { LongTermMemoryScreen } from '../features/memories/LongTermMemoryScreen'
import { ChatSettingsScreen } from '../features/chat/ChatSettingsScreen'
import { SearchHistoryScreen } from '../features/chat/SearchHistoryScreen'
import { ShoppingScreen, ProductDetailScreen, CartScreen } from '../features/shopping/ShoppingScreens'
import { ProductEditorModal, ProductCategoryManagerModal, VariationSelectionModal, ShoppingSettingsModal } from '../features/shopping/ProductDialogs'
import { GiftReceiptModal, GiftRecipientModal } from '../features/shopping/GiftDialogs'
import { PersonaLibraryModal, PersonaEditorModal } from '../features/personas/PersonaDialogs'
import { CustomModalOverlay } from '../features/dialogs/SystemDialogs'
import { TransferModal, WaimaiRequestModal, RedPacketModal, RedPacketDetailsModal, TransferActionsModal } from '../features/chat/PaymentDialogs'
import { CreateCountdownModal, CreatePollModal, AnnouncementBoardModal, AnnouncementActionsModal } from '../features/chat/GroupActivities'
import { ChatListActionsModal, MessageActionsModal, MessageEditorModal, AiResponseEditorModal } from '../features/chat/MessageDialogs'
import { ShareLinkModal, ShareTargetModal, SharedHistoryViewerModal } from '../features/chat/SharingDialogs'
import { DeleteWorldBooksModal } from '../features/world-book/WorldInfoDialogs'
import { AvatarFrameModal } from '../features/avatars/AvatarFrameModal'
import { CharacterProfileModal } from '../features/character-phone/CharacterProfileModal'
import { MusicSearchResultsModal } from '../features/music/MusicSearchResultsModal'
import { ReadingLibraryModal } from '../features/reading/ReadingLibraryModal'
import { NovelaiSettingsModal, NovelaiTestModal, CharacterNaiPromptsModal } from '../features/novelai/NovelAiDialogs'

export function PhoneContent({ database }: { database?: LocalDatabase }) {
  return (
    <>
      <StatusBar />
      <NotificationBar />
      <BankNotice database={database} />
      <DataClearWizardModal />
      <NpcEditorModal />
      <ClearPostsModal />
      <FilePicker id="album-photo-input" accept="image/*" multiple />
      <IncomingCallModal />
      <ProductEditorModal />
      <GiftReceiptModal />
      <HomeScreen database={database} />
      <BackupScreen database={database} />
      <BankScreen database={database} />
      <MarketScreen database={database} />
      <CharacterEditScreen ready={Boolean(database)} />
      <LorebookScreen ready={Boolean(database)} />
      <SocialScreen database={database} />
      <StickerLibraryScreen database={database} />
      <ContextScreen database={database} />
      <CharacterSelectionScreen />
      <CharacterPhoneScreen database={database} />
      <WorldBookScreen />
      <WorldBookEditorScreen database={database} />
      <PresetScreen />
      <TutorialScreen />
      <PresetEditorScreen database={database} />
      <ApiSettingsScreen />
      <ChatListScreen database={database} />
      <AlbumScreen />
      <AlbumPhotosScreen />
      <ChatInterfaceScreen />
      <WallpaperScreen />
      <BrowserScreen />
      <FontSettingsScreen />
      <ContactPickerScreen />
      <MemberManagementScreen />
      <VideoCallScreen />
      <OutgoingCallScreen />
      <CallHistoryScreen />
      <LongTermMemoryScreen />
      <ChatSettingsScreen />
      <SearchHistoryScreen />
      <ShoppingScreen />
      <ProductDetailScreen />
      <CartScreen />
    </>
  )
}

export function PhoneOverlays() {
  return (
    <>
      <FilePicker id="import-world-book-input" accept=".json" />
      <PersonaLibraryModal />
      <PersonaEditorModal />
      <MemberSettingsModal />
      <CustomModalOverlay />
      <PresetActionsModal />
      <TransferModal />
      <BatteryAlertModal />
      <WaimaiRequestModal />
      <CreateCountdownModal />
      <RedPacketModal />
      <RedPacketDetailsModal />
      <CreatePollModal />
      <AvatarLibraries />

      <ChatListActionsModal />
      <ShareLinkModal />
      <TransferActionsModal />
      <CallTranscriptModal />
      <ShareTargetModal />
      <SharedHistoryViewerModal />
      <AnnouncementBoardModal />
      <AnnouncementActionsModal />
      <GroupManagementModal />
      <MessageActionsModal />
      <PostActionsModal />
      <MessageEditorModal />
      <AiResponseEditorModal />
      <RepostModal />
      <CallMessageActionsModal />
      <audio id="audio-player" hidden />
      <CreatePostModal />

      <QzoneStickerPanel />
      <AvatarFrameModal />
      <FilePicker id="custom-frame-upload-input" accept="image/*" />
      <CharacterProfileModal />
      
      <GiftRecipientModal />
      <audio id="notification-sound-player" preload="auto" />
      <MusicSearchResultsModal />
      <audio id="char-audio-player" preload="auto" />
      <FilePicker id="import-preset-input" accept=".json" />
      <DeleteWorldBooksModal />
      <ReadingLibraryModal />
      <ProductCategoryManagerModal />
      <VariationSelectionModal />
      <ShoppingSettingsModal />
      <NovelaiSettingsModal />
      <NovelaiTestModal />
      <CharacterNaiPromptsModal />
      <audio id="silent-audio-player" loop preload="auto" hidden>
        <source src={import.meta.env.BASE_URL + 'silence.wav'} type="audio/wav" />
      </audio>
      <audio id="tts-audio-player" hidden />
    </>
  )
}
