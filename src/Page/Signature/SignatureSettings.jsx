import React, { useState, useEffect } from "react";
import { Card, Upload, Button, message, Spin, Space, Typography, Input, Form, Divider, Tag } from "antd";
import { UploadOutlined, SaveOutlined, SafetyCertificateOutlined, KeyOutlined } from "@ant-design/icons";
import axios from "axios";
import Cookies from "js-cookie";
import { formatFileName } from "../../utils/formatFileName";

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL;

const SignatureSettings = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signature, setSignature] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [certForm] = Form.useForm();
  const [savingCert, setSavingCert] = useState(false);

  useEffect(() => {
    fetchMySignature();
  }, []);

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
      if (res.data.digitalCertificate) {
        certForm.setFieldsValue(res.data.digitalCertificate);
      } else {
        certForm.setFieldsValue({
          subject: "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
          issuer: "Viettel-CA SHA2",
          serialNumber: "5404FFFEB7033FB324B728D3C2E92FE6",
          validTo: "19/09/2028",
          pin: "12345678"
        });
      }
    } catch (error) {
      console.error(error);
      message.error("Lỗi khi tải thông tin chữ ký");
    } finally {
      setLoading(false);
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
          <div className="flex items-center gap-2 text-blue-700 font-bold">
            <SafetyCertificateOutlined className="text-lg" />
            Cấu hình Thông tin Chứng thư số (USB Token / Chữ ký số Viettel-CA, VNPT-CA)
          </div>
        }
        className="shadow-sm rounded-lg mt-6"
      >
        <div className="max-w-3xl">
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Thiết lập chính xác thông tin chủ thể, nhà cung cấp dịch vụ chứng thực chữ ký số (CA) và mã PIN của thiết bị USB Token để hệ thống đối soát chính xác khi ký số tài liệu.
          </p>
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
                tooltip="Tên nhà cung cấp dịch vụ ký số (VD: Viettel-CA SHA2, VNPT-CA...)"
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
