import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  message,
  Select,
  Row,
  Col,
  Card,
  Tag,
} from 'antd';
import {
  UserAddOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  BankOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { createUser } from '../../api/auth';
import { useNavigate } from 'react-router-dom';
import { getAllPositions } from '../../api/PositionAPI';
import { getAllDepartments } from '../../api/DepartmentAPI';

const CreateUserPage = () => {
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);

  const navigate = useNavigate();
  const [form] = Form.useForm();

  const roles = [
    { _id: 'manager', name: 'Quản lý hệ thống', color: 'purple' },
    { _id: 'staff', name: 'Cấp trưởng', color: 'blue' },
    { _id: 'cappho', name: 'Cấp phó', color: 'cyan' },
    { _id: 'chuyenvien', name: 'GV-VC', color: 'green' },
  ];

  useEffect(() => {
    const fetchPositionsAndDepartments = async () => {
      try {
        setFetchingData(true);
        const [positionsData, departmentsData] = await Promise.all([
          getAllPositions(),
          getAllDepartments(),
        ]);

        if (positionsData && Array.isArray(positionsData.AllPosition)) {
          setPositions(
            positionsData.AllPosition.map((position) => ({
              _id: position._id,
              name: position.positionName,
            }))
          );
        } else {
          message.error('Dữ liệu Chức vụ không hợp lệ');
        }

        if (departmentsData && Array.isArray(departmentsData.AllDepartment)) {
          setDepartments(
            departmentsData.AllDepartment.map((department) => ({
              _id: department._id,
              name: department.departmentName,
            }))
          );
        } else {
          message.error('Dữ liệu phòng ban không hợp lệ');
        }
      } catch (error) {
        console.error('Error fetching positions or departments:', error);
        message.error('Lỗi khi tải danh mục phòng ban và chức vụ');
      } finally {
        setFetchingData(false);
      }
    };

    fetchPositionsAndDepartments();
  }, []);

  const handleCreateUser = async (values) => {
    setLoading(true);
    try {
      const response = await createUser(values);
      message.success(response.message || 'Tạo người dùng mới thành công!');
      form.resetFields();
    } catch (error) {
      message.error(error.message || 'Có lỗi xảy ra khi tạo người dùng!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/70 p-3 sm:p-5 md:p-8">
      <div className="w-full mx-auto space-y-5 md:space-y-6">
        
        {/* Header Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              className="rounded-xl flex items-center justify-center h-10 w-10 border-slate-300 hover:border-blue-500 hover:text-blue-600 shadow-sm flex-shrink-0"
              title="Quay lại"
            />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight m-0">
                  Tạo Người Dùng Mới
                </h1>
                <Tag color="blue" className="rounded-full px-3 py-0.5 text-xs font-semibold">
                  Tài khoản hệ thống
                </Tag>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 m-0">
                Khởi tạo tài khoản nhân sự, phân bổ phòng ban, vị trí công tác và thiết lập vai trò người dùng.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-center flex-wrap">
            <Button
              onClick={() => navigate(-1)}
              className="rounded-xl text-slate-600 hover:text-slate-800"
            >
              Quay lại
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => form.resetFields()}
              disabled={loading}
              className="rounded-xl text-slate-600 hover:text-slate-800"
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              loading={loading}
              onClick={() => form.submit()}
              className="bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold shadow-md shadow-blue-500/20 px-5"
            >
              Tạo Người Dùng
            </Button>
          </div>
        </div>

        {/* Main Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateUser}
          requiredMark={false}
          autoComplete="off"
        >
          <div className="space-y-5 md:space-y-6">

            {/* Section 1: Thông tin tài khoản & Đăng nhập */}
            <Card
              className="rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden"
              title={
                <div className="flex items-center gap-2.5 py-1">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
                    <UserOutlined />
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 text-base sm:text-lg block">
                      Thông tin cơ bản & Đăng nhập
                    </span>
                    <span className="text-xs text-slate-400 font-normal block">
                      Thông tin định danh và thông tin xác thực của tài khoản
                    </span>
                  </div>
                </div>
              }
            >
              <Row gutter={[20, 12]}>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label={<span className="font-semibold text-slate-700">Họ và tên <span className="text-red-500">*</span></span>}
                    name="name"
                    rules={[{ required: true, message: 'Vui lòng nhập họ và tên!' }]}
                  >
                    <Input
                      prefix={<UserOutlined className="text-slate-400" />}
                      placeholder="VD: Nguyễn Văn An"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label={<span className="font-semibold text-slate-700">Email đăng nhập <span className="text-red-500">*</span></span>}
                    name="email"
                    rules={[
                      { required: true, message: 'Vui lòng nhập email!' },
                      { type: 'email', message: 'Địa chỉ email không hợp lệ!' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined className="text-slate-400" />}
                      placeholder="VD: an.nv@namsaigon.edu.vn"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label={<span className="font-semibold text-slate-700">Mật khẩu khởi tạo <span className="text-red-500">*</span></span>}
                    name="password"
                    rules={[
                      { required: true, message: 'Vui lòng nhập mật khẩu!' },
                      { min: 6, message: 'Mật khẩu phải có tối thiểu 6 ký tự!' },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="text-slate-400" />}
                      placeholder="Tối thiểu 6 ký tự"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label={<span className="font-semibold text-slate-700">Số điện thoại</span>}
                    name="mobile"
                    rules={[
                      { pattern: /^[0-9]{10}$/, message: 'Số điện thoại phải gồm 10 chữ số!' },
                    ]}
                  >
                    <Input
                      prefix={<PhoneOutlined className="text-slate-400" />}
                      placeholder="VD: 0912345678"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section 2: Đơn vị công tác & Phân quyền */}
            <Card
              className="rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden"
              title={
                <div className="flex items-center gap-2.5 py-1">
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base">
                    <BankOutlined />
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 text-base sm:text-lg block">
                      Đơn vị công tác & Phân quyền hệ thống
                    </span>
                    <span className="text-xs text-slate-400 font-normal block">
                      Thiết lập đơn vị phòng ban, chức danh công tác và cấp vai trò sử dụng
                    </span>
                  </div>
                </div>
              }
            >
              <Row gutter={[20, 12]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label={<span className="font-semibold text-slate-700">Phòng ban / Đơn vị <span className="text-red-500">*</span></span>}
                    name="department"
                    rules={[{ required: true, message: 'Vui lòng chọn phòng ban!' }]}
                  >
                    <Select
                      placeholder="Chọn phòng ban / đơn vị trực thuộc"
                      size="large"
                      loading={fetchingData}
                      showSearch
                      optionFilterProp="label"
                      className="rounded-xl w-full"
                      options={departments.map((d) => ({
                        value: d._id,
                        label: d.name,
                      }))}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label={<span className="font-semibold text-slate-700">Chức danh / Chức vụ <span className="text-red-500">*</span></span>}
                    name="position"
                    rules={[{ required: true, message: 'Vui lòng chọn chức vụ!' }]}
                  >
                    <Select
                      placeholder="Chọn chức danh / chức vụ công tác"
                      size="large"
                      loading={fetchingData}
                      showSearch
                      optionFilterProp="label"
                      className="rounded-xl w-full"
                      options={positions.map((p) => ({
                        value: p._id,
                        label: p.name,
                      }))}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label={<span className="font-semibold text-slate-700">Vai trò quyền hạn <span className="text-red-500">*</span></span>}
                    name="role"
                    rules={[{ required: true, message: 'Vui lòng chọn vai trò!' }]}
                  >
                    <Select
                      placeholder="Chọn vai trò sử dụng hệ thống"
                      size="large"
                      className="rounded-xl w-full"
                      options={roles.map((r) => ({
                        value: r._id,
                        label: (
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{r.name}</span>
                            <Tag color={r.color} className="mr-0 text-xs">
                              {r._id}
                            </Tag>
                          </div>
                        ),
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section 3: Mô tả bổ sung */}
            <Card
              className="rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden"
              title={
                <div className="flex items-center gap-2.5 py-1">
                  <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base">
                    <FileTextOutlined />
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 text-base sm:text-lg block">
                      Ghi chú & Thông tin bổ sung
                    </span>
                    <span className="text-xs text-slate-400 font-normal block">
                      Mô tả chuyên trách, nhiệm vụ hoặc các lưu ý khác về tài khoản
                    </span>
                  </div>
                </div>
              }
            >
              <Row gutter={[20, 12]}>
                <Col xs={24}>
                  <Form.Item
                    label={<span className="font-semibold text-slate-700">Mô tả / Ghi chú</span>}
                    name="description"
                  >
                    <Input.TextArea
                      placeholder="Nhập thông tin mô tả chi tiết hoặc ghi chú về nhân sự (không bắt buộc)..."
                      rows={3}
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Bottom Actions Bar */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs sm:text-sm text-slate-500 flex items-center gap-2">
                <CheckCircleOutlined className="text-emerald-500 text-base flex-shrink-0" />
                <span>Mật khẩu và thông tin tài khoản sẽ có hiệu lực ngay sau khi được khởi tạo thành công.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
                <Button
                  onClick={() => navigate(-1)}
                  size="large"
                  disabled={loading}
                  className="rounded-xl px-5"
                >
                  Quay lại
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => form.resetFields()}
                  size="large"
                  disabled={loading}
                  className="rounded-xl px-5"
                >
                  Làm mới
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<UserAddOutlined />}
                  loading={loading}
                  size="large"
                  className="bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold shadow-md shadow-blue-500/20 px-6"
                >
                  Tạo Người Dùng
                </Button>
              </div>
            </div>

          </div>
        </Form>
      </div>
    </div>
  );
};

export default CreateUserPage;
