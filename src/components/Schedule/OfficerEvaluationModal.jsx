import React, { useState, useRef } from "react";
import { Modal, Button, Tag, Space, Alert, Typography, Divider, Rate, Input, Radio } from "antd";
import { PrinterOutlined, FileTextOutlined, CheckCircleOutlined, TrophyOutlined } from "@ant-design/icons";

const { Text, Title, Paragraph } = Typography;

/**
 * Modal hiển thị và in Phiếu tự đánh giá, xếp loại chất lượng viên chức
 * Theo chuẩn Nghị định 90/2020/NĐ-CP & Quy chế thi đua đánh giá nội bộ NSG.
 */
export default function OfficerEvaluationModal({ visible, onCancel, userKpi, periodName = "Năm học 2025 - 2026" }) {
  const printRef = useRef(null);
  const [selfRank, setSelfRank] = useState(
    userKpi?.rank === "XS" ? "XS" : userKpi?.rank === "T" ? "T" : "HTNV"
  );
  const [selfRemarks, setSelfRemarks] = useState(
    "Trong kỳ công tác, bản thân luôn chấp hành tốt chủ trương chính sách của Đảng và Pháp luật của Nhà nước; hoàn thành đầy đủ, đúng hạn các nhiệm vụ chuyên môn được giao."
  );

  if (!userKpi) return null;

  const totalScore = userKpi.finalScore || userKpi.score || 0;
  const totalTasks = userKpi.totalTasks || 0;
  const completedTasks = userKpi.completedTasks || 0;
  const onTimeTasks = userKpi.onTimeTasks || 0;
  const lateTasks = userKpi.lateTasks || 0;
  const exceededTasks = userKpi.totalExceededTasks || 0;
  const onTimeRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Phiếu đánh giá, xếp loại chất lượng viên chức - ${userKpi.user?.name || "Cán bộ"}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.4; color: #000; padding: 25px 35px; }
            .header-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
            .header-table td { vertical-align: top; text-align: center; }
            .title { text-align: center; font-weight: bold; font-size: 14pt; margin: 15px 0 5px 0; text-transform: uppercase; }
            .sub-title { text-align: center; font-style: italic; margin-bottom: 20px; font-size: 12pt; }
            .section-title { font-weight: bold; font-size: 13pt; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; }
            .kpi-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .kpi-table th, .kpi-table td { border: 1px solid #333; padding: 6px 10px; font-size: 12pt; }
            .kpi-table th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
            .signature-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
            .signature-table td { vertical-align: top; text-align: center; width: 50%; }
            .font-bold { font-weight: bold; }
            .italic { font-style: italic; }
            @media print {
              body { padding: 0; }
              @page { size: A4; margin: 20mm 15mm 20mm 20mm; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-indigo-700">
          <FileTextOutlined className="text-xl" />
          <span>Phiếu Đánh Giá, Xếp Loại Chất Lượng Viên Chức Tự Động</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={850}
      footer={[
        <Button key="back" onClick={onCancel}>
          Đóng
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          style={{ backgroundColor: "#4f46e5", borderColor: "#4f46e5" }}
          onClick={handlePrint}
        >
          In Phiếu Đánh Giá (A4 / PDF)
        </Button>,
      ]}
    >
      <Alert
        message="Hệ thống tự động đồng bộ kết quả KPI & tiến độ công việc số vào mẫu chuẩn Nghị định 90/2020/NĐ-CP"
        type="info"
        showIcon
        className="mb-4 text-xs"
      />

      <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="text-xs font-semibold text-slate-700 mb-2">Tự xếp loại chất lượng:</div>
        <Radio.Group value={selfRank} onChange={(e) => setSelfRank(e.target.value)} size="small">
          <Radio.Button value="XS">Hoàn thành xuất sắc</Radio.Button>
          <Radio.Button value="T">Hoàn thành tốt</Radio.Button>
          <Radio.Button value="HTNV">Hoàn thành nhiệm vụ</Radio.Button>
          <Radio.Button value="KHT">Không hoàn thành</Radio.Button>
        </Radio.Group>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-xs max-h-[60vh] overflow-y-auto">
        <div ref={printRef}>
          {/* Header Quốc hiệu / Đơn vị */}
          <table className="header-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
            <tbody>
              <tr>
                <td style={{ width: "48%", textAlign: "center", verticalAlign: "top" }}>
                  <div style={{ fontSize: "11pt", textTransform: "uppercase" }}>ỦY BAN NHÂN DÂN</div>
                  <div style={{ fontSize: "11pt", textTransform: "uppercase" }}>THÀNH PHỐ HỒ CHÍ MINH</div>
                  <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                    TRƯỜNG CAO ĐẲNG BÁCH KHOA
                  </div>
                  <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                    NAM SÀI GÒN
                  </div>
                  <div style={{ fontSize: "10pt", borderBottom: "1px solid #333", width: "120px", margin: "4px auto 2px auto" }}></div>
                </td>
                <td style={{ width: "55%", textAlign: "center", verticalAlign: "top" }}>
                  <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </div>
                  <div style={{ fontSize: "11pt", fontWeight: "bold" }}>Độc lập - Tự do - Hạnh phúc</div>
                  <div style={{ fontSize: "10pt", borderBottom: "1px solid #333", width: "150px", margin: "2px auto" }}></div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Tiêu đề */}
          <div style={{ textAlign: "center", margin: "20px 0 5px 0" }}>
            <div style={{ fontSize: "14pt", fontWeight: "bold", textTransform: "uppercase" }}>
              PHIẾU ĐÁNH GIÁ, XẾP LOẠI CHẤT LƯỢNG VIÊN CHỨC
            </div>
            <div style={{ fontSize: "12pt", fontStyle: "italic", marginTop: "4px" }}>
              {periodName} (Dữ liệu KPI Hệ thống số)
            </div>
          </div>

          {/* Phần I: Thông tin cá nhân */}
          <div style={{ marginTop: "20px", fontSize: "12pt" }}>
            <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "8px" }}>
              I. THÔNG TIN VIÊN CHỨC / NGƯỜI LAO ĐỘNG
            </div>
            <div style={{ paddingLeft: "15px", lineHeight: "1.8" }}>
              <div>- Họ và tên: <strong>{userKpi.user?.name || "N/A"}</strong></div>
              <div>- Chức vụ / Chức danh: <strong>{userKpi.user?.position?.positionName || "Viên chức"}</strong></div>
              <div>- Đơn vị công tác: <strong>{userKpi.user?.department?.departmentName || "Trường Cao đẳng Bách khoa Nam Sài Gòn"}</strong></div>
              <div>- Hạng chức danh nghề nghiệp / Mã ngạch: <strong>{userKpi.user?.civilServantRank || "Viên chức chuyên ngành"}</strong></div>
            </div>
          </div>

          {/* Phần II: Kết quả tự đánh giá */}
          <div style={{ marginTop: "20px", fontSize: "12pt" }}>
            <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "8px" }}>
              II. KẾT QUẢ THỰC HIỆN NHIỆM VỤ THEO HỢP ĐỒNG / KẾ HOẠCH
            </div>
            
            <table className="kpi-table" style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", width: "40px" }}>STT</th>
                  <th style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "left" }}>Tiêu chí theo dõi trên hệ thống số</th>
                  <th style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", width: "120px" }}>Kết quả ghi nhận</th>
                  <th style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", width: "100px" }}>Điểm quy đổi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center" }}>1</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px" }}>Tổng số công việc được giao phân bổ</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", fontWeight: "bold" }}>{totalTasks} việc</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center" }}>-</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center" }}>2</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px" }}>Số công việc đã hoàn thành đúng và trước hạn</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", color: "#16a34a", fontWeight: "bold" }}>
                    {onTimeTasks} việc ({onTimeRate}%)
                  </td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", fontWeight: "bold" }}>
                    {userKpi.onTimeScore || 0} / 70 đ
                  </td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center" }}>3</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px" }}>Điểm đánh giá chất lượng nghiệm thu từ Quản lý trực tiếp</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center" }}>
                    {userKpi.avgQualityRate ? `${userKpi.avgQualityRate}% chất lượng` : "Đạt chuẩn"}
                  </td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", fontWeight: "bold" }}>
                    {userKpi.qualityScore || 0} / 30 đ
                  </td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center" }}>4</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px" }}>Số lượng công việc xuất sắc / vượt chỉ tiêu yêu cầu</td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", fontWeight: "bold" }}>
                    {exceededTasks} việc
                  </td>
                  <td style={{ border: "1px solid #333", padding: "6px 8px", textAlign: "center", color: "#d97706", fontWeight: "bold" }}>
                    +{userKpi.totalBonusScore || 0} đ
                  </td>
                </tr>
                <tr style={{ backgroundColor: "#f3f4f6", fontWeight: "bold" }}>
                  <td colSpan={3} style={{ border: "1px solid #333", padding: "8px", textAlign: "right" }}>
                    TỔNG ĐIỂM ĐÁNH GIÁ KPI HỆ THỐNG:
                  </td>
                  <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center", fontSize: "13pt", color: "#4f46e5" }}>
                    {totalScore} / 100 đ
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: "10px", paddingLeft: "15px" }}>
              <div>- Tự nhận xét ưu, khuyết điểm: {selfRemarks}</div>
              <div style={{ marginTop: "6px" }}>
                - Tự nhận mức xếp loại chất lượng: <strong>
                  {selfRank === "XS" ? "Hoàn thành xuất sắc nhiệm vụ" :
                   selfRank === "T" ? "Hoàn thành tốt nhiệm vụ" :
                   selfRank === "HTNV" ? "Hoàn thành nhiệm vụ" : "Không hoàn thành nhiệm vụ"}
                </strong>
              </div>
            </div>
          </div>

          {/* Phần III: Ý kiến của Thủ trưởng đơn vị */}
          <div style={{ marginTop: "20px", fontSize: "12pt" }}>
            <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "8px" }}>
              III. Ý KIẾN NHẬN XÉT CỦA LÃNH ĐẠO TRỰC TIẾP
            </div>
            <div style={{ borderBottom: "1px dotted #666", minHeight: "24px", margin: "8px 0" }}></div>
            <div style={{ borderBottom: "1px dotted #666", minHeight: "24px", margin: "8px 0" }}></div>
          </div>

          {/* Bảng ký tên */}
          <table className="signature-table" style={{ width: "100%", marginTop: "35px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                  <div style={{ fontStyle: "italic", fontSize: "11pt" }}>TP. Hồ Chí Minh, ngày ..... tháng ..... năm 202...</div>
                  <div style={{ fontWeight: "bold", fontSize: "12pt", marginTop: "4px" }}>THỦ TRƯỞNG ĐƠN VỊ</div>
                  <div style={{ fontStyle: "italic", fontSize: "10pt" }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ height: "70px" }}></div>
                </td>
                <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                  <div style={{ fontStyle: "italic", fontSize: "11pt" }}>TP. Hồ Chí Minh, ngày ..... tháng ..... năm 202...</div>
                  <div style={{ fontWeight: "bold", fontSize: "12pt", marginTop: "4px" }}>NGƯỜI TỰ ĐÁNH GIÁ</div>
                  <div style={{ fontStyle: "italic", fontSize: "10pt" }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ height: "70px" }}></div>
                  <div style={{ fontWeight: "bold" }}>{userKpi.user?.name || ""}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
