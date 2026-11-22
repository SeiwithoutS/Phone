# Quy chuẩn phát triển EPhone

## Bộ công nghệ

| Phạm vi | Lựa chọn cho EPhone |
| --- | --- |
| Ngôn ngữ | TypeScript 5.9 ở chế độ `strict`. Dùng `.ts` cho dữ liệu, nghiệp vụ và server. Dùng `.tsx` cho module có JSX. |
| Giao diện | React 19 với function component và hooks. React Router 7 quản lý URL qua `HashRouter`. |
| Kiểu dáng | Tailwind CSS 4 cho bố cục, khoảng cách và trạng thái tại component. CSS cho theme, keyframes, safe area và selector dùng chung. |
| Công cụ | Vite 6 build giao diện. `tsc` kiểm tra kiểu và biên dịch server sang ESM cho Node.js 22+. |
| Dữ liệu | Node HTTP và file JSON trên thiết bị. Schema dùng chung giữa client và server. Giao dịch dùng revision để phát hiện hai tab ghi đè nhau. |
| Phụ thuộc | npm và `package-lock.json`. Cài bằng `npm ci` trên Windows và Termux để dùng cùng phiên bản. |

Đây là bộ công nghệ đã chạy trong dự án. Khi nâng phiên bản, cập nhật lockfile và chạy lại build, kiểm thử lưu trữ và các luồng giao diện bị ảnh hưởng.

## Tìm đúng chỗ để sửa

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `src/app/` | Khung ứng dụng, bảng route, khởi động và bố trí màn hình. `routes.ts` sở hữu ánh xạ giữa ID và URL. |
| `src/features/<tính-năng>/` | Màn hình, hộp thoại và nghiệp vụ của một tính năng. Ví dụ, `world-book/WorldInfoEditor.tsx` quản lý bản nháp và `world-book/model.ts` chuẩn hóa dữ liệu nhập. |
| `src/components/phone.tsx` | Các thành phần giao diện có người dùng ở nhiều tính năng. |
| `src/storage/` | Truy vấn bảng, transaction và mã hóa dữ liệu nhị phân ở trình duyệt. |
| `src/runtime/` | Tiện ích chạy trên trình duyệt và thư viện được tải theo nhu cầu. |
| `src/styles/` | Điểm vào Tailwind, CSS của giao diện dùng chung và thứ tự nạp CSS. |
| `src/legacy/` | Phần JavaScript thao tác DOM của bản cũ, chia theo tính năng, cùng CSS còn phụ thuộc vào thứ tự cascade. Khi thay một luồng bằng React, chuyển cả xử lý sự kiện của luồng đó sang chủ sở hữu mới. |
| `shared/storage.ts` | Tên bảng và kiểu dữ liệu lưu trên đĩa, dùng ở cả client và server. |
| `server/` | Phục vụ trang, đọc và ghi dữ liệu, API backup. |
| `tests/` | Các ca hồi quy cho hành vi có thể kiểm tra lặp lại bằng `npm test`. |

## Khi nào gom file, khi nào tách file

- Bắt đầu với một file cho một luồng. Một màn hình được phép chứa các component con, kiểu props và hàm chỉ dùng trong màn hình đó.
- Gom các hộp thoại mà lập trình viên thường sửa cùng nhau. Ví dụ, sửa luồng chuyển tiền và lì xì trong `chat/PaymentDialogs.tsx`, sửa hộp thoại sản phẩm trong `shopping/ProductDialogs.tsx`.
- Tách khi phần đó có trách nhiệm riêng, có người dùng ở module khác, hoặc có vòng đời đủ độc lập để kiểm thử. Chat Settings và trình chỉnh sửa World Info là các màn hình độc lập. Một input upload ẩn có thể dùng trực tiếp `FilePicker`.
- Tên file TSX theo PascalCase, tên hook bắt đầu bằng `use`, tên module nghiệp vụ thể hiện chức năng như `database.ts` hoặc `shared-cards.ts`. Dùng named export và import trực tiếp module sở hữu chức năng.

## Hợp đồng của component chung

| Component | Dùng khi |
| --- | --- |
| `Screen` | Khai báo màn hình với `id` có kiểu `ScreenId`. Router chọn màn hình hoạt động và các màn hình nền dùng `inert`. |
| `ScreenHeader`, `BackButton` | Dùng cho thanh tiêu đề và nút quay lại. Truyền `onClick` để chọn màn hình đích. `BackButton` có nhãn truy cập và biểu tượng mặc định. |
| `Dialog` | Dùng khung hộp thoại, liên kết tiêu đề bằng `aria-labelledby`. Tính năng sở hữu trạng thái mở, đóng và hành động xác nhận. |
| `FormField` | Ghép `label` với input qua cùng một `id`. Giá trị nhập và lỗi thuộc về form. |
| `FilePicker` | Dùng `id`, `accept`, `multiple` và `onChange` cho input chọn file ẩn. Nút mở picker cần có nhãn cho người dùng. |
| `AppShortcut` | Dùng nút thật cho shortcut có thể kích hoạt bằng chuột, cảm ứng và bàn phím. |

Component dùng chung nhận dữ liệu qua props và phát hành động qua callback. Nghiệp vụ như lưu World Info, chọn nhân vật hoặc gọi AI thuộc về feature. Khi hai giao diện có cấu trúc giống nhau, mô hình hóa phần khác biệt bằng props có kiểu. Ví dụ, ba thư viện avatar dùng một `AvatarLibrary` với `kind` cho nhân vật, người dùng hoặc nhóm.

## State, CSS và dữ liệu

- Dùng state React cho bản nháp. Giữ định danh ổn định khi thêm hoặc xóa hàng. Chỉ cập nhật danh sách và chuyển trang sau khi ghi thành công. Hiển thị lỗi cạnh hành động cần thử lại.
- Một tương tác có một nơi xử lý. Khi React tiếp quản click hoặc submit, gỡ listener DOM tương ứng trong mã cũ. Giữ những ID, class và radio name mà CSS, dữ liệu đã lưu hoặc các màn hình chưa chuyển đổi đang dùng.
- Dùng nút HTML cho hành động, label cho trường nhập, và tên truy cập cho nút chỉ có biểu tượng. Render văn bản người dùng bằng JSX hoặc `textContent`. Giao diện dùng tiếng Anh và cùng thuật ngữ như **World Info**, **Character Card**, **API Connections**.
- Ưu tiên utility Tailwind có tên đầy đủ trong TSX. Dùng biến CSS của theme cho màu. Giá trị do người dùng chọn như hình nền và màu bong bóng có thể truyền qua style động. Khi sửa màn hình cũ, kiểm tra computed style, vì selector CSS cũ có thể được ưu tiên hơn utility.
- Khi thay đổi liên quan nhiều bảng, dùng `database.transaction('rw', ...)`. Gặp xung đột revision, báo lỗi cho người dùng tải lại. Khi đổi định dạng, kiểm tra cả backup cũ lẫn dữ liệu mới. Test dùng thư mục tạm riêng.
- Mã ứng dụng mới dùng TypeScript. Các module JavaScript còn lại nằm trong `src/legacy/`. Khi chuyển một module, khai báo kiểu cho dữ liệu đầu vào và kết quả rồi chạy `tsc`. Giữ chế độ kiểm tra nghiêm ngặt cho mã đã chuyển.

## Kiểm tra trước khi bàn giao

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Với thay đổi UI, chạy ứng dụng bằng `npm run dev`. Kiểm tra luồng vừa sửa ở kích thước điện thoại, gồm thao tác mở, lưu, hủy, Back và tải lại khi phù hợp. Với thay đổi lưu trữ, kiểm tra mở lại ứng dụng từ cùng thư mục dữ liệu và khôi phục một bản sao lưu cũ.
