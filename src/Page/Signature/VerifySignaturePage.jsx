import React, { useState } from "react";
import { 
  Card, 
  Upload, 
  Button, 
  Typography, 
  Tag, 
  Descriptions, 
  Spin, 
  Space
} from "antd";
import { 
  InboxOutlined, 
  CheckCircleFilled, 
  CloseCircleFilled, 
  SafetyCertificateFilled, 
  FilePdfOutlined, 
  ReloadOutlined,
  KeyOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  AuditOutlined,
  CopyOutlined,
  FileProtectOutlined
} from "@ant-design/icons";
import axios from "axios";
import Cookies from "js-cookie";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const API_URL = import.meta.env.VITE_API_URL || "";

const VerifySignaturePage = () => {
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleVerifyFile = async (file) => {
    setSelectedFile(file);
    setLoading(true);
    setVerifyResult(null);

    const formData = new FormData();
    formData.append("pdfFile", file);

    try {
      const token = Cookies.get("accessToken");
      const headers = { "Content-Type": "multipart/form-data" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await axios.post(`${API_URL}/api/signature/verify`, formData, { headers });
      setVerifyResult(res.data);
    } catch (err) {
      console.error("Lỗi xác thực chữ ký số:", err);
      setVerifyResult({
        success: false,
        isValid: false,
        summaryMessage: err.response?.data?.message || "Có lỗi xảy ra trong quá trình đối soát chữ ký số.",
        signatures: []
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    name: "pdfFile",
    multiple: false,
    accept: ".pdf",
    showUploadList: false,
    beforeUpload: (file) => {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        alert("Chỉ chấp nhận tệp định dạng PDF!");
        return Upload.LIST_IGNORE;
      }
      handleVerifyFile(file);
      return false;
    },
  };

  const handleReset = () => {
    setVerifyResult(null);
    setSelectedFile(null);
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 bg-slate-50 min-h-screen w-full">
      <div className="w-full">
        {/* Tiêu đề & Giới thiệu */}
        <div className="mb-4 md:mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shrink-0">
                <SafetyCertificateFilled className="text-xl sm:text-2xl" />
              </div>
              <div>
                <Title level={3} className="!mb-0 text-slate-800 font-bold text-lg sm:text-2xl">
                  Kiểm tra tính hợp lệ của chữ ký số
                </Title>
                <Text type="secondary" className="text-xs sm:text-sm">
                  Xác thực tính toàn vẹn tệp PDF, thông tin chủ thể, nhà cung cấp CA (Viettel-CA, VNPT-CA...) và giá trị pháp lý
                </Text>
              </div>
            </div>

            {verifyResult && (
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleReset}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                Kiểm tra tệp khác
              </Button>
            )}
          </div>
        </div>

        {/* Khung tải file kiểm tra */}
        {!verifyResult && !loading && (
          <div className="space-y-4">
            <Card className="shadow-2xs border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <Dragger {...uploadProps} className="p-4 sm:p-8 md:p-12 bg-white hover:border-blue-500 transition-colors">
                <p className="ant-upload-drag-icon text-blue-600 mb-3">
                  <InboxOutlined style={{ fontSize: 56 }} />
                </p>
                <p className="text-base sm:text-lg font-semibold text-slate-800 mb-1">
                  Kéo thả hoặc bấm vào đây để chọn tệp PDF cần kiểm tra
                </p>
                <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto px-2">
                  Hỗ trợ văn bản PDF ký số qua USB Token (Viettel-CA, VNPT-CA...), chữ ký điện tử nội bộ NSG Office hoặc các văn bản ký số theo chuẩn quốc tế PAdES / Adobe PKCS#7.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium rounded-full">
                  <FilePdfOutlined /> Định dạng: *.pdf (Tối đa 25MB)
                </div>
              </Dragger>
            </Card>

            {/* Các bước kiểm tra */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Quy trình xác thực đa tầng tại NSG Office:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm text-slate-600">
                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="font-semibold text-slate-800 flex items-center gap-2 mb-1.5">
                    <KeyOutlined className="text-blue-600 text-base" /> 1. Xác thực Mã băm SHA-256
                  </div>
                  Đối soát tính toàn vẹn dữ liệu, kiểm tra tệp không bị chỉnh sửa sau thời điểm ký.
                </div>
                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="font-semibold text-slate-800 flex items-center gap-2 mb-1.5">
                    <AuditOutlined className="text-emerald-600 text-base" /> 2. Chứng thư số CA
                  </div>
                  Truy vết danh tính chủ thể ký số (Subject), nhà cung cấp chứng thực CA và số Serial Token.
                </div>
                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="font-semibold text-slate-800 flex items-center gap-2 mb-1.5">
                    <ClockCircleOutlined className="text-indigo-600 text-base" /> 3. Dấu thời gian (Timestamp)
                  </div>
                  Xác nhận thời điểm phát hành chữ ký số và đối chiếu theo quy chế văn thư lưu trữ.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trạng thái đang phân tích */}
        {loading && (
          <Card className="shadow-2xs border border-slate-200 rounded-2xl p-10 md:p-16 text-center bg-white">
            <Spin size="large" />
            <div className="mt-5 font-bold text-slate-800 text-base sm:text-lg">
              Đang phân tích cấu trúc mật mã & kiểm tra chữ ký số...
            </div>
            <div className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Đang giải mã luồng stream PDF, bóc tách chứng thư số và đối soát mã băm SHA-256 toàn vẹn.
            </div>
          </Card>
        )}

        {/* Kết quả kiểm tra */}
        {verifyResult && (
          <div className="space-y-4 md:space-y-6">
            <Card className="shadow-2xs border border-slate-200 rounded-2xl overflow-hidden bg-white p-0">
              {/* Banner trạng thái */}
              <div
                className={`p-4 sm:p-6 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  verifyResult.isValid
                    ? "bg-emerald-50/90 border-emerald-100 text-emerald-950"
                    : "bg-rose-50/90 border-rose-100 text-rose-950"
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                  {verifyResult.isValid ? (
                    <CheckCircleFilled className="text-3xl sm:text-4xl text-emerald-500 shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <CloseCircleFilled className="text-3xl sm:text-4xl text-rose-500 shrink-0 mt-0.5 sm:mt-0" />
                  )}
                  <div>
                    <div className="text-base sm:text-xl font-bold">
                      {verifyResult.isValid
                        ? "CHỮ KÝ SỐ HỢP LỆ VÀ TOÀN VẸN"
                        : "TÀI LIỆU CHƯA CÓ CHỮ KÝ SỐ HỢP CHUẨN"}
                    </div>
                    <div className="text-xs sm:text-sm mt-1 text-slate-700 leading-normal">
                      {verifyResult.summaryMessage}
                    </div>
                  </div>
                </div>

                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                  className="w-full sm:w-auto shrink-0 font-medium"
                >
                  Kiểm tra tệp khác
                </Button>
              </div>

              {/* Thông tin tệp */}
              <div className="p-4 sm:p-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileProtectOutlined className="text-blue-600" /> Thông tin tệp được kiểm tra:
                </div>
                
                <div className="overflow-x-auto">
                  <Descriptions
                    bordered
                    size="small"
                    column={{ xs: 1, sm: 2, md: 3, lg: 4 }}
                    className="bg-white rounded-lg min-w-full"
                  >
                    <Descriptions.Item label="Tên tệp tin" span={2}>
                      <span className="font-semibold text-slate-800 break-all text-xs sm:text-sm">
                        <FilePdfOutlined className="text-red-500 mr-1.5" />
                        {verifyResult.fileName || selectedFile?.name}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Dung lượng">
                      <span className="text-xs sm:text-sm font-medium">{verifyResult.fileSizeFormatted}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Số trang">
                      <span className="text-xs sm:text-sm font-medium">{verifyResult.pageCount || 1} trang</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Số lượng chữ ký">
                      <Tag color={verifyResult.signaturesCount > 0 ? "blue" : "default"} className="font-medium">
                        {verifyResult.signaturesCount} chữ ký
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Mã băm SHA-256" span={3}>
                      <span className="font-mono text-[11px] text-slate-600 select-all break-all block">
                        {verifyResult.fileHashSha256}
                      </span>
                    </Descriptions.Item>
                  </Descriptions>
                </div>

                {/* Danh sách chữ ký số được phát hiện */}
                {verifyResult.signatures && verifyResult.signatures.length > 0 && (
                  <div className="mt-6">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Chi tiết chứng thư số ({verifyResult.signatures.length}):
                    </div>

                    <div className="space-y-4">
                      {verifyResult.signatures.map((sig, idx) => (
                        <div
                          key={idx}
                          className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <SafetyCertificateFilled className="text-emerald-500 text-lg" />
                              <span className="font-bold text-slate-800 text-sm sm:text-base">
                                Chữ ký số #{idx + 1}: {sig.subject}
                              </span>
                            </div>
                            <Tag color="success" className="font-semibold self-start sm:self-auto">
                              HỢP LỆ (VALID)
                            </Tag>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                            <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                              <span className="text-[11px] text-slate-400 block font-semibold uppercase">Chủ thể chứng thư (Subject):</span>
                              <span className="font-bold text-slate-800 block mt-0.5 break-words">
                                {sig.subject}
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                              <span className="text-[11px] text-slate-400 block font-semibold uppercase">Nhà cung cấp CA (Issuer):</span>
                              <span className="font-bold text-blue-700 block mt-0.5 break-words">
                                {sig.issuer}
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                              <span className="text-[11px] text-slate-400 block font-semibold uppercase">Số Serial chứng thư:</span>
                              <span className="font-mono text-slate-800 font-medium block mt-0.5 break-all">
                                {sig.serialNumber}
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                              <span className="text-[11px] text-slate-400 block font-semibold uppercase">Thời điểm ký (Signing Time):</span>
                              <span className="text-slate-700 font-medium block mt-0.5">
                                <ClockCircleOutlined className="mr-1 text-slate-400" />
                                {sig.signingTime}
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                              <span className="text-[11px] text-slate-400 block font-semibold uppercase">Chuẩn chữ ký số:</span>
                              <Tag color="cyan" className="mt-1 font-medium">
                                {sig.type}
                              </Tag>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                              <span className="text-[11px] text-slate-400 block font-semibold uppercase">Tính toàn vẹn (Integrity):</span>
                              <span className="text-emerald-700 font-medium flex items-center gap-1 mt-1 text-xs">
                                <CheckCircleFilled className="text-emerald-500 text-xs shrink-0" /> {sig.integrity}
                              </span>
                            </div>
                          </div>

                          {sig.user && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                              <span>Tài khoản người ký trong hệ thống:</span>
                              <span className="font-semibold text-slate-700">{sig.user.name} ({sig.user.email})</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kết luận pháp lý */}
                <div className="mt-6 p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs sm:text-sm text-blue-900 leading-relaxed">
                  <div className="font-semibold text-blue-950 mb-1 flex items-center gap-1.5 text-sm">
                    <GlobalOutlined className="text-blue-600" /> Căn cứ pháp lý về giá trị chữ ký số:
                  </div>
                  Chữ ký số và thông tin chứng thư số được xác thực tuân thủ theo quy định tại <strong>Luật Giao dịch điện tử số 20/2023/QH15</strong> và <strong>Nghị định 130/2018/NĐ-CP</strong> của Chính phủ về quy định chi tiết thi hành Luật Giao dịch điện tử về chữ ký số và dịch vụ chứng thực chữ ký số. Văn bản có giá trị pháp lý tương đương văn bản giấy có đóng dấu và ký tên.
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifySignaturePage;
