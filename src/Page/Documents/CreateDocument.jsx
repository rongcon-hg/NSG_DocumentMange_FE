import { formatFileName } from "../../utils/formatFileName";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  DatePicker,
  Upload,
  message,
  Row,
  Col,
  Card,
  Space,
  Tooltip,
  Collapse,
  Tag,
  Spin,
} from "antd";
import { UploadOutlined, InfoCircleOutlined, SaveOutlined, RedoOutlined, DeleteOutlined, InboxOutlined, CheckSquareOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { uploadDocument, getNextDocNum, getTotalDocNum } from "../../api/documentApi";
import { getDriveToken, uploadFileDirectlyToDrive } from "../../api/driveApi";
import SelectFromSignatureArchive from "../../components/SelectFromSignatureArchive";
import { getAllDocVariants } from "../../api/docVariantApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllUsersCanSearchBanUser } from "../../api/auth";
import { getAllUnits } from "../../api/unitApi.js";
import { categorizeUsers } from "../../utils/userClassification";
import { removeVietnameseTones } from "../../utils/stringUtils";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import debounce from "lodash/debounce";

const { Option } = Select;
const { Panel } = Collapse;

const urgencyTag = (urgency) => {
  switch (urgency) {
    case "normal":
      return <Tag color="blue">Bình thường</Tag>;
    case "high":
      return <Tag color="orange">Khẩn</Tag>;
    case "immediately":
      return <Tag color="red">Hỏa tốc</Tag>;
    default:
      return null;
  }
};

const DocumentForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const [signers, setSigners] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [docVariants, setDocVariants] = useState([]);
  const [nextDocNum, setNextDocNum] = useState(null);
  const [nextDocNumReceived, setNextDocNumReceived] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [fileList, setFileList] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [displayPositionName, setDisplayPositionName] = useState("");

  const userGroups = useMemo(() => categorizeUsers(users), [users]);

  const docTypeWatch = Form.useWatch("docType", form);
  const executorsWatch = Form.useWatch("executors", form) || [];

  // Danh sách nhóm người ký hợp lệ: Chỉ hiển thị Ban Giám hiệu, Cấp trưởng và Cấp phó
  const eligibleSignerGroups = useMemo(() => {
    return userGroups.filter((g) => ["bgh", "capTruong", "capPho"].includes(g.key) && g.users.length > 0);
  }, [userGroups]);

  // Xử lý bật/tắt chọn tất cả theo từng nhóm cho Đơn vị / Người nhận
  const handleToggleGroupExecutors = (groupKey) => {
    const currentExecutors = form.getFieldValue("executors") || [];
    let targetIds = [];

    if (groupKey === "allUsers") {
      targetIds = (users || []).map((u) => `User|${u._id}`);
    } else if (groupKey === "allDepartments") {
      targetIds = (departments || []).map((d) => `Department|${d._id}`);
    } else {
      const group = userGroups.find((g) => g.key === groupKey);
      if (group && group.users) {
        targetIds = group.users.map((u) => `User|${u._id}`);
      }
    }

    if (targetIds.length === 0) return;

    const allSelected = targetIds.every((id) => currentExecutors.includes(id));
    let updatedExecutors;
    if (allSelected) {
      updatedExecutors = currentExecutors.filter((id) => !targetIds.includes(id));
    } else {
      updatedExecutors = Array.from(new Set([...currentExecutors, ...targetIds]));
    }

    form.setFieldsValue({ executors: updatedExecutors });
  };

  const isGroupFullySelected = (groupKey) => {
    const currentExecutors = executorsWatch || [];
    let targetIds = [];
    if (groupKey === "allUsers") {
      targetIds = (users || []).map((u) => `User|${u._id}`);
    } else if (groupKey === "allDepartments") {
      targetIds = (departments || []).map((d) => `Department|${d._id}`);
    } else {
      const group = userGroups.find((g) => g.key === groupKey);
      if (group && group.users) {
        targetIds = group.users.map((u) => `User|${u._id}`);
      }
    }
    return targetIds.length > 0 && targetIds.every((id) => currentExecutors.includes(id));
  };

  const handleExecutorsChange = (selectedValues) => {
    let updated = [...(selectedValues || [])];
    let hasSpecial = false;

    if (updated.includes("SPECIAL|ALL_USERS")) {
      hasSpecial = true;
      const allUserIds = (users || []).map((u) => `User|${u._id}`);
      updated = Array.from(new Set([...updated.filter((v) => v !== "SPECIAL|ALL_USERS"), ...allUserIds]));
    }

    if (updated.includes("SPECIAL|ALL_DEPARTMENTS")) {
      hasSpecial = true;
      const allDeptIds = (departments || []).map((d) => `Department|${d._id}`);
      updated = Array.from(new Set([...updated.filter((v) => v !== "SPECIAL|ALL_DEPARTMENTS"), ...allDeptIds]));
    }

    for (const group of userGroups) {
      const specialKey = `SPECIAL|GROUP_${group.key}`;
      if (updated.includes(specialKey)) {
        hasSpecial = true;
        const groupUserIds = group.users.map((u) => `User|${u._id}`);
        updated = Array.from(new Set([...updated.filter((v) => v !== specialKey), ...groupUserIds]));
      }
    }

    if (hasSpecial) {
      form.setFieldsValue({ executors: updated });
    }
  };

  useEffect(() => {
    if (location.state) {
      if (location.state.shortDescription) {
        form.setFieldsValue({ shortDescription: location.state.shortDescription });
      }
      if (location.state.signer && signers.length > 0) {
        form.setFieldsValue({ signer: location.state.signer, docType: "sent" });
        const selectedSigner = signers.find((s) => s._id === location.state.signer);
        if (selectedSigner) {
          const signerDepartmentId = selectedSigner?.department?._id;
          const signerPositionId = selectedSigner?.position?._id || "";
          const signerPositionName = selectedSigner?.position?.positionName || "";
          form.setFieldsValue({
            position: signerPositionId,
            departments: signerDepartmentId ? [signerDepartmentId] : [],
          });
          setDisplayPositionName(signerPositionName);
        }
      }
      if (location.state.files && location.state.files.length > 0) {
        const mappedFiles = location.state.files.map((file) => ({
          uid: file.fileId || file._id,
          name: file.fileName || file.name,
          status: "done",
          url: `https://drive.google.com/file/d/${file.fileId || file._id}/view`,
          isExisting: true,
          fileId: file.fileId || file._id,
          fileName: file.fileName || file.name,
        }));
        setFileList(mappedFiles);
        form.setFieldsValue({ files: mappedFiles });
      }
    }
  }, [location.state, form, signers]);

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.userId);
      } catch (e) {
        console.error("Invalid token:", e);
        message.error("Token không hợp lệ, vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }
    } else {
      message.error("Vui lòng đăng nhập để tạo văn bản.");
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [usersRes, departmentsRes, docVariantsRes, unitsRes] = await Promise.all([
          getAllUsersCanSearchBanUser(),
          getAllDepartments(),
          getAllDocVariants(),
          getAllUnits(),
        ]);

        const activeUsers = (usersRes.users || []).filter((u) => u.role !== null);
        setSigners(activeUsers);
        setUsers(activeUsers);
        setDepartments(departmentsRes?.AllDepartment || []);
        setDocVariants(docVariantsRes || []);
        setUnits(unitsRes || []);

        form.setFieldsValue({
          createAt: dayjs(),
          receivedAt: dayjs(),
          year: dayjs().year(),
          urgency: "normal",
          numOfPages: 1,
          assignedToUsers: [],
          executors: [],
          departments: form.getFieldValue("departments") || [],
          unit: null,
          docType: form.getFieldValue("docType") || "sent",
        });
        if (!location?.state?.files) {
          setFileList([]);
        }
        setNextDocNum(null);
        setNextDocNumReceived(null);
      } catch (error) {
        console.error("Error fetching data:", error);
        message.error("Không thể tải dữ liệu cần thiết.");
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [navigate, form]);

    const prevDocType = useRef(docTypeWatch);

    useEffect(() => {
      if (prevDocType.current !== docTypeWatch) {
        const wasUndefined = prevDocType.current === undefined;
        prevDocType.current = docTypeWatch;
        if (docTypeWatch === "received") {
          form.setFieldsValue({ signer: undefined, position: "", departments: [] });
          setDisplayPositionName("Sẽ được tự động gán bởi hệ thống");
        } else if (docTypeWatch === "sent") {
          if (!wasUndefined) {
            form.setFieldsValue({ signer: undefined, position: "", departments: [] });
          }
          setDisplayPositionName("");
        }
      }
    }, [docTypeWatch, form]);

  const debouncedGetNextDocNum = debounce(async () => {
    const selectedDocType = form.getFieldValue("docType");
    const selectedVariant = form.getFieldValue("docVariant");
    const selectedYear = form.getFieldValue("year");

    if (!selectedDocType || !selectedVariant || !selectedYear) {
      setNextDocNum(null);
      setNextDocNumReceived(null);
      form.setFieldsValue({ docNum: null, docNumReceived: null });
      return;
    }
    try {
      if (selectedDocType === "received") {
        const [nextDocNumRes, totalDocNumRes] = await Promise.all([
          getNextDocNum(selectedDocType, selectedVariant, selectedYear),
          getTotalDocNum(selectedVariant, selectedYear),
        ]);

        if (nextDocNumRes.success) {
          setNextDocNum(nextDocNumRes.nextDocNum);
          form.setFieldsValue({ docNum: nextDocNumRes.nextDocNum });
        } else {
          console.warn("Không thể lấy số tự động từ getNextDocNum:", nextDocNumRes.message);
          setNextDocNum(null);
          form.setFieldsValue({ docNum: null });
        }

        if (totalDocNumRes.success) {
          setNextDocNumReceived(totalDocNumRes.totalNum);
          form.setFieldsValue({ docNumReceived: totalDocNumRes.totalNum });
        } else {
          console.warn("Không thể lấy số văn bản đến từ getTotalDocNum:", totalDocNumRes.message);
          setNextDocNumReceived(null);
          form.setFieldsValue({ docNumReceived: null });
        }
      } else {
        const response = await getNextDocNum(selectedDocType, selectedVariant, selectedYear);
        if (response.success) {
          setNextDocNum(response.nextDocNum);
          form.setFieldsValue({ docNum: response.nextDocNum });
        } else {
          console.warn("Không thể lấy số tự động:", response.message);
          setNextDocNum(null);
          form.setFieldsValue({ docNum: null });
        }
      }
    } catch (error) {
      console.error("Lỗi khi lấy số thứ tự:", error);
      setNextDocNum(null);
      setNextDocNumReceived(null);
      form.setFieldsValue({ docNum: null, docNumReceived: null });
    }
  }, 500);

  const handleFileChange = ({ fileList: newFileList }) => setFileList(newFileList);

  const handleSignerChange = (signerId) => {
    if (form.getFieldValue("docType") === "received") {
      return;
    }
    const selectedSigner = signers.find((signer) => signer._id === signerId);
    const signerDepartmentId = selectedSigner?.department?._id;
    const signerPositionId = selectedSigner?.position?._id || "";
    const signerPositionName = selectedSigner?.position?.positionName || "";
    form.setFieldsValue({
      position: signerPositionId,
      departments: signerDepartmentId ? [signerDepartmentId] : [],
    });
    setDisplayPositionName(signerPositionName);
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      if (!currentUserId) {
        throw new Error("Không xác định được người dùng hiện tại (sentBy).");
      }

      const formData = new FormData();
      let finalSignerId = values.signer;
      let finalPositionId = values.position;
      let finalDepartments = values.departments;

      if (values.docType === "received") {
        finalSignerId = undefined;
        finalPositionId = "";
        finalDepartments = [];
      } else {
        const selectedSignerDetails = signers.find((s) => s._id === finalSignerId);
        if (!selectedSignerDetails) {
          throw new Error(`Người ký được chọn (ID: ${finalSignerId}) không hợp lệ hoặc không tìm thấy.`);
        }
        finalPositionId = selectedSignerDetails?.position?._id || "";
        const signerDepartmentId = selectedSignerDetails?.department?._id;
        finalDepartments = signerDepartmentId ? [signerDepartmentId] : [];
        form.setFieldsValue({ position: finalPositionId, departments: finalDepartments });
      }

      if (values.docType !== "received") {
        if (!finalSignerId) {
          throw new Error("ID người ký không hợp lệ hoặc không được cung cấp.");
        }
        if (!finalDepartments.length) {
          throw new Error("Phải chọn ít nhất một đơn vị (departments).");
        }
      }

      const executors = (values.executors || [])
        .filter((e) => typeof e === "string" && !e.startsWith("SPECIAL|"))
        .map((e) => {
          const [type, id] = e.split("|");
          if (!type || !id) throw new Error(`Định dạng không hợp lệ cho đơn vị nhận: ${e}`);
          return { executorId: id, executorType: type };
        });

      const assignedToUsers = (values.assignedToUsers || []).map((userId) => {
        if (!userId) throw new Error(`ID người nhận không hợp lệ: ${userId}`);
        return {
          userId,
          status: "received",
          onTime: values.deadlineDay ? "pending" : "onTime",
          isRead: false,
          receivedDate: null,
        };
      });

      formData.append("sentBy", currentUserId);
      formData.append("docType", values.docType);
      formData.append("docVariant", values.docVariant);
      formData.append("year", values.year);
      if (values.deadlineDay) {
        formData.append("deadlineDay", values.deadlineDay.format("YYYY-MM-DD"));
      }
      formData.append("docNum", values.docNum);
      formData.append("docCode", values.docCode);
      if (values.docType !== "received") {
        formData.append("signer", finalSignerId);
        if (finalPositionId) formData.append("position", finalPositionId);
      }
      formData.append("departments", JSON.stringify(finalDepartments));
      formData.append("executors", JSON.stringify(executors));
      formData.append("assignedToUsers", JSON.stringify(assignedToUsers));
      formData.append("principalIdea", values.principalIdea || "");
      formData.append("numOfPages", values.numOfPages || 1);
      formData.append("shortDescription", values.shortDescription || "");
      if (values.note) formData.append("note", values.note);
      formData.append("urgency", values.urgency);
      if (values.createAt) formData.append("createAt", values.createAt.format("YYYY-MM-DD"));
      
      if (values.docType === "received") {
        if (!values.unit) throw new Error("Cơ quan ban hành là bắt buộc đối với văn bản đến.");
        formData.append("unit", values.unit);
        if (values.receivedAt) formData.append("receivedAt", values.receivedAt.format("YYYY-MM-DD"));
        formData.append("position", "67e0df448459c5b00584f922");
      }

      const extractedExistingFiles = [];
      const filesToUploadDirectly = [];

      fileList.forEach((file) => {
        if (file.originFileObj) {
          filesToUploadDirectly.push(file.originFileObj);
        } else if (file.isExisting) {
          extractedExistingFiles.push({ fileId: file.fileId, fileName: file.fileName });
        }
      });

      const newlyUploadedFiles = [];
      if (filesToUploadDirectly.length > 0) {
        message.loading({ content: 'Đang tải tệp lên Google Drive...', key: 'uploading' });
        try {
          const driveAuth = await getDriveToken();
          const accessToken = driveAuth.accessToken;
          const folderId = driveAuth.folderId;

          for (const fileObj of filesToUploadDirectly) {
            const uploadedFile = await uploadFileDirectlyToDrive(fileObj, accessToken, folderId);
            newlyUploadedFiles.push(uploadedFile);
          }
          message.success({ content: 'Tải tệp lên Google Drive thành công!', key: 'uploading', duration: 2 });
        } catch (error) {
          message.error({ content: `Lỗi tải tệp: ${error.message}`, key: 'uploading', duration: 4 });
          throw error;
        }
      }

      if (newlyUploadedFiles.length > 0) {
        formData.append("uploadedFiles", JSON.stringify(newlyUploadedFiles));
      }

      if (extractedExistingFiles.length > 0) {
        formData.append("existingFiles", JSON.stringify(extractedExistingFiles));
      }

      if (location.state && location.state.repliedDocId) {
        formData.append("repliedDocId", location.state.repliedDocId);
      }

      await uploadDocument(formData);

      message.success("Phát hành văn bản thành công!");
      form.resetFields();
      setFileList([]);
      setNextDocNum(null);
      setNextDocNumReceived(null);
      form.setFieldsValue({
        createAt: dayjs(),
        receivedAt: dayjs(),
        year: dayjs().year(),
        urgency: "normal",
        numOfPages: 1,
        assignedToUsers: [],
        executors: [],
        departments: [],
        unit: null,
        docType: "sent",
      });
      navigate("/documents/SentDocumentList");
    } catch (error) {
      if (error.errorFields) {
        const firstErrorField = error.errorFields[0];
        const fieldName = firstErrorField.name.join(".");
        const errorMessage = firstErrorField.errors[0];
        form.scrollToField(fieldName, { behavior: "smooth", block: "center" });
        message.error(`Lỗi nhập liệu: ${errorMessage || "Vui lòng kiểm tra lại các trường đã nhập."}`);
      } else {
        console.error("Error uploading document:", error);
        const serverErrorMessage = error.response?.data?.message || error.message || "Lỗi không xác định.";
        message.error(`Lỗi phát hành văn bản: ${serverErrorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
      <Spin spinning={loadingData} tip="Đang tải dữ liệu biểu mẫu..." size="large">
        <Card
          title={
            <Space className="flex-wrap">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">Ban hành văn bản mới</h1>
              <Tooltip title="Điền đầy đủ thông tin và nhấn Phát hành. Ctrl+S để lưu nhanh.">
                <InfoCircleOutlined className="text-gray-500" />
              </Tooltip>
            </Space>
          }
          bordered={false}
          className={`shadow-md rounded-lg transition-all ${loadingData ? "blur-sm" : ""}`}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            disabled={loadingData || loading}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                form.submit();
              }
            }}
          >
            <Collapse defaultActiveKey={["1", "2", "3"]} expandIconPosition="right" ghost className="mb-6">
              <Panel
                header={<span className="font-semibold text-base md:text-lg">Thông tin cơ bản</span>}
                key="1"
                className="bg-white rounded-md mb-4 shadow-sm"
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      name="docType"
                      label="Kiểu văn bản"
                      rules={[{ required: true, message: "Chọn kiểu văn bản!" }]}
                    >
                      <Select placeholder="Chọn kiểu văn bản" onChange={debouncedGetNextDocNum}>
                        <Option value="sent">Văn bản đi</Option>
                        <Option value="received">Văn bản đến</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      name="docVariant"
                      label="Loại văn bản"
                      rules={[{ required: true, message: "Chọn loại văn bản!" }]}
                    >
                      <Select
                        placeholder="Chọn loại văn bản"
                        onChange={debouncedGetNextDocNum}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {docVariants.map((variant) => (
                          <Option key={variant._id} value={variant._id}>
                            {variant.docVariantName}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item name="year" label="Năm" rules={[{ required: true, message: "Nhập năm!" }]}>
                      <InputNumber
                        min={1900}
                        max={dayjs().year() + 1}
                        style={{ width: "100%" }}
                        onChange={debouncedGetNextDocNum}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      name="createAt"
                      label="Ngày văn bản"
                      rules={[{ required: true, message: "Chọn ngày văn bản!" }]}
                    >
                      <DatePicker style={{ width: "100%" }} placeholder="Chọn ngày" format="DD/MM/YYYY" />
                    </Form.Item>
                  </Col>
                  {docTypeWatch === "received" && (
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item
                        name="receivedAt"
                        label="Ngày nhận văn bản đến"
                        rules={[{ required: true, message: "Chọn ngày nhận văn bản đến!" }]}
                      >
                        <DatePicker
                          style={{ width: "100%" }}
                          placeholder="Chọn ngày"
                          format="DD/MM/YYYY"
                        />
                      </Form.Item>
                    </Col>
                  )}
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item 
                      name="deadlineDay" 
                      label="Hạn xử lý"
                      getValueFromEvent={(date) => {
                        return date || null;
                      }}
                    >
                      <DatePicker
                        style={{ width: "100%" }}
                        placeholder="Chọn ngày (nếu có)"
                        format="DD/MM/YYYY"
                        allowClear
                        onChange={(date) => {
                          if (!date) {
                            form.setFieldValue("deadlineDay", null);
                          }
                        }}
                      />
                    </Form.Item>
                  </Col>
                  {docTypeWatch === "received" && (
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item
                        name="docNumReceived"
                        label="Số văn bản đến"
                        rules={[{ required: true, message: "Số văn bản đến là bắt buộc!" }]}
                      >
                        <InputNumber
                          min={1}
                          placeholder={nextDocNumReceived ? `${nextDocNumReceived}` : "Số văn bản đến"}
                          style={{ width: "100%" }}
                          disabled
                        />
                      </Form.Item>
                    </Col>
                  )}
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item label="Số/Ký hiệu văn bản" required>
                      <Space.Compact style={{ width: "100%" }}>
                        <Form.Item
                          name="docNum"
                          noStyle
                          rules={[{ required: true, message: "Nhập số văn bản!" }]}
                        >
                          <InputNumber
                            min={1}
                            placeholder={nextDocNum ? `Gợi ý: ${nextDocNum}` : "Số văn bản"}
                            style={{ width: "40%" }}
                          />
                        </Form.Item>
                        <Input
                          placeholder="/"
                          disabled
                          style={{ width: "10%", textAlign: "center", background: "#fff", borderColor: "#d9d9d9" }}
                        />
                        <Form.Item
                          name="docCode"
                          noStyle
                          rules={[{ required: true, message: "Nhập ký hiệu!" }]}
                        >
                          <Input placeholder="Ký hiệu" style={{ width: "50%" }} />
                        </Form.Item>
                      </Space.Compact>
                      <Tooltip title={nextDocNum ? "Số đã được lấy tự động" : "Lấy gợi ý số tiếp theo (nếu cần)"}>
                        <Button
                          type="link"
                          onClick={debouncedGetNextDocNum}
                          icon={<RedoOutlined />}
                          className="p-0 mt-1 text-xs"
                        >
                          {nextDocNum ? "Đã lấy số" : "Gợi ý số"}
                        </Button>
                      </Tooltip>
                    </Form.Item>
                  </Col>
                  {docTypeWatch === "received" && (
                    <Col xs={24}>
                      <Form.Item
                        name="unit"
                        label="Cơ quan ban hành"
                        rules={[{ required: true, message: "Vui lòng chọn cơ quan ban hành!" }]}
                      >
                        <Select
                          placeholder="Chọn cơ quan ban hành"
                          allowClear
                          showSearch
                          filterOption={(input, option) =>
                            (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
                          }
                        >
                          {units.map((unit) => (
                            <Option key={unit._id} value={unit._id}>
                              {unit.unitName}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  )}
                </Row>
              </Panel>

              <Panel
                header={<span className="font-semibold text-base md:text-lg">Người ký & Người nhận</span>}
                key="2"
                className="bg-white rounded-md mb-4 shadow-sm"
              >
                <Row gutter={[16, 16]}>
                  {docTypeWatch !== "received" && (
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item
                        name="signer"
                        label="Người ký"
                        rules={[{ required: true, message: "Chọn người ký!" }]}
                      >
                        <Select
                          placeholder="Chọn người ký (BGH, Cấp trưởng, Cấp phó)"
                          onChange={handleSignerChange}
                          showSearch
                          optionFilterProp="label"
                          optionLabelProp="name"
                          filterOption={(input, option) => {
                            if (!input) return true;
                            const search = removeVietnameseTones(input.toLowerCase().trim());
                            const label = removeVietnameseTones(String(option?.label || "").toLowerCase());
                            const name = removeVietnameseTones(String(option?.name || "").toLowerCase());
                            return label.includes(search) || name.includes(search);
                          }}
                        >
                          {eligibleSignerGroups.map((group) => (
                            <Select.OptGroup key={group.key} label={group.label}>
                              {group.users.map((signer) => {
                                const posStr = signer.position?.positionName ? ` - ${signer.position.positionName}` : "";
                                const deptStr = signer.department?.departmentName ? ` (${signer.department.departmentName})` : "";
                                const labelStr = `${signer.name || ""}${posStr}${deptStr}`.trim();
                                return (
                                  <Option key={signer._id} value={signer._id} label={labelStr} name={signer.name || ""}>
                                    {labelStr}
                                  </Option>
                                );
                              })}
                            </Select.OptGroup>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  )}
                  {docTypeWatch !== "received" && (
                    <>
                      <Col xs={24} sm={12} md={8}>
                        <label className="ant-form-item-label">
                          <label title="Chức vụ">Chức vụ</label>
                        </label>
                        <Input
                          disabled
                          placeholder="Tự động"
                          className="bg-gray-100"
                          value={displayPositionName}
                        />
                        <Form.Item name="position" hidden>
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item
                          name="departments"
                          label="Đơn vị"
                          rules={[{ required: true, message: "Chọn ít nhất một đơn vị!" }]}
                        >
                          <Select
                            mode="multiple"
                            placeholder="Tự động điền theo người ký"
                            disabled
                            allowClear
                            optionFilterProp="label"
                            optionLabelProp="name"
                          >
                            {departments.map((dept) => (
                              <Option key={dept._id} value={dept._id} label={dept.departmentName} name={dept.departmentName}>
                                {dept.departmentName}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </>
                  )}
                  <Col xs={24} md={12}>
                    {/* Thanh nút Chọn nhanh theo nhóm */}
                    <div className="mb-2 p-2 bg-blue-50/70 border border-blue-200/80 rounded-lg">
                      <div className="flex items-center justify-between flex-wrap gap-1 mb-1.5">
                        <span className="font-semibold text-xs text-blue-900 flex items-center gap-1">
                          <CheckSquareOutlined className="text-blue-600" /> Chọn nhanh Đơn vị / Người nhận:
                        </span>
                        {executorsWatch?.length > 0 && (
                          <Button
                            size="small"
                            danger
                            type="link"
                            className="!p-0 text-xs h-auto"
                            onClick={() => form.setFieldsValue({ executors: [] })}
                          >
                            Xóa chọn ({executorsWatch.length})
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {userGroups.map((group) => {
                          const isFully = isGroupFullySelected(group.key);
                          const shortName = group.key === "bgh" ? "Tất cả BGH" : group.key === "capTruong" ? "Tất cả Cấp trưởng" : group.key === "capPho" ? "Tất cả Cấp phó" : group.key === "chuyenVien" ? "Tất cả Chuyên viên" : group.key === "manager" ? "Tất cả Manager" : group.label;
                          return (
                            <Button
                              key={group.key}
                              size="small"
                              type={isFully ? "primary" : "default"}
                              className={`text-xs !h-6 !px-2 rounded ${isFully ? "" : "border-gray-300 text-gray-700 bg-white hover:border-blue-400"}`}
                              onClick={() => handleToggleGroupExecutors(group.key)}
                            >
                              {isFully ? "✓ " : "+ "}{shortName} ({group.users.length})
                            </Button>
                          );
                        })}
                        <Button
                          size="small"
                          type={isGroupFullySelected("allDepartments") ? "primary" : "default"}
                          className={`text-xs !h-6 !px-2 rounded ${isGroupFullySelected("allDepartments") ? "" : "border-indigo-200 text-indigo-700 bg-indigo-50/40 hover:border-indigo-400"}`}
                          onClick={() => handleToggleGroupExecutors("allDepartments")}
                        >
                          {isGroupFullySelected("allDepartments") ? "✓ " : "+ "}Tất cả Đơn vị ({departments.length})
                        </Button>
                        <Button
                          size="small"
                          type={isGroupFullySelected("allUsers") ? "primary" : "default"}
                          className={`text-xs !h-6 !px-2 rounded ${isGroupFullySelected("allUsers") ? "" : "border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:border-emerald-500 hover:text-emerald-800 font-medium"}`}
                          onClick={() => handleToggleGroupExecutors("allUsers")}
                        >
                          {isGroupFullySelected("allUsers") ? "✓ " : "+ "}Tất cả người dùng ({users.length})
                        </Button>
                      </div>
                    </div>

                    <Form.Item
                      name="executors"
                      label="Đơn vị / Người nhận"
                      rules={[{ required: true, message: "Chọn ít nhất một đơn vị hoặc người nhận!" }]}
                    >
                      <Select
                        mode="multiple"
                        placeholder="Chọn đơn vị/cá nhân (hoặc dùng các nút chọn nhanh ở trên)"
                        allowClear
                        showSearch
                        onChange={handleExecutorsChange}
                        optionFilterProp="label"
                        optionLabelProp="name"
                        filterOption={(input, option) => {
                          if (!input) return true;
                          const search = removeVietnameseTones(input.toLowerCase().trim());
                          const label = removeVietnameseTones(String(option?.label || "").toLowerCase());
                          const name = removeVietnameseTones(String(option?.name || "").toLowerCase());
                          return label.includes(search) || name.includes(search);
                        }}
                        dropdownRender={(menu) => (
                          <div>
                            <div className="p-2 border-b border-gray-200 bg-slate-50 flex flex-wrap gap-1.5 items-center">
                              <span className="text-xs font-bold text-gray-600 mr-1">⚡ Chọn nhanh:</span>
                              <Button size="small" type={isGroupFullySelected("bgh") ? "primary" : "dashed"} className="!text-[11px] !h-5 !px-1.5" onClick={() => handleToggleGroupExecutors("bgh")}>
                                {isGroupFullySelected("bgh") ? "✓ BGH" : "+ BGH"}
                              </Button>
                              <Button size="small" type={isGroupFullySelected("capTruong") ? "primary" : "dashed"} className="!text-[11px] !h-5 !px-1.5" onClick={() => handleToggleGroupExecutors("capTruong")}>
                                {isGroupFullySelected("capTruong") ? "✓ Cấp trưởng" : "+ Cấp trưởng"}
                              </Button>
                              <Button size="small" type={isGroupFullySelected("capPho") ? "primary" : "dashed"} className="!text-[11px] !h-5 !px-1.5" onClick={() => handleToggleGroupExecutors("capPho")}>
                                {isGroupFullySelected("capPho") ? "✓ Cấp phó" : "+ Cấp phó"}
                              </Button>
                              <Button size="small" type={isGroupFullySelected("allDepartments") ? "primary" : "dashed"} className="!text-[11px] !h-5 !px-1.5" onClick={() => handleToggleGroupExecutors("allDepartments")}>
                                {isGroupFullySelected("allDepartments") ? "✓ Đơn vị" : "+ Đơn vị"}
                              </Button>
                              <Button size="small" type={isGroupFullySelected("allUsers") ? "primary" : "dashed"} className="!text-[11px] !h-5 !px-1.5 text-emerald-700" onClick={() => handleToggleGroupExecutors("allUsers")}>
                                {isGroupFullySelected("allUsers") ? "✓ Tất cả người dùng" : "+ Tất cả người dùng"}
                              </Button>
                            </div>
                            {menu}
                          </div>
                        )}
                      >
                        {userGroups.map((group) => (
                          <Select.OptGroup key={group.key} label={group.label}>
                            <Option
                              key={`SPECIAL|GROUP_${group.key}`}
                              value={`SPECIAL|GROUP_${group.key}`}
                              label={`Chọn tất cả ${group.label}`}
                              name={`Chọn tất cả ${group.label}`}
                              className="font-semibold text-blue-600 bg-blue-50/40"
                            >
                              ⚡ [Chọn tất cả {group.label}]
                            </Option>
                            {group.users.map((user) => {
                              const posStr = user.position?.positionName ? ` - ${user.position.positionName}` : "";
                              const deptStr = user.department?.departmentName ? ` (${user.department.departmentName})` : "";
                              const labelStr = `${user.name || ""}${posStr}${deptStr}`.trim();
                              return (
                                <Option key={`User|${user._id}`} value={`User|${user._id}`} label={labelStr} name={user.name || ""}>
                                  {labelStr}
                                </Option>
                              );
                            })}
                          </Select.OptGroup>
                        ))}
                        <Select.OptGroup label={`Đơn vị / Phòng ban (${departments.length})`}>
                          <Option
                            key="SPECIAL|ALL_DEPARTMENTS"
                            value="SPECIAL|ALL_DEPARTMENTS"
                            label="Chọn tất cả Đơn vị / Phòng ban"
                            name="Chọn tất cả Đơn vị / Phòng ban"
                            className="font-semibold text-indigo-600 bg-indigo-50/40"
                          >
                            🏢 [Chọn tất cả Đơn vị / Phòng ban ({departments.length})]
                          </Option>
                          <Option
                            key="SPECIAL|ALL_USERS"
                            value="SPECIAL|ALL_USERS"
                            label="Chọn tất cả Người dùng (Toàn trường)"
                            name="Chọn tất cả Người dùng (Toàn trường)"
                            className="font-semibold text-emerald-600 bg-emerald-50/40"
                          >
                            👥 [Chọn tất cả Người dùng ({users.length})]
                          </Option>
                          {departments.map((dept) => {
                            const labelStr = String(dept.departmentName || "");
                            return (
                              <Option key={`Department|${dept._id}`} value={`Department|${dept._id}`} label={labelStr} name={labelStr}>
                                {labelStr}
                              </Option>
                            );
                          })}
                        </Select.OptGroup>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="assignedToUsers" label="Người chủ trì">
                      <Select
                        mode="multiple"
                        placeholder="Chọn người chủ trì (nếu có)"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        optionLabelProp="name"
                        filterOption={(input, option) => {
                          if (!input) return true;
                          const search = removeVietnameseTones(input.toLowerCase().trim());
                          const label = removeVietnameseTones(String(option?.label || "").toLowerCase());
                          const name = removeVietnameseTones(String(option?.name || "").toLowerCase());
                          return label.includes(search) || name.includes(search);
                        }}
                      >
                        {userGroups.map((group) => (
                          <Select.OptGroup key={group.key} label={group.label}>
                            {group.users.map((user) => {
                              const posStr = user.position?.positionName ? ` - ${user.position.positionName}` : "";
                              const deptStr = user.department?.departmentName ? ` (${user.department.departmentName})` : "";
                              const labelStr = `${user.name || ""}${posStr}${deptStr}`.trim();
                              return (
                                <Option key={user._id} value={user._id} label={labelStr} name={user.name || ""}>
                                  {labelStr}
                                </Option>
                              );
                            })}
                          </Select.OptGroup>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              <Panel
                header={<span className="font-semibold text-base md:text-lg">Nội dung & Tệp</span>}
                key="3"
                className="bg-white rounded-md shadow-sm"
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Form.Item
                      name="shortDescription"
                      label="Trích yếu"
                      rules={[{ required: true, message: "Vui lòng nhập trích yếu!" }]}
                    >
                      <Input.TextArea rows={3} placeholder="Tóm tắt nội dung chính của văn bản" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="principalIdea" label="Bút phê/Ý kiến">
                      <Input.TextArea rows={2} placeholder="Ý kiến chỉ đạo của lãnh đạo (nếu có)" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Form.Item
                      name="numOfPages"
                      label="Số lượng phát hành"
                      rules={[{ type: "number", min: 1, message: "Số lượng phát hành không hợp lệ!" }]}
                    >
                      <InputNumber min={1} style={{ width: "100%" }} placeholder="Số lượng phát hành" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Form.Item
                      name="urgency"
                      label="Độ khẩn"
                      rules={[{ required: true, message: "Chọn độ khẩn!" }]}
                    >
                      <Select
                        placeholder="Chọn độ khẩn"
                        onChange={(value) => form.setFieldsValue({ urgency: value })}
                      >
                        <Option value="normal">{urgencyTag("normal")}</Option>
                        <Option value="high">{urgencyTag("high")}</Option>
                        <Option value="immediately">{urgencyTag("immediately")}</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="note" label="Ghi chú thêm">
                      <Input.TextArea
                        rows={3}
                        placeholder="Thông tin bổ sung, diễn giải thêm (nếu có)"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      name="files"
                      label="Tệp đính kèm"
                      valuePropName="fileList"
                      getValueFromEvent={(e) => {
                        if (Array.isArray(e)) {
                          return e;
                        }
                        return e && e.fileList;
                      }}
                    >
                      <SelectFromSignatureArchive 
                        onSelectFiles={(files) => {
                          const newFileList = [...fileList];
                          files.forEach(f => {
                             if (!newFileList.find(extF => extF.fileId === f.fileId)) {
                                newFileList.push(f);
                             }
                          });
                          setFileList(newFileList);
                        }} 
                      />
                      <Upload.Dragger
                        multiple
                        onChange={handleFileChange}
                        beforeUpload={() => false}
                        fileList={fileList}
                        itemRender={(originNode, file, fileList, actions) => (
                          <div className="flex items-center justify-between p-2 mt-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-blue-50 transition-colors">
                            <div className="flex items-center space-x-2 overflow-hidden">
                              <span className="text-blue-500 text-lg">📄</span>
                              <span className="text-sm text-gray-700 truncate block" title={file.name || file.fileName}>
                                {file.name || file.fileName}
                              </span>
                            </div>
                            <span 
                              className="text-red-500 cursor-pointer hover:text-red-700 font-bold px-2 text-lg" 
                              onClick={actions.remove}
                              title="Xóa"
                            >
                              ×
                            </span>
                          </div>
                        )}
                      >
                        <p className="ant-upload-drag-icon">
                          <InboxOutlined className="text-blue-500 text-3xl" />
                        </p>
                        <p className="ant-upload-text text-gray-700 font-medium mt-2">
                          Nhấp hoặc kéo thả tệp vào đây
                        </p>
                      </Upload.Dragger>
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>
            </Collapse>

            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button onClick={() => navigate(-1)} size="large" disabled={loading} className="w-full sm:w-auto">
                Hủy
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                disabled={loadingData}
                size="large"
                icon={<SaveOutlined />}
                className="w-full sm:w-auto min-w-[150px]"
              >
                Phát hành văn bản
              </Button>
            </div>
          </Form>
        </Card>
      </Spin>
    </div>
  );
};

export default DocumentForm;