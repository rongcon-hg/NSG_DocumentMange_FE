import React, { useState } from "react";
import { 
  Card, 
  Upload, 
  Button, 
  Typography, 
  Alert, 
  Tag, 
  Descriptions, 
  Spin, 
  Result, 
  Divider, 
  Space,
  Steps
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
  AuditOutlined
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
      return false; // Ngăn chặn AntD upload mặc định
    },
  };

  const handleReset = () => {
    setVerifyResult(null);
    setSelectedFile(null);
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Tiêu đề & Giới thiệu */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <SafetyCertificateFilled className="text-xl" />
            </div>
            <div>
              <Title level={3} className="!mb-0 text-slate-800 font-bold">
                Kiểm tra tính hợp lệ của chữ ký số
              </Title>
              <Text type="secondary" className="text-sm">
                Xác thực tính toàn vẹn của tệp PDF, thông tin chủ thể, nhà cung cấp CA (Viettel-CA, VNPT-CA...) và tính pháp lý của chữ ký số
              </Text>
            </div>
          </div>
        </div>

        {/* Khung tải file kiểm tra */}
        {!verifyResult && !loading && (
          <Card className="shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
            <Dragger {...uploadProps} className="p-8 bg-white hover:border-blue-500 transition-colors">
              <p className="ant-upload-drag-icon text-blue-600 mb-3">
                <InboxOutlined style={{ fontSize: 56 }} />
              </p>
              <p className="text-base font-semibold text-slate-800 mb-1">
                Kéo thả hoặc bấm vào đây để tải tệp PDF cần kiểm tra
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hỗ trợ các văn bản PDF được ký số qua USB Token (Viettel-CA, VNPT-CA...), chữ ký điện tử nội bộ NSG Office hoặc các văn bản ký số theo chuẩn quốc tế PAdES / Adobe PKCS#7.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                <FilePdfOutlined /> Định dạng: *.pdf (Tối đa 25MB)
              </div>
            </Dragger>

            {/* Các bước kiểm tra */}
            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Quy trình xác thực đa tầng tại NSG Office:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
                <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                    <KeyOutlined className="text-blue-600" /> 1. Xác thực Mã băm SHA-256
                  </div>
                  Đối soát tính toàn vẹn dữ liệu, đảm bảo nội dung tệp không bị chỉnh sửa sau khi ký.
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                    <AuditOutlined className="text-emerald-600" /> 2. Chứng thư số CA
                  </div>
                  Truy vết danh tính chủ thể ký số (Subject), nhà cung cấp chứng thực CA và số Serial Token.
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                    <ClockCircleOutlined className="text-indigo-600" /> 3. Dấu thời gian (Timestamp)
                  </div>
                  Xác nhận thời điểm phát hành chữ ký số và đối chiếu với quy chế lưu trữ văn bản số.
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Trạng thái đang phân tích */}
        {loading && (
          <Card className="shadow-sm border border-slate-200 rounded-2xl p-12 text-center">
            <Spin size="large" />
            <div className="mt-4 font-semibold text-slate-700 text-base">
              Đang phân tích cấu trúc mật mã & kiểm tra chữ ký số...
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Đang giải mã luồng stream PDF, bóc tách chứng thư số và đối soát mã băm SHA-256.
            </div>
          </Card>
        )}

        {/* Kết quả kiểm tra */}
        {verifyResult && (
          <div className="space-y-6">
            <Card className="shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
              {/* Banner trạng thái */}
              <div
                className={`p-6 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  verifyResult.isValid
                    ? "bg-emerald-50/80 border-emerald-100 text-emerald-900"
                    : "bg-rose-50/80 border-rose-100 text-rose-900"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {verifyResult.isValid ? (
                    <CheckCircleFilled className="text-4xl text-emerald-500 shrink-0" />
                  ) : (
                    <CloseCircleFilled className="text-4xl text-rose-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-lg font-bold">
                      {verifyResult.isValid
                        ? "CHỮ KÝ SỐ HỢP LỆ VÀ TOÀN VẸN"
                        : "TÀI LIỆU CHƯA CÓ CHỮ KÝ SỐ HỢP CHUẨN"}
                    </div>
                    <div className="text-xs sm:text-sm mt-0.5 opacity-90">
                      {verifyResult.summaryMessage}
                    </div>
                  </div>
                </div>

                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                  className="shrink-0 font-medium"
                >
                  Kiểm tra tệp khác
                </Button>
              </div>

              {/* Thông tin tệp */}
              <div className="p-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Thông tin tệp được kiểm tra:
                </div>
                <Descriptions
                  bordered
                  size="small"
                  column={{ xs: 1, sm: 2, md: 3 }}
                  className="bg-white rounded-lg overflow-hidden"
                >
                  <Descriptions.Item label="Tên tệp tin" span={2}>
                    <span className="font-semibold text-slate-800">
                      <FilePdfOutlined className="text-red-500 mr-1.5" />
                      {verifyResult.fileName || selectedFile?.name}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Dung lượng">
                    {verifyResult.fileSizeFormatted}
                  </Descriptions.Item>
                  <Descriptions.Item label="Số trang">
                    {verifyResult.pageCount || 1} trang
                  </Descriptions.Item>
                  <Descriptions.Item label="Số lượng chữ ký số">
                    <Tag color={verifyResult.signaturesCount > 0 ? "blue" : "default"}>
                      {verifyResult.signaturesCount} chữ ký
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Mã băm SHA-256" span={3}>
                    <span className="font-mono text-[11px] text-slate-600 select-all break-all">
                      {verifyResult.fileHashSha256}
                    </span>
                  </Descriptions.Item>
                </Descriptions>

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
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
                            <div className="flex items-center gap-2">
                              <SafetyCertificateFilled className="text-emerald-500 text-lg" />
                              <span className="font-bold text-slate-800 text-sm">
                                Chữ ký số #{idx + 1}: {sig.subject}
                              </span>
                            </div>
                            <Tag color="success" className="font-semibold">
                              HỢP LỆ (VALID)
                            </Tag>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 block font-medium">Chủ thể chứng thư (Subject):</span>
                              <span className="font-semibold text-slate-700 text-sm">
                                {sig.subject}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Nhà cung cấp CA (Issuer):</span>
                              <span className="font-semibold text-blue-700">
                                {sig.issuer}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Số Serial chứng thư:</span>
                              <span className="font-mono text-slate-700 font-medium">
                                {sig.serialNumber}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Thời điểm ký (Signing Time):</span>
                              <span className="text-slate-700 font-medium">
                                <ClockCircleOutlined className="mr-1 text-slate-400" />
                                {sig.signingTime}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Phương thức chữ ký số:</span>
                              <Tag color="cyan">{sig.type}</Tag>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Tính toàn vẹn (Integrity):</span>
                              <span className="text-emerald-700 font-medium flex items-center gap-1">
                                <CheckCircleFilled className="text-emerald-500 text-xs" /> {sig.integrity}
                              </span>
                            </div>
                          </div>

                          {sig.user && (
                            <div className="mt-3 pt-2 border-t border-slate-200/60 text-xs text-slate-500 flex items-center gap-2">
                              <span>Tài khoản người ký trong hệ thống:</span>
                              <span className="font-medium text-slate-700">{sig.user.name} ({sig.user.email})</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kết luận pháp lý */}
                <div className="mt-6 p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 leading-relaxed">
                  <div className="font-semibold text-blue-950 mb-1 flex items-center gap-1.5">
                    <GlobalOutlined /> Căn cứ pháp lý về giá trị chữ ký số:
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
