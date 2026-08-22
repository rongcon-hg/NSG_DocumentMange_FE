import { formatFileName } from "../../utils/formatFileName";
import { useEffect, useState } from "react";
import { Form, Input, InputNumber, Select, Button, DatePicker, Upload, message, Row, Col, Card, Space, Tooltip, Collapse, Tag, Modal, Spin } from "antd";
import { UploadOutlined, InfoCircleOutlined, SaveOutlined, InboxOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { getDocumentById, updateDocument, getTotalDocNum } from "../../api/documentApi";
import { getAllDocVariants } from "../../api/docVariantApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllUsersCanSearchBanUser } from "../../api/auth";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import { getAllUnits } from "../../api/unitApi.js";
import debounce from 'lodash/debounce';

const { Option } = Select;
const { Panel } = Collapse;

const UpdateDocumentPage = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [signers, setSigners] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [docVariants, setDocVariants] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);
  const [nextDocNumReceived, setNextDocNumReceived] = useState(null);
  const docTypeWatch = Form.useWatch('docType', form);
  const [displayPositionName, setDisplayPositionName] = useState('');

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        jwtDecode(token);
      } catch (e) {
        console.error("Invalid token:", e);
        message.error("Token không hợp lệ, vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

    } else {
      message.error("Vui lòng đăng nhập để tiếp tục.");
      navigate("/login");
      return;
    }

    const fetchDataAndDocument = async () => {
      setLoadingData(true);
      try {
        const [usersRes, departmentsRes, docVariantsRes, unitsRes] = await Promise.all([
          getAllUsersCanSearchBanUser(),
          getAllDepartments(),
          getAllDocVariants(),
          getAllUnits(),
        ]);
        const activeUsers = (usersRes.users || []).filter(u => u.role !== null);
        setSigners(activeUsers);
        setUsers(activeUsers);
        setDepartments(departmentsRes?.AllDepartment || []);
        setDocVariants(docVariantsRes || []);
        setUnits(unitsRes || []);

        

        if (!documentId) {
          throw new Error("Không có ID tài liệu được cung cấp.");
        }

        const response = await getDocumentById(documentId);
        if (!response || !response.success || !response.data) {
          throw new Error(response?.message || "Không tìm thấy tài liệu.");
        }
        const doc = response.data;

        // Lọc assignedToUsers để chỉ lấy những người có onTime !== null
        const filteredAssignedToUsers = doc.assignedToUsers
          ?.filter(user => user.onTime !== null)
          .map(user => user.userId?._id || user.userId) || [];

        form.setFieldsValue({
          docType: doc.docType,
          docVariant: doc.docVariant?._id,
          year: doc.year,
          deadlineDay: doc.deadlineDay ? dayjs(doc.deadlineDay) : null,
          docNum: doc.docNum,
          docNumReceived: doc.docNumReceived || null,
          docCode: doc.docCode,
          signer: doc.signer?._id,
          position: doc.signer?.position?._id || '',
          departments: doc.departments?.map(dept => dept._id) || [],
          principalIdea: doc.principalIdea,
          numOfPages: doc.numOfPages,
          shortDescription: doc.shortDescription,
          note: doc.note,
          urgency: doc.urgency,
          executors: doc.executors?.map(executor => `${executor.executorType}|${executor.executorId}`) || [],
          assignedToUsers: filteredAssignedToUsers,
          createAt: doc.createAt ? dayjs(doc.createAt) : null,
          receivedAt: doc.receivedAt ? dayjs(doc.receivedAt) : null,
          unit: doc.unit?._id,
        });

        setDisplayPositionName(doc.signer?.position?.positionName || '');

        const filesFromDoc = doc.files || [];
        const formattedFiles = filesFromDoc.map((file, index) => {
          const uid = file.fileId || `existing-${index}-${Date.now()}`;
          const name = file.fileName || `file_không_tên_${index}`;
          const url = file.fileId ? `https://drive.google.com/file/d/${file.fileId}/view?usp=sharing` : '#';
          const previewUrl = file.fileId ? `https://drive.google.com/file/d/${file.fileId}/preview` : '#';

          
          return {
            uid: uid,
            name: name,
            status: 'done',
            url: url,
            previewUrl: previewUrl,
            linkProps: { download: name, target: '_blank' },
            fileId: file.fileId,
            isExisting: true,
            type: file.mimeType || '',
          };
        });
        setFileList(formattedFiles);
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu cập nhật:", error);
        message.error(error.message || "Lỗi khi tải dữ liệu. Vui lòng thử lại.");
        navigate(-1);
      } finally {
        setLoadingData(false);
      }
    };

    fetchDataAndDocument();
  }, [documentId, form, navigate]);

  useEffect(() => {
    if (docTypeWatch === 'received') {
      // Văn bản đến: không chọn người ký ở FE, BE sẽ tự gán
      form.setFieldsValue({ signer: undefined, position: '', departments: [] });
      setDisplayPositionName('Sẽ được tự động gán bởi hệ thống');
    } else if (docTypeWatch === 'sent') {
      const currentSignerId = form.getFieldValue('signer');
      if (currentSignerId) {
        const selectedSigner = signers.find(s => s._id === currentSignerId);
        if (!selectedSigner) {
          console.warn(`Không tìm thấy thông tin người ký (ID: ${currentSignerId})`);
          form.setFieldsValue({ position: '', departments: [] });
          setDisplayPositionName('');
          return;
        }
        const signerPositionId = selectedSigner?.position?._id || '';
        const signerPositionName = selectedSigner?.position?.positionName || '';
        const signerDepartmentId = selectedSigner?.department?._id;
        form.setFieldsValue({
          position: signerPositionId,
          departments: signerDepartmentId ? [signerDepartmentId] : []
        });
        setDisplayPositionName(signerPositionName);
      } else {
        form.setFieldsValue({ position: '', departments: [] });
        setDisplayPositionName('');
      }
    }
  }, [docTypeWatch, form, signers]);

  useEffect(() => {
    const debouncedGetNextDocNum = debounce(async () => {
      const selectedDocType = form.getFieldValue("docType");
      const selectedVariant = form.getFieldValue("docVariant");
      const selectedYear = form.getFieldValue("year");

      if (selectedDocType !== 'received' || !selectedVariant || !selectedYear) {
        setNextDocNumReceived(null);
        return;
      }

      try {
        const totalDocNumRes = await getTotalDocNum(selectedVariant, selectedYear);
        if (totalDocNumRes.success) {
          setNextDocNumReceived(totalDocNumRes.totalNum);
        } else {
          console.warn("Không thể lấy số văn bản đến từ getTotalDocNum:", totalDocNumRes.message);
          setNextDocNumReceived(null);
        }
      } catch (error) {
        console.error("Lỗi khi lấy số văn bản đến:", error);
        setNextDocNumReceived(null);
      }
    }, 500);

    debouncedGetNextDocNum();

    return () => debouncedGetNextDocNum.cancel();
  }, [docTypeWatch, form]);

  const handleSignerChange = (signerId) => {
    if (form.getFieldValue('docType') === 'received') {
      return;
    }
    const selectedSigner = signers.find(signer => signer._id === signerId);
    if (!selectedSigner) {
      console.warn(`Không tìm thấy thông tin người ký (ID: ${signerId})`);
      form.setFieldsValue({ position: '', departments: [] });
      setDisplayPositionName('');
      return;
    }
    const signerDepartmentId = selectedSigner?.department?._id;
    const signerPositionId = selectedSigner?.position?._id || '';
    const signerPositionName = selectedSigner?.position?.positionName || '';
    form.setFieldsValue({
      position: signerPositionId,
      departments: signerDepartmentId ? [signerDepartmentId] : [],
    });
    setDisplayPositionName(signerPositionName);
  };

  const handleFileChange = ({ fileList: newFileList }) => {
    const updatedFileList = newFileList.map(file => {
      const existingFile = fileList.find(f => f.uid === file.uid);
      if (existingFile && existingFile.isExisting) {
        return { ...file, isExisting: true, fileId: existingFile.fileId };
      }
      return file;
    });
    setFileList(updatedFileList);
  };

  const handleCancelPreview = () => {
    if (previewFile && previewFile.isObjectUrl && previewFile.url) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewFile(null);
  };

  const handleUpdate = async (values) => {
    setLoading(true);
    try {
      const formData = new FormData();

      let finalSignerId = values.signer;
      let finalPositionId = values.position;
      let finalDepartments = values.departments;

      if (values.docType === 'received') {
        // Văn bản đến: không gửi signer/position; BE sẽ tự gán theo cấu hình
        finalSignerId = undefined;
        finalPositionId = '';
        finalDepartments = [];
      } else {
        const selectedSignerDetails = signers.find(s => s._id === finalSignerId);
        if (!selectedSignerDetails) throw new Error(`Không tìm thấy thông tin người ký (ID: ${finalSignerId})`);
        finalPositionId = selectedSignerDetails?.position?._id || '';
        finalDepartments = selectedSignerDetails?.department?._id ? [selectedSignerDetails.department._id] : values.departments;
      }

      // Chỉ validate khi văn bản đi
      if (values.docType !== 'received') {
        if (!finalDepartments.length) {
          throw new Error("Phải chọn ít nhất một đơn vị (departments).");
        }
        if (!finalSignerId) {
          throw new Error("ID người ký không hợp lệ hoặc không được cung cấp.");
        }
      }

      formData.append('docType', values.docType);
      formData.append('docVariant', values.docVariant);
      formData.append('year', values.year);
      // Luôn append deadlineDay, nếu null/undefined thì append empty string để backend biết cần xóa
      if (values.deadlineDay && typeof values.deadlineDay.format === 'function') {
        formData.append('deadlineDay', values.deadlineDay.format("YYYY-MM-DD"));
      } else {
        // Nếu đã clear (null/undefined), gửi empty string để backend xóa
        formData.append('deadlineDay', '');
      }
      formData.append('docNum', values.docNum);
      formData.append('docCode', values.docCode);
      if (values.docType !== 'received') {
        formData.append('signer', finalSignerId);
        if (finalPositionId) formData.append('position', finalPositionId);
      }
      formData.append("departments", JSON.stringify(finalDepartments));
      formData.append('principalIdea', values.principalIdea || '');
      formData.append('numOfPages', values.numOfPages || 0);
      formData.append('shortDescription', values.shortDescription || '');
      if (values.note) formData.append('note', values.note);
      formData.append('urgency', values.urgency);
      if (values.createAt) formData.append('createAt', values.createAt.format("YYYY-MM-DD"));
      if (values.receivedAt) formData.append('receivedAt', values.receivedAt.format("YYYY-MM-DD"));

      if (values.docType === 'received' && values.unit) {
        formData.append('unit', values.unit);
      } else if (values.docType === 'received' && !values.unit) {
        throw new Error("Cơ quan ban hành là bắt buộc đối với văn bản đến.");
      }

      const executors = (values.executors || []).map(executorValue => {
        const [type, id] = executorValue.split('|');
        if (!type || !id) return null;
        return { executorId: id, executorType: type };
      }).filter(Boolean);
      formData.append('executors', JSON.stringify(executors));

      const assignedToUsers = (values.assignedToUsers || []).map(userId => ({
        userId,
        status: "received",
      }));
      formData.append('assignedToUsers', JSON.stringify(assignedToUsers));

      const existingFiles = fileList
        .filter(file => file.isExisting)
        .map(file => ({
          fileId: file.fileId,
          fileName: file.name,
          mimeType: file.type || '',
          size: file.size || '',
        }));

      const newFiles = fileList
        .filter(file => !file.isExisting && file.originFileObj)
        .map(file => file.originFileObj);

      formData.append('existingFiles', JSON.stringify(existingFiles));

      newFiles.forEach(file => {
        formData.append("files", file, formatFileName(file.name || "upload"));
      });

      // BE không cần allFiles tổng hợp

      await updateDocument(documentId, formData);
      message.success('Cập nhật tài liệu thành công!');
      navigate("/documents/SentDocumentList");
    } catch (error) {
      console.error('Lỗi khi cập nhật:', error);
      message.error(error.response?.data?.message || error.message || "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  const urgencyTag = (urgency) => {
    switch (urgency) {
      case 'normal': return <Tag color="blue">Bình thường</Tag>;
      case 'high': return <Tag color="orange">Khẩn</Tag>;
      case 'immediately': return <Tag color="red">Hỏa tốc</Tag>;
      default: return null;
    }
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
      <Spin spinning={loadingData} tip="Đang tải dữ liệu văn bản..." size="large">
        <Card
          title={
            <Space className="flex-wrap">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">Cập nhật văn bản</h1>
              <Tooltip title="Sửa thông tin văn bản. Ctrl+S để lưu nhanh.">
                <InfoCircleOutlined className="text-gray-500" />
              </Tooltip>
            </Space>
          }
          bordered={false}
          className={`shadow-md rounded-lg overflow-hidden transition-all ${loadingData ? 'blur-sm' : ''}`}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleUpdate}
            disabled={loadingData || loading}
            onKeyDown={(e) => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); form.submit(); } }}
          >
            <Collapse defaultActiveKey={['1', '2', '3']} expandIconPosition="right" ghost className="mb-6">
              <Panel header={<span className="font-semibold text-base md:text-lg">Thông tin cơ bản</span>} key="1" className="bg-white rounded-md mb-4 shadow-sm">
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item name="docType" label="Kiểu văn bản" rules={[{ required: true, message: "Chọn kiểu văn bản!" }]}>
                      <Select placeholder="Chọn kiểu văn bản">
                        <Option value="sent">Văn bản đi</Option>
                        <Option value="received">Văn bản đến</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item name="docVariant" label="Loại văn bản" rules={[{ required: true, message: "Chọn loại văn bản!" }]}>
                      <Select placeholder="Chọn loại văn bản" showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
                        {docVariants.map(variant => (
                          <Option key={variant._id} value={variant._id}>{variant.docVariantName}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item name="year" label="Năm" rules={[{ required: true, message: "Nhập năm!" }]}>
                      <InputNumber min={1900} max={dayjs().year() + 1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item name="createAt" label="Ngày văn bản" rules={[{ required: true, message: "Chọn ngày văn bản!" }]}>
                      <DatePicker style={{ width: '100%' }} placeholder="Chọn ngày" format="DD/MM/YYYY" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item 
                      name="deadlineDay" 
                      label="Hạn xử lý"
                      getValueFromEvent={(date) => {
                        // Khi clear, date sẽ là null, giữ nguyên null để form biết đã clear
                        return date || null;
                      }}
                    >
                      <DatePicker
                        style={{ width: "100%" }}
                        placeholder="Chọn ngày (nếu có)"
                        format="DD/MM/YYYY"
                        allowClear
                        onChange={(date) => {
                          // Force update form khi clear
                          if (!date) {
                            form.setFieldValue("deadlineDay", null);
                            // Force re-validate để đảm bảo form state được cập nhật
                            setTimeout(() => {
                              const currentValue = form.getFieldValue("deadlineDay");
                              if (currentValue !== null && currentValue !== undefined) {
                                // Nếu vẫn còn giá trị, force set lại
                                form.setFieldValue("deadlineDay", null);
                              }
                            }, 100);
                          }
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item label="Số/Ký hiệu văn bản" required>
                      <Space.Compact style={{ width: '100%' }}>
                        <Form.Item name="docNum" noStyle rules={[{ required: true, message: "Nhập số văn bản!" }]}>
                          <InputNumber disabled min={1} placeholder="Số" style={{ width: '40%' }} />
                        </Form.Item>
                        <Input placeholder="/" disabled style={{ width: '10%', textAlign: 'center', background: '#fff', borderColor: '#d9d9d9' }} />
                        <Form.Item name="docCode" noStyle rules={[{ required: true, message: "Nhập ký hiệu!" }]}>
                          <Input placeholder="Ký hiệu" style={{ width: '50%' }} />
                        </Form.Item>
                      </Space.Compact>
                    </Form.Item>
                  </Col>
                  {docTypeWatch === 'received' && (
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item name="receivedAt" label="Ngày nhận văn bản đến" rules={[{ required: true, message: "Chọn ngày nhận văn bản đến!" }]}>
                        <DatePicker style={{ width: "100%" }} placeholder="Chọn ngày" format="DD/MM/YYYY" />
                      </Form.Item>
                    </Col>
                  )}
                  {docTypeWatch === 'received' && (
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item name="docNumReceived" label="Số văn bản đến">
                        <InputNumber
                          min={1}
                          placeholder={nextDocNumReceived ? `${nextDocNumReceived}` : "Số văn bản đến"}
                          style={{ width: "100%" }}
                          disabled
                        />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
                <Row gutter={[16, 16]} className="mt-4">
                  <Col xs={24}>
                    {docTypeWatch === 'received' ? (
                      <Form.Item
                        name="unit"
                        label="Tên Cơ quan ban hành"
                        rules={[{ required: true, message: 'Vui lòng chọn cơ quan ban hành!' }]}
                      >
                        <Select
                          placeholder="Chọn cơ quan ban hành"
                          allowClear
                          showSearch
                          filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
                        >
                          {units.map(unit => (
                            <Option key={unit._id} value={unit._id}>{unit.unitName}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    ) : (
                      <Form.Item label="Tên Cơ quan ban hành">
                        <Input disabled value="Trường" className="bg-gray-100" />
                      </Form.Item>
                    )}
                  </Col>
                </Row>
              </Panel>

              <Panel header={<span className="font-semibold text-base md:text-lg">Người ký & Người nhận</span>} key="2" className="bg-white rounded-md mb-4 shadow-sm">
                <Row gutter={[16, 16]}>
                  {docTypeWatch !== 'received' && (
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item name="signer" label="Người ký" rules={[{ required: true, message: "Chọn người ký!" }]}>
                        <Select
                          placeholder="Chọn người ký"
                          onChange={handleSignerChange}
                          showSearch
                          optionFilterProp="label"
                        >
                          {signers.map(signer => {
                            const labelStr = `${signer.name} ${signer.department?.departmentName ? `(${signer.department.departmentName})` : ""}`.trim();
                            return (
                              <Option key={signer._id} value={signer._id} label={labelStr}>
                                {labelStr}
                              </Option>
                            );
                          })}
                        </Select>
                      </Form.Item>
                    </Col>
                  )}
                  {docTypeWatch !== 'received' && (
                    <>
                      <Col xs={24} sm={12} md={8}>
                        <label className="ant-form-item-label"><label title="Chức vụ">Chức vụ</label></label>
                        <Input
                          disabled
                          placeholder="Tự động"
                          className="bg-gray-100"
                          value={displayPositionName}
                        />
                        <Form.Item name="position" hidden><Input /></Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="departments" label="Đơn vị">
                          <Select
                            mode="multiple"
                            placeholder="Tự động điền theo người ký"
                            disabled
                            allowClear
                            optionFilterProp="label"
                          >
                            {departments.map(dept => (
                              <Option key={dept._id} value={dept._id} label={dept.departmentName}>{dept.departmentName}</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </>
                  )}
                  <Col xs={24} md={12}>
                    <Form.Item name="executors" label="Đơn vị / Người nhận">
                      <Select
                        mode="multiple"
                        placeholder="Chọn đơn vị/cá nhân"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                      >
                        <Select.OptGroup label="Người dùng">
                          {users.map(user => {
                            const labelStr = `${user.name || ''} ${user.department?.departmentName ? `(${user.department.departmentName})` : ""}`.trim();
                            return (
                              <Option key={`User|${user._id}`} value={`User|${user._id}`} label={labelStr}>
                                {labelStr}
                              </Option>
                            );
                          })}
                        </Select.OptGroup>
                        <Select.OptGroup label="Đơn vị">
                          {departments.map(dept => {
                            const labelStr = String(dept.departmentName || '');
                            return (
                              <Option key={`Department|${dept._id}`} value={`Department|${dept._id}`} label={labelStr}>
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
                        placeholder="Chọn người nhận"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                      >
                        {users.map(user => {
                          const labelStr = `${user.name || ''} ${user.department?.departmentName ? `(${user.department.departmentName})` : ""}`.trim();
                          return (
                            <Option key={user._id} value={user._id} label={labelStr}>
                              {labelStr}
                            </Option>
                          );
                        })}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              <Panel header={<span className="font-semibold text-base md:text-lg">Nội dung & Tệp</span>} key="3" className="bg-white rounded-md shadow-sm">
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Form.Item name="shortDescription" label="Trích yếu" rules={[{ required: true, message: "Vui lòng nhập trích yếu!" }]}>
                      <Input.TextArea rows={3} placeholder="Tóm tắt nội dung chính" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="principalIdea" label="Bút phê/Ý kiến">
                      <Input.TextArea rows={2} placeholder="Ý kiến của lãnh đạo (nếu có)" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Form.Item name="numOfPages" label="Số trang văn bản" rules={[{ type: 'number', min: 0, message: 'Số trang không hợp lệ' }]}>
                      <InputNumber min={0} style={{ width: '100%' }} placeholder="Số trang" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Form.Item name="urgency" label="Độ khẩn" rules={[{ required: true, message: "Chọn độ khẩn!" }]}>
                      <Select placeholder="Chọn độ khẩn" onChange={(value) => form.setFieldsValue({ urgency: value })}>
                        <Option value="normal">{urgencyTag('normal')}</Option>
                        <Option value="high">{urgencyTag('high')}</Option>
                        <Option value="immediately">{urgencyTag('immediately')}</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="note" label="Ghi chú thêm">
                      <Input.TextArea rows={3} placeholder="Thông tin bổ sung (nếu có)" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="files"
                     label="File đính kèm"
                      tooltip="Tải lên tệp liên quan (nếu có)">
                      <Upload.Dragger
                        multiple
                        fileList={fileList}
                        onChange={handleFileChange}
                        beforeUpload={() => false}
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
                          Nhấp hoặc kéo thả tệp vào đây (hỗ trợ nhiều tệp)
                        </p>
                      </Upload.Dragger>
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>
            </Collapse>

            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                onClick={() => navigate(-1)}
                size="large"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Hủy
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                icon={<SaveOutlined />}
                className="w-full sm:w-auto min-w-[150px]"
              >
                Cập nhật văn bản
              </Button>
            </div>
          </Form>
        </Card>
      </Spin>

      <Modal
        open={!!previewFile}
        title={previewFile?.name || "Xem trước tệp"}
        footer={null}
        onCancel={handleCancelPreview}
        width={previewFile?.isImage ? 'fit-content' : '90%'}
        style={{ top: 20 }}
        destroyOnClose
        centered={previewFile?.isImage}
        bodyStyle={{ padding: previewFile?.isImage ? 0 : '16px 0 0 0', height: previewFile?.isImage ? 'auto' : 'calc(100vh - 120px)' }}
      >
        {previewFile && (
          previewFile.isImage ? (
            <img
              src={previewFile.url}
              alt={previewFile.name}
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', display: 'block', margin: 'auto' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z'/%3E%3C/svg%3E";
                message.error("Không thể tải ảnh xem trước.");
              }}
            />
          ) : (
            <iframe
              src={previewFile.url}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={previewFile.name}
              onError={() => message.error("Không thể tải bản xem trước cho tệp này.")}
            />
          )
        )}
      </Modal>
    </div>
  );
};

export default UpdateDocumentPage;