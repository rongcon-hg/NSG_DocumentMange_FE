import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Card, 
  Result, 
  Spin, 
  Tag, 
  Descriptions, 
  Button, 
  Typography, 
  Alert, 
  Divider, 
  Space 
} from "antd";
import { 
  CheckCircleFilled, 
  CloseCircleFilled, 
  FilePdfOutlined, 
  SafetyCertificateFilled, 
  DownloadOutlined, 
  HomeOutlined, 
  ShareAltOutlined 
} from "@ant-design/icons";
import axios from "axios";
import QRCode from "qrcode";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;
const API_URL = import.meta.env.VITE_API_URL || "";

const VerifyDocumentPage = () => {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    if (code) {
      fetchVerificationData(code);
      // Tạo QR code của trang hiện tại để tiện chia sẻ
      QRCode.toDataURL(window.location.href, { width: 180, margin: 1 })
        .then(setQrSrc)
        .catch(console.error);
    }
  }, [code]);

  const fetchVerificationData = async (verifyCode) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axios.get(`${API_URL}/documents/public-verify/${verifyCode}`);
      if (res.data && res.data.success) {
        setDocData(res.data.data);
      } else {
        setErrorMsg(res.data.message || "Không tìm thấy văn bản hợp lệ.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err.response?.data?.message || 
        "Không thể xác thực văn bản. Văn bản có thể không tồn tại hoặc đã bị gỡ bỏ."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Xác thực văn bản: ${docData?.docCode}`,
        text: docData?.shortDescription,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Đã sao chép liên kết xác thực vào bộ nhớ tạm!");
    }
  };

  const previewUrl = docData?.file?.fileId 
    ? `${API_URL}/api/drive/public-stream/${docData.file.fileId}`
    : null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header thương hiệu trường */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <img src="/logo.webp" alt="Logo Nam Sài Gòn" className="w-14 h-14 object-contain" />
            <div>
              <h1 className="text-sm sm:text-base font-bold text-blue-950 uppercase tracking-wide">
                Trường Cao đẳng Bách khoa Nam Sài Gòn
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Cổng Tra Cứu & Xác Thực Tính Toàn Vẹn Văn Bản Điện Tử
              </p>
            </div>
          </div>
          <Link to="/">
            <Button icon={<HomeOutlined />} type="default" size="middle">
              Vào hệ thống
            </Button>
          </Link>
        </div>

        {/* Nội dung xác thực */}
        {loading ? (
          <Card className="shadow-sm rounded-2xl text-center py-16">
            <Spin size="large" tip="Đang kiểm tra chứng thư và tính hợp lệ của văn bản..." />
          </Card>
        ) : errorMsg ? (
          <Card className="shadow-sm rounded-2xl border-rose-200">
            <Result
              status="warning"
              icon={<CloseCircleFilled className="text-rose-500" />}
              title={<span className="text-rose-600 font-bold">Văn bản không hợp lệ hoặc không tồn tại</span>}
              subTitle={errorMsg}
              extra={[
                <Link to="/" key="home">
                  <Button type="primary">Quay về trang chủ</Button>
                </Link>,
              ]}
            />
          </Card>
        ) : docData ? (
          <div className="space-y-6">
            {/* Banner trạng thái hợp lệ */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="bg-white/20 p-3 rounded-full flex-shrink-0">
                  <SafetyCertificateFilled className="text-3xl text-emerald-200" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-xs font-semibold mb-1">
                    <CheckCircleFilled /> VĂN BẢN CHÍNH THỨC & TOÀN VẸN
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
                    {docData.docCode}
                  </h2>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Mã tra cứu: <span className="font-mono font-bold">{docData.verificationCode}</span>
                  </p>
                </div>
              </div>

              <Button
                icon={<ShareAltOutlined />}
                onClick={handleShare}
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 rounded-lg text-xs"
              >
                Chia sẻ liên kết
              </Button>
            </div>

            {/* Thông tin chi tiết */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card 
                title={<span className="text-slate-800 font-bold text-sm uppercase">Thông tin chi tiết văn bản</span>}
                className="md:col-span-2 shadow-sm rounded-2xl border-slate-200"
              >
                <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                  <Descriptions.Item label="Số ký hiệu" span={2}>
                    <Text strong className="text-blue-900 text-base">{docData.docCode}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Số văn bản">{docData.docNum}</Descriptions.Item>
                  <Descriptions.Item label="Năm ban hành">{docData.year}</Descriptions.Item>
                  <Descriptions.Item label="Thể loại văn bản">
                    <Tag color="blue">{docData.variantName}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Ngày ban hành">
                    {docData.issuedDate ? dayjs(docData.issuedDate).format("DD/MM/YYYY HH:mm") : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Đơn vị ban hành" span={2}>
                    <Text strong>{docData.issuingDepartment}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Người ký duyệt" span={2}>
                    <span className="font-semibold text-slate-800">{docData.signerName}</span>
                    {docData.signerPosition && (
                      <span className="text-slate-500 text-xs ml-1">({docData.signerPosition})</span>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Trích yếu nội dung" span={2}>
                    <Paragraph className="text-slate-700 font-medium mb-0">
                      {docData.shortDescription || "Không có trích yếu."}
                    </Paragraph>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Thẻ QR và tải file */}
              <div className="space-y-6">
                <Card className="shadow-sm rounded-2xl border-slate-200 text-center">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Mã xác thực trực tuyến
                  </h3>
                  {qrSrc && (
                    <img 
                      src={qrSrc} 
                      alt="QR Tra Cứu" 
                      className="mx-auto w-36 h-36 p-1 border rounded-xl shadow-inner bg-white" 
                    />
                  )}
                  <p className="text-[11px] text-slate-400 mt-2">
                    Quét mã trên bằng Camera điện thoại hoặc Zalo để tra cứu trực tiếp.
                  </p>
                </Card>

                {docData.file && (
                  <Card className="shadow-sm rounded-2xl border-slate-200">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Tệp văn bản gốc đính kèm
                    </h3>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70 mb-3">
                      <FilePdfOutlined className="text-2xl text-rose-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {docData.file.fileName}
                        </p>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          Đã đóng mã xác thực
                        </span>
                      </div>
                    </div>
                    {previewUrl && (
                      <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                        <Button 
                          type="primary" 
                          icon={<DownloadOutlined />} 
                          block 
                          className="bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-xs"
                        >
                          Mở / Tải tệp PDF chính thức
                        </Button>
                      </a>
                    )}
                  </Card>
                )}
              </div>
            </div>

            {/* Khung nhúng PDF xem trực tiếp */}
            {previewUrl && (
              <Card 
                title={<span className="text-slate-800 font-bold text-sm uppercase">Xem trước văn bản gốc đã đóng dấu</span>}
                className="shadow-sm rounded-2xl border-slate-200 overflow-hidden"
              >
                <div className="w-full h-[650px] bg-slate-200 rounded-xl overflow-hidden border border-slate-300">
                  <iframe
                    src={`${previewUrl}#toolbar=1`}
                    title="Bản xem trước văn bản gốc"
                    className="w-full h-full border-none"
                  />
                </div>
              </Card>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4">
          Hệ thống Quản lý Văn bản & Điều hành Công việc © {new Date().getFullYear()} - Trường Cao đẳng Bách khoa Nam Sài Gòn
        </div>
      </div>
    </div>
  );
};

export default VerifyDocumentPage;
