/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Upload,
  DatePicker,
  Space,
  message,
  Alert,
  Typography,
  Divider,
  Spin,
  Tooltip,
  Modal,
  Table,
  AutoComplete,
  Row,
  Col,
} from "antd";
import {
  TrophyOutlined,
  UserOutlined,
  BankOutlined,
  FileTextOutlined,
  CalendarOutlined,
  LinkOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  SaveOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  createAchievement,
  batchImportAchievements,
  uploadAchievementFiles,
  getEmulationTitles,
} from "../../api/emulationApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllUsers } from "../../api/auth";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SCHOOL_YEARS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
];

const COMMON_AGENCIES = [
  { value: "Trường Cao đẳng Nam Sài Gòn" },
  { value: "Sở Giáo dục và Đào tạo TP. Hồ Chí Minh" },
  { value: "Ủy ban Nhân dân TP. Hồ Chí Minh" },
  { value: "Bộ Lao động - Thương binh và Xã hội" },
  { value: "Bộ Giáo dục và Đào tạo" },
  { value: "Thủ tướng Chính phủ" },
  { value: "Chủ tịch nước" },
];

const EmulationAchievementAddPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titles, setTitles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  // Upload file local to Drive
  const [fileList, setFileList] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Import Excel Preview Modal
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [importing, setImporting] = useState(false);

  // Load master data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [titleRes, deptRes, userRes] = await Promise.all([
          getEmulationTitles({ activeOnly: "true" }),
          getAllDepartments(),
          getAllUsers(),
        ]);

        if (titleRes?.success) setTitles(titleRes.data || []);
        if (Array.isArray(deptRes)) setDepartments(deptRes);
        else if (deptRes?.departments) setDepartments(deptRes.departments);
        if (Array.isArray(userRes)) setUsers(userRes);
        else if (userRes?.data) setUsers(userRes.data);
      } catch (err) {
        console.error("Lỗi tải danh mục master:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Khi người dùng chọn cán bộ từ danh sách, tự động điền Đơn vị công tác
  const handleSelectUser = (selectedUserId) => {
    const selectedUser = users.find((u) => String(u._id) === String(selectedUserId));
    if (selectedUser) {
      form.setFieldsValue({
        fullName: selectedUser.name,
        userId: selectedUser._id,
      });

      const deptId = selectedUser.department?._id || selectedUser.department;
      const dept = departments.find(
        (d) =>
          String(d._id) === String(deptId) ||
          d.departmentName === selectedUser.department?.departmentName
      );
      if (dept) {
        form.setFieldsValue({
          departmentId: dept._id,
          departmentName: dept.departmentName,
        });
      } else if (selectedUser.department?.departmentName) {
        form.setFieldsValue({
          departmentName: selectedUser.department.departmentName,
        });
      }
    }
  };

  // Submit form đơn lẻ
  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      // Nếu có upload file local, upload lên Drive trước
      let uploadedAttachments = [];
      if (fileList.length > 0) {
        setUploadingFiles(true);
        const formData = new FormData();
        fileList.forEach((f) => {
          if (f.originFileObj) {
            formData.append("files", f.originFileObj);
          }
        });

        try {
          const uploadRes = await uploadAchievementFiles(formData);
          if (uploadRes?.success && uploadRes.data) {
            uploadedAttachments = uploadRes.data;
          }
        } catch (uploadErr) {
          console.error("Lỗi upload file minh chứng:", uploadErr);
          message.warning("Không thể upload tệp minh chứng lên Google Drive, dữ liệu thành tích vẫn sẽ được lưu.");
        } finally {
          setUploadingFiles(false);
        }
      }

      // Xác định titleName
      let selectedTitleName = values.titleName || "";
      if (values.titleId) {
        const foundT = titles.find((t) => String(t._id) === String(values.titleId));
        if (foundT) selectedTitleName = foundT.name;
      }

      // Xác định departmentName
      let selectedDeptName = values.departmentName || "";
      if (values.departmentId) {
        const foundD = departments.find((d) => String(d._id) === String(values.departmentId));
        if (foundD) selectedDeptName = foundD.departmentName;
      }

      const payload = {
        fullName: values.fullName,
        userId: values.userId || null,
        departmentId: values.departmentId || null,
        departmentName: selectedDeptName,
        titleId: values.titleId || null,
        titleName: selectedTitleName,
        achievementContent: values.achievementContent,
        decisionNumber: values.decisionNumber || "",
        decisionDate: values.decisionDate ? values.decisionDate.format("YYYY-MM-DD") : null,
        decisionAgency: values.decisionAgency || "",
        schoolYear: values.schoolYear || "2026-2027",
        driveLink: values.driveLink || "",
        attachedFiles: uploadedAttachments,
        notes: values.notes || "",
      };

      const res = await createAchievement(payload);
      if (res?.success) {
        message.success("Lưu thông tin thành tích khen thưởng thành công!");
        form.resetFields();
        setFileList([]);
        navigate("/emulation/achievements");
      }
    } catch (err) {
      console.error("Lỗi lưu thành tích:", err);
      message.error(err.response?.data?.message || "Lỗi khi lưu thành tích");
    } finally {
      setSubmitting(false);
    }
  };

  // Tải file mẫu Excel chuẩn
  const handleDownloadExcelTemplate = () => {
    try {
      const templateData = [
        {
          "STT": 1,
          "Họ và tên": "Nguyễn Văn A",
          "Đơn vị công tác": "Khoa Công nghệ thông tin",
          "Loại danh hiệu thi đua": "Lao động tiên tiến",
          "Nội dung thành tích": "Hoàn thành xuất sắc nhiệm vụ giảng dạy và nghiên cứu khoa học năm học 2025-2026",
          "Số quyết định": "125/QĐ-CĐNSG",
          "Ngày ban hành (DD/MM/YYYY)": "15/08/2026",
          "Cơ quan ban hành quyết định": "Trường Cao đẳng Nam Sài Gòn",
          "Link minh chứng Google Drive": "https://drive.google.com/file/d/sample-id/view",
          "Năm học": "2026-2027",
          "Ghi chú": "Khen thưởng cấp cơ sở",
        },
        {
          "STT": 2,
          "Họ và tên": "Trần Thị B",
          "Đơn vị công tác": "Phòng Đào tạo",
          "Loại danh hiệu thi đua": "Chiến sĩ thi đua cơ sở",
          "Nội dung thành tích": "Có sáng kiến cải tiến quy trình quản lý điểm số và giáo trình số hóa",
          "Số quyết định": "130/QĐ-CĐNSG",
          "Ngày ban hành (DD/MM/YYYY)": "20/08/2026",
          "Cơ quan ban hành quyết định": "Trường Cao đẳng Nam Sài Gòn",
          "Link minh chứng Google Drive": "https://drive.google.com/file/d/sample-id-2/view",
          "Năm học": "2026-2027",
          "Ghi chú": "",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      ws["!cols"] = [
        { wch: 6 },  // STT
        { wch: 25 }, // Họ và tên
        { wch: 30 }, // Đơn vị công tác
        { wch: 28 }, // Loại danh hiệu
        { wch: 45 }, // Nội dung thành tích
        { wch: 18 }, // Số quyết định
        { wch: 26 }, // Ngày ban hành
        { wch: 35 }, // Cơ quan ban hành
        { wch: 45 }, // Link Drive
        { wch: 15 }, // Năm học
        { wch: 25 }, // Ghi chú
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Thanh_Tich");
      XLSX.writeFile(wb, "Mau_Danh_Sach_Thanh_Tich_Thi_Dua.xlsx");
      message.success("Đã tải xuống file mẫu Excel thành công!");
    } catch (err) {
      console.error("Lỗi tạo mẫu Excel:", err);
      message.error("Lỗi khi tải file mẫu Excel");
    }
  };

  // Đọc file Excel người dùng chọn để Preview
  const handleFileUploadExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (!json || json.length === 0) {
          message.warning("File Excel không có dòng dữ liệu nào!");
          return;
        }

        // Chuẩn hóa dữ liệu
        const parsed = json.map((row, idx) => {
          const fullName = row["Họ và tên"] || row["Họ tên"] || row["fullName"] || "";
          const departmentName = row["Đơn vị công tác"] || row["Đơn vị"] || row["departmentName"] || "";
          const titleName = row["Loại danh hiệu thi đua"] || row["Danh hiệu thi đua"] || row["Danh hiệu"] || "";
          const achievementContent = row["Nội dung thành tích"] || row["Nội dung"] || "";
          const decisionNumber = row["Số quyết định"] || row["Số QĐ"] || "";
          const rawDate = row["Ngày ban hành (DD/MM/YYYY)"] || row["Ngày ban hành"] || row["Ngày quyết định"] || "";
          const decisionAgency = row["Cơ quan ban hành quyết định"] || row["Cơ quan ban hành"] || "";
          const driveLink = row["Link minh chứng Google Drive"] || row["Link minh chứng"] || row["Minh chứng"] || "";
          const schoolYear = row["Năm học"] || "2026-2027";
          const notes = row["Ghi chú"] || "";

          let isValid = true;
          const errors = [];
          if (!fullName.trim()) {
            isValid = false;
            errors.push("Thiếu Họ tên");
          }
          if (!departmentName.trim()) {
            isValid = false;
            errors.push("Thiếu Đơn vị");
          }
          if (!achievementContent.trim()) {
            isValid = false;
            errors.push("Thiếu Nội dung");
          }

          return {
            key: idx,
            stt: idx + 1,
            fullName,
            departmentName,
            titleName,
            achievementContent,
            decisionNumber,
            decisionDate: rawDate,
            decisionAgency,
            driveLink,
            schoolYear,
            notes,
            isValid,
            errors,
          };
        });

        setPreviewData(parsed);
        setImportModalVisible(true);
      } catch (err) {
        console.error("Lỗi đọc file Excel:", err);
        message.error("Lỗi đọc file Excel. Vui lòng kiểm tra lại định dạng file!");
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Ngăn antd tự upload
  };

  // Xác nhận nhập dữ liệu từ Excel Preview
  const handleConfirmImport = async () => {
    const validRows = previewData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      message.error("Không có dòng dữ liệu hợp lệ nào để nhập!");
      return;
    }

    try {
      setImporting(true);
      const items = validRows.map((r) => ({
        fullName: r.fullName,
        departmentName: r.departmentName,
        titleName: r.titleName,
        achievementContent: r.achievementContent,
        decisionNumber: r.decisionNumber,
        decisionDate: r.decisionDate,
        decisionAgency: r.decisionAgency,
        driveLink: r.driveLink,
        schoolYear: r.schoolYear,
        notes: r.notes,
      }));

      const res = await batchImportAchievements(items);
      if (res?.success) {
        message.success(res.message || `Đã nhập thành công ${res.count} thành tích khen thưởng!`);
        setImportModalVisible(false);
        setPreviewData([]);
        navigate("/emulation/achievements");
      }
    } catch (err) {
      console.error("Lỗi import Excel:", err);
      message.error(err.response?.data?.message || "Lỗi khi nhập danh sách từ Excel");
    } finally {
      setImporting(false);
    }
  };

  // Columns cho bảng Preview Import
  const previewColumns = [
    {
      title: "STT",
      dataIndex: "stt",
      width: 50,
      align: "center",
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      width: 160,
      render: (text, record) => (
        <span className={record.errors.includes("Thiếu Họ tên") ? "text-red-500 font-bold" : "font-medium"}>
          {text || "(Trống)"}
        </span>
      ),
    },
    {
      title: "Đơn vị công tác",
      dataIndex: "departmentName",
      width: 170,
      render: (text, record) => (
        <span className={record.errors.includes("Thiếu Đơn vị") ? "text-red-500 font-bold" : ""}>
          {text || "(Trống)"}
        </span>
      ),
    },
    {
      title: "Danh hiệu thi đua",
      dataIndex: "titleName",
      width: 170,
      render: (t) => t ? <span className="text-amber-700 font-medium">{t}</span> : <Text type="secondary">--</Text>,
    },
    {
      title: "Nội dung thành tích",
      dataIndex: "achievementContent",
      width: 220,
      render: (text, record) => (
        <span className={record.errors.includes("Thiếu Nội dung") ? "text-red-500 font-bold" : ""}>
          {text || "(Trống)"}
        </span>
      ),
    },
    {
      title: "Số QĐ",
      dataIndex: "decisionNumber",
      width: 120,
    },
    {
      title: "Ngày ban hành",
      dataIndex: "decisionDate",
      width: 120,
    },
    {
      title: "Cơ quan ban hành",
      dataIndex: "decisionAgency",
      width: 180,
    },
    {
      title: "Link Google Drive",
      dataIndex: "driveLink",
      width: 150,
      render: (url) =>
        url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            Xem link Drive
          </a>
        ) : (
          <Text type="secondary">--</Text>
        ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 130,
      align: "center",
      render: (_, record) =>
        record.isValid ? (
          <span className="text-green-600 font-medium flex items-center justify-center gap-1">
            <CheckCircleOutlined /> Hợp lệ
          </span>
        ) : (
          <span className="text-red-500 text-xs flex items-center justify-center gap-1">
            <ExclamationCircleOutlined /> {record.errors.join(", ")}
          </span>
        ),
    },
  ];

  return (
    <div className="w-full px-2 sm:px-4 py-3">
      <Card className="shadow-sm border-gray-200">
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-1 flex items-center gap-2 text-blue-700">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              Thêm Mới Thành Tích Thi Đua - Khen Thưởng
            </Title>
            <Text type="secondary">
              Quản lý và lưu trữ thông tin quyết định công nhận thành tích của cán bộ, giáo viên và đơn vị
            </Text>
          </div>

          <Space wrap>
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => navigate("/emulation/achievements")}
            >
              Tra cứu thành tích
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadExcelTemplate}
            >
              Tải mẫu Excel
            </Button>
            <Upload
              accept=".xlsx, .xls"
              showUploadList={false}
              beforeUpload={handleFileUploadExcel}
            >
              <Button
                icon={<FileExcelOutlined style={{ color: "#52c41a" }} />}
                style={{ borderColor: "#52c41a", color: "#389e0d" }}
              >
                Nhập từ Excel
              </Button>
            </Upload>
          </Space>
        </div>

        {/* BANNER HƯỚNG DẪN */}
        <Alert
          type="info"
          showIcon
          className="mb-6 text-sm"
          message="Hướng dẫn quản lý thành tích khen thưởng"
          description="Sau khi có quyết định khen thưởng, bạn hãy nhập thông tin bên dưới hoặc bấm 'Nhập từ Excel' để thêm hàng loạt. Hệ thống hỗ trợ nhúng trực tiếp link minh chứng Google Drive hoặc tải tệp đính kèm."
        />

        {/* BIỂU MẪU NHẬP THÀNH TÍCH */}
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              schoolYear: "2026-2027",
              decisionAgency: "Trường Cao đẳng Nam Sài Gòn",
            }}
          >
            {/* THÔNG TIN CÁN BỘ & ĐƠN VỊ */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5">
              <Text strong className="text-base text-blue-800 flex items-center gap-1 mb-3 block">
                <UserOutlined /> 1. Thông tin đối tượng khen thưởng
              </Text>
              <Row gutter={[16, 12]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="fullName"
                    label="Họ và tên cán bộ / Cá nhân / Tập thể"
                    rules={[{ required: true, message: "Vui lòng nhập họ và tên" }]}
                    tooltip="Có thể gõ tên tự do hoặc chọn nhanh từ danh sách cán bộ trong trường"
                  >
                    <AutoComplete
                      options={users.map((u) => ({
                        value: u.name,
                        label: (
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{u.name}</span>
                            <span className="text-xs text-gray-400">
                              {u.department?.departmentName || ""}
                            </span>
                          </div>
                        ),
                        userId: u._id,
                      }))}
                      onSelect={(value, option) => handleSelectUser(option.userId)}
                      placeholder="Nhập hoặc chọn họ tên cán bộ..."
                      filterOption={(inputValue, option) =>
                        (option?.value || "").toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                    />
                  </Form.Item>
                  <Form.Item name="userId" hidden>
                    <Input />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="departmentName"
                    label="Đơn vị / Phòng ban công tác"
                    rules={[{ required: true, message: "Vui lòng chọn hoặc nhập đơn vị công tác" }]}
                  >
                    <AutoComplete
                      options={departments.map((d) => ({
                        value: d.departmentName,
                        deptId: d._id,
                      }))}
                      onSelect={(value, option) => form.setFieldsValue({ departmentId: option.deptId })}
                      placeholder="Chọn hoặc nhập phòng ban / đơn vị..."
                      filterOption={(inputValue, option) =>
                        (option?.value || "").toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                    />
                  </Form.Item>
                  <Form.Item name="departmentId" hidden>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* THÔNG TIN THÀNH TÍCH & QUYẾT ĐỊNH */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5">
              <Text strong className="text-base text-amber-800 flex items-center gap-1 mb-3 block">
                <TrophyOutlined /> 2. Danh hiệu thi đua & Quyết định công nhận
              </Text>
              <Row gutter={[16, 12]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="titleId"
                    label="Loại danh hiệu thi đua (Lấy từ danh mục)"
                    tooltip="Chọn loại danh hiệu trong danh mục thi đua khen thưởng của nhà trường"
                  >
                    <Select
                      placeholder="Chọn loại danh hiệu thi đua..."
                      allowClear
                      onChange={(val) => {
                        const t = titles.find((item) => String(item._id) === String(val));
                        if (t) form.setFieldsValue({ titleName: t.name });
                      }}
                    >
                      {titles.map((t) => (
                        <Select.Option key={t._id} value={t._id}>
                          <span className="font-medium text-amber-700">{t.name}</span>{" "}
                          <span className="text-xs text-gray-400">({t.code})</span>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="titleName" hidden>
                    <Input />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="schoolYear"
                    label="Năm học công nhận"
                    rules={[{ required: true, message: "Vui lòng chọn năm học" }]}
                  >
                    <AutoComplete
                      options={SCHOOL_YEARS.map((y) => ({ value: y, label: `Năm học ${y}` }))}
                      placeholder="Chọn hoặc nhập năm học..."
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="achievementContent"
                    label="Nội dung thành tích / Chi tiết khen thưởng"
                    rules={[{ required: true, message: "Vui lòng nhập nội dung thành tích" }]}
                  >
                    <TextArea
                      rows={3}
                      placeholder="Ví dụ: Đạt danh hiệu Lao động tiên tiến năm học 2025-2026 vì đã hoàn thành xuất sắc các chỉ tiêu công tác..."
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="decisionNumber"
                    label="Số quyết định công nhận"
                    tooltip="Ví dụ: 125/QĐ-CĐNSG"
                  >
                    <Input placeholder="Nhập số quyết định..." />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="decisionDate"
                    label="Ngày ban hành quyết định"
                  >
                    <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày ban hành" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="decisionAgency"
                    label="Cơ quan ban hành quyết định"
                  >
                    <AutoComplete
                      options={COMMON_AGENCIES}
                      placeholder="Chọn hoặc nhập cơ quan ban hành..."
                      filterOption={(inputValue, option) =>
                        (option?.value || "").toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* MINH CHỨNG & TỆP ĐÍNH KÈM */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5">
              <Text strong className="text-base text-green-800 flex items-center gap-1 mb-3 block">
                <LinkOutlined /> 3. Tệp minh chứng & Link Google Drive
              </Text>
              <Row gutter={[16, 12]}>
                <Col xs={24} md={14}>
                  <Form.Item
                    name="driveLink"
                    label="Link minh chứng Google Drive"
                    tooltip="Dán đường dẫn chia sẻ file hoặc thư mục trên Google Drive của bạn"
                  >
                    <Input
                      prefix={<LinkOutlined className="text-blue-500" />}
                      placeholder="https://drive.google.com/file/d/..."
                      allowClear
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={10}>
                  <Form.Item
                    label="Hoặc tải file đính kèm trực tiếp (PDF, Word, Ảnh...)"
                    tooltip="File sẽ được tự động đồng bộ lên Google Drive của hệ thống"
                  >
                    <Upload
                      fileList={fileList}
                      beforeUpload={(file) => {
                        setFileList((prev) => [...prev, file]);
                        return false;
                      }}
                      onRemove={(file) => {
                        setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
                      }}
                      multiple
                    >
                      <Button icon={<UploadOutlined />} loading={uploadingFiles}>
                        Chọn tệp đính kèm ({fileList.length})
                      </Button>
                    </Upload>
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item name="notes" label="Ghi chú bổ sung (nếu có)">
                    <TextArea rows={2} placeholder="Nhập ghi chú thêm..." />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* NÚT THAO TÁC SUBMIT */}
            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={() => form.resetFields()}>
                Nhập lại
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={submitting || uploadingFiles}
                size="large"
                style={{ backgroundColor: "#1890ff" }}
              >
                Lưu thành tích
              </Button>
            </div>
          </Form>
        </Spin>
      </Card>

      {/* MODAL PREVIEW IMPORT TỪ EXCEL */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <FileExcelOutlined className="text-green-600 text-lg" />
            <span>Xem trước danh sách Thành tích nhập từ Excel</span>
          </div>
        }
        open={importModalVisible}
        onCancel={() => {
          if (!importing) {
            setImportModalVisible(false);
            setPreviewData([]);
          }
        }}
        width={1100}
        footer={[
          <Button key="cancel" onClick={() => setImportModalVisible(false)} disabled={importing}>
            Hủy bỏ
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={importing}
            onClick={handleConfirmImport}
            style={{ backgroundColor: "#52c41a" }}
          >
            Xác nhận nhập ({previewData.filter((r) => r.isValid).length} dòng hợp lệ)
          </Button>,
        ]}
      >
        <div className="mb-3 flex justify-between items-center">
          <Text>
            Tổng số dòng: <b>{previewData.length}</b> | Hợp lệ:{" "}
            <b className="text-green-600">{previewData.filter((r) => r.isValid).length}</b> | Lỗi:{" "}
            <b className="text-red-500">{previewData.filter((r) => !r.isValid).length}</b>
          </Text>
          <Text type="secondary" className="text-xs">
            Hệ thống sẽ tự động ghép danh hiệu thi đua và đơn vị theo tên tương ứng
          </Text>
        </div>

        <Table
          columns={previewColumns}
          dataSource={previewData}
          size="small"
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1000, y: 380 }}
          bordered
        />
      </Modal>
    </div>
  );
};

export default EmulationAchievementAddPage;
