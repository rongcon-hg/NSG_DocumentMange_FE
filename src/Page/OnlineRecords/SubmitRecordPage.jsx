/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Typography,
  message,
  Upload,
  Divider,
  Tag,
  Alert,
  Space,
  Spin,
  Row,
  Col,
} from "antd";
import {
  SendOutlined,
  UploadOutlined,
  FileDoneOutlined,
  UserOutlined,
  BankOutlined,
  IdcardOutlined,
  PaperClipOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getUserInfo, getAllUsers } from "../../api/auth";
import {
  getRecordCategories,
  getRecordAttachmentTypes,
  uploadRecordFiles,
  createOnlineRecord,
} from "../../api/onlineRecordApi";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const SubmitRecordPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // User đăng nhập
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Master Data
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [availableAttachmentTypes, setAvailableAttachmentTypes] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // Danh sách file đính kèm theo loại file { [attachmentTypeId]: [files] }
  const [uploadedFilesByType, setUploadedFilesByType] = useState({});
  const [uploadingTypeId, setUploadingTypeId] = useState(null);

  // Người nhận khả dụng sau khi lọc theo vai trò
  const [availableRecipients, setAvailableRecipients] = useState([]);
  const [recipientGroups, setRecipientGroups] = useState({
    bgh: [],
    capTruong: [],
    capPho: [],
    manager: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const token = Cookies.get("accessToken");
  const decodedToken = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (e) {
      return null;
    }
  }, [token]);

  const currentUserId = decodedToken?.userId || decodedToken?._id || decodedToken?.id || Cookies.get("userId");

  // 1. Tải thông tin người dùng đăng nhập & Danh sách người nhận hợp lệ
  useEffect(() => {
    const fetchUserDataAndRecipients = async () => {
      try {
        setLoadingUser(true);
        if (!currentUserId) {
          message.error("Không tìm thấy thông tin phiên đăng nhập!");
          return;
        }

        const [userRes, allUsersRes] = await Promise.all([
          getUserInfo(currentUserId),
          getAllUsers(),
        ]);

        const uData = userRes?.data || {};
        setCurrentUser(uData);

        // Khởi tạo các trường thông tin cá nhân trên form
        form.setFieldsValue({
          fullName: uData.name || "",
          positionName: uData.position?.positionName || "",
          departmentName: uData.department?.departmentName || "",
          phoneNumber: uData.phoneNumber || "",
          email: uData.email || "",
        });

        const allUsers = Array.isArray(allUsersRes?.users)
          ? allUsersRes.users
          : Array.isArray(allUsersRes?.data)
          ? allUsersRes.data
          : Array.isArray(allUsersRes)
          ? allUsersRes
          : [];

        // Phân loại vai trò người dùng
        const isBgh = (u) => {
          if (!u) return false;
          const role = (u.role || "").toLowerCase();
          const deptCode = (u.department?.departmentCode || "").toUpperCase();
          const deptName = (u.department?.departmentName || "").toLowerCase();
          const posName = (u.position?.positionName || "").toLowerCase();
          const posCode = (u.position?.positionCode || u.position?.abbreviation || u.position?.code || "").toUpperCase();
          return (
            role === "bgh" ||
            deptCode === "BGH" ||
            deptName.includes("ban giám hiệu") ||
            ["HT", "PHT", "NHT"].includes(posCode) ||
            posName.includes("hiệu trưởng") ||
            posName.includes("phó hiệu trưởng")
          );
        };

        const isCapPho = (u) => {
          if (!u || isBgh(u)) return false;
          const role = (u.role || "").toLowerCase();
          const posName = (u.position?.positionName || "").toLowerCase();
          return (
            role === "cappho" ||
            posName.includes("phó trưởng") ||
            posName.includes("phó khoa") ||
            posName.includes("phó phòng") ||
            posName.includes("phó ban") ||
            posName.includes("phó giám đốc") ||
            posName.includes("phó bí thư") ||
            posName.includes("phó đơn vị") ||
            posName.startsWith("phó ")
          );
        };

        const isCapTruong = (u) => {
          if (!u || isBgh(u) || isCapPho(u)) return false;
          const role = (u.role || "").toLowerCase();
          const posName = (u.position?.positionName || "").toLowerCase();
          return (
            role === "staff" ||
            role === "captruong" ||
            posName.includes("trưởng khoa") ||
            posName.includes("trưởng phòng") ||
            posName.includes("trưởng ban") ||
            posName.includes("trưởng bộ môn") ||
            posName.includes("trưởng đơn vị") ||
            posName.includes("bí thư đoàn") ||
            posName.startsWith("trưởng ")
          );
        };

        const isManager = (u) => {
          if (!u) return false;
          const role = (u.role || "").toLowerCase();
          return role === "manager" || role === "admin";
        };

        // Người dùng hiện tại
        const curRole = (uData.role || decodedToken?.role || "").toLowerCase();
        const curIsBgh = isBgh(uData) || curRole === "bgh";
        const curIsManager = isManager(uData) || curRole === "manager" || curRole === "admin";
        const curIsCapPho = !curIsBgh && !curIsManager && isCapPho(uData);
        const curIsCapTruong = !curIsBgh && !curIsManager && !curIsCapPho && isCapTruong(uData);
        const curIsGvCv = !curIsBgh && !curIsManager && !curIsCapTruong && !curIsCapPho;

        // Lọc người nhận khả dụng (loại bỏ tài khoản hệ thống, đã khóa, hoặc chính mình)
        const validUsers = allUsers.filter(
          (u) =>
            u &&
            u.role !== null &&
            u.email?.toLowerCase() !== "qlvb@nsgpc.edu.vn" &&
            String(u._id) !== String(currentUserId)
        );

        const allBgh = validUsers.filter(isBgh);
        const allCapPho = validUsers.filter(isCapPho);
        const allCapTruong = validUsers.filter(isCapTruong);
        const allManager = validUsers.filter(isManager);

        const userDeptId = String(uData.department?._id || uData.department || "");
        const userDeptCode = (uData.department?.departmentCode || "").toUpperCase().trim();
        const userDeptName = (uData.department?.departmentName || "").toLowerCase().trim();

        const isSameDept = (u) => {
          if (!u) return false;
          const uDeptId = String(u?.department?._id || u?.department || "");
          if (userDeptId && uDeptId && uDeptId === userDeptId) return true;
          const uDeptCode = (u?.department?.departmentCode || "").toUpperCase().trim();
          if (userDeptCode && uDeptCode && userDeptCode === uDeptCode) return true;
          const uDeptName = (u?.department?.departmentName || "").toLowerCase().trim();
          if (userDeptName && uDeptName && userDeptName === uDeptName) return true;
          return false;
        };

        let finalRecipients = [];
        let grouped = {
          bgh: [],
          capTruong: [],
          capPho: [],
          manager: [],
        };

        if (curIsManager) {
          // Manager / Admin: Gửi cho Ban Giám hiệu (và Manager)
          grouped.bgh = allBgh;
          grouped.manager = allManager;
          finalRecipients = [...allBgh, ...allManager];
        } else if (curIsGvCv) {
          // Tài khoản GV - CV: Gửi cho Cấp trưởng, Cấp phó (cùng đơn vị) và Manager
          const myCapTruong = allCapTruong.filter(isSameDept);
          const myCapPho = allCapPho.filter(isSameDept);
          grouped.capTruong = myCapTruong.length > 0 ? myCapTruong : allCapTruong;
          grouped.capPho = myCapPho.length > 0 ? myCapPho : allCapPho;
          grouped.manager = allManager;
        } else if (curIsCapPho) {
          // Tài khoản Cấp phó: Bổ sung người nhận là Cấp trưởng của đơn vị mình, cùng với Manager và Ban Giám hiệu
          const myCapTruong = allCapTruong.filter(isSameDept);
          grouped.capTruong = myCapTruong.length > 0 ? myCapTruong : allCapTruong;
          grouped.manager = allManager;
          grouped.bgh = allBgh;
          finalRecipients = [...grouped.capTruong, ...allManager, ...allBgh];
        } else if (curIsCapTruong) {
          // Tài khoản Cấp trưởng: Gửi cho Manager và Ban Giám hiệu
          grouped.manager = allManager;
          grouped.bgh = allBgh;
          finalRecipients = [...allManager, ...allBgh];
        } else if (curIsBgh) {
          // Ban Giám hiệu: Gửi cho Manager
          grouped.manager = allManager;
          finalRecipients = [...allManager];
        } else {
          // Mặc định: Gửi cho Ban Giám hiệu hoặc Manager
          grouped.bgh = allBgh;
          grouped.manager = allManager;
          grouped.capTruong = allCapTruong;
          finalRecipients = [...allBgh, ...allManager, ...allCapTruong];
        }

        // Loại bỏ trùng lặp
        const uniqueRecipients = [];
        const seenIds = new Set();
        finalRecipients.forEach((u) => {
          const id = String(u._id);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueRecipients.push(u);
          }
        });

        setAvailableRecipients(uniqueRecipients);
        setRecipientGroups(grouped);
      } catch (err) {
        console.error("Lỗi nạp dữ liệu người dùng & người nhận:", err);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserDataAndRecipients();
  }, [currentUserId, form]);

  // 2. Tải danh mục loại hồ sơ
  useEffect(() => {
    const fetchCats = async () => {
      try {
        setLoadingCategories(true);
        const res = await getRecordCategories({ activeOnly: "true" });
        if (res.success) setCategories(res.data || []);
      } catch (err) {
        message.error("Lỗi tải danh mục hồ sơ");
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCats();
  }, []);

  // 3. Khi chọn loại hồ sơ -> nạp danh mục file đính kèm tương ứng
  const handleCategoryChange = async (catId) => {
    setSelectedCategory(catId);
    setUploadedFilesByType({});
    if (!catId) {
      setAvailableAttachmentTypes([]);
      return;
    }
    try {
      setLoadingTypes(true);
      const res = await getRecordAttachmentTypes({ categoryId: catId, activeOnly: "true" });
      if (res.success) {
        setAvailableAttachmentTypes(res.data || []);
      }
    } catch (err) {
      message.error("Lỗi tải danh mục file đính kèm");
    } finally {
      setLoadingTypes(false);
    }
  };

  // Upload file cho 1 loại file đính kèm
  const handleUploadFilesForType = async (typeId, typeName, fileList) => {
    if (!fileList || fileList.length === 0) return;
    try {
      setUploadingTypeId(typeId);
      const formData = new FormData();
      fileList.forEach((file) => {
        formData.append("files", file);
      });

      const res = await uploadRecordFiles(formData);
      if (res.success && res.data) {
        const newFiles = res.data.map((f) => ({
          ...f,
          attachmentType: typeId,
          attachmentTypeName: typeName,
        }));

        setUploadedFilesByType((prev) => ({
          ...prev,
          [typeId]: [...(prev[typeId] || []), ...newFiles],
        }));
        message.success(`Đã tải lên ${newFiles.length} tệp cho mục "${typeName}"`);
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi tải tệp lên Google Drive");
    } finally {
      setUploadingTypeId(null);
    }
  };

  const handleRemoveFile = (typeId, fileId) => {
    setUploadedFilesByType((prev) => ({
      ...prev,
      [typeId]: (prev[typeId] || []).filter((f) => f.fileId !== fileId),
    }));
  };

  // 4. Submit gửi hồ sơ
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Kiểm tra các loại file bắt buộc
      const missingRequired = availableAttachmentTypes.filter(
        (t) => t.isRequired && (!uploadedFilesByType[t._id] || uploadedFilesByType[t._id].length === 0)
      );

      if (missingRequired.length > 0) {
        message.error(
          `Vui lòng đính kèm tệp cho các mục bắt buộc: ${missingRequired.map((t) => t.name).join(", ")}`
        );
        return;
      }

      // Gom toàn bộ attachedFiles
      const allAttachedFiles = [];
      Object.values(uploadedFilesByType).forEach((files) => {
        if (Array.isArray(files)) {
          allAttachedFiles.push(...files);
        }
      });

      setSubmitting(true);
      const payload = {
        categoryId: values.categoryId,
        title: values.title,
        note: values.note,
        recipients: Array.isArray(values.recipients) ? values.recipients : [values.recipients],
        attachedFiles: allAttachedFiles,
        fullName: values.fullName,
        positionName: values.positionName,
        departmentName: values.departmentName,
        phoneNumber: values.phoneNumber,
        email: values.email,
      };

      const res = await createOnlineRecord(payload);
      if (res.success) {
        message.success("Gửi hồ sơ trực tuyến thành công!");
        navigate("/online-records/list");
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Có lỗi xảy ra khi nộp hồ sơ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 py-3 space-y-3">
      <Card className="shadow-sm border-gray-200 w-full">
        <div className="border-b border-gray-100 pb-3 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
            <SendOutlined />
          </div>
          <div>
            <Title level={4} className="!mb-0 text-blue-800">
              Gửi Hồ Sơ Trực Tuyến
            </Title>
            <Text type="secondary" className="text-xs">
              Nộp các loại hồ sơ hành chính, học tập, nghiệp vụ trực tiếp đến quản lý hệ thống có thẩm quyền
            </Text>
          </div>
        </div>

        {loadingUser ? (
          <div className="text-center py-10">
            <Spin tip="Đang tải thông tin người dùng..." />
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            {/* THÔNG TIN NGƯỜI NỘP */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-4">
              <Text className="font-bold text-gray-700 block mb-2 flex items-center gap-1.5">
                <IdcardOutlined className="text-blue-500" />
                Thông tin người nộp hồ sơ
              </Text>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name="fullName"
                    label={<span className="text-xs text-gray-500 font-medium">Họ và tên</span>}
                    rules={[{ required: true, message: "Thiếu họ tên" }]}
                    className="!mb-0"
                  >
                    <Input prefix={<UserOutlined className="text-gray-400" />} disabled className="bg-white font-medium" />
                  </Form.Item>
                </Col>

                <Col xs={12} sm={8}>
                  <Form.Item
                    name="departmentName"
                    label={<span className="text-xs text-gray-500 font-medium">Đơn vị / Phòng ban</span>}
                    className="!mb-0"
                  >
                    <Input prefix={<BankOutlined className="text-gray-400" />} disabled className="bg-white" />
                  </Form.Item>
                </Col>

                <Col xs={12} sm={8}>
                  <Form.Item
                    name="positionName"
                    label={<span className="text-xs text-gray-500 font-medium">Chức vụ</span>}
                    className="!mb-0"
                  >
                    <Input disabled className="bg-white" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* THÔNG TIN HỒ SƠ */}
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="categoryId"
                  label={<span className="font-semibold text-gray-800">Loại hồ sơ trực tuyến:</span>}
                  rules={[{ required: true, message: "Vui lòng chọn loại hồ sơ cần nộp" }]}
                >
                  <Select
                    placeholder="-- Chọn loại hồ sơ --"
                    loading={loadingCategories}
                    onChange={handleCategoryChange}
                    className="w-full"
                    size="large"
                  >
                    {categories.map((c) => (
                      <Option key={c._id} value={c._id}>
                        {c.name} ({c.code})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="recipients"
                  label={
                    <span className="font-semibold text-gray-800 flex items-center justify-between w-full">
                      <span>Người tiếp nhận / Cấp duyệt:</span>
                      <span className="text-xs text-blue-600 font-normal">
                        (Theo quy định phân cấp thẩm quyền)
                      </span>
                    </span>
                  }
                  rules={[{ required: true, message: "Vui lòng chọn ít nhất 1 người tiếp nhận" }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="-- Chọn người nhận hồ sơ --"
                    className="w-full"
                    size="large"
                    showSearch
                    filterOption={(input, option) => {
                      const text = `${option?.label || ""} ${option?.children || ""}`.toLowerCase();
                      return text.includes(input.toLowerCase());
                    }}
                  >
                    {recipientGroups.bgh.length > 0 && (
                      <Select.OptGroup label="Ban Giám hiệu">
                        {recipientGroups.bgh.map((u) => {
                          const labelText = `${u.name} - ${u.position?.positionName || "BGH"} (${u.department?.departmentName || "Ban Giám hiệu"})`;
                          return (
                            <Option key={u._id} value={u._id} label={labelText}>
                              {labelText}
                            </Option>
                          );
                        })}
                      </Select.OptGroup>
                    )}

                    {recipientGroups.capTruong.length > 0 && (
                      <Select.OptGroup label="Cấp trưởng đơn vị">
                        {recipientGroups.capTruong.map((u) => {
                          const labelText = `${u.name} - ${u.position?.positionName || "Cấp trưởng"} (${u.department?.departmentName || ""})`;
                          return (
                            <Option key={u._id} value={u._id} label={labelText}>
                              {labelText}
                            </Option>
                          );
                        })}
                      </Select.OptGroup>
                    )}

                    {recipientGroups.capPho.length > 0 && (
                      <Select.OptGroup label="Cấp phó đơn vị">
                        {recipientGroups.capPho.map((u) => {
                          const labelText = `${u.name} - ${u.position?.positionName || "Cấp phó"} (${u.department?.departmentName || ""})`;
                          return (
                            <Option key={u._id} value={u._id} label={labelText}>
                              {labelText}
                            </Option>
                          );
                        })}
                      </Select.OptGroup>
                    )}

                    {recipientGroups.manager.length > 0 && (
                      <Select.OptGroup label="Cấp Quản trị / Manager">
                        {recipientGroups.manager.map((u) => {
                          const labelText = `${u.name} - Quản lý hệ thống (${u.email})`;
                          return (
                            <Option key={u._id} value={u._id} label={labelText}>
                              {labelText}
                            </Option>
                          );
                        })}
                      </Select.OptGroup>
                    )}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="title"
              label={<span className="font-semibold text-gray-800">Tiêu đề / Trích yếu nội dung hồ sơ:</span>}
              rules={[{ required: true, message: "Vui lòng nhập tiêu đề hồ sơ" }]}
            >
              <Input placeholder="VD: Đề nghị thanh toán kinh phí lớp bồi dưỡng nâng cao trình độ hè 2026..." size="large" />
            </Form.Item>

            <Form.Item
              name="note"
              label={<span className="font-medium text-gray-700">Ghi chú / Diễn giải thêm (nếu có):</span>}
            >
              <TextArea rows={2} placeholder="Nội dung giải trình, thông tin cần trao đổi thêm với người duyệt..." />
            </Form.Item>

            {/* DANH SÁCH CÁC FILE ĐÍNH KÈM THEO DANH MỤC */}
            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <Text className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <PaperClipOutlined className="text-blue-600" />
                  Danh sách file minh chứng theo danh mục hồ sơ
                </Text>
                {selectedCategory && (
                  <Tag color="processing">
                    {availableAttachmentTypes.length} loại file quy định
                  </Tag>
                )}
              </div>

              {!selectedCategory ? (
                <Alert
                  type="info"
                  showIcon
                  message="Vui lòng chọn Loại hồ sơ trực tuyến ở trên để hệ thống hiển thị danh mục các file cần đính kèm tương ứng."
                  className="mb-4"
                />
              ) : loadingTypes ? (
                <div className="text-center py-6">
                  <Spin tip="Đang tải danh mục file yêu cầu..." />
                </div>
              ) : availableAttachmentTypes.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Loại hồ sơ này chưa có danh mục file bắt buộc cụ thể. Bạn có thể nộp hồ sơ mà không cần đính kèm file."
                  className="mb-4"
                />
              ) : (
                <div className="space-y-3 mb-6">
                  {availableAttachmentTypes.map((type, idx) => {
                    const files = uploadedFilesByType[type._id] || [];
                    const isUploading = uploadingTypeId === type._id;

                    return (
                      <div
                        key={type._id}
                        className={`p-3 rounded-lg border transition-colors ${
                          files.length > 0
                            ? "bg-emerald-50/40 border-emerald-200"
                            : type.isRequired
                            ? "bg-red-50/20 border-red-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-sm">
                                {idx + 1}. {type.name}
                              </span>
                              {type.isRequired ? (
                                <Tag color="error" className="text-xs">
                                  Bắt buộc nộp
                                </Tag>
                              ) : (
                                <Tag color="default" className="text-xs text-gray-500">
                                  Tùy chọn
                                </Tag>
                              )}
                            </div>
                            {type.description && (
                              <p className="text-xs text-gray-500 mb-0 mt-0.5">
                                {type.description}
                              </p>
                            )}
                          </div>

                          <Upload
                            beforeUpload={(file, fileList) => {
                              handleUploadFilesForType(type._id, type.name, [file]);
                              return false;
                            }}
                            showUploadList={false}
                            multiple
                          >
                            <Button
                              icon={<UploadOutlined />}
                              size="small"
                              loading={isUploading}
                              className="bg-white border-blue-400 text-blue-600 hover:bg-blue-50 text-xs"
                            >
                              Tải tệp lên
                            </Button>
                          </Upload>
                        </div>

                        {/* Danh sách file đã tải lên cho loại file này */}
                        {files.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-2">
                            {files.map((f) => (
                              <div
                                key={f.fileId}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded border border-emerald-300 text-xs shadow-2xs"
                              >
                                <CheckCircleOutlined className="text-emerald-600" />
                                <a
                                  href={f.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-700 hover:underline max-w-[220px] truncate"
                                  title={f.fileName}
                                >
                                  {f.fileName}
                                </a>
                                {f.size && <span className="text-gray-400">({f.size})</span>}
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleRemoveFile(type._id, f.fileId)}
                                  className="!p-0 !w-4 !h-4 ml-1 flex items-center justify-center text-gray-400 hover:text-red-600"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button onClick={() => navigate("/online-records/list")} size="large">
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                icon={<SendOutlined />}
                size="large"
                className="bg-blue-600 hover:bg-blue-700 shadow-md px-6"
              >
                Gửi hồ sơ ngay
              </Button>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default SubmitRecordPage;
