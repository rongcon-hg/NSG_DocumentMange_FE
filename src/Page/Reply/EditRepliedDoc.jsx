import { formatFileName } from "../../utils/formatFileName";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, Button, DatePicker, Upload, message, Row, Col, Card, Space, Collapse } from 'antd';
import { UploadOutlined, SaveOutlined, InboxOutlined } from '@ant-design/icons';
import { getAllUsersCanSearchBanUser, getUserInfo } from '../../api/auth';
import { isBghUser } from '../../utils/userClassification';
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
  const [recipientGroups, setRecipientGroups] = useState({ bgh: [], capTruong: [], manager: [] });
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

        const [usersRes, departmentsRes, docVariantsRes, originalDocResponse, currentUserRes] = await Promise.all([
          getAllUsersCanSearchBanUser(),
          getAllDepartments(),
          getAllDocVariants(),
          originalDocId ? getDocumentById(originalDocId) : Promise.resolve(null),
          getUserInfo(userId),
        ]);

        const currentUser = currentUserRes?.data || currentUserRes?.user || null;
        const fetchedUsers = (usersRes?.users || []).filter(
          (u) => u && u.role !== null && u.email?.toLowerCase() !== "qlvb@nsgpc.edu.vn"
        );

        // Helper nhận diện vai trò
        const isBgh = (u) => isBghUser(u) || (u?.department?.departmentCode || "").toUpperCase() === "BGH";
        const isCapTruong = (u) => {
          if (!u || isBgh(u)) return false;
          const role = u.role || "";
          const posName = (u.position?.positionName || "").toLowerCase();
          return (
            role === "staff" ||
            role === "captruong" ||
            posName.includes("trưởng khoa") ||
            posName.includes("trưởng phòng") ||
            posName.includes("trưởng ban") ||
            posName.includes("trưởng bộ môn") ||
            posName.includes("trưởng đơn vị") ||
            posName.startsWith("trưởng ")
          );
        };

        const isCapPho = (u) => {
          if (!u || isBgh(u) || isCapTruong(u)) return false;
          const role = u.role || "";
          const posName = (u.position?.positionName || "").toLowerCase();
          return (
            role === "cappho" ||
            posName.includes("phó trưởng") ||
            posName.includes("phó khoa") ||
            posName.includes("phó phòng") ||
            posName.includes("phó ban") ||
            posName.includes("phó giám đốc") ||
            posName.includes("phó đơn vị") ||
            posName.startsWith("phó ")
          );
        };

        // Xác định đơn vị của người dùng hiện tại
        const userDeptId = currentUser?.department?._id || currentUser?.department;
        const userDeptName = (
          currentUser?.department?.departmentName ||
          currentUser?.departmentName ||
          ""
        ).toLowerCase().trim();

        const isSameDept = (u) => {
          if (!u) return false;
          const uDeptId = u?.department?._id || u?.department;
          if (userDeptId && uDeptId && String(uDeptId) === String(userDeptId)) return true;
          const uDeptName = (
            u?.department?.departmentName ||
            u?.departmentName ||
            ""
          ).toLowerCase().trim();
          if (userDeptName && uDeptName && userDeptName === uDeptName) return true;
          return false;
        };

        // Xác định vai trò của người dùng hiện tại
        const curIsBgh = isBgh(currentUser);
        const curIsManager = currentUser?.role === "manager" || currentUser?.role === "admin";
        const curIsCapTruong = !curIsBgh && !curIsManager && isCapTruong(currentUser);
        const curIsCapPho = !curIsBgh && !curIsManager && !curIsCapTruong && isCapPho(currentUser);
        const curIsChuyenVien = !curIsBgh && !curIsManager && !curIsCapTruong && !curIsCapPho;

        // Phân loại danh sách người dùng khả dụng (loại trừ chính người dùng hiện tại)
        const bghList = fetchedUsers.filter((u) => isBgh(u) && String(u._id) !== String(userId));
        const capTruongList = fetchedUsers.filter((u) => isCapTruong(u) && String(u._id) !== String(userId));
        const capPhoList = fetchedUsers.filter((u) => isCapPho(u) && String(u._id) !== String(userId));
        const managerList = fetchedUsers.filter(
          (u) => (u.role === "manager" || u.role === "admin") && String(u._id) !== String(userId)
        );

        let availableRecipients = [];
        let grouped = {
          bgh: bghList,
          capTruong: [],
          capPho: [],
          manager: managerList,
          isChuyenVien: curIsChuyenVien,
          isCapPho: curIsCapPho,
        };

        if (curIsChuyenVien) {
          // Chuyên viên: CHỈ THẤY DANH SÁCH CẤP TRƯỞNG VÀ CẤP PHÓ CỦA ĐƠN VỊ MÌNH (+ BGH + Manager)
          const myCapTruong = capTruongList.filter(isSameDept);
          const myCapPho = capPhoList.filter(isSameDept);
          grouped.capTruong = myCapTruong;
          grouped.capPho = myCapPho;
          availableRecipients = [...bghList, ...myCapTruong, ...myCapPho, ...managerList];
        } else if (curIsCapPho) {
          // Cấp phó: chỉ thấy cấp trưởng của đơn vị mình (+ BGH + Manager)
          const myCapTruong = capTruongList.filter(isSameDept);
          grouped.capTruong = myCapTruong;
          grouped.capPho = [];
          availableRecipients = [...bghList, ...myCapTruong, ...managerList];
        } else if (curIsCapTruong) {
          // Cấp trưởng: chỉ thấy Ban Giám hiệu (+ Manager)
          grouped.capTruong = [];
          grouped.capPho = [];
          availableRecipients = [...bghList, ...managerList];
        } else {
          // Manager / Admin / BGH: Xem đầy đủ
          grouped.capTruong = capTruongList;
          grouped.capPho = capPhoList;
          availableRecipients = [...bghList, ...capTruongList, ...capPhoList, ...managerList];
        }

        // Loại bỏ trùng lặp nếu có
        const uniqueRecipients = [];
        const seenIds = new Set();
        availableRecipients.forEach((u) => {
          const id = String(u._id);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueRecipients.push(u);
          }
        });

        setUsers(uniqueRecipients);
        setRecipientGroups(grouped);
        const deptsList = (departmentsRes?.AllDepartment || []).filter(
          (d) => d && !d.departmentName?.toLowerCase().includes("giải thể")
        );
        setDepartments(deptsList);
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

        const originalSender = originalDocData
          ? (uniqueRecipients.find(u => u._id === originalDocData.sentBy?._id) || fetchedUsers.find(u => u._id === originalDocData.sentBy?._id))
          : null;
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
                    <Select 
                      placeholder="Chọn loại văn bản" 
                      loading={loading} 
                      className="input-shadow"
                      showSearch
                      allowClear
                      optionFilterProp="children"
                      filterOption={(input, option) => {
                        const label = option?.children ?? "";
                        const normInput = (input || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        const normLabel = (label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        return normLabel.includes(normInput);
                      }}
                    >
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
                      optionLabelProp="label"
                      placeholder={isRecipientRequired ? "Tìm và chọn người nhận (bắt buộc)" : "Tìm và chọn người nhận bổ sung"}
                      filterOption={(input, option) => {
                        const searchStr = `${option?.label || ''} ${option?.title || ''}`.toLowerCase();
                        const normInput = (input || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        const normSearch = searchStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        return normSearch.includes(normInput);
                      }}
                      className="input-shadow"
                      loading={loading}
                      allowClear
                    >
                      {recipientGroups.bgh?.length > 0 && (
                        <Select.OptGroup label={`🏛️ Ban Giám hiệu (${recipientGroups.bgh.length})`}>
                          {recipientGroups.bgh.map(u => (
                            <Option
                              key={`User|${u._id}`}
                              value={`User|${u._id}`}
                              label={u.name}
                              title={`${u.name} ${u.position?.positionName || ''} ${u.department?.departmentName || ''}`}
                            >
                              <div className="flex items-center justify-between py-0.5">
                                <span className="font-semibold text-slate-800">{u.name}</span>
                                <span className="text-xs text-blue-600 font-medium">
                                  {u.position?.positionName || "Ban Giám hiệu"}
                                </span>
                              </div>
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}

                      {recipientGroups.capTruong?.length > 0 && (
                        <Select.OptGroup
                          label={`👔 Cấp trưởng ${
                            recipientGroups.isChuyenVien || recipientGroups.isCapPho
                              ? "đơn vị của bạn"
                              : "Đơn vị / Khoa / Phòng"
                          } (${recipientGroups.capTruong.length})`}
                        >
                          {recipientGroups.capTruong.map(u => (
                            <Option
                              key={`User|${u._id}`}
                              value={`User|${u._id}`}
                              label={u.name}
                              title={`${u.name} ${u.position?.positionName || ''} ${u.department?.departmentName || ''}`}
                            >
                              <div className="flex items-center justify-between py-0.5">
                                <span className="font-semibold text-slate-800">{u.name}</span>
                                <span className="text-xs text-slate-500">
                                  {u.position?.positionName || "Trưởng đơn vị"} ({u.department?.departmentName || "NSG"})
                                </span>
                              </div>
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}

                      {recipientGroups.capPho?.length > 0 && (
                        <Select.OptGroup
                          label={`💼 Cấp phó ${
                            recipientGroups.isChuyenVien
                              ? "đơn vị của bạn"
                              : "Đơn vị / Khoa / Phòng"
                          } (${recipientGroups.capPho.length})`}
                        >
                          {recipientGroups.capPho.map(u => (
                            <Option
                              key={`User|${u._id}`}
                              value={`User|${u._id}`}
                              label={u.name}
                              title={`${u.name} ${u.position?.positionName || ''} ${u.department?.departmentName || ''}`}
                            >
                              <div className="flex items-center justify-between py-0.5">
                                <span className="font-semibold text-slate-800">{u.name}</span>
                                <span className="text-xs text-slate-500">
                                  {u.position?.positionName || "Phó đơn vị"} ({u.department?.departmentName || "NSG"})
                                </span>
                              </div>
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}

                      {recipientGroups.manager?.length > 0 && (
                        <Select.OptGroup label={`⚙️ Quản lý hệ thống / Manager (${recipientGroups.manager.length})`}>
                          {recipientGroups.manager.map(u => (
                            <Option
                              key={`User|${u._id}`}
                              value={`User|${u._id}`}
                              label={u.name}
                              title={`${u.name} ${u.position?.positionName || ''} ${u.department?.departmentName || ''}`}
                            >
                              <div className="flex items-center justify-between py-0.5">
                                <span className="font-semibold text-slate-800">{u.name}</span>
                                <span className="text-xs text-purple-600 font-medium">
                                  {u.position?.positionName || "Manager / Quản trị"}
                                </span>
                              </div>
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}
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