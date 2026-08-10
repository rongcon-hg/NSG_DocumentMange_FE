import { formatFileName } from "../../utils/formatFileName";
import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, DatePicker, Upload, message, Row, Col, Card, Space, Collapse } from 'antd';
import { UploadOutlined, SaveOutlined, InboxOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAllUsersCanSearchBanUser } from '../../api/auth';
import { getAllDocVariants } from '../../api/docVariantApi';
import { getDocumentById } from '../../api/documentApi';
import { getAllDepartments } from '../../api/DepartmentAPI';
import { createRepliedDoc } from '../../api/repliedDocApi';
import { getDocumentsByUserAndType } from '../../api/documentApi';
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from 'dayjs';

const { Option } = Select;
const { Panel } = Collapse;
import { getDriveToken, uploadFileDirectlyToDrive } from "../../api/driveApi";

const ReplyDocForm = () => {
  const [form] = Form.useForm();
  const [userId, setUserId] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [departments, setDepartments] = useState([]);
  const [docVariants, setDocVariants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [isRecipientRequired, setIsRecipientRequired] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [isRepliedDocDisabled, setIsRepliedDocDisabled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Lấy userId từ token
  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUserId(decodedToken.userId || decodedToken.id);
      // eslint-disable-next-line no-unused-vars
      } catch (err) {
        message.error('Token không hợp lệ. Vui lòng đăng nhập lại.',);
        navigate('/login');
      }
    } else {
      message.error('Không tìm thấy token. Vui lòng đăng nhập lại.');
      navigate('/login');
    }
  }, [navigate]);

  // Fetch dữ liệu và xử lý documentId từ location state
  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersRes, departmentsRes, docVariantsRes, documentsRes] = await Promise.all([
          getAllUsersCanSearchBanUser(),
          getAllDepartments(),
          getAllDocVariants(),
          getDocumentsByUserAndType(userId, 'received', 1, 100),
        ]);

        const fetchedUsers = usersRes?.users || [];
        const managers = fetchedUsers.filter(user => user.role === 'manager' || user.role === 'admin');
        setUsers(managers);
        setDocVariants(docVariantsRes || []);
        setDepartments(departmentsRes?.AllDepartment || []);
        setDocuments(documentsRes?.data || []);

        const documentIdFromState = location.state?.documentId;

        if (documentIdFromState) {
          const docResponse = await getDocumentById(documentIdFromState);
          if (docResponse && docResponse.success && docResponse.data) {
            const selectedDoc = docResponse.data;
            const originalSender = managers.find(u => u._id === selectedDoc.sentBy?._id);

            form.setFieldsValue({
              repliedDoc: selectedDoc._id,
              docVariant: selectedDoc.docVariant?._id,
              replyAt: dayjs(),
              intendedRecipient: originalSender ? [`User|${originalSender._id}`] : [],
            });

            setIsRepliedDocDisabled(true);
            setIsRecipientRequired(false);
          } else {
            message.error('Không thể tải thông tin văn bản gốc để trả lời.');
            form.setFieldsValue({ replyAt: dayjs(), intendedRecipient: [] });
            setIsRecipientRequired(true);
            setIsRepliedDocDisabled(false);
          }
        } else {
          form.setFieldsValue({ replyAt: dayjs(), intendedRecipient: [] });
          setIsRecipientRequired(true);
          setIsRepliedDocDisabled(false);
        }

        form.validateFields(['intendedRecipient'], { force: true });
      } catch (error) {
        message.error(`Không thể tải dữ liệu cần thiết: ${error.message || 'Lỗi không xác định'}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, form, location.state, navigate]);

  // Xử lý thay đổi file upload
  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  // Xử lý submit form
  const handleSubmit = async (values) => {
    if (!userId) {
      message.error('Người dùng chưa xác thực. Vui lòng đăng nhập.');
      return;
    }

    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('replyBy', userId);
      formDataToSend.append('status', 'pending');
      formDataToSend.append('docVariant', values.docVariant);
      formDataToSend.append('shortDescription', values.shortDescription);
      formDataToSend.append('replyAt', values.replyAt.toISOString());

      if (values.repliedDoc) {
        formDataToSend.append('repliedDoc', values.repliedDoc);
      }

      // Tự động thêm người dùng hiện tại làm representFor
      const representForData = [{ representForId: userId, representForType: 'User' }];
      formDataToSend.append('representFor', JSON.stringify(representForData));

      const recipientIds = values.intendedRecipient ? values.intendedRecipient.map(item => item.split('|')[1]) : [];
      formDataToSend.append('intendedRecipient', JSON.stringify(recipientIds));

      const newlyUploadedFiles = [];
      const newFilesToUpload = [];
      
      fileList.forEach(file => {
        if (file.originFileObj) {
          newFilesToUpload.push(file.originFileObj);
        }
      });

      if (newFilesToUpload.length > 0) {
        message.loading({ content: 'Đang tải tệp lên Google Drive...', key: 'uploading' });
        try {
          const tokenData = await getDriveToken();
          const accessToken = tokenData.accessToken;
          const folderId = tokenData.folderId;
          
          for (const fileObj of newFilesToUpload) {
            const uploadedFile = await uploadFileDirectlyToDrive(fileObj, accessToken, folderId);
            newlyUploadedFiles.push(uploadedFile);
          }
          message.success({ content: 'Tải tệp lên Google Drive thành công!', key: 'uploading', duration: 2 });
        } catch (error) {
          message.error({ content: `Lỗi tải tệp: ${error.message}`, key: 'uploading', duration: 4 });
          setLoading(false);
          return;
        }
      }

      if (newlyUploadedFiles.length > 0) {
        formDataToSend.append('uploadedFiles', JSON.stringify(newlyUploadedFiles));
      }

      const response = await createRepliedDoc(formDataToSend);
      message.success(response.message || 'Tạo văn bản trình ký thành công!', 3);
      form.resetFields();
      setFileList([]);
      setIsRecipientRequired(true);
      setIsRepliedDocDisabled(false);
      navigate('/getAllRepliedDoc');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Đã xảy ra lỗi khi gửi văn bản trình ký';
      message.error(errorMsg, 5);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý thay đổi repliedDoc
  const handleRepliedDocChange = (value) => {
    const selectedDoc = documents.find(doc => doc._id === value);
    setIsRecipientRequired(!value);

    if (selectedDoc) {
      const originalSender = users.find(u => u._id === selectedDoc.sentBy?._id);
      form.setFieldsValue({
        docVariant: selectedDoc.docVariant?._id,
        intendedRecipient: originalSender ? [`User|${originalSender._id}`] : [],
      });
    } else {
      form.setFieldsValue({
        docVariant: undefined,
        intendedRecipient: [],
      });
    }

    form.validateFields(['intendedRecipient'], { force: true });
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-50 via-white to-gray-100 min-h-screen transition-all duration-500">
      <Card
        title={
          <Space className="w-full justify-between">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight mb-0">
              Tạo Văn Bản Trình Ký
            </h1>
          </Space>
        }
        bordered={false}
        className="shadow-lg rounded-lg overflow-hidden"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ replyAt: dayjs() }}
          className="form-custom"
        >
          <Collapse defaultActiveKey={['1']} expandIconPosition="right" ghost className="custom-collapse -m-2">
            <Panel header={<span className="font-semibold text-base md:text-lg text-gray-800">Thông tin văn bản trình ký</span>} key="1" className="p-2">
              <Row gutter={[24, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="docVariant"
                    label="Loại văn bản"
                    rules={[{ required: true, message: 'Vui lòng chọn loại văn bản!' }]}
                  >
                    <Select placeholder="Chọn loại văn bản" loading={loading} className="input-shadow">
                      {docVariants.map(variant => (
                        <Option key={variant._id} value={variant._id}>{variant.docVariantName}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="repliedDoc"
                    label="Số ký hiệu"
                    tooltip="Văn bản đến mà bạn đang trả lời"
                  >
                    <Select
                      placeholder="số ký hiệu"
                      onChange={handleRepliedDocChange}
                      className="input-shadow"
                      allowClear
                      showSearch
                      loading={loading}
                      disabled
                      filterOption={(input, option) =>
                        option.children.toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {documents.map(doc => (
                        <Option key={doc._id} value={doc._id}>
                          {`${doc.docNum ? doc.docNum + '/' : ''}${doc.docCode || ''}${doc.docNum || doc.docCode ? '' : ` (ID: ${doc._id.substring(0, 5)}...)`}`}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="replyAt"
                    label="Thời gian trình ký"
                    rules={[{ required: true, message: 'Vui lòng kiểm tra thời gian trình ký!' }]}
                  >
                    <DatePicker
                      disabled
                      format="YYYY-MM-DD HH:mm"
                      showTime={{ format: 'HH:mm' }}
                      style={{ width: '100%' }}
                      className="input-shadow"
                      placeholder="Chọn ngày giờ trình ký"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="intendedRecipient"
                    label="Đơn vị / Người nhận"
                    rules={[{ required: isRecipientRequired, message: 'Vui lòng chọn người nhận!' }]}
                    tooltip={isRecipientRequired
                      ? "Bắt buộc chọn người nhận vì không trả lời cho Số ký hiệu cụ thể."
                      : "Đã chọn văn bản trả lời, mặc định gửi cho người tạo văn bản gốc."
                    }
                  >
                    <Select
                      mode="multiple"
                      showSearch
                      placeholder={isRecipientRequired ? "Tìm và chọn người nhận (bắt buộc)" : "Tìm và chọn người nhận bổ sung"}
                      filterOption={(input, option) => option?.children?.toLowerCase().includes(input.toLowerCase())}
                      className="input-shadow"
                      loading={loading}
                      allowClear
                    >
                      {users.map(user => (
                        <Option key={`User|${user._id}`} value={`User|${user._id}`}>{user.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="shortDescription"
                    label="Trích yếu"
                    rules={[{ required: true, message: 'Vui lòng nhập trích yếu!' }]}
                    tooltip="Tóm tắt ngắn gọn nội dung văn bản trình ký"
                  >
                    <Input.TextArea rows={3} placeholder="Nhập nội dung tóm tắt..." className="input-shadow resize-y" />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item name="files" label="Tệp đính kèm" tooltip="Tải lên các tệp liên quan (nếu có)">
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
                        Nhấn để chọn hoặc kéo thả tệp vào đây
                      </p>
                    </Upload.Dragger>
                  </Form.Item>
                </Col>
              </Row>
            </Panel>
          </Collapse>

          <div className="mt-6 text-right space-x-2">
            <Button
              onClick={() => {
                form.resetFields();
                setFileList([]);
                setIsRecipientRequired(true);
                setIsRepliedDocDisabled(false);
                navigate('/getAllRepliedDoc');
              }}
              size="large"
              disabled={loading}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              icon={<SaveOutlined />}
              className="btn-submit"
            >
              {loading ? 'Đang xử lý...' : 'Lưu và Trình ký'}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ReplyDocForm;