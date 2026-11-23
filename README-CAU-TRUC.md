# Cấu trúc dự án EPhone

Giao diện dùng React, TypeScript, React Router và Tailwind CSS. Vite phục vụ bản phát triển. Bản production dùng Node.js để phục vụ giao diện và lưu dữ liệu vào một file JSON trên thiết bị.

## Mở file nào khi cần sửa?

| Muốn sửa | Bắt đầu ở |
| --- | --- |
| Màu nhấn, nút icon, nút quay lại | [`theme.css`](src/styles/theme.css), [`appearance-controls.css`](src/styles/appearance-controls.css), [`icons.tsx`](src/components/icons.tsx), [`phone.tsx`](src/components/phone.tsx) |
| Màn hình chính, kéo thả app hoặc mẫu widget | [`HomeScreen.tsx`](src/features/home/HomeScreen.tsx), [`HomeWidgets.tsx`](src/features/home/HomeWidgets.tsx), [`home-desktop.css`](src/styles/home-desktop.css) |
| Đổi tên, ảnh app hoặc âm báo | [`WallpaperScreen.tsx`](src/features/appearance/WallpaperScreen.tsx), [`icons.js`](src/legacy/appearance/icons.js), [`status.js`](src/legacy/home/status.js) |
| Thanh soạn tin, sticker, menu dấu + hoặc ba tab cài đặt | [`ChatInterfaceScreen.tsx`](src/features/chat/ChatInterfaceScreen.tsx), [`ChatSettingsScreen.tsx`](src/features/chat/ChatSettingsScreen.tsx), [`src/legacy/chat/`](src/legacy/chat/) |
| Tin nhắn tự gửi sau thời gian chờ hoặc nội dung gửi lên AI | [`simulation.js`](src/legacy/npc/simulation.js), [`context.ts`](src/features/context/context.ts), [`completion.ts`](src/features/api/completion.ts) |
| Số dư, tiền tệ, thanh toán và đơn hàng | [`src/features/bank/`](src/features/bank/), [`src/features/shopping/`](src/features/shopping/), [`market.css`](src/styles/market.css) |
| Nhập, xuất, xóa một bộ prompt hoặc lorebook | [`collection-actions.js`](src/legacy/world-book/collection-actions.js) cho Mini Prompts và Presets. [`LorebookScreen.tsx`](src/features/world-book/LorebookScreen.tsx) cho World Info. |
| Đổi thứ tự hoặc bật/tắt entry | [`PromptEntryList.tsx`](src/components/PromptEntryList.tsx), [`WorldInfoEditor.tsx`](src/features/world-book/WorldInfoEditor.tsx), [`prompt-order.ts`](src/features/presets/prompt-order.ts) |
| Sao lưu, phục hồi hoặc đổi cách ghi dữ liệu | [`BackupScreen.tsx`](src/features/backup/BackupScreen.tsx), [`database.ts`](src/storage/database.ts), [`server/storage.ts`](server/storage.ts) |

## File ở thư mục gốc và phía server

| Đường dẫn | Vai trò |
| --- | --- |
| `index.html` | Khung HTML đầu vào. Khai báo viewport, tiêu đề, favicon và phần tử để React gắn giao diện. |
| `package.json`, `package-lock.json` | Khai báo lệnh npm và phụ thuộc. Lockfile chốt phiên bản để `npm ci` cài lại đồng nhất. |
| `vite.config.ts` | Cấu hình Vite, tích hợp Tailwind, đường dẫn tài nguyên và middleware lưu trữ khi chạy dev. |
| `tsconfig.json`, `tsconfig.server.json` | Cấu hình kiểm tra kiểu cho frontend và biên dịch server, mã dùng chung, bài kiểm thử. |
| `.editorconfig`, `.gitattributes`, `.gitignore` | Quy ước định dạng file trong editor, cách Git chuẩn hóa file và các đường dẫn Git bỏ qua. |
| `start.bat`, `start.sh`, `scripts/start.mjs` | Điểm chạy trên Windows và Termux. Cả hai gọi script chung để kiểm tra phụ thuộc, build và khởi động server. |
| `server/index.ts` | Tạo HTTP server, phục vụ tài nguyên từ `dist/` và chuyển yêu cầu API sang bộ xử lý lưu trữ. |
| `server/local-address.ts` | Đọc `PORT` và `EEPHONE_HOST`, kiểm tra giá trị và cung cấp địa chỉ loopback dùng chung. |
| `server/storage.ts` | Đọc, kiểm tra và ghi snapshot JSON, phát hiện xung đột phiên bản, xuất ZIP và ghi nhật ký thao tác ra terminal. |
| `shared/storage.ts` | Khai báo bảng, khóa, hàng dữ liệu và định dạng snapshot dùng chung cho trình duyệt và server. |
| `tests/storage.test.ts` | Kiểm thử ghi đồng thời, tuần tự hóa media, sao lưu ZIP đầy đủ và theo nhóm, tương thích World Info cũ. |
| `public/site-avatar.jpg` | Ảnh nhận diện dùng làm favicon và biểu tượng khi thêm trang vào màn hình chính. |
| `public/message-sent.wav`, `public/message-received.wav`, `public/silence.wav` | Âm gửi, âm nhận và mẫu im lặng cho trình phát âm thanh ẩn. |

## Khởi tạo và thư viện dùng chung trong `src/`

| Đường dẫn | Vai trò |
| --- | --- |
| `main.tsx` | Nạp CSS, gắn React vào HTML và bọc ứng dụng bằng `HashRouter`. |
| `app/App.tsx` | Khung ứng dụng, trạng thái khởi động, lỗi lưu trữ và chọn màn hình theo URL. |
| `app/routes.ts` | Ánh xạ ID màn hình với URL. Khai báo màn hình cần ngữ cảnh và đường dẫn quay về. |
| `app/PhoneContent.tsx` | Lắp màn hình, hộp thoại toàn cục, input nhập file và các trình phát âm thanh. |
| `app/actions.ts` | Cung cấp các thao tác để component React gọi được những luồng JavaScript hiện có. |
| `components/phone.tsx` | Khung màn hình, thanh tiêu đề, nút quay lại, avatar, hộp thoại, trường nhập và shortcut. |
| `components/icons.tsx`, `components/ThemeToggle.tsx` | Bộ SVG và nút icon dùng chung, kể cả nút tạo từ JavaScript. `ThemeToggle.tsx` là nút chuyển sáng/tối. |
| `storage/database.ts` | Mở cơ sở dữ liệu phía trình duyệt, gọi `/api/storage`, điều phối transaction và nhập dữ liệu IndexedDB cũ khi phù hợp. |
| `storage/table.ts`, `storage/portable.ts` | `table.ts` thực hiện truy vấn và cập nhật bảng. `portable.ts` mã hóa và giải mã dữ liệu như Blob, mảng byte và ngày tháng để lưu vào JSON. |
| `runtime/files.ts`, `runtime/helpers.ts` | Tiện ích đọc file, xác định URL ảnh, escape HTML và tải JSON. `helpers.ts` có debounce và chọn giá trị ngẫu nhiên. |
| `runtime/dependencies.ts`, `runtime/activity-log.ts` | Tải thư viện chụp màn hình hoặc đọc ZIP khi cần. `activity-log.ts` chuyển kết quả một số thao tác sang nhật ký server. |

## Màn hình và nghiệp vụ trong `src/features/`

Tên file trong bảng tính từ thư mục tương ứng ở cột đầu.

| Thư mục | File và vai trò |
| --- | --- |
| `home/` | `HomeScreen.tsx` quản lý shortcut, trang Home, dock và kéo thả. `HomeWidgets.tsx` chứa mẫu, bản xem trước và trình sửa widget. `StatusBar.tsx` hiển thị thanh trạng thái. `TutorialScreen.tsx` hiển thị hướng dẫn. |
| `chat/` | `ChatListScreen.tsx` là danh sách hội thoại. `ChatInterfaceScreen.tsx` là khung trò chuyện và thanh công cụ. `ChatSettingsScreen.tsx` chia cài đặt theo ba tab Setup, Features và Appearance. `ChatSessions.tsx` là giao diện quản lý phiên và nhánh hội thoại. |
| `chat/` | `ChatTodoDialog.tsx` quản lý việc cần làm trong chat. `SearchHistoryScreen.tsx` là màn hình tìm lịch sử. `GroupManagement.tsx` quản lý thành viên và `GroupActivities.tsx` chứa các hoạt động nhóm. |
| `chat/` | `MessageDialogs.tsx` chứa hộp thoại thao tác tin nhắn. `PaymentDialogs.tsx` chứa hộp thoại chuyển tiền, lì xì và các thẻ thanh toán. `SharingDialogs.tsx` chứa hộp thoại chia sẻ. |
| `chat/` | `model.ts` định nghĩa tin nhắn, hội thoại và phiên. `sessions.ts` lưu, chuyển và tạo nhánh phiên. `replies.ts` xử lý công cụ dưới tin nhắn, sửa trực tiếp và các phiên bản trả lời. `format.ts` định dạng thời gian. `shared-cards.ts` render thẻ chia sẻ. `chat-features.ts` xử lý tùy chọn chat, ngày đặc biệt, bình chọn và dữ liệu tính năng đưa vào prompt. |
| `characters/` | `CharacterEditScreen.tsx` tạo, sửa và nhập nhân vật. `characters.ts` lưu hồ sơ, prompt và lời chào. `card.ts` đọc Character Card PNG, JSON hoặc CHARX. `gallery.ts` chọn avatar theo thời gian hoặc số cuộc gọi. |
| `character-phone/` | `CharacterSelectionScreen.tsx` chọn nhân vật. `CharacterPhoneScreen.tsx` lắp launcher và các màn hình Cphone. `CharacterProfileModal.tsx` hiển thị hồ sơ nhân vật. |
| `personas/`, `npc/` | `PersonaTab.tsx` quản lý persona trong QQ, gồm chọn persona mặc định. `PersonaDialogs.tsx` chứa hộp thoại persona. `NpcEditorModal.tsx` là form tạo và cấu hình NPC. |
| `api/` | `ApiSettingsScreen.tsx` hiển thị cấu hình nhà cung cấp và model. `completion.ts` gửi yêu cầu, đọc phản hồi hoặc stream. `endpoints.ts` chuẩn hóa URL OpenAI-compatible. `image-input.ts` quyết định và đóng gói ảnh đưa vào prompt. |
| `context/` | `ContextScreen.tsx` hiển thị cấu hình và ngữ cảnh đã tạo. `context.ts` thu thập lịch sử, bộ nhớ, prompt và hoạt động liên quan. `budget.ts` chuẩn hóa cấu hình, ước lượng token và phân bổ giới hạn. |
| `world-book/` | `LorebookScreen.tsx` quản lý World Info, keyword và bộ lorebook. `lore.ts` đọc dữ liệu lorebook và chọn entry được kích hoạt. `lore-storage.ts` lưu bộ và liên kết với nhân vật. |
| `world-book/` | `WorldInfoScreens.tsx`, `WorldInfoEditor.tsx`, `WorldInfoDialogs.tsx` lắp danh sách, trình sửa và hộp thoại của luồng Mini Prompts. `model.ts` chuẩn hóa cấu trúc entries nhập vào luồng này. |
| `presets/` | `PresetScreens.tsx` lắp danh sách và trình chỉnh sửa dùng chung với Mini Prompts. `prompt-order.ts` đọc preset SillyTavern và chuyển entries thành các bước ráp prompt. |
| `social/`, `qzone/` | `SocialScreen.tsx` quản lý feed, tìm kiếm, trang hồ sơ và cài đặt. `SocialPost.tsx` hiển thị, soạn và sửa bài. `SocialDialog.tsx` chứa khung hộp thoại Social và tiện ích ảnh. `social.ts` định nghĩa dữ liệu và tạo nội dung AI. `activity.ts` lưu và điều phối bài đăng, bình luận AI. `qzone/PostDialogs.tsx` chứa các hộp thoại đăng bài của luồng Qzone. |
| `bank/` | `BankScreen.tsx` hiển thị số dư, sổ giao dịch và thông báo. `bank.ts` tính số dư, ghi chuyển khoản và lưu đơn vị hiển thị mặc định VND. `useBankCurrency.ts` đồng bộ thay đổi đơn vị giữa các màn hình React. |
| `shopping/` | `MarketScreen.tsx` hiển thị danh mục, giỏ, thanh toán và lịch sử đơn. `MarketProductEditor.tsx` là form thêm sản phẩm. `MarketOrderDetails.tsx` hiển thị tiến độ giao hàng và trình tạo thiệp. `market.ts` tính giá, lưu đơn, ghi giao dịch Bank và ghi thiệp vào chat. `market-gifts.ts` kiểm tra đơn tới hạn và đồng bộ thiệp với hội thoại đang mở. |
| `shopping/` | `ShoppingScreens.tsx` chứa giao diện cửa hàng, chi tiết và giỏ của luồng mua sắm trước đây. `ProductDialogs.tsx` chứa hộp thoại sản phẩm và danh mục. `GiftDialogs.tsx` chứa hộp thoại tặng quà. |
| `appearance/`, `avatars/` | `WallpaperScreen.tsx` lắp cài đặt hình nền, tên/ảnh app và âm báo. `launcher-labels.ts` chứa tên mặc định EPhone và Cphone. `FontSettingsScreen.tsx` chỉnh font. `AvatarLibraries.tsx` lắp thư viện avatar. `AvatarFrameModal.tsx` quản lý khung avatar. |
| `backup/` | `BackupScreen.tsx` hiển thị xuất ZIP toàn bộ hoặc theo nhóm và nhập sao lưu. `DataClearWizardModal.tsx` lắp hộp thoại dọn dữ liệu. |
| `stickers/` | `StickerLibraryScreen.tsx` quản lý sticker và nhóm sticker. `library.ts` đọc file, nhập URL, truy vấn và gán sticker cho chat. |
| `album/`, `browser/`, `reading/` | `AlbumScreens.tsx` hiển thị album và ảnh. `BrowserScreen.tsx` mở nội dung liên kết. `ReadingLibraryModal.tsx` tìm và nhập sách trong thư viện. |
| `calls/`, `music/`, `memories/` | `CallScreens.tsx` lắp màn hình cuộc gọi và lịch sử. `CallDialogs.tsx` lắp hộp thoại gọi. `MusicSearchResultsModal.tsx` hiển thị kết quả tìm nhạc. `LongTermMemoryScreen.tsx` lắp màn hình bộ nhớ dài hạn. |
| `novelai/`, `dialogs/` | `NovelAiDialogs.tsx` lắp form thiết lập và kiểm tra tạo ảnh. `SystemDialogs.tsx` chứa hộp thoại xác nhận, nhập và thông báo toàn ứng dụng. |

## JavaScript đang chạy trong `src/legacy/`

React cung cấp khung màn hình. Các file bên dưới vẫn gắn sự kiện DOM và xử lý những luồng có từ trước. Tên file tính từ thư mục ở cột đầu.

| Thư mục | File và vai trò |
| --- | --- |
| `runtime/`, `app/` | `start.js` chuẩn bị runtime và gắn listener. `startup.js` khởi tạo giao diện và dữ liệu sau khi mở storage. `state.js` chứa trạng thái dùng chung. `state.d.ts` khai báo kiểu cho phía TypeScript. `app/screen-effects.js` chuẩn bị nội dung khi vào một màn hình. |
| `chat/` | `list.js` render danh sách hội thoại. `conversation.js` mở chat, phân trang lịch sử, dựng bong bóng và thẻ. `composer.js` xử lý soạn/gửi tin và @mention. `ai.js` điều phối phản hồi và hành động AI trong chat riêng, nhóm và cuộc gọi. |
| `chat/` | `messages.js` xử lý gửi một số loại tin, chọn, trích dẫn và thu hồi. `editor.js` xử lý chỉnh nội dung nâng cao. `message-events.js` gắn sự kiện thao tác tin nhắn. `media-events.js` gắn sự kiện ảnh, âm thanh và các nội dung đa phương tiện trong chat. |
| `chat/` | `attachments.js` xử lý thẻ đính kèm, chuyển tiền, lì xì và bình chọn. `attachment-events.js` gắn sự kiện mở và gửi qua thanh công cụ. `button-order.js` chỉnh và lưu thứ tự nút. |
| `chat/` | `settings.js` dựng danh sách thiết lập World Book và thành viên. `settings-events.js` nạp và lưu form cài đặt chat. `groups.js` xử lý nhóm. `announcement-events.js` gắn sự kiện bảng thông báo nhóm. |
| `chat/` | `import.js` nhập/xuất hội thoại. `search.js` tìm và nhảy tới tin gốc. `sharing.js` xử lý chia sẻ nội dung và chụp ảnh dài. |
| `appearance/` | `wallpaper.js` nạp, lưu và áp dụng hình nền/cài đặt Appearance. `icons.js` render hàng chỉnh tên và ảnh, rồi áp dụng lên launcher. `theme.js` áp dụng theme và CSS tùy chỉnh. `fonts.js` xử lý font. `presets.js` lưu và nạp các preset giao diện. `events.js` gắn sự kiện cho các điều khiển, gồm nghe thử âm báo. |
| `home/` | `status.js` cập nhật đồng hồ, pin, toast, âm báo và ngữ cảnh đọc. `events.js` gắn sự kiện tùy chọn điện thoại. `widgets.js` xử lý tải ảnh cục bộ của luồng cũ. |
| `character-phone/` | `launcher.js` chuyển giữa EPhone, Cphone và các màn hình Cphone. `apps.js` mở app, điều phối hành động. `settings.js` áp dụng hình nền và icon. `simulation.js` sinh và hiển thị dữ liệu mô phỏng. `notes.js`, `music.js`, `profile.js` xử lý ghi chú/nhật ký, nghe nhạc và hồ sơ. `events.js` gắn sự kiện cho các màn hình này. |
| `world-book/`, `presets/` | `books.js` điều khiển danh sách và thao tác Mini Prompts. `transfer.js` xử lý nhập/xuất và tương thích World Book. `collection-actions.js` tạo nút và xử lý nhập, xuất hoặc xóa từng bộ Mini Prompts và Presets. `presets/presets.js` xử lý danh sách, bộ và entries của Presets. |
| `storage/`, `backup/` | `load.js` nạp dữ liệu và điền cấu hình mặc định. `preferences.js` truy cập tùy chọn thiết bị. `backup.js` xử lý nhập bản sao lưu. `clear-data.js` dọn dữ liệu. `media.js` tính dung lượng và nén ảnh. `repair.js` kiểm tra và sửa dữ liệu. `events.js` gắn thao tác dọn và sửa. |
| `api/`, `npc/` | `api/settings.js` nạp và lưu form API, preset và model. `api/client.js` phân tích phản hồi AI và hỗ trợ tóm tắt bộ nhớ. `npcs.js` quản lý hồ sơ NPC. `npc/simulation.js` xử lý hoạt động nền và tin nhắn tự gửi theo cooldown. |
| `memories/` | `memories.js` đọc, sửa, xóa bộ nhớ dài hạn và tạo tóm tắt từ chat hoặc cuộc gọi. `events.js` gắn sự kiện điều hướng và chỉnh sửa bộ nhớ. |
| `qzone/`, `personas/`, `stickers/` | `feed.js` dựng và quản lý feed Qzone. `interactions.js` xử lý tương tác, `favorites.js` quản lý mục đã lưu, `gestures.js` xử lý cử chỉ và `events.js` gắn sự kiện. `personas.js` áp dụng persona vào chat. `stickers.js` điều khiển bảng sticker trong chat và tương thích với thư viện. |
| `shopping/`, `avatars/`, `album/` | `store.js` và `events.js` xử lý cửa hàng cũ và gắn sự kiện. `libraries.js` và `frames.js` quản lý thư viện và khung avatar. `album.js` quản lý album, ảnh và thao tác lưu ảnh. |
| `calls/`, `music/` | `calls.js` điều phối gọi, `audio.js` xử lý âm thanh/TTS và `calls/events.js` gắn điều khiển. `player.js` quản lý phát nhạc, `search.js` tìm bài, `lyrics.js` xử lý lời và `music/events.js` gắn điều khiển nhạc. |
| `novelai/`, `reading/`, `gomoku/` | `images.js` xử lý tạo ảnh, `download.js` tải ảnh và `events.js` gắn thao tác NovelAI. `reading.js` điều khiển thư viện và phiên đọc. `gomoku.js` điều khiển trò cờ Gomoku. |
| `dialogs/`, `rendering/` | `dialogs.js` điều khiển hộp thoại toàn ứng dụng. `markup.js` dựng nội dung định dạng cho phần giao diện JavaScript. |

## CSS và thứ tự nạp

| Đường dẫn | Vai trò |
| --- | --- |
| `src/styles/main.css` | Điểm vào Tailwind và CSS. Nạp CSS cũ trước rồi đến component, theme và các stylesheet tính năng theo thứ tự khai báo ở đây. |
| `src/styles/theme.css`, `components.css`, `appearance-controls.css` | Bảng màu sáng/tối và nút icon, khung và trạng thái chung, kiểu nút và điều khiển Appearance. |
| `src/styles/home-desktop.css`, `phone-apps.css`, `phone-refresh.css` | Lưới Home, dock và kéo thả. Khung app, form và widget dùng chung. Các kiểu cập nhật cho danh sách chat, thanh công cụ, cài đặt chat và một số màn hình điện thoại. |
| `src/styles/market.css`, `social.css`, `stickers.css`, `context.css` | Kiểu riêng cho Bank và Marketplace, Social, thư viện sticker và màn hình Context. |
| `src/styles/prompts.css` | Bố cục danh sách/lưới của các bộ prompt và giao diện thu gọn, bật/tắt, kéo thả entry. |
| `src/legacy/styles/foundation.css`, `theme.css`, `responsive.css` | CSS nền của khung điện thoại, theme cũ và quy tắc theo kích thước màn hình. |
| `src/legacy/styles/chat.css`, `chat-messages.css`, `chat-settings.css`, `attachments.css` | Bố cục chat, bong bóng và thẻ tin nhắn, cài đặt chat và nội dung đính kèm ở các luồng cũ. |
| `src/legacy/styles/home-widgets.css`, `character-phone.css`, `qzone.css`, `reading.css`, `settings.css` | Kiểu cho widget cũ, Cphone, Qzone, trình đọc và các màn hình cài đặt. |

## Dữ liệu và thư mục được tạo khi chạy

Khi mở EPhone, `src/main.tsx` tải `App.tsx`. Ứng dụng mở cơ sở dữ liệu thông qua `src/storage/database.ts`, sau đó chọn màn hình theo `routes.ts` và lắp nội dung từ `PhoneContent.tsx`. Khi lưu, các tính năng cập nhật bảng hoặc transaction. Client gửi `PATCH /api/storage` kèm revision để server kiểm tra và ghi `eephone.json`. Khi xuất ZIP, server dùng cùng snapshot và lọc bảng nếu người dùng chọn một phần dữ liệu.

| Đường dẫn | Vai trò |
| --- | --- |
| `data/eephone.json` | Dữ liệu người dùng, được tạo trong thư mục dữ liệu ở lần ghi đầu tiên. Có thể đổi thư mục bằng `EEPHONE_DATA_DIR`. |
| `dist/`, `build/` | Đầu ra biên dịch. `dist/` chứa giao diện và tài nguyên tĩnh. `build/` chứa JavaScript đã biên dịch cho server và bài kiểm thử. |
| `node_modules/` | Các gói npm đã cài từ lockfile. |
| `SillyTavern/` | Mã tham khảo trong những bản làm việc có thư mục này. EPhone chạy từ mã nguồn và bản build của chính nó. |

Xem [README.md](README.md) để chạy dự án và [HUONG-DAN-CSS.md](HUONG-DAN-CSS.md) để tra selector hoặc nhập CSS.
