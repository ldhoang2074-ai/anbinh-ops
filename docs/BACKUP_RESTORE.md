# Backup & Restore — An Bình OPS

## Sao lưu định kỳ (Supabase)
- **PITR / Daily backups**: bật trong Supabase (Project → Database → Backups). Gói trả phí có Point-in-Time Recovery.
- **Export thủ công**: `pg_dump` qua connection string (Project Settings → Database → Connection string):
  ```bash
  pg_dump "$SUPABASE_DB_URL" --no-owner --format=custom -f anbinh-$(date +%F).dump
  ```

## Restore
```bash
pg_restore --clean --no-owner -d "$SUPABASE_DB_URL" anbinh-YYYY-MM-DD.dump
```

## Trước khi migrate dữ liệu localStorage
`tools/migrate-localstorage.mjs` tự backup trạng thái đích vào `tools/backups/target-<ts>.backup.json` trước khi ghi (chỉ ở chế độ `--commit`). Luôn chạy `--dry-run` trước để xem báo cáo.

## Dữ liệu nhạy cảm
- Bản backup chứa dữ liệu kinh doanh → lưu nơi an toàn, không commit (`tools/backups/` đã trong `.gitignore`).
- audit_events là append-only; backup giữ nguyên toàn bộ lịch sử.

## Kiểm thử khôi phục
Định kỳ restore vào project staging để xác nhận backup dùng được (không chỉ tạo backup rồi bỏ đó).
