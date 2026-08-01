export default function AdminDashboardPage() {
  return (
    <>
      <div className="ab-h1">Tổng quan vận hành</div>

      <div className="ab-sub">
        Giao diện Claude Design đang được kết nối với dữ liệu Supabase.
      </div>

      <div className="ab-statrow">
        <div className="ab-stat">
          <div className="st-top">
            <span className="st-label">Tổng doanh thu đã thu</span>
            <span className="st-ico green">₫</span>
          </div>

          <div className="st-val">0đ</div>
          <div className="st-meta">
            <span className="st-trend flat">14 ngày</span>
          </div>
        </div>

        <div className="ab-stat">
          <div className="st-top">
            <span className="st-label">Đơn đang hoạt động</span>
            <span className="st-ico blue">▣</span>
          </div>

          <div className="st-val">0</div>
          <div className="st-meta">
            <span className="st-trend flat">14 ngày</span>
          </div>
        </div>

        <div className="ab-stat">
          <div className="st-top">
            <span className="st-label">Tổng số đơn hàng</span>
            <span className="st-ico violet">▤</span>
          </div>

          <div className="st-val">0</div>
          <div className="st-meta">
            <span className="st-trend flat">14 ngày</span>
          </div>
        </div>

        <div className="ab-stat">
          <div className="st-top">
            <span className="st-label">Lượt truy cập website</span>
            <span className="st-ico amber">◎</span>
          </div>

          <div className="st-val">0</div>
          <div className="st-meta">
            <span className="st-trend flat">14 ngày</span>
          </div>
        </div>
      </div>

      <div className="ab-dash">
        <div className="ab-dash-col">
          <div className="ab-card">
            <div className="ab-card-hd">
              <h3>Tổng quan hoạt động</h3>
            </div>

            <div className="ab-empty">
              Biểu đồ sẽ hiển thị sau khi nối dữ liệu thật.
            </div>
          </div>

          <div className="ab-card">
            <div className="ab-card-hd">
              <h3>Chuyến gần nhất</h3>
            </div>

            <div className="ab-empty">Chưa có đơn nào.</div>
          </div>
        </div>

        <div className="ab-dash-col">
          <div className="ab-card">
            <h3>Nguồn truy cập</h3>
            <div className="ab-empty">Chưa có dữ liệu truy cập.</div>
          </div>

          <div className="ab-card">
            <h3>Mục tiêu tháng</h3>
            <div className="ab-empty">Đang chờ dữ liệu thật.</div>
          </div>
        </div>
      </div>

      <div className="ab-card">
        <div className="ab-card-hd">
          <h3>Việc cần xử lý ngay</h3>
          <span className="ab-chip good" style={{ marginLeft: 'auto' }}>
            0 việc
          </span>
        </div>

        <div className="ab-empty">Không có việc tồn đọng.</div>
      </div>
    </>
  );
}