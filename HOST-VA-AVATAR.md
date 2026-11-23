# Đổi host và avatar EPhone

Mở [http://127.0.0.1:8017](http://127.0.0.1:8017) trên thiết bị chạy server. Tên host mặc định là [http://eephone.localhost:8017](http://eephone.localhost:8017) và dùng được khi trình duyệt phân giải tên đó. Nếu dùng Termux, hãy chạy server trong Termux và mở địa chỉ trên cùng điện thoại.

## Đổi host hoặc cổng

Chọn một tên kết thúc bằng `.localhost`, ví dụ `myphone.localhost`. Dùng đúng tên trần, bỏ phần giao thức, cổng và đường dẫn khi khai báo `EEPHONE_HOST`.

**Windows PowerShell**

```powershell
$env:EEPHONE_HOST = 'myphone.localhost'
$env:PORT = '8018'
npm start
```

**Android Termux**

```bash
EEPHONE_HOST=myphone.localhost PORT=8018 npm start
```

Sau khi server khởi động, mở [http://myphone.localhost:8018](http://myphone.localhost:8018) hoặc [http://127.0.0.1:8018](http://127.0.0.1:8018). Có thể bỏ `PORT` để dùng cổng 8017. Hai biến cũng áp dụng khi chạy `npm run dev`. Nếu chưa có bản build, dùng `start.bat` trên Windows hoặc `bash start.sh` trong Termux.

Để lưu tên mặc định trong mã dự án, sửa chuỗi `eephone.localhost` trong [server/local-address.ts](server/local-address.ts), rồi chạy lại `npm run build` và `npm start`. Với một tên tùy chỉnh ngoài `.localhost`, máy đang chạy trình duyệt cần phân giải tên đó về `127.0.0.1` qua cấu hình DNS hoặc file hosts. Địa chỉ công khai cần cấu hình triển khai và DNS riêng.

Server tiếp tục đọc cùng một file `data/eephone.json` khi bạn đổi host hoặc cổng. Nếu đang chuyển từ bản EPhone cũ lưu trong trình duyệt, hãy xuất JSON tại địa chỉ cũ và nhập vào bản hiện tại.

## Đổi avatar web

| Bạn muốn đổi | Cách thực hiện |
| --- | --- |
| Biểu tượng tab và ảnh mặc định trên màn hình chính | Thay [public/site-avatar.jpg](public/site-avatar.jpg) bằng ảnh JPEG mới cùng tên. Ảnh vuông sẽ hiển thị rõ hơn ở kích thước biểu tượng. |
| Chỉ đổi avatar hồ sơ của bạn | Bấm vào ảnh tròn ở trang chính, rồi chọn **Upload image** hoặc **Use image URL**. Ảnh này được lưu trong dữ liệu của bạn. |
| Chỉ đổi biểu tượng tab hoặc ảnh ghim lên màn hình chính | Đặt ảnh mới vào `public/`, rồi sửa đường dẫn `rel="icon"` hoặc `rel="apple-touch-icon"` trong [index.html](index.html). |
| Đổi tên hiển thị trên tab | Sửa nội dung thẻ `<title>` trong [index.html](index.html). |

Sau khi thay file trong `public/` hoặc sửa `index.html`, chạy `npm run build` và khởi động lại với `npm start`. Nếu tab vẫn hiện biểu tượng cũ, tải lại trang bằng **Ctrl + F5**. Avatar hồ sơ bạn đã chọn trước đó được ưu tiên khi mở màn hình chính.

Ảnh mặc định hiện tại là minh họa của [@pyro_bulka](https://x.com/pyro_bulka/status/1840859450229579900).
