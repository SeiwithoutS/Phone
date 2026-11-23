# Sao lưu và khôi phục dữ liệu EPhone

EPhone chạy bằng Node.js trên thiết bị của bạn. Thư mục dữ liệu mặc định là `data/`, nằm cạnh `start.bat` và `start.sh`. Nếu bạn đã đặt `EEPHONE_DATA_DIR`, EPhone dùng đường dẫn đó.

## Xuất bản sao lưu

1. Lưu các form bạn đang chỉnh sửa trong EPhone.
2. Mở **API Connections** rồi chọn **Export User Data ZIP**.
3. Cất file `EPhone-User-Data-YYYY-MM-DD.zip` ở nơi riêng. Bản sao chứa chat, nhân vật, ảnh đã tải lên, Gallery, World Info, hồ sơ Social, widget, bố cục màn hình chính, cài đặt và API key. Ảnh chỉ nhập bằng URL vẫn được lưu dưới dạng URL.

## Khôi phục hoặc chuyển sang thiết bị khác

1. Đóng các tab EPhone. Trong cửa sổ đang chạy server, nhấn **Ctrl+C** để dừng server.
2. Giải nén ZIP và tìm file `eephone.json`.
3. Mở thư mục `data/` của bản EPhone đích. Nếu dùng `EEPHONE_DATA_DIR`, mở thư mục đó. Tạo thư mục nếu đây là lần chạy đầu.
4. Nếu thư mục đã có `eephone.json`, sao chép file hiện tại ra một nơi riêng trước. Dán file từ ZIP vào thư mục đích với đúng tên `eephone.json`. Bản sao lưu thay thế toàn bộ dữ liệu của bản EPhone đích.
5. Chạy `start.bat` trên Windows hoặc `bash start.sh` trên Termux. Mở địa chỉ local mà terminal in ra.

Với bản sao lưu JSON từ EPhone đời cũ, mở **API Connections → Data maintenance → Import Legacy JSON Backup**.
