import React, { useState, useEffect, useRef } from "react";
import { Card, Upload, Button, message, Spin, Typography, Radio, Tooltip, Modal, Input, Alert, Descriptions, Tag } from "antd";
import { UploadOutlined, HighlightOutlined, LeftOutlined, RightOutlined, PlusOutlined, DeleteOutlined, SafetyCertificateOutlined, UsbOutlined, CheckCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import axios from "axios";
import Cookies from "js-cookie";
import { formatFileName } from "../../utils/formatFileName";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL;

const SignDocument = () => {
  const [file, setFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null); // The actual PDF blob for preview
  const [signature, setSignature] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // PDF state
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 }); // original PDF size
  
  // Rnd state - Array of signatures
  const [signaturesPos, setSignaturesPos] = useState([]);
  const [signatureType, setSignatureType] = useState("DIGITAL_SIGNATURE"); // DIGITAL_SIGNATURE | ELECTRONIC_SIGNATURE
  const [currentUser, setCurrentUser] = useState(null);
  
  // USB Token Modal states
  const [isTokenModalVisible, setIsTokenModalVisible] = useState(false);
  const [tokenPin, setTokenPin] = useState("");
  const [submittingToken, setSubmittingToken] = useState(false);
  const [detectedCert, setDetectedCert] = useState({
    subject: "TRƯỜNG CAO ĐẲNG NAM SÀI GÒN",
    issuer: "VNPT-CA / BAN CƠ YẾU CHÍNH PHỦ",
    serialNumber: "5401020088998877",
    validTo: "31/12/2028"
  });
  const containerRef = useRef(null);

  useEffect(() => {
    fetchMySignature();
  }, []);

  const fetchMySignature = async () => {
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.get(`${API_URL}/api/signature/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.signature) setSignature(res.data.signature);
      if (res.data.digitalCertificate) {
        setDetectedCert(res.data.digitalCertificate);
      } else {
        setDetectedCert({
          subject: "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
          issuer: "Viettel-CA SHA2 / Viettel Group",
          serialNumber: "5404FFFEB7033FB324B728D3C2E92FE6",
          validTo: "19/09/2028"
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUploadFile = async (info) => {
    const selectedFile = info.fileList[0]?.originFileObj || info.fileList[0] || info.file;
    if (!selectedFile) return;

    setFile(selectedFile);
    setSignaturesPos([]); // Reset signatures on new file
    
    // If it is Word, we need to convert it via API to preview
    if (selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || selectedFile.type === "application/msword") {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile, formatFileName(selectedFile.name));
        const token = Cookies.get("accessToken");
        const res = await axios.post(`${API_URL}/api/signature/convert-preview`, formData, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob"
        });
        setPdfFile(URL.createObjectURL(res.data));
      } catch (e) {
        message.error("Lỗi khi chuyển Word sang PDF để xem trước.");
      } finally {
        setLoading(false);
      }
    } else {
      // Direct PDF
      setPdfFile(URL.createObjectURL(selectedFile));
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    // Tự động thêm 1 khung chữ ký ở trang 1
    setSignaturesPos([{ id: Date.now(), x: 50, y: 50, width: (signatureType === "DIGITAL_SIGNATURE" && !signature?.fileId) ? 220 : 150, height: (signatureType === "DIGITAL_SIGNATURE" && !signature?.fileId) ? 85 : 75, pageNum: 1 }]);
  };

  const onPageLoadSuccess = (page) => {
    setPdfDimensions({
      width: page.originalWidth,
      height: page.originalHeight
    });
  };

  const addSignature = () => {
    setSignaturesPos([...signaturesPos, { id: Date.now(), x: 50, y: 50, width: (signatureType === "DIGITAL_SIGNATURE" && !signature?.fileId) ? 220 : 150, height: (signatureType === "DIGITAL_SIGNATURE" && !signature?.fileId) ? 85 : 75, pageNum: pageNumber }]);
  };

  const removeSignature = (id) => {
    setSignaturesPos(signaturesPos.filter(s => s.id !== id));
  };

  const updateSignature = (id, newProps) => {
    setSignaturesPos(signaturesPos.map(s => s.id === id ? { ...s, ...newProps } : s));
  };

    const submitSignature = () => {
    if (signatureType === "ELECTRONIC_SIGNATURE" && !signature) {
      message.error("Bạn chưa cấu hình chữ ký điện tử! Vui lòng vào 'Cấu hình chữ ký' để tải ảnh lên trước.");
      return;
    }
    if (!file) {
      message.error("Vui lòng chọn file văn bản!");
      return;
    }
    if (signaturesPos.length === 0) {
      message.error("Vui lòng đặt ít nhất 1 chữ ký!");
      return;
    }

    if (signatureType === "DIGITAL_SIGNATURE") {
      // Gọi trực tiếp phần mềm USB Token của nhà cung cấp trên máy tính
      executeSign(true);
    } else {
      executeSign(false);
    }
  };

  const handleConfirmTokenSign = () => {
    if (!tokenPin || tokenPin.length < 4) {
      message.warning("Vui lòng nhập mã PIN bảo mật của USB Token (tối thiểu 4 ký tự)!");
      return;
    }
    executeSign(true);
  };

  const executeSign = async (isToken = false) => {
    const containerNode = containerRef.current;
    if (!containerNode) return;
    const domWidth = containerNode.getBoundingClientRect().width;
    const scale = pdfDimensions.width / domWidth;

    const mappedSignatures = signaturesPos.map(sig => ({
      pageNum: sig.pageNum,
      x: sig.x * scale,
      y: pdfDimensions.height - ((sig.y + sig.height) * scale),
      width: sig.width * scale,
      height: sig.height * scale
    }));

    setLoading(true);
    if (isToken) setSubmittingToken(true);

    try {
      let fileToUpload = file;

      // PHƯƠNG ÁN 1: BẬT PHẦN MỀM KÝ SỐ USB TOKEN CHÍNH THỨC CỦA NHÀ CUNG CẤP TRÊN MÁY TÍNH
      if (signatureType === "DIGITAL_SIGNATURE") {
        try {
          message.loading({ content: "Đang gọi phần mềm USB Token trên máy tính để nhập mã PIN...", key: "sign_process", duration: 0 });
          const localFormData = new FormData();
          localFormData.append("file", file, formatFileName(file.name));

          const localRes = await fetch("http://localhost:8989/sign", {
            method: "POST",
            body: localFormData
          });

          if (!localRes.ok) {
            throw new Error("Không thể kết nối phần mềm Ký số (Local Service 8989). Vui lòng đảm bảo dịch vụ ký số đang chạy trên máy tính!");
          }

          const signedBlob = await localRes.blob();
          fileToUpload = new File([signedBlob], formatFileName(file.name), { type: "application/pdf" });
          message.success({ content: "Xác thực USB Token và ký số thành công!", key: "sign_process" });
        } catch (localErr) {
          message.destroy("sign_process");
          throw new Error(localErr.message || "Lỗi khi gọi phần mềm USB Token");
        }
      }

      // Lưu trữ văn bản đã ký lên hệ thống
      const formData = new FormData();
      formData.append("pdfFile", fileToUpload, formatFileName(fileToUpload.name));
      formData.append("signatures", JSON.stringify(mappedSignatures));
      formData.append("signatureType", signatureType);
      if (isToken) {
        formData.append("certificateInfo", JSON.stringify(detectedCert));
      }

      const token = Cookies.get("accessToken");
      await axios.post(`${API_URL}/api/signature/sign-pdf`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });

      message.success("Ký số và lưu văn bản thành công!");
      setIsTokenModalVisible(false);
      window.location.href = "/signature/archive";
    } catch (e) {
      message.error(e.response?.data?.message || e.message || "Lỗi khi ký văn bản");
    } finally {
      setLoading(false);
      if (isToken) setSubmittingToken(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <Title level={3} className="mb-6 text-gray-800">Ký văn bản nhiều vị trí</Title>
      
      {!signature && (
        <div className="mb-4 p-4 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
          Bạn chưa cấu hình chữ ký điện tử. Vui lòng vào <b>Cấu hình chữ ký</b> để tải ảnh lên trước khi ký.
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3 space-y-4">
          <Card title="1. Chọn tài liệu" className="shadow-xs rounded-xl border border-slate-200">
            <Upload 
              beforeUpload={() => false}
              maxCount={1}
              onChange={handleUploadFile}
              accept=".pdf,.doc,.docx"
              showUploadList={true}
            >
              <Button icon={<UploadOutlined />} className="w-full h-9 font-medium">Tải file (PDF, Word)</Button>
            </Upload>
            <div className="mt-2.5 text-slate-500 text-xs leading-relaxed">
              Hệ thống tự động chuyển đổi Word sang PDF và cho phép chọn vị trí đóng dấu.
            </div>
          </Card>

          <Card title="2. Hình thức ký" className="shadow-xs rounded-xl border border-slate-200">
            <Radio.Group
              value={signatureType}
              onChange={(e) => {
                const newType = e.target.value;
                setSignatureType(newType);
                // Cập nhật lại kích thước các ô ký hiện có cho vừa vặn
                setSignaturesPos(prev => prev.map(s => ({
                  ...s,
                  width: (newType === "DIGITAL_SIGNATURE" && !signature?.fileId) ? 220 : 150,
                  height: (newType === "DIGITAL_SIGNATURE" && !signature?.fileId) ? 85 : 75
                })));
              }}
              className="w-full flex flex-col gap-2.5"
            >
              <Radio value="DIGITAL_SIGNATURE" className="p-3 border border-slate-200 rounded-lg hover:border-blue-400 transition-colors w-full m-0 bg-blue-50/40">
                <div className="flex items-start gap-2">
                  <SafetyCertificateOutlined className="text-blue-600 text-base mt-0.5" />
                  <div>
                    <div className="font-semibold text-xs text-blue-900">Chữ ký số (USB Token / Chứng thư số)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Đóng dấu ký số xác thực điện tử. Hệ thống ưu tiên hiển thị hình ảnh chữ ký của bạn; nếu chưa có ảnh chữ ký sẽ hiển thị khung chứng thư số xác thực.
                    </div>
                  </div>
                </div>
              </Radio>

              <Radio value="ELECTRONIC_SIGNATURE" className="p-3 border border-slate-200 rounded-lg hover:border-blue-400 transition-colors w-full m-0 bg-slate-50/60">
                <div className="flex items-start gap-2">
                  <HighlightOutlined className="text-slate-600 text-base mt-0.5" />
                  <div>
                    <div className="font-semibold text-xs text-slate-800">Chữ ký điện tử nội bộ</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Chèn trực tiếp hình ảnh chữ ký đã cấu hình của bạn vào văn bản.
                    </div>
                  </div>
                </div>
              </Radio>
            </Radio.Group>
          </Card>
        </div>

        <Card title="2. Đóng dấu (Kéo thả)" className="w-full md:w-2/3 shadow-sm" bodyStyle={{ padding: 0 }}>
          {loading && <div className="p-8 text-center"><Spin tip="Đang xử lý tài liệu..." /></div>}
          
          {!loading && pdfFile && (
            <div className="flex flex-col items-center bg-gray-200 p-4">
              <div className="flex justify-between items-center w-full max-w-[600px] mb-2 bg-white p-2 rounded shadow">
                <Button 
                  icon={<LeftOutlined />} 
                  disabled={pageNumber <= 1} 
                  onClick={() => setPageNumber(p => p - 1)}
                />
                <Text>Trang {pageNumber} / {numPages}</Text>
                <Button 
                  icon={<RightOutlined />} 
                  disabled={pageNumber >= numPages} 
                  onClick={() => setPageNumber(p => p + 1)}
                />
                <Button type="dashed" icon={<PlusOutlined />} onClick={addSignature} className="ml-4">
                  Thêm chữ ký ở trang này
                </Button>
              </div>

              <div className="relative border border-gray-300 shadow bg-white" style={{ maxWidth: 800 }} ref={containerRef}>
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<Spin className="m-10" />}
                >
                  <Page 
                    pageNumber={pageNumber} 
                    onLoadSuccess={onPageLoadSuccess}
                    renderTextLayer={false} 
                    renderAnnotationLayer={false} 
                    width={600} 
                  />
                </Document>

                {(signature || signatureType === "DIGITAL_SIGNATURE") && signaturesPos.map(sig => (
                  sig.pageNum === pageNumber && (
                    <Rnd
                      key={sig.id}
                      bounds="parent"
                      position={{ x: sig.x, y: sig.y }}
                      size={{ width: sig.width, height: sig.height }}
                      onDragStop={(e, d) => updateSignature(sig.id, { x: d.x, y: d.y })}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        updateSignature(sig.id, {
                          width: ref.offsetWidth,
                          height: ref.offsetHeight,
                          ...position,
                        });
                      }}
                      className="border-2 border-blue-500 border-dashed bg-blue-50 bg-opacity-30 cursor-move group"
                    >
                      <Button 
                        type="primary" danger shape="circle" icon={<DeleteOutlined />} 
                        size="small" 
                        className="absolute -top-3 -right-3 hidden group-hover:block z-50"
                        onClick={() => removeSignature(sig.id)}
                      />
                      {signatureType === "DIGITAL_SIGNATURE" ? (
                        signature?.fileId ? (
                          /* Khi có ảnh chữ ký: Chỉ hiển thị hình ảnh chữ ký của người ký */
                          <div className="w-full h-full relative pointer-events-none select-none">
                            <img 
                              src={`${API_URL}/api/signature/image/${signature.fileId}`} 
                              className="w-full h-full object-contain mix-blend-multiply" 
                              alt="Chữ ký"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://placehold.co/150x50/f9fafb/9ca3af?text=L%E1%BB%97i+%E1%BA%A3nh";
                              }}
                            />
                            <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-[8px] px-1 py-0.2 rounded-tl font-medium flex items-center gap-0.5 opacity-80">
                              <SafetyCertificateOutlined className="text-[7px]" /> Ký số
                            </div>
                          </div>
                        ) : (
                          /* Khi KHÔNG có ảnh chữ ký: Hiển thị khung thông tin nội dung chứng thư số */
                          <div className="w-full h-full bg-blue-50/95 border border-blue-600 rounded p-2 flex flex-col justify-center text-[10px] text-blue-950 pointer-events-none select-none leading-snug overflow-hidden">
                            <div className="flex items-center gap-1 font-bold text-blue-800 uppercase truncate">
                              <SafetyCertificateOutlined className="text-blue-600" />
                              KÝ BỞI: {detectedCert.subject}
                            </div>
                            <div className="text-[9px] text-slate-600 truncate mt-0.5">
                              CHỨNG THƯ SỐ: {detectedCert.issuer}
                            </div>
                            <div className="text-[8.5px] text-slate-600 truncate">
                              SERIAL: {detectedCert.serialNumber}
                            </div>
                            <div className="text-[8px] text-emerald-600 font-semibold mt-1">
                              [ CHỨNG THỰC SỐ HỢP LỆ ]
                            </div>
                          </div>
                        )
                      ) : (
                        signature?.fileId ? (
                          <img 
                            src={`${API_URL}/api/signature/image/${signature.fileId}`} 
                            className="w-full h-full object-contain pointer-events-none mix-blend-multiply" 
                            alt="Chữ ký"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "https://placehold.co/150x50/f9fafb/9ca3af?text=L%E1%BB%97i+%E1%BA%A3nh";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 italic">
                            Chưa có ảnh chữ ký
                          </div>
                        )
                      )}
                    </Rnd>
                  )
                ))}
              </div>
              
              <div className="mt-6 w-full max-w-[600px] flex justify-between items-center bg-white p-4 rounded shadow">
                <Text strong>Tổng số chữ ký: {signaturesPos.length}</Text>
                <Button type="primary" size="large" icon={<HighlightOutlined />} onClick={submitSignature} disabled={(!signature && signatureType === "ELECTRONIC_SIGNATURE") || signaturesPos.length === 0}>
                  {signatureType === "DIGITAL_SIGNATURE" ? "Ký số & Lưu văn bản" : "Tiến hành Ký & Lưu"}
                </Button>
              </div>
            </div>
          )}
          
          {!pdfFile && !loading && (
            <div className="p-10 text-center text-gray-400">
              Chưa có tài liệu nào được chọn để xem trước
            </div>
          )}
        </Card>
      </div>
      {/* Modal xác thực USB Token & Nhập mã PIN */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-indigo-700 text-base font-bold">
            <UsbOutlined className="text-lg" /> Xác thực Ký số USB Token (Chứng thư số)
          </div>
        }
        open={isTokenModalVisible}
        onCancel={() => {
          setIsTokenModalVisible(false);
          setTokenPin("");
        }}
        onOk={handleConfirmTokenSign}
        confirmLoading={submittingToken}
        okText="Ký số ngay"
        cancelText="Đóng"
        width={520}
      >
        <div className="space-y-4 py-2">
          <Alert
            type="info"
            showIcon
            message="Đã phát hiện thiết bị Chữ ký số / USB Token"
            description="Thông tin chứng thư số sẽ được nhúng trực tiếp kèm dấu chữ ký số vào văn bản PDF."
            className="text-xs"
          />

          <Card size="small" className="bg-slate-50 border border-slate-200">
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 font-medium">Chủ thể chứng thư (Subject):</label>
                <Input
                  size="small"
                  value={detectedCert.subject}
                  onChange={(e) => setDetectedCert({ ...detectedCert, subject: e.target.value })}
                  className="font-semibold text-slate-800 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium">Nhà cung cấp (Issuer):</label>
                  <Input
                    size="small"
                    value={detectedCert.issuer}
                    onChange={(e) => setDetectedCert({ ...detectedCert, issuer: e.target.value })}
                    className="text-xs font-medium text-blue-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium">Số Serial:</label>
                  <Input
                    size="small"
                    value={detectedCert.serialNumber}
                    onChange={(e) => setDetectedCert({ ...detectedCert, serialNumber: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200 text-slate-500">
                <span>Hạn sử dụng: <b className="text-slate-700">{detectedCert.validTo || "19/09/2028"}</b></span>
                <span className="text-emerald-600 font-medium">● Thiết bị USB Token Viettel-CA</span>
              </div>
            </div>
          </Card>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nhập mã PIN USB Token để ký: <span className="text-red-500">*</span>
            </label>
            <Input.Password
              placeholder="Nhập mã PIN Token (mặc định: 12345678)"
              value={tokenPin}
              onChange={(e) => setTokenPin(e.target.value)}
              className="text-xs"
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1 mb-0">
              Mã PIN do nhà cung cấp thiết bị USB Token cấp để xác nhận quyền ký số.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SignDocument;
