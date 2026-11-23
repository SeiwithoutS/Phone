# Cấu trúc dự án EPhone

EPhone dùng React và Vite cho giao diện, Node.js cho server và một file JSON để lưu dữ liệu trên thiết bị.

## Thư mục chính

| Đường dẫn | Tác dụng |
| --- | --- |
| `src/main.tsx`, `index.html` | Khởi tạo React và router. `index.html` chứa tiêu đề tab, favicon và cấu hình viewport. |
| `src/app/` | Ghép các màn hình trong khung điện thoại. `routes.ts` ánh xạ địa chỉ sang màn hình, `PhoneContent.tsx` lắp màn hình và hộp thoại, `actions.ts` nối thao tác React với logic có sẵn. |
| `src/components/` | Các thành phần dùng chung như màn hình, nút quay lại, nút mở app và hộp thoại. |
| `src/features/` | Màn hình, hộp thoại và logic React hoặc TypeScript theo từng tính năng. |
| `src/legacy/` | Logic JavaScript đang dùng cho thao tác DOM, chat, AI, nhạc, giao diện, sao lưu và các tính năng có từ phiên bản trước. `src/legacy/runtime/` khởi động và gắn các sự kiện cho phần này. |
| `src/styles/`, `src/legacy/styles/` | `main.css` nhập toàn bộ CSS. `home-desktop.css` định kiểu màn hình chính, các trang widget và dock, `components.css` cố định khung ngoài, `phone-apps.css` định kiểu các app mới. Các màn hình cũ dùng nhiều CSS trong `src/legacy/styles/`. |
| `src/runtime/` | Tiện ích ở trình duyệt, gồm xử lý file, URL ảnh và các phụ thuộc dùng chung. |
| `src/storage/` | Giao diện đọc và ghi dữ liệu trên frontend, các thao tác bảng và bộ mã hóa dữ liệu sao lưu. |
| `shared/` | Danh sách bảng và kiểu dữ liệu được dùng chung giữa frontend và server. |
| `server/` | Phục vụ `dist/`, xử lý API lưu trữ và sao lưu, quản lý địa chỉ host và cổng. |
| `public/` | File tĩnh được Vite đưa vào bản build, gồm `site-avatar.jpg`. |
| `tests/` | Kiểm thử lưu trữ, xuất nhập dữ liệu và tương thích định dạng World Info. |

## Các app thường chỉnh

| Tính năng | Đường dẫn |
| --- | --- |
| Màn hình chính, thanh trạng thái, widget | `src/features/home/`, `src/legacy/home/`, `src/styles/home-desktop.css` |
| QQ, hội thoại, lịch sử phiên và cài đặt chat | `src/features/chat/`, `src/legacy/chat/` |
| Edit và điện thoại nhân vật Cphone | `src/features/characters/`, `src/features/character-phone/`, `src/legacy/character-phone/` |
| World Info và Mini Prompts | `src/features/world-book/`, `src/legacy/world-book/` |
| Social và Qzone | `src/features/social/`, `src/features/qzone/`, `src/legacy/qzone/` |
| API Connections, Presets và Appearance | `src/features/api/`, `src/features/presets/`, `src/features/appearance/` và các thư mục tương ứng trong `src/legacy/` |

## File chính của từng luồng

| Luồng | File chính |
| --- | --- |
| Lịch sử và chuyển phiên Chat | `src/features/chat/ChatSessions.tsx`, `src/features/chat/sessions.ts` |
| Soạn tin và @mention | `src/legacy/chat/composer.js` |
| Tạo, sửa và nhập nhân vật | `src/features/characters/CharacterEditScreen.tsx`, `src/features/characters/characters.ts`, `src/features/characters/card.ts` |
| World Info và liên kết với nhân vật | `src/features/world-book/LorebookScreen.tsx`, `src/features/world-book/lore.ts`, `src/features/world-book/lore-storage.ts` |
| Bình luận AI trong Social | `src/features/social/SocialScreen.tsx`, `src/features/social/social.ts` |

## Chạy, build và dữ liệu

| Đường dẫn | Tác dụng |
| --- | --- |
| `start.bat`, `start.sh` | Chuẩn bị bản build và chạy server trên Windows hoặc Android Termux. |
| `scripts/start.mjs` | Kiểm tra dependency khi cần build, cài phần còn thiếu và chạy server. |
| `package.json`, `vite.config.ts`, `tsconfig*.json` | Khai báo lệnh npm, cấu hình Vite và kiểm tra TypeScript. |
| `dist/`, `build/` | Kết quả build của frontend và server. Sửa mã nguồn trong `src/` hoặc `server/`, rồi build lại. |
| `data/` | Dữ liệu của người dùng trên thiết bị. Server mặc định lưu vào `data/eephone.json`. |
| `node_modules/` | Các gói npm cài từ `package-lock.json`. |
| `.migration/`, `SillyTavern/` | Bản tham khảo và công cụ phục vụ quá trình chuyển đổi dự án. App chạy từ mã nguồn và bản build của EPhone. |

Xem [README.md](README.md) để chạy dự án hoặc [HOST-VA-AVATAR.md](HOST-VA-AVATAR.md) để chỉnh host và avatar.
