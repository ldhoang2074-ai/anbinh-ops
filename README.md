# An Bình OPS — Admin (Next.js + Supabase)

Backend production cho hệ thống vận hành An Bình. Thay bản localStorage demo bằng
PostgreSQL + Google OAuth thật + phân quyền server-side + RLS.

## Trạng thái: Slice 1 (Auth + Org + Invitation + RBAC + RLS)

### Đã có
- **Migrations** (`supabase/migrations/0001..0009`): 30+ bảng, tiền BIGINT, cột chuẩn
  (id/organization_id/created_at/updated_at/created_by/updated_by/version/deleted_at),
  RLS deny-by-default, exclusion constraint chống trùng lịch, trigger (audit append-only,
  refund-reason, no-self-approval, remaining sync, auto-profile).
- **Seed** (`supabase/seed.sql`): org An Bình + 7 roles + 24 permissions + role_permissions.
- **Auth**: login page (nút Google thật), OAuth callback, logout, middleware + guard server
  (session → membership ACTIVE → org → permission).
- **Command layer** (`lib/commands`): khung `base.execute` 10 bước; command mẫu create_lead,
  lead_transition, assign_vehicle_driver (state machine + dispatch conflict server-side).
- **Repository adapter** (`lib/repositories`): UI chỉ gọi repository; READ qua Supabase (RLS),
  WRITE qua command.
- **Core logic** (`lib/core/*.mjs`): orderStateMachine, dispatchConflict, financeCalculator.
- **Migration tool** (`tools/migrate-localstorage.mjs`): JSON → Postgres, dry-run, mapping ID,
  chống duplicate, backup, báo cáo.
- **Tests**: unit (đã chạy 31/31 PASS), rls/e2e/security scripts (chờ Supabase).
- **Docs**: SUPABASE_SETUP, GOOGLE_OAUTH_SETUP, BACKEND_ARCHITECTURE, RBAC_MATRIX,
  RLS_MATRIX, SECURITY_CHECKLIST, DEPLOYMENT, BACKUP_RESTORE, TEST_REPORT.

## Chạy nhanh (local)
```bash
cd admin-next
npm install
npm run test:unit          # test logic thuần — KHÔNG cần Supabase
cp .env.example .env.local # rồi điền theo docs/SUPABASE_SETUP.md
npm run dev                # http://localhost:3000/login
```

## Cần cấu hình bên ngoài trước khi chạy full
1. Supabase project + migrations + seed → `docs/SUPABASE_SETUP.md`
2. Google OAuth → `docs/GOOGLE_OAUTH_SETUP.md`
3. RLS/E2E/security test → `docs/TEST_REPORT.md`

## Bàn giao Claude Code / Codex
Repo tự chứa; agent có terminal chạy: `supabase db push`, `psql < seed.sql`,
`npm run test:rls|e2e|security` với env thật để hoàn tất kiểm thử live.

## Slice tiếp theo
2) Lead→Quote→Deposit→Order · 3) Dispatch→Trip · 4) Payment→Expense→Settlement ·
5) Audit+Storage+Migration+Backup + gắn giao diện SaaS đầy đủ.
