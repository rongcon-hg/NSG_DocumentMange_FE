/* eslint-disable react/prop-types */
/* eslint-disable no-useless-escape */
import React, { useRef, useState } from "react";
import { Modal, Button, Radio, Alert, message } from "antd";
import {
  PrinterOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  CloseOutlined,
  ProfileOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const STATUS_LABELS = {
  OPEN: "Đang thu thập",
  SUBMITTED: "Chờ nộp lưu",
  ARCHIVED: "Đã vào kho lưu trữ",
  DISCARDED: "Tiêu hủy",
};

/**
 * Modal in và xuất báo cáo Hồ sơ công việc theo quy chuẩn hành chính Nhà nước
 * (Nghị định 30/2020/NĐ-CP & Thông tư 02/2019/TT-BNV về công tác văn thư, lưu trữ)
 */
const ArchivePrintReportModal = ({
  open,
  onClose,
  folder,
  foldersList = [],
  reportType = "single", // "single": Mục lục tài liệu 1 hồ sơ | "list": Danh mục các hồ sơ
}) => {
  const printRef = useRef(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [currentReportType, setCurrentReportType] = useState(reportType);

  // Đồng bộ lại khi prop thay đổi
  React.useEffect(() => {
    setCurrentReportType(reportType);
  }, [reportType, open]);


  // 1. In trực tiếp (A4 sắc nét qua iframe)
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>In Báo Cáo Hồ Sơ Công Việc</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 20mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 13pt;
            line-height: 1.35;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .table-bordered th, .table-bordered td {
            border: 1px solid #000;
            padding: 5px 6px;
            font-size: 12pt;
            vertical-align: middle;
          }
          .table-bordered th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2 !important;
            -webkit-print-color-adjust: exact;
          }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .italic { font-style: italic; }
          .uppercase { text-transform: uppercase; }
          tr {
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 400);
  };

  // 2. Xuất file PDF bằng html2pdf.js
  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const printElement = printRef.current;
      if (!printElement) return;

      message.loading({ content: "Đang khởi tạo file PDF chuẩn...", key: "pdf_archive_export" });

      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const fileName =
        currentReportType === "single" && folder
          ? `Muc_luc_ho_so_${folder.folderCode?.replace(/[\/\\?%*:|"<>]/g, "_") || "HS"}.pdf`
          : `Danh_muc_ho_so_cong_viec_${dayjs().format("YYYYMMDD_HHmm")}.pdf`;

      const opt = {
        margin: [10, 10, 10, 15],
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(printElement).save();
      message.success({ content: "Xuất file PDF thành công!", key: "pdf_archive_export" });
    } catch (err) {
      console.warn("html2pdf lỗi, fallback sang in PDF của trình duyệt:", err);
      message.info("Đang chuyển sang hộp thoại in của trình duyệt để lưu PDF...");
      handlePrint();
    } finally {
      setExportingPdf(false);
    }
  };

  // 3. Xuất file Word (.doc định dạng chuẩn HTML Word XML)
  const handleExportWord = () => {
    try {
      const printContent = printRef.current;
      if (!printContent) return;

      const fileName =
        currentReportType === "single" && folder
          ? `Muc_luc_ho_so_${folder.folderCode?.replace(/[\/\\?%*:|"<>]/g, "_") || "HS"}.doc`
          : `Danh_muc_ho_so_cong_viec_${dayjs().format("YYYYMMDD_HHmm")}.doc`;

      const wordHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>Báo cáo hồ sơ</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 210mm 297mm;
      margin: 20mm 15mm 20mm 25mm;
      mso-header-margin: 35.4pt;
      mso-footer-margin: 35.4pt;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 13pt;
      line-height: 1.35;
      color: #000000;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    .table-bordered th, .table-bordered td {
      border: 1px solid #000000;
      padding: 5px 7px;
      font-size: 12pt;
    }
    .table-bordered th {
      background-color: #f2f2f2;
      font-weight: bold;
      text-align: center;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="Section1">
    ${printContent.innerHTML}
  </div>
</body>
</html>`;

      const blob = new Blob(["\ufeff", wordHtml], {
        type: "application/msword;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      message.success(`Đã tải xuống file Word: ${fileName}`);
    } catch (err) {
      console.error("Lỗi xuất Word:", err);
      message.error("Có lỗi xảy ra khi tạo file Word!");
    }
  };

  const renderSingleFolderContent = () => {
    if (!folder) {
      return (
        <div className="text-center p-8 text-gray-500">
          Chưa chọn hồ sơ nào để in báo cáo. Vui lòng chọn hồ sơ từ danh sách.
        </div>
      );
    }

    const items = folder.items || [];
    const totalPages = items.reduce((acc, curr) => acc + (Number(curr.pageCount) || 1), 0);
    const creatorName = folder.creator?.name || "Nguyễn Văn Luyến";
    const deptName = folder.department?.departmentName || "Phòng Tổ chức - Hành chính";

    return (
      <div style={{ padding: "10px 5px", color: "#000", fontFamily: "'Times New Roman', Times, serif" }}>
        {/* Header Quốc hiệu & Đơn vị (Nghị định 30/2020/NĐ-CP) */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
          <tbody>
            <tr>
              <td style={{ width: "45%", textAlign: "center", verticalAlign: "top" }}>
                <div style={{ fontSize: "11pt", textTransform: "uppercase" }}>ỦY BAN NHÂN DÂN</div>
                <div style={{ fontSize: "11pt", textTransform: "uppercase" }}>THÀNH PHỐ HỒ CHÍ MINH</div>
                <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  TRƯỜNG CAO ĐẲNG BÁCH KHOA
                </div>
                <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  NAM SÀI GÒN
                </div>
                {deptName && (
                  <div style={{ fontSize: "10.5pt", fontWeight: "bold", textTransform: "uppercase", marginTop: "2px" }}>
                    {deptName}
                  </div>
                )}
                <div style={{ borderBottom: "1px solid #000", width: "130px", margin: "4px auto 0 auto" }}></div>
              </td>
              <td style={{ width: "55%", textAlign: "center", verticalAlign: "top" }}>
                <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div style={{ fontSize: "11pt", fontWeight: "bold" }}>Độc lập - Tự do - Hạnh phúc</div>
                <div style={{ borderBottom: "1px solid #000", width: "150px", margin: "4px auto 0 auto" }}></div>
                <div style={{ fontSize: "11pt", fontStyle: "italic", marginTop: "8px" }}>
                  Thành phố Hồ Chí Minh, ngày {dayjs().format("DD")} tháng {dayjs().format("MM")} năm {dayjs().format("YYYY")}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tiêu đề biểu mẫu */}
        <div style={{ textAlign: "center", margin: "20px 0 15px 0" }}>
          <div style={{ fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase" }}>
            MỤC LỤC VĂN BẢN, TÀI LIỆU TRONG HỒ SƠ
          </div>
          <div style={{ fontSize: "12pt", fontStyle: "italic", marginTop: "4px" }}>
            (Ban hành kèm theo Quy định về lập hồ sơ và nộp lưu hồ sơ vào Lưu trữ cơ quan)
          </div>
        </div>

        {/* Khung Thông tin chi tiết Hồ sơ công việc */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", fontSize: "12pt" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 0", width: "18%", fontWeight: "bold" }}>Mã hồ sơ:</td>
              <td style={{ padding: "4px 0", width: "32%" }}>{folder.folderCode}</td>
              <td style={{ padding: "4px 0", width: "20%", fontWeight: "bold" }}>Thời hạn bảo quản:</td>
              <td style={{ padding: "4px 0", width: "30%" }}>{folder.retentionPeriod || "10 năm"}</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 0", fontWeight: "bold" }}>Tiêu đề hồ sơ:</td>
              <td style={{ padding: "4px 0" }} colSpan={3}>
                <span style={{ fontWeight: "bold" }}>{folder.title}</span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 0", fontWeight: "bold" }}>Đơn vị lập:</td>
              <td style={{ padding: "4px 0" }}>{deptName}</td>
              <td style={{ padding: "4px 0", fontWeight: "bold" }}>Năm học / Niên khóa:</td>
              <td style={{ padding: "4px 0" }}>{folder.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`}</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 0", fontWeight: "bold" }}>Người lập hồ sơ:</td>
              <td style={{ padding: "4px 0" }}>{creatorName}</td>
              <td style={{ padding: "4px 0", fontWeight: "bold" }}>Trạng thái hồ sơ:</td>
              <td style={{ padding: "4px 0" }}>{STATUS_LABELS[folder.status] || folder.status}</td>
            </tr>
            {folder.description && (
              <tr>
                <td style={{ padding: "4px 0", fontWeight: "bold" }}>Ghi chú vụ việc:</td>
                <td style={{ padding: "4px 0" }} colSpan={3}>
                  <span style={{ fontStyle: "italic" }}>{folder.description}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Bảng Danh mục tài liệu thành phần chuẩn */}
        <table className="table-bordered" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>STT</th>
              <th style={{ width: "120px" }}>Số, ký hiệu văn bản</th>
              <th style={{ width: "95px" }}>Ngày, tháng</th>
              <th>Tên loại và trích yếu nội dung văn bản</th>
              <th style={{ width: "120px" }}>Tác giả văn bản</th>
              <th style={{ width: "55px" }}>Số tờ</th>
              <th style={{ width: "80px" }}>Ghi chú</th>
            </tr>
            <tr style={{ fontSize: "10pt", fontStyle: "italic", background: "#fafafa" }}>
              <th style={{ fontWeight: "normal" }}>(1)</th>
              <th style={{ fontWeight: "normal" }}>(2)</th>
              <th style={{ fontWeight: "normal" }}>(3)</th>
              <th style={{ fontWeight: "normal" }}>(4)</th>
              <th style={{ fontWeight: "normal" }}>(5)</th>
              <th style={{ fontWeight: "normal" }}>(6)</th>
              <th style={{ fontWeight: "normal" }}>(7)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "15px", fontStyle: "italic", color: "#666" }}>
                  Chưa có tài liệu thành phần nào được đưa vào hồ sơ này.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item._id || idx}>
                  <td style={{ textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ textAlign: "center", fontWeight: "500" }}>{item.documentNumber || "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    {item.date ? dayjs(item.date).format("DD/MM/YYYY") : dayjs(item.createdAt).format("DD/MM/YYYY")}
                  </td>
                  <td>
                    <div style={{ fontWeight: "600" }}>{item.title}</div>
                    <div style={{ fontSize: "10pt", color: "#555" }}>Phân loại: {item.itemType || "Văn bản"}</div>
                  </td>
                  <td style={{ textAlign: "center" }}>{item.author || deptName}</td>
                  <td style={{ textAlign: "center" }}>{item.pageCount || 1}</td>
                  <td style={{ textAlign: "center", fontSize: "11pt" }}>{item.note || "Bản chính"}</td>
                </tr>
              ))
            )}
            <tr style={{ fontWeight: "bold", background: "#f9fafb" }}>
              <td colSpan={5} style={{ textAlign: "right", paddingRight: "10px" }}>
                TỔNG CỘNG:
              </td>
              <td style={{ textAlign: "center" }}>{totalPages}</td>
              <td style={{ textAlign: "center", fontSize: "10pt" }}>{items.length} văn bản</td>
            </tr>
          </tbody>
        </table>

        {/* Thuyết minh kết thúc hồ sơ (Chứng từ kết thúc theo quy định lưu trữ) */}
        <div style={{ fontSize: "12pt", margin: "10px 0 20px 0" }}>
          <div>
            - Mục lục này gồm: <strong>{items.length}</strong> văn bản, tài liệu.
          </div>
          <div style={{ marginTop: "4px" }}>
            - Tổng số trang/tờ tài liệu đóng kèm: <strong>{totalPages}</strong> tờ.
          </div>
          <div style={{ marginTop: "4px" }}>
            - Tình trạng tài liệu khi nộp lưu: Tài liệu đầy đủ, nguyên vẹn, rõ ràng theo đúng quy định.
          </div>
        </div>

        {/* Chữ ký xác nhận bên dưới (Người lập hồ sơ & Trưởng đơn vị) */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "25px", fontSize: "12pt" }}>
          <tbody>
            <tr>
              <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>NGƯỜI LẬP HỒ SƠ</div>
                <div style={{ fontStyle: "italic", fontSize: "10.5pt" }}>(Ký, ghi rõ họ tên)</div>
                <div style={{ height: "70px" }}></div>
                <div style={{ fontWeight: "bold" }}>{creatorName}</div>
              </td>
              <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>TRƯỞNG ĐƠN VỊ / LÃNH ĐẠO DUYỆT</div>
                <div style={{ fontStyle: "italic", fontSize: "10.5pt" }}>(Ký, đóng dấu hoặc ghi rõ họ tên)</div>
                <div style={{ height: "70px" }}></div>
                <div style={{ fontWeight: "bold" }}>..................................................</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderListFoldersContent = () => {
    return (
      <div style={{ padding: "10px 5px", color: "#000", fontFamily: "'Times New Roman', Times, serif" }}>
        {/* Header Quốc hiệu & Đơn vị */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
          <tbody>
            <tr>
              <td style={{ width: "45%", textAlign: "center", verticalAlign: "top" }}>
                <div style={{ fontSize: "11pt", textTransform: "uppercase" }}>ỦY BAN NHÂN DÂN</div>
                <div style={{ fontSize: "11pt", textTransform: "uppercase" }}>THÀNH PHỐ HỒ CHÍ MINH</div>
                <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  TRƯỜNG CAO ĐẲNG BÁCH KHOA
                </div>
                <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  NAM SÀI GÒN
                </div>
                <div style={{ borderBottom: "1px solid #000", width: "130px", margin: "4px auto 0 auto" }}></div>
              </td>
              <td style={{ width: "55%", textAlign: "center", verticalAlign: "top" }}>
                <div style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div style={{ fontSize: "11pt", fontWeight: "bold" }}>Độc lập - Tự do - Hạnh phúc</div>
                <div style={{ borderBottom: "1px solid #000", width: "150px", margin: "4px auto 0 auto" }}></div>
                <div style={{ fontSize: "11pt", fontStyle: "italic", marginTop: "8px" }}>
                  Thành phố Hồ Chí Minh, ngày {dayjs().format("DD")} tháng {dayjs().format("MM")} năm {dayjs().format("YYYY")}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tiêu đề */}
        <div style={{ textAlign: "center", margin: "20px 0 15px 0" }}>
          <div style={{ fontSize: "15pt", fontWeight: "bold", textTransform: "uppercase" }}>
            DANH MỤC HỒ SƠ LƯU TRỮ CƠ QUAN
          </div>
          <div style={{ fontSize: "12pt", fontStyle: "italic", marginTop: "4px" }}>
            (Hệ thống Văn phòng số - Khai thác và quản lý hồ sơ vụ việc cơ quan)
          </div>
        </div>

        {/* Bảng Danh mục hồ sơ */}
        <table className="table-bordered" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>STT</th>
              <th style={{ width: "120px" }}>Mã hồ sơ</th>
              <th>Tiêu đề hồ sơ vụ việc</th>
              <th style={{ width: "130px" }}>Đơn vị lập</th>
              <th style={{ width: "90px" }}>Thời hạn</th>
              <th style={{ width: "90px" }}>Niên khóa</th>
              <th style={{ width: "65px" }}>Số TL</th>
              <th style={{ width: "110px" }}>Trạng thái</th>
            </tr>
            <tr style={{ fontSize: "10pt", fontStyle: "italic", background: "#fafafa" }}>
              <th style={{ fontWeight: "normal" }}>(1)</th>
              <th style={{ fontWeight: "normal" }}>(2)</th>
              <th style={{ fontWeight: "normal" }}>(3)</th>
              <th style={{ fontWeight: "normal" }}>(4)</th>
              <th style={{ fontWeight: "normal" }}>(5)</th>
              <th style={{ fontWeight: "normal" }}>(6)</th>
              <th style={{ fontWeight: "normal" }}>(7)</th>
              <th style={{ fontWeight: "normal" }}>(8)</th>
            </tr>
          </thead>
          <tbody>
            {foldersList.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "15px", fontStyle: "italic", color: "#666" }}>
                  Không có hồ sơ nào trong danh sách.
                </td>
              </tr>
            ) : (
              foldersList.map((f, idx) => (
                <tr key={f._id || idx}>
                  <td style={{ textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ textAlign: "center", fontWeight: "bold" }}>{f.folderCode}</td>
                  <td>
                    <div style={{ fontWeight: "600" }}>{f.title}</div>
                    <div style={{ fontSize: "10pt", color: "#555" }}>Người lập: {f.creator?.name || "N/A"}</div>
                  </td>
                  <td style={{ textAlign: "center" }}>{f.department?.departmentName || "Cơ quan"}</td>
                  <td style={{ textAlign: "center" }}>{f.retentionPeriod || "10 năm"}</td>
                  <td style={{ textAlign: "center" }}>{f.academicYear}</td>
                  <td style={{ textAlign: "center" }}>{f.items?.length || 0}</td>
                  <td style={{ textAlign: "center", fontSize: "11pt" }}>{STATUS_LABELS[f.status] || f.status}</td>
                </tr>
              ))
            )}
            <tr style={{ fontWeight: "bold", background: "#f9fafb" }}>
              <td colSpan={6} style={{ textAlign: "right", paddingRight: "10px" }}>
                TỔNG SỐ HỒ SƠ:
              </td>
              <td style={{ textAlign: "center" }} colSpan={2}>
                {foldersList.length} hồ sơ
              </td>
            </tr>
          </tbody>
        </table>

        {/* Chữ ký xác nhận */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "30px", fontSize: "12pt" }}>
          <tbody>
            <tr>
              <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>NGƯỜI LẬP BIỂU</div>
                <div style={{ fontStyle: "italic", fontSize: "10.5pt" }}>(Ký, ghi rõ họ tên)</div>
                <div style={{ height: "70px" }}></div>
                <div style={{ fontWeight: "bold" }}>..................................................</div>
              </td>
              <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>THỦ TRƯỞNG CƠ QUAN / ĐƠN VỊ</div>
                <div style={{ fontStyle: "italic", fontSize: "10.5pt" }}>(Ký, đóng dấu hoặc ghi rõ họ tên)</div>
                <div style={{ height: "70px" }}></div>
                <div style={{ fontWeight: "bold" }}>..................................................</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-blue-700 text-base font-bold">
          <ProfileOutlined className="text-xl text-blue-600" />
          <span>In Báo Cáo & Xuất Biểu Mẫu Hồ Sơ Công Việc (Chuẩn Hành Chính)</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose} icon={<CloseOutlined />}>
          Đóng
        </Button>,
        <Button
          key="word"
          icon={<FileWordOutlined className="text-blue-600" />}
          onClick={handleExportWord}
          className="border-blue-400 text-blue-700 hover:border-blue-600"
        >
          Tải file Word (.doc)
        </Button>,
        <Button
          key="pdf"
          icon={<FilePdfOutlined className="text-red-500" />}
          onClick={handleExportPdf}
          loading={exportingPdf}
          className="border-red-400 text-red-700 hover:border-red-600"
        >
          Xuất PDF chuẩn
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          className="bg-blue-600 hover:bg-blue-500"
          onClick={handlePrint}
        >
          In trực tiếp (A4)
        </Button>,
      ]}
    >
      <Alert
        message="Biểu mẫu mục lục văn bản & danh mục hồ sơ công việc được thiết kế theo đúng quy chuẩn Nghị định 30/2020/NĐ-CP và Thông tư 02/2019/TT-BNV"
        type="info"
        showIcon
        className="mb-3 text-xs"
      />

      {/* Tùy chọn chuyển đổi kiểu báo cáo nếu có cả folder và foldersList */}
      {folder && foldersList.length > 0 && (
        <div className="mb-3 flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-700">Chế độ biểu mẫu báo cáo:</div>
          <Radio.Group
            value={currentReportType}
            onChange={(e) => setCurrentReportType(e.target.value)}
            size="small"
          >
            <Radio.Button value="single">Mục lục hồ sơ hiện tại ({folder.folderCode})</Radio.Button>
            <Radio.Button value="list">Danh mục toàn bộ hồ sơ ({foldersList.length})</Radio.Button>
          </Radio.Group>
        </div>
      )}

      {/* Vùng xem trước nội dung in (A4 format) */}
      <div className="border border-slate-300 rounded-lg p-6 bg-white shadow-xs max-h-[62vh] overflow-y-auto">
        <div ref={printRef}>
          {currentReportType === "single" ? renderSingleFolderContent() : renderListFoldersContent()}
        </div>
      </div>
    </Modal>
  );
};

export default ArchivePrintReportModal;
