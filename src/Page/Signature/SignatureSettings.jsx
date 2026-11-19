import React, { useState, useEffect } from "react";
import { Card, Upload, Button, message, Spin, Space, Typography, Input, Form, Divider, Tag, Alert, Select, Tooltip } from "antd";
import { UploadOutlined, SaveOutlined, SafetyCertificateOutlined, KeyOutlined, UsbOutlined, ReloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import axios from "axios";
import Cookies from "js-cookie";
import { formatFileName } from "../../utils/formatFileName";

const { Title, Text } = Typography;
const { Option } = Select;
const API_URL = import.meta.env.VITE_API_URL;
const LOCAL_SERVICE_URL = "http://localhost:8989";

const SignatureSettings = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signature, setSignature] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [certForm] = Form.useForm();
  const [savingCert, setSavingCert] = useState(false);
  const [detectingToken, setDetectingToken] = useState(false);
  const [localServiceOnline, setLocalServiceOnline] = useState(null);
  const [availableCerts, setAvailableCerts] = useState([]);

  useEffect(() => {
    fetchMySignature();
  }, []);

  const detectFromUsbToken = async (showNotification = false) => {
    setDetectingToken(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${LOCAL_SERVICE_URL}/certificate`, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setLocalServiceOnline(true);
        const data = await res.json();
        if (data.success && data.certificate) {
          const cert = data.certificate;
          certForm.setFieldsValue({
            subject: cert.Subject || cert.FullSubject,
            issuer: cert.Issuer || cert.FullIssuer,
            serialNumber: cert.SerialNumber,
            validTo: cert.ValidTo
          });
          setAvailableCerts(data.certificates || [cert]);
          if (showNotification) {
            message.success(data.message || "Đã tự động nhận diện chữ ký số từ USB Token thành công!");
          }
          return cert;
        } else {
          setAvailableCerts([]);
          if (showNotification) {
            message.warning(data.message || "Không tìm thấy chứng thư số trong thiết bị USB Token. Vui lòng kiểm tra lại thiết bị đã cắm vào máy tính.");
          }
        }
      } else {
        setLocalServiceOnline(false);
        if (showNotification) {
          message.warning("Không thể đọc chứng thư số từ Local Service.");
        }
      }
    } catch (err) {
      setLocalServiceOnline(false);
      if (showNotification) {
        message.info("Chưa kết nối được với phần mềm cầu nối ký số NSG VGCA (http://localhost:8989). Vui lòng khởi động tệp start.bat trong thư mục NSG_VGCA_LocalService.");
      }
    } finally {
      setDetectingToken(false);
    }
    return null;
  };

  const fetchMySignature = async () => {
    setLoading(true);
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.get(`${API_URL}/api/signature/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.signature) {
        setSignature(res.data.signature);
      }
      if (res.data.digitalCertificate && res.data.digitalCertificate.subject) {
        certForm.setFieldsValue(res.data.digitalCertificate);
        // Kiểm tra ngầm xem USB Token hiện có đang cắm trên máy không
        detectFromUsbToken(false);
      } else {
        // Nếu người dùng chưa từng lưu cấu hình, tự động dò tìm từ USB Token đang cắm
        detectFromUsbToken(false);
      }
    } catch (error) {
      console.error(error);
      message.error("Lỗi khi tải thông tin chữ ký");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCert = (serialNumber) => {
    const selected = availableCerts.find(c => c.SerialNumber === serialNumber);
    if (selected) {
      certForm.setFieldsValue({
        subject: selected.Subject || selected.FullSubject,
        issuer: selected.Issuer || selected.FullIssuer,
        serialNumber: selected.SerialNumber,
        validTo: selected.ValidTo
      });
      message.info(`Đã chọn chứng thư số: ${selected.Subject}`);
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning("Vui lòng chọn một ảnh chữ ký!");
      return;
    }

    const formData = new FormData();
    // In beforeUpload we set fileList to [file], so fileList[0] is the native File object
    const fileToUpload = fileList[0].originFileObj || fileList[0];
    formData.append("signatureImage", fileToUpload, formatFileName(fileToUpload.name || "signature.png"));

    setUploading(true);
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.post(`${API_URL}/api/signature/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      message.success("Tải chữ ký thành công!");
      setSignature(res.data.signature);
      setFileList([]);
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.message || "Có lỗi xảy ra khi tải chữ ký");
    } finally {
      setUploading(false);
    }
  };

  
  const handleSaveCertificate = async (values) => {
    setSavingCert(true);
    try {
      const token = Cookies.get("accessToken");
      await axios.post(`${API_URL}/api/signature/update-certificate`, values, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success("Cập nhật thông tin chứng thư số và mã PIN thành công!");
    } catch (e) {
      message.error(e.response?.data?.message || "Lỗi khi lưu thông tin chứng thư");
    } finally {
      setSavingCert(false);
    }
  };

  const uploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file) => {
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        message.error("Chỉ chấp nhận file định dạng hình ảnh!");
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      return false; // Ngăn chặn upload tự động
    },
    fileList,
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <Title level={3} className="mb-6 text-gray-800">Cấu hình chữ ký cá nhân</Title>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Chữ ký hiện tại của bạn" className="shadow-sm rounded-lg">
          {loading ? (
            <div className="flex justify-center p-8"><Spin /></div>
          ) : signature ? (
            <div className="flex flex-col items-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 mb-4 flex justify-center items-center h-48 w-full max-w-sm">
                  <img 
                    src={`${API_URL}/api/signature/image/${signature.fileId}`}
                    alt="Chữ ký cá nhân" 
                    className="w-full h-full object-contain mix-blend-multiply"
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src = "https://placehold.co/300x150/f9fafb/9ca3af?text=L%E1%BB%97i+hi%E1%BB%83n+th%E1%BB%8B+%E1%BA%A3nh";
                    }}
                />
              </div>
              <Text type="secondary">Tên file: {signature.fileName}</Text>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              Bạn chưa thiết lập chữ ký cá nhân.
            </div>
          )}
        </Card>

        <Card title="Cập nhật chữ ký mới" className="shadow-sm rounded-lg">
          <div className="flex flex-col space-y-4">
            <div className="p-4 bg-blue-50 text-blue-800 rounded-md text-sm">
              <p><strong>Khuyến nghị:</strong></p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Sử dụng ảnh định dạng <strong>PNG có nền trong suốt</strong>.</li>
                <li>Tỷ lệ ảnh phù hợp (khoảng 3:1 hoặc 2:1), không chứa quá nhiều khoảng trống thừa xung quanh chữ ký.</li>
                <li>Dung lượng ảnh không vượt quá 5MB.</li>
              </ul>
            </div>
            
            <Upload {...uploadProps} listType="picture" maxCount={1} accept="image/*">
              <Button icon={<UploadOutlined />}>Chọn file ảnh chữ ký</Button>
            </Upload>
            
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={handleUpload}
              loading={uploading}
              disabled={fileList.length === 0}
              className="w-32 mt-4"
            >
              Lưu chữ ký
            </Button>
          </div>
        </Card>
      </div>
      {/* Cấu hình Chữ ký số USB Token */}
      <Card
        title={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-blue-700 font-bold">
              <SafetyCertificateOutlined className="text-lg" />
              Cấu hình Thông tin Chứng thư số (USB Token / Viettel-CA, VNPT-CA, Ban Cơ yếu)
            </div>
            <div className="flex items-center gap-2">
              {localServiceOnline === true ? (
                <Tag color="success" className="px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircleOutlined /> Đã kết nối phần mềm ký số (Localhost:8989)
                </Tag>
              ) : localServiceOnline === false ? (
                <Tag color="warning" className="px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ExclamationCircleOutlined /> Phần mềm ký số chưa bật
                </Tag>
              ) : null}
              <Button
                type="primary"
                ghost
                size="small"
                icon={<UsbOutlined />}
                loading={detectingToken}
                onClick={() => detectFromUsbToken(true)}
                className="font-medium !text-xs !h-7"
              >
                Nhận diện từ USB Token
              </Button>
            </div>
          </div>
        }
        className="shadow-sm rounded-lg mt-6"
      >
        <div className="max-w-3xl">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 mb-4 leading-relaxed">
            <p className="font-semibold mb-1 flex items-center gap-1">
              <UsbOutlined className="text-blue-600" /> Hướng dẫn tự động đọc thông tin chữ ký số:
            </p>
            <p>1. Cắm thiết bị <strong>USB Token</strong> vào cổng USB máy tính của bạn.</p>
            <p>2. Khởi động phần mềm <strong>NSG_VGCA_LocalService</strong> (hoặc chạy tệp <code>start.bat</code>).</p>
            <p>3. Bấm nút <strong>"Nhận diện từ USB Token"</strong> ở trên để hệ thống tự động điền chính xác thông tin chủ thể, nhà cung cấp và số serial thực tế.</p>
          </div>

          {availableCerts.length > 1 && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-xs font-semibold text-emerald-800 block mb-1.5">
                Tìm thấy {availableCerts.length} chứng thư số trên thiết bị. Chọn chứng thư muốn sử dụng:
              </span>
              <Select
                className="w-full"
                placeholder="Chọn chứng thư số"
                onChange={handleSelectCert}
                defaultValue={certForm.getFieldValue("serialNumber")}
              >
                {availableCerts.map((c) => (
                  <Option key={c.SerialNumber} value={c.SerialNumber}>
                    <strong>{c.Subject}</strong> ({c.Issuer} - Serial: {c.SerialNumber})
                  </Option>
                ))}
              </Select>
            </div>
          )}

          <Form form={certForm} layout="vertical" onFinish={handleSaveCertificate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                label="Chủ thể chứng thư số (Subject)"
                name="subject"
                rules={[{ required: true, message: "Vui lòng nhập tên chủ thể chứng thư" }]}
                tooltip="Tên cơ quan, tổ chức hoặc cá nhân được cấp chữ ký số (VD: TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN)"
              >
                <Input placeholder="Tên chủ thể trên chứng thư" className="font-semibold text-slate-800" />
              </Form.Item>

              <Form.Item
                label="Nhà cung cấp chứng thư (Issuer / CA)"
                name="issuer"
                rules={[{ required: true, message: "Vui lòng nhập nhà cung cấp chứng thư" }]}
                tooltip="Tên nhà cung cấp dịch vụ ký số (VD: Viettel-CA SHA2, VNPT-CA, Ban Cơ yếu...)"
              >
                <Input placeholder="VD: Viettel-CA SHA2" className="text-blue-700 font-medium" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item
                label="Số Serial chứng thư số"
                name="serialNumber"
                rules={[{ required: true, message: "Vui lòng nhập số Serial chứng thư" }]}
              >
                <Input placeholder="VD: 5404FFFEB7033FB324B728D3C2E92FE6" className="font-mono text-xs" />
              </Form.Item>

              <Form.Item
                label="Hạn sử dụng chứng thư"
                name="validTo"
              >
                <Input placeholder="VD: 19/09/2028" />
              </Form.Item>

              <Form.Item
                label="Mã PIN bảo mật của USB Token"
                name="pin"
                rules={[{ required: true, message: "Vui lòng thiết lập mã PIN của Token" }]}
                tooltip="Mã PIN của thiết bị USB Token để đối soát khi ký (Mặc định: 12345678)"
              >
                <Input.Password placeholder="Mã PIN Token (VD: 12345678)" />
              </Form.Item>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={savingCert}
              className="bg-blue-600 hover:bg-blue-700 h-9 font-medium"
            >
              Lưu cấu hình Chứng thư số
            </Button>
          </Form>
        </div>
      </Card>
    </div>
  );
};

export default SignatureSettings;
