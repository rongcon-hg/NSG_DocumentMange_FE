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
  ShareAltOutlined,
  EyeOutlined
} from "@ant-design/icons";
import axios from "axios";
import QRCode from "qrcode";
import dayjs from "dayjs";
import { useSystemConfig } from "../../context/SystemConfigContext.jsx";

const { Title, Text, Paragraph } = Typography;
const API_URL = import.meta.env.VITE_API_URL || "";

const VerifyDocumentPage = () => {
  const { code } = useParams();
  const { config, getLogoUrl } = useSystemConfig();
  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const [previewError, setPreviewError] = useState(false);

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

  // Các nguồn link xem trước và tải PDF
  const directStreamUrl = docData?.file?.fileId 
    ? `${API_URL}/api/drive/public-stream/${docData.file.fileId}`
    : null;
    
  const googleDrivePreviewUrl = docData?.file?.fileId
    ? `https://drive.google.com/file/d/${docData.file.fileId}/preview`
    : null;

  const googleDriveViewUrl = docData?.file?.fileId
    ? `https://drive.google.com/file/d/${docData.file.fileId}/view?usp=sharing`
    : null;

  // Tính toán số ký hiệu chuẩn kết hợp số và ký hiệu: VD 328/NSG-TCHC
  let displayDocCode = docData?.docCode || "";
  if (docData?.docNum && docData?.docCode && !docData.docCode.startsWith(`${docData.docNum}/`)) {
    displayDocCode = `${docData.docNum}/${docData.docCode}`;
  }

  const schoolName = config?.organizationName || "Trường Cao đẳng Bách khoa Nam Sài Gòn";
  const systemTitle = config?.siteName || "Hệ thống Quản lý Văn bản & Điều hành Công việc";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-4 sm:py-8 px-2.5 sm:px-6 lg:px-12">
      <div className="max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
        {/* Header thương hiệu trường */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left min-w-0">
            <img src={getLogoUrl()} alt={schoolName} className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-blue-950 uppercase tracking-wide truncate">
                {schoolName}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Cổng Tra Cứu & Xác Thực Tính Toàn Vẹn Văn Bản Điện Tử
              </p>
            </div>
          </div>
          <Link to="/" className="w-full sm:w-auto">
            <Button icon={<HomeOutlined />} type="default" size="middle" className="w-full sm:w-auto font-medium">
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
          <div className="space-y-4 sm:space-y-6">
            {/* Banner trạng thái hợp lệ - Tone màu xanh dương chủ đạo */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center sm:text-left min-w-0">
                <div className="bg-white/15 p-3 rounded-2xl flex-shrink-0">
                  <SafetyCertificateFilled className="text-3xl sm:text-4xl text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-semibold mb-1">
                    <CheckCircleFilled className="text-emerald-400" /> VĂN BẢN CHÍNH THỨC & TOÀN VẸN
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-wide">
                    {displayDocCode}
                  </h2>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Mã tra cứu: <span className="font-mono font-bold text-cyan-200">{docData.verificationCode}</span>
                  </p>
                </div>
              </div>
              <Button 
                ghost 
                icon={<ShareAltOutlined />} 
                onClick={handleShare}
                className="rounded-full border-white/40 text-white hover:bg-white/15 text-xs px-4 flex-shrink-0"
              >
                Chia sẻ liên kết
              </Button>
            </div>

            {/* Chi tiết văn bản và cột phụ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Thông tin chi tiết */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                <Card 
                  title={<span className="text-slate-800 font-bold text-sm uppercase">Thông tin chi tiết văn bản</span>}
                  className="shadow-sm rounded-2xl border-slate-200"
                >
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-sm">
                    {/* Dòng 1: Thể loại văn bản, Năm ban hành, Ngày ban hành (3 cột chia đều) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200">
                      <div className="flex flex-col sm:flex-row">
                        <div className="bg-slate-50 px-3.5 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider sm:w-36 flex-shrink-0 flex items-center border-b sm:border-b-0 sm:border-r border-slate-200">
                          Thể loại văn bản
                        </div>
                        <div className="px-3.5 py-2.5 flex-1 flex items-center bg-white">
                          <Tag color="blue" className="text-xs font-semibold px-2 py-0.5 m-0">
                            {docData.variantName || "Văn bản"}
                          </Tag>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row">
                        <div className="bg-slate-50 px-3.5 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider sm:w-32 flex-shrink-0 flex items-center border-b sm:border-b-0 sm:border-r border-slate-200">
                          Năm ban hành
                        </div>
                        <div className="px-3.5 py-2.5 flex-1 flex items-center bg-white">
                          <Tag color="cyan" className="text-xs font-semibold px-2 py-0.5 m-0">
                            {docData.year}
                          </Tag>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row">
                        <div className="bg-slate-50 px-3.5 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider sm:w-32 flex-shrink-0 flex items-center border-b sm:border-b-0 sm:border-r border-slate-200">
                          Ngày ban hành
                        </div>
                        <div className="px-3.5 py-2.5 flex-1 flex items-center bg-white font-medium text-slate-700">
                          {docData.issuedDate ? dayjs(docData.issuedDate).format("DD/MM/YYYY HH:mm") : "---"}
                        </div>
                      </div>
                    </div>

                    {/* Dòng 2: Cơ quan ban hành (1 dòng) */}
                    <div className="flex flex-col sm:flex-row border-b border-slate-200">
                      <div className="bg-slate-50 px-3.5 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider sm:w-36 flex-shrink-0 flex items-center border-b sm:border-b-0 sm:border-r border-slate-200">
                        Cơ quan ban hành
                      </div>
                      <div className="px-3.5 py-2.5 flex-1 bg-white font-bold text-slate-800 flex items-center">
                        {docData.issuingDepartment || schoolName}
                      </div>
                    </div>

                    {/* Dòng 3: Người ký, Chức vụ (Chia đều 2 cột 50% - 50%, ẩn nếu là Văn bản đến) */}
                    {docData.docType !== 'received' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200">
                        <div className="flex flex-col sm:flex-row">
                          <div className="bg-slate-50 px-3.5 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider sm:w-36 flex-shrink-0 flex items-center border-b sm:border-b-0 sm:border-r border-slate-200">
                            Người ký
                          </div>
                          <div className="px-3.5 py-2.5 flex-1 bg-white font-semibold text-slate-900 flex items-center">
                            {docData.signerName || "Lãnh đạo đơn vị"}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row">
                          <div className="bg-slate-50 px-3.5 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider sm:w-36 flex-shrink-0 flex items-center border-b sm:border-b-0 sm:border-r border-slate-200">
                            Chức vụ
                          </div>
                          <div className="px-3.5 py-2.5 flex-1 bg-white text-slate-700 font-medium flex items-center">
                            {docData.signerPosition || "Hiệu trưởng"}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dòng 4: Trích yếu nội dung (1 dòng) */}
                    <div className="flex flex-col sm:flex-row">
                      <div className="bg-slate-50 px-3.5 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider sm:w-36 flex-shrink-0 flex items-start pt-3 border-b sm:border-b-0 sm:border-r border-slate-200">
                        Trích yếu nội dung
                      </div>
                      <div className="px-3.5 py-2.5 flex-1 bg-white text-slate-800 text-justify leading-relaxed font-medium">
                        {docData.shortDescription || "Không có trích yếu."}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Cột phụ: QR & Tải file */}
              <div className="space-y-4 sm:space-y-6">
                <Card className="shadow-sm rounded-2xl border-slate-200 text-center">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Mã xác thực trực tuyến
                  </h3>
                  <div className="flex justify-center mb-3">
                    {qrSrc ? (
                      <img src={qrSrc} alt="QR Code" className="w-36 h-36 border border-slate-200 rounded-xl p-1 bg-white shadow-sm" />
                    ) : (
                      <Spin />
                    )}
                  </div>
                  <Tag color="blue" className="font-mono text-xs px-2.5 py-0.5">
                    {docData.verificationCode}
                  </Tag>
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
                      <FilePdfOutlined className="text-2xl text-rose-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={docData.file.fileName}>
                          {docData.file.fileName}
                        </p>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          Đã đóng mã QR xác thực
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {directStreamUrl && (
                        <a href={directStreamUrl} target="_blank" rel="noopener noreferrer">
                          <Button 
                            type="primary" 
                            icon={<DownloadOutlined />} 
                            block 
                            className="bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-xs"
                          >
                            Tải tệp PDF chính thức
                          </Button>
                        </a>
                      )}
                      {googleDriveViewUrl && (
                        <a href={googleDriveViewUrl} target="_blank" rel="noopener noreferrer">
                          <Button 
                            type="default" 
                            icon={<EyeOutlined />} 
                            block 
                            className="rounded-lg font-medium text-xs border-slate-300 text-slate-700"
                          >
                            Mở xem trên Google Drive
                          </Button>
                        </a>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Khung nhúng PDF xem trực tiếp */}
            {docData.file?.fileId && (
              <Card 
                title={
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-bold text-sm uppercase">Xem trước văn bản gốc đã đóng dấu</span>
                    {googleDriveViewUrl && (
                      <a 
                        href={googleDriveViewUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-blue-600 hover:text-blue-800 font-normal normal-case flex items-center gap-1"
                      >
                        <EyeOutlined /> Mở toàn màn hình
                      </a>
                    )}
                  </div>
                }
                className="shadow-sm rounded-2xl border-slate-200 overflow-hidden"
              >
                <div className="w-full h-[550px] sm:h-[700px] bg-slate-200 rounded-xl overflow-hidden border border-slate-300">
                  <iframe
                    src={googleDrivePreviewUrl || `${directStreamUrl}#toolbar=1`}
                    title="Bản xem trước văn bản gốc"
                    className="w-full h-full border-none"
                    onError={() => setPreviewError(true)}
                  />
                </div>
              </Card>
            )}
          </div>
        ) : null}

        {/* Footer đồng bộ với cấu hình hệ thống */}
        <div className="text-center text-xs text-slate-400 py-4">
          {systemTitle} © {new Date().getFullYear()} - {schoolName}
        </div>
      </div>
    </div>
  );
};

export default VerifyDocumentPage;
