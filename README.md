# Ứng dụng Tải lên và Lưu trữ Tệp Discord

- Project web cho phép người dùng tải lên tệp, lưu trữ bằng cách gửi lên Discord để lấy CDN và custom URL rồi trả về cho người dùng.
- Project được dùng để đáp ứng nhu cầu của cá nhân mình, open source với mục đích cho mọi người tham khảo. Không hỗ trợ setup
- Demo: [youtube](https://youtu.be/lbB_iVLSvYM)

---

## 👤 Tác Giả

- **Nguyễn Thiên Phong**
  - Discord: `thienphong1401.`
  - GitHub: [github.com/phongprovip1401](https://github.com/phongprovip1401)
  - Socials: [thienphong.site](https://thienphong.site)

---

## Tính năng

- Tải lên tệp lên random channel trong 1 máy chủ Discord
- Hỗ trợ tất cả định dạng tệp được Discord cho phép
- Giới hạn kích thước tệp: 10MB
- Hệ thống tự động renew link CDN Discord khi bị hết hạn (thường là hết hạn sau 24h)
- Custom URL thay vì xài thẳng CDN của Discord
- Giao diện đơn giản, dễ sử dụng

## Yêu cầu

- Node.js (phiên bản 16 trở lên)
- Bot Discord với quyền gửi tệp tin & add sẵn bot vào server
- Mysql

## Cài đặt

1. Cài đặt:
```
npm install
```

2. Tạo tệp `.env` với nội dung:
```
DISCORD_BOT_TOKEN=token_bot_discord_của_bạn
SERVER_ID=id_máy_chủ_discord
PORT=3000
```

3. Khởi động máy chủ:
```
npm start
```

Ứng dụng sẽ chạy tại `http://localhost:3000`.

## Cách sử dụng

1. Mở ứng dụng trong trình duyệt
2. Chọn tệp cần tải lên (kéo thả hoặc nhấp vào nút chọn tệp)
3. Nhấn nút tải lên
4. Nhận URL tùy chỉnh cho tệp đã tải lên 
