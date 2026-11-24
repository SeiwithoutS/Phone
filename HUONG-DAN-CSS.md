# Hướng dẫn tùy chỉnh CSS trong EPhone

EPhone có bốn nơi nhập CSS. Chọn nơi nhập theo phần giao diện cần sửa.

| Bạn muốn chỉnh | Nơi nhập | Cách lưu |
| --- | --- | --- |
| Một widget ở Home | **Widgets → chọn mẫu hoặc sửa widget → Advanced styling** | Bấm icon nhập file `.css` cạnh **Custom CSS** hoặc dán CSS vào ô bên dưới. Xem trước rồi bấm **Save widget**. |
| Bong bóng tin nhắn của một hội thoại | **Chat Settings → Appearance → Custom CSS** | Dán CSS rồi bấm **Save**. EPhone giới hạn CSS ở vùng tin nhắn và dùng cùng quy tắc cho bản xem trước. |
| Nhật ký của một char | **QQ → Chat Settings → Diary → Diary CSS** | Chọn **Import CSS** hoặc dán nội dung. Xem trước rồi bấm dấu ✓ trên Chat Settings. |
| Toàn bộ giao diện điện thoại | **Appearance → Global Custom CSS** | Dán CSS rồi bấm **Save Appearance Settings**. Nút nhập **Appearance JSON** dùng để nhập preset giao diện JSON. |

File widget dùng UTF-8, phần mở rộng `.css` và chỉ chứa quy tắc CSS. Ô nhập CSS cũng nhận trực tiếp phần nội dung này.

## Cấu trúc thẻ và class của widget

Widget có tài liệu HTML riêng, vì vậy dùng selector bắt đầu từ `.widget` để sửa widget. Biến CSS giao diện khai báo ở trang EPhone nằm ngoài tài liệu này.

```html
<div class="widget photo-note">
  <img class="image" src="..." alt="">
  <div class="photo-note-copy">
    <h2 class="title">Nhật ký</h2>
    <p class="text">Một ngày có nắng.</p>
  </div>
</div>
```

| Selector | Thành phần |
| --- | --- |
| `.widget` | Thẻ bao ngoài. Có thêm class theo mẫu, chẳng hạn `.widget.note` hoặc `.widget.photo-note`. |
| `.title`, `.text` | Tiêu đề `<h2>` và nội dung hoặc chú thích `<p>`. Khi để trống, một số mẫu ẩn thẻ tương ứng. |
| `img.image`, `.image.placeholder` | Ảnh đã thêm và ô giữ chỗ khi chưa chọn ảnh. |
| `.value` | Giá trị chính của đồng hồ, lịch, đếm ngược, tâm trạng hoặc tiến độ. |
| `.photo-note-copy` | Vùng chứa chữ ở mẫu **Photo and note**. |
| `.collage .photos` | Lưới ảnh của mẫu **Photo collage**. Dùng `.collage .photos > .image:nth-child(2)` để chỉnh ô ảnh thứ hai. |
| `.duo .photos > div` | Hai cột của **Two avatars**. Mỗi cột có `.image` và có thể có một `.text`. |
| `.progress progress` | Thẻ thanh tiến độ. Đổi màu bằng thuộc tính `accent-color`. |

Class theo mẫu gồm `note`, `photo`, `polaroid`, `profile`, `clock`, `countdown`, `calendar`, `quote`, `progress`, `mood`, `photo-note`, `collage` và `duo`.

### Mẫu file CSS cho ảnh kèm ghi chú

```css
.widget.photo-note {
  background: #edf6ff;
  color: #244260;
  padding: 10px;
  gap: 8px;
}

.widget.photo-note > .image {
  border-radius: 10px;
  object-fit: cover;
}

.photo-note-copy .title {
  color: #245c92;
  font-size: 1rem;
}

.photo-note-copy .text {
  line-height: 1.4;
}
```

## CSS cho chat

Dùng những selector sau trong ô **Chat Settings → Appearance → Custom CSS**. EPhone tự thêm vùng giới hạn tương ứng.

| Selector | Thành phần |
| --- | --- |
| `.message-bubble.user .content` | Nội dung bong bóng của người dùng. |
| `.message-bubble:not(.user) .content` | Nội dung bong bóng của phía còn lại. |
| `.message-wrapper .timestamp` | Dấu thời gian của tin nhắn. |
| `.market-chat-card`, `.market-gift-card` | Thẻ đơn hàng và thiệp quà trong chat. |

```css
.message-bubble.user:not(.is-card-like) .content {
  background: #e3f1ff;
  color: #183451;
  border-radius: 14px 6px 14px 14px;
}
```

## CSS toàn ứng dụng

| Selector hoặc biến | Thành phần |
| --- | --- |
| `#home-screen .home-app-tile`, `#desktop-dock` | Shortcut app trên Home và thanh dock. |
| `#wallpaper-screen .launcher-setting-row` | Hàng chỉnh tên và ảnh của một app. |
| `#market-screen .market-product`, `.market-order-row` | Thẻ sản phẩm và hàng trong lịch sử đơn. |
| `#phone-screen .ui-icon-button` | Nút icon trong khung điện thoại. |
| `--ui-accent`, `--ui-accent-soft`, `--ui-surface`, `--ui-text`, `--ui-divider` | Màu nhấn, nền nhấn, nền thẻ, chữ và đường viền. |
| `:root[data-theme="dark"]` | Ghi đè riêng cho chế độ tối. |

```css
:root {
  --ui-accent: #245c92;
  --ui-accent-soft: #e4f1ff;
}

:root[data-theme="dark"] {
  --ui-accent: #abd6ff;
  --ui-accent-soft: #1f3954;
}

#market-screen .market-product {
  border-radius: 18px;
}
```

Nếu CSS không có hiệu lực, kiểm tra selector trên đúng loại widget hoặc màn hình và lưu lại sau khi xem trước. Xóa nội dung CSS tùy chỉnh rồi lưu để trở về kiểu mặc định. Mã đánh dấu widget nằm trong [HomeWidgets.tsx](src/features/home/HomeWidgets.tsx), màu dùng chung nằm trong [theme.css](src/styles/theme.css).


## CSS cho Diary

Dùng `.diary-entry` cho toàn trang nhật ký, `.diary-title` cho tiêu đề, `.diary-content` cho nội dung và `.diary-highlight` cho đoạn tô sáng. **Reset CSS** khôi phục kiểu mặc định của trình đọc. Bấm ✓ để lưu thay đổi cho char đang mở.
