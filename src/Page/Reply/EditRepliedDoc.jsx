import { formatFileName } from "../../utils/formatFileName";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, Button, DatePicker, Upload, message, Row, Col, Card, Space, Collapse } from 'antd';
import { UploadOutlined, SaveOutlined, InboxOutlined } from '@ant-design/icons';
import { getAllUsersCanSearchBanUser } from '../../api/auth';
import { getAllDepartments } from '../../api/DepartmentAPI';
import { getAllDocVariants } from '../../api/docVariantApi';
import { getDocumentById } from '../../api/documentApi';
import { getRepliedDocById, updateRepliedDoc } from '../../api/repliedDocApi';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';

const { Option } = Select;
const { Panel } = Collapse;
import { getDriveToken, uploadFileDirectlyToDrive } from "../../api/driveApi";

const EditRepliedDoc = () => {
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [docVariants, setDocVariants] = useState([]);
  const [users, setUsers] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [departments, setDepartments] = useState([]);
  const [isRecipientRequired, setIsRecipientRequired] = useState(false);
  const [originalDocDisplay, setOriginalDocDisplay] = useState({ id: null, text: 'Đang tải...' });

  // Lấy userId từ token
  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUserId(decodedToken.userId || decodedToken.id);
      } catch (err) {
        console.error('Invalid token:', err);
        message.error('Token không hợp lệ. Vui lòng đăng nhập lại.');
        navigate('/login');
      }
    } else {
      message.error('Không tìm thấy token. Vui lòng đăng nhập lại.');
      navigate('/login');
    }
  }, [navigate]);

  // Fetch dữ liệu ban đầu và chi tiết repliedDoc
  useEffect(() => {
    if (!userId || !id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const repliedDocRes = await getRepliedDocById(id);
        const repliedDocData = repliedDocRes.data || repliedDocRes;

        if (!repliedDocData) {
          throw new Error('Không tìm thấy văn bản trả lời.');
        }

        const originalDocId = repliedDocData.repliedDoc?._id || repliedDocData.repliedDoc;
        let originalDocData = null;

        const [usersRes, departmentsRes, docVariantsRes, originalDocResponse] = await Promise.all([
          getAllUsersCanSearchBanUser(),
          getAllDepartments(),
          getAllDocVariants(),
          originalDocId ? getDocumentById(originalDocId) : Promise.resolve(null),
        ]);

        const fetchedUsers = usersRes.users || [];
        const managers = fetchedUsers.filter(user => user.role === 'manager' || user.role === 'admin');
        setUsers(managers);
        setDepartments(departmentsRes?.AllDepartment || []);
        setDocVariants(docVariantsRes || []);

        if (originalDocResponse && originalDocResponse.success && originalDocResponse.data) {
          originalDocData = originalDocResponse.data;
          const code = originalDocData.docCode || '';
          const num = originalDocData.docNum || '';
          const displayText = num && code ? `${num}/${code}` : code || String(num) || `ID: ${originalDocData._id}`;
          setOriginalDocDisplay({ id: originalDocData._id, text: displayText });
        } else if (originalDocId) {
          setOriginalDocDisplay({ id: originalDocId, text: `ID: ${originalDocId} (Không tải được chi tiết)` });
        } else {
          setOriginalDocDisplay({ id: null, text: 'Không có văn bản gốc' });
        }

        const originalSender = originalDocData ? managers.find(u => u._id === originalDocData.sentBy?._id) : null;
        form.setFieldsValue({
          docVariant: repliedDocData.docVariant?._id || repliedDocData.docVariant,
          repliedDoc: originalDocId,
          shortDescription: repliedDocData.shortDescription || '',
          replyAt: repliedDocData.replyAt ? dayjs(repliedDocData.replyAt) : dayjs(),
          intendedRecipient: repliedDocData.intendedRecipient?.map(recipient => `User|${recipient._id || recipient}`) || 
                            (originalSender ? [`User|${originalSender._id}`] : []),
        });

        setIsRecipientRequired(!originalDocId);

        if (repliedDocData.files && repliedDocData.files.length > 0) {
          setFileList(repliedDocData.files.map(file => ({
            uid: file.fileId || file._id,
            name: file.fileName,
            status: 'done',
            url: `https://drive.google.com/file/d/${file.fileId}/view`,
            existingFile: true,
            fileId: file.fileId,
            _id: file._id,
          })));
        }

        form.validateFields(['intendedRecipient'], { force: true });
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
        message.error(`Không thể tải dữ liệu: ${error.message || 'Lỗi không xác định'}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, id, form, navigate]);

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

      const existingFileIds = [];
      const newFilesToUpload = [];

      fileList.forEach(file => {
        if (file.originFileObj) {
          newFilesToUpload.push(file.originFileObj);
        } else if (file.existingFile && file.status !== 'removed') {
          existingFileIds.push({
            fileId: file.fileId || file._id,
            fileName: file.name || file.fileName,
            mimeType: file.mimeType,
            size: file.size
          });
        }
      });
      formDataToSend.append('existingFiles', JSON.stringify(existingFileIds));

      const newlyUploadedFiles = [];
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

      const response = await updateRepliedDoc(id, formDataToSend);
      message.success(response.message || 'Cập nhật văn bản trả lời thành công!', 3);
      navigate('/getAllRepliedDoc');
    } catch (err) {
      console.error('Lỗi khi cập nhật repliedDoc:', err);
      message.error(err.response?.data?.message || err.message || 'Đã xảy ra lỗi khi cập nhật văn bản trả lời', 3);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-50 via-white to-gray-100 min-h-screen transition-all duration-500">
      <Card
        title={
          <Space className="w-full justify-between">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight mb-0">
              Cập nhật văn bản trình ký
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
                    tooltip="Văn bản gốc mà văn bản này trả lời (Không thể thay đổi)"
                  >
                    <Select
                      placeholder={originalDocDisplay.text}
                      className="input-shadow"
                      disabled
                      value={originalDocDisplay.id}
                      allowClear={false}
                    >
                      {originalDocDisplay.id && (
                        <Option key={originalDocDisplay.id} value={originalDocDisplay.id}>
                          {originalDocDisplay.text}
                        </Option>
                      )}
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
                      format="YYYY-MM-DD HH:mm"
                      showTime={{ format: 'HH:mm' }}
                      style={{ width: '100%' }}
                      className="input-shadow"
                      placeholder="Chọn ngày giờ trình ký"
                      disabled
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="intendedRecipient"
                    label="Đơn vị/Người nhận"
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
              onClick={() => navigate('/getAllRepliedDoc')}
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
              {loading ? 'Đang xử lý...' : 'Cập nhật và Trình ký'}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default EditRepliedDoc;