import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Tag,
  Modal,
  Form,
  message,
  Typography,
  Tooltip,
  Popconfirm,
  Badge,
  Spin,
  Empty,
} from "antd";
import {
  FileWordOutlined,
  SearchOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  SendOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import {
  getTemplatesApi,
  getTemplateByIdApi,
  createTemplateApi,
  updateTemplateApi,
  deleteTemplateApi,
} from "../../api/templateApi";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CATEGORIES = [
  { value: "ALL", label: "Tất cả lĩnh vực" },
  { value: "HANH_CHINH", label: "Hành chính - Quản trị" },
  { value: "DAO_TAO", label: "Đào tạo & Quản trị SV" },
  { value: "TAI_CHINH", label: "Kế hoạch - Tài chính" },
  { value: "CONG_TAC_HSSV", label: "Công tác HSSV & Đoàn thể" },
  { value: "TO_CHUC_CAN_BO", label: "Tổ chức cán bộ" },
  { value: "KHAC", label: "Lĩnh vực khác" },
];

const DOC_TYPES = [
  { value: "ALL", label: "Tất cả loại văn bản" },
  { value: "TO_TRINH", label: "Tờ trình" },
  { value: "THONG_BAO", label: "Thông báo" },
  { value: "QUYET_DINH", label: "Quyết định" },
  { value: "KE_HOACH", label: "Kế hoạch" },
  { value: "CONG_VAN", label: "Công văn" },
  { value: "BAO_CAO", label: "Báo cáo" },
  { value: "GIAY_MOI", label: "Giấy mời" },
  { value: "GIAY_DI_DUONG", label: "Giấy đi đường" },
  { value: "BIEN_BAN", label: "Biên bản" },
];

const DocumentTemplatePage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedDocType, setSelectedDocType] = useState("ALL");

  // Modal xem trước và cá nhân hóa
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

  // Modal tạo/sửa
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  // Kiểm tra quyền quản trị
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setIsAdmin(decoded.role === "admin" || decoded.role === "manager");
      } catch (e) {
        setIsAdmin(false);
      }
    }
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await getTemplatesApi({
        category: selectedCategory,
        docType: selectedDocType,
        search: searchTerm,
      });
      if (res.success) {
        setTemplates(res.data || []);
      }
    } catch (error) {
      console.error("Lỗi tải biểu mẫu:", error);
      message.error("Lỗi khi tải danh sách biểu mẫu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory, selectedDocType]);

  const handleSearch = () => {
    fetchTemplates();
  };

  // Mở modal xem trước chi tiết (kèm nội dung đã cá nhân hóa tên cán bộ, đơn vị)
  const handleOpenPreview = async (template) => {
    try {
      setLoading(true);
      const res = await getTemplateByIdApi(template._id);
      if (res.success) {
        setPreviewTemplate(res.data);
        setIsPreviewModalVisible(true);
      }
    } catch (error) {
      message.error("Không thể xem chi tiết biểu mẫu");
    } finally {
      setLoading(false);
    }
  };

  // Sử dụng mẫu này đưa sang Trình soạn thảo AI
  const handleUseInAiDrafter = (template) => {
    const content = template.personalizedContent || template.content || "";
    // Lưu tạm vào sessionStorage để Trợ lý AI nạp vào
    sessionStorage.setItem("ai_drafter_prefill_content", content);
    sessionStorage.setItem("ai_drafter_prefill_title", template.title);
    navigate("/documents/ai-drafter");
  };

  // Sử dụng mẫu này đưa sang Trình ký văn bản (/replyDoc)
  const handleUseInReplyDoc = (template) => {
    navigate("/replyDoc", {
      state: {
        title: template.title,
        shortDescription: template.description || template.title,
      },
    });
  };

  // Mở modal Tạo/Sửa biểu mẫu
  const handleOpenEdit = (template = null) => {
    setEditingTemplate(template);
    if (template) {
      form.setFieldsValue({
        title: template.title,
        code: template.code,
        category: template.category,
        docType: template.docType,
        description: template.description,
        content: template.content,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        category: "HANH_CHINH",
        docType: "TO_TRINH",
      });
    }
    setIsEditModalVisible(true);
  };

  const handleSaveTemplate = async (values) => {
    try {
      setSaving(true);
      if (editingTemplate) {
        await updateTemplateApi(editingTemplate._id, values);
        message.success("Cập nhật biểu mẫu thành công!");
      } else {
        await createTemplateApi(values);
        message.success("Thêm mới biểu mẫu chuẩn thành công!");
      }
      setIsEditModalVisible(false);
      fetchTemplates();
    } catch (error) {
      message.error(error.response?.data?.message || "Lỗi khi lưu biểu mẫu");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await deleteTemplateApi(id);
      message.success("Đã xóa biểu mẫu");
      fetchTemplates();
    } catch (error) {
      message.error("Lỗi khi xóa biểu mẫu");
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FolderOpenOutlined className="text-2xl text-cyan-300" />
              <h1 className="text-xl md:text-2xl font-black text-white m-0 tracking-tight">
                KHO VĂN BẢN MẪU & BIỂU MẪU HÀNH CHÍNH CHUẨN
              </h1>
            </div>
            <p className="text-blue-100 text-xs md:text-sm max-w-2xl leading-relaxed m-0">
              Thư viện mẫu biểu hành chính chuẩn hóa theo <b>Nghị định 30/2020/NĐ-CP</b> của Trường Cao đẳng Bách khoa Nam Sài Gòn. Tự động điền sẵn họ tên, chức danh và đơn vị của bạn chỉ với 1-click.
            </p>
          </div>

          {isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenEdit(null)}
              className="bg-emerald-600 hover:bg-emerald-500 font-semibold shadow-md shrink-0 h-10 px-4"
            >
              Thêm biểu mẫu mới
            </Button>
          )}
        </div>
      </div>

      {/* Bộ lọc và Tìm kiếm */}
      <Card className="rounded-xl border-slate-200 shadow-xs mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={10}>
            <Input
              placeholder="Tìm theo tên mẫu, mã số hiệu hoặc mô tả..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              className="rounded-lg"
            />
          </Col>
          <Col xs={12} md={6}>
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              className="w-full"
            >
              {CATEGORIES.map((c) => (
                <Option key={c.value} value={c.value}>
                  {c.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={5}>
            <Select
              value={selectedDocType}
              onChange={setSelectedDocType}
              className="w-full"
            >
              {DOC_TYPES.map((d) => (
                <Option key={d.value} value={d.value}>
                  {d.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={3}>
            <Button type="primary" onClick={handleSearch} block className="bg-blue-600">
              Tìm kiếm
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Danh sách Biểu mẫu Card Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <Spin size="large" tip="Đang tải thư viện biểu mẫu chuẩn..." />
        </div>
      ) : templates.length === 0 ? (
        <Empty description="Không tìm thấy biểu mẫu phù hợp" className="my-16" />
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map((tpl) => (
            <Col xs={24} sm={12} lg={8} key={tpl._id}>
              <Card
                hoverable
                className="h-full rounded-xl border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all group"
                bodyStyle={{ display: "flex", flexDirection: "column", height: "100%", padding: "18px" }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <Tag color="blue" className="font-bold text-xs uppercase m-0">
                      {tpl.code || "BM-NSG"}
                    </Tag>
                    <Tag color="cyan" className="text-[11px] font-semibold m-0">
                      {CATEGORIES.find((c) => c.value === tpl.category)?.label || tpl.category}
                    </Tag>
                  </div>

                  <h3
                    className="font-bold text-slate-800 text-base leading-snug mb-2 group-hover:text-blue-600 cursor-pointer transition-colors"
                    onClick={() => handleOpenPreview(tpl)}
                  >
                    {tpl.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                    {tpl.description || "Mẫu văn bản hành chính dùng chung cho các đơn vị phòng ban."}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-auto">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span>Lượt sử dụng: <b>{tpl.downloadCount || 0}</b></span>
                    <span className="text-[11px]">Chuẩn NĐ 30/2020</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handleOpenPreview(tpl)}
                      className="rounded-lg text-xs font-medium"
                    >
                      Xem trước
                    </Button>

                    <Button
                      type="primary"
                      size="small"
                      icon={<ThunderboltOutlined />}
                      onClick={() => handleUseInAiDrafter(tpl)}
                      className="bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold"
                    >
                      Dùng mẫu này
                    </Button>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined className="text-blue-600" />}
                        onClick={() => handleOpenEdit(tpl)}
                      >
                        Sửa
                      </Button>
                      <Popconfirm
                        title="Xóa mẫu này?"
                        onConfirm={() => handleDeleteTemplate(tpl._id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                      >
                        <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                          Xóa
                        </Button>
                      </Popconfirm>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Modal Xem trước và Sử dụng mẫu */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <FileWordOutlined className="text-blue-600" />
            Xem Trước Mẫu Văn Bản Chuẩn
          </div>
        }
        open={isPreviewModalVisible}
        onCancel={() => setIsPreviewModalVisible(false)}
        width={850}
        footer={[
          <Button key="close" onClick={() => setIsPreviewModalVisible(false)}>
            Đóng
          </Button>,
          <Button
            key="reply"
            icon={<SendOutlined />}
            onClick={() => {
              setIsPreviewModalVisible(false);
              handleUseInReplyDoc(previewTemplate);
            }}
          >
            Đưa vào Trình ký
          </Button>,
          <Button
            key="ai"
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => {
              setIsPreviewModalVisible(false);
              handleUseInAiDrafter(previewTemplate);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 font-semibold"
          >
            Soạn thảo bằng Trợ lý AI
          </Button>,
        ]}
      >
        {previewTemplate && (
          <div className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-3 text-xs">
              <div>
                <span className="font-bold text-blue-900 block">{previewTemplate.title}</span>
                <span className="text-blue-700">Mã: {previewTemplate.code}</span>
              </div>
              <Tag color="green" className="font-semibold">
                Đã tự động điền thông tin của bạn
              </Tag>
            </div>

            {/* Khung tài liệu chuẩn A4 */}
            <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-inner max-h-[550px] overflow-y-auto">
              <div
                dangerouslySetInnerHTML={{
                  __html: previewTemplate.personalizedContent || previewTemplate.content || "<p>Chưa có nội dung mẫu</p>",
                }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Thêm / Chỉnh sửa mẫu biểu */}
      <Modal
        title={
          <div className="font-bold text-slate-800 text-base">
            {editingTemplate ? "Chỉnh Sửa Biểu Mẫu" : "Thêm Mới Biểu Mẫu Chuẩn"}
          </div>
        }
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Lưu biểu mẫu"
        cancelText="Hủy"
        width={750}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveTemplate} className="mt-4">
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                name="title"
                label="Tên biểu mẫu"
                rules={[{ required: true, message: "Vui lòng nhập tên biểu mẫu!" }]}
              >
                <Input placeholder="Ví dụ: Tờ trình phê duyệt kinh phí, Kế hoạch tổ chức..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="code" label="Mã hiệu biểu mẫu">
                <Input placeholder="VD: BM-TTR-01" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item name="category" label="Lĩnh vực / Phòng ban">
                <Select>
                  {CATEGORIES.filter((c) => c.value !== "ALL").map((c) => (
                    <Option key={c.value} value={c.value}>
                      {c.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item name="docType" label="Loại văn bản">
                <Select>
                  {DOC_TYPES.filter((d) => d.value !== "ALL").map((d) => (
                    <Option key={d.value} value={d.value}>
                      {d.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Mô tả mục đích sử dụng">
            <Input placeholder="Hướng dẫn ngắn gọn trường hợp sử dụng biểu mẫu này..." />
          </Form.Item>

          <Form.Item
            name="content"
            label={
              <span>
                Nội dung mẫu văn bản (HTML / Văn bản kèm biến động: <code>{"{{TEN_CAN_BO}}"}</code>, <code>{"{{DON_VI}}"}</code>, <code>{"{{CHUC_VU}}"}</code>, <code>{"{{NGAY_HIEN_TAI}}"}</code>)
              </span>
            }
          >
            <TextArea rows={12} placeholder="Nhập mã HTML hoặc nội dung văn bản chuẩn..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DocumentTemplatePage;
