import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Select, Spin, Row, Col, Typography, Divider } from 'antd';
import { createUser } from '../../api/auth';  
import { useNavigate } from 'react-router-dom';
import { getAllPositions } from '../../api/PositionAPI';
import { getAllDepartments } from '../../api/DepartmentAPI';


const { Title } = Typography;

const CreateUserPage = () => {
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);

  const navigate = useNavigate();

  const [roles] = useState([
    { _id: 'manager', name: 'Manager' },
    { _id: 'staff', name: 'Cấp trưởng' },
    { _id: 'cappho', name: 'Cấp phó' },
    { _id: 'chuyenvien', name: 'Chuyên viên' }
  ]);  // Mảng các vai trò
  const [form] = Form.useForm();

  // Fetch positions và departments khi trang được load
  useEffect(() => {
    const fetchPositionsAndDepartments = async () => {
      try {
        const positionsData = await getAllPositions();
        const departmentsData = await getAllDepartments();
        if (positionsData && Array.isArray(positionsData.AllPosition)) {
          const positionNames = positionsData.AllPosition.map(position => ({
            _id: position._id, 
            name: position.positionName
          }));
          setPositions(positionNames);
        } else {
          message.error('Dữ liệu Chức vụ không hợp lệ');
        }

        if (departmentsData && Array.isArray(departmentsData.AllDepartment)) {
          const departmentNames = departmentsData.AllDepartment.map(department => ({
            _id: department._id, 
            name: department.departmentName
          }));
          setDepartments(departmentNames);
        } else {
          message.error('Dữ liệu phòng ban không hợp lệ');
        }
        
      } catch (error) {
        console.error('Error fetching positions or departments:', error);
      }
    };

    fetchPositionsAndDepartments();
  }, []);

  const handleCreateUser = async (values) => {
    setLoading(true);
    try {
      const response = await createUser(values);
      message.success(response.message);
      form.resetFields();  
    } catch (error) {
      message.error(error.message || 'Có lỗi xảy ra!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f9f9f9', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Row justify="center" style={{ width: '100%' }}>
        <Col xs={24} sm={18} md={12} lg={10}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            width: '100%',
            maxWidth: '700px',
          }}>
            <Title level={3} style={{ textAlign: 'center', color: '#2C3E50' }}>Tạo Người Dùng Mới</Title>
            <Divider style={{ borderColor: '#2C3E50', margin: '10px 0' }} />
            <Form form={form} layout="vertical" onFinish={handleCreateUser}>
              <Form.Item
                label="Email"
                name="email"
                rules={[{ required: true, message: 'Vui lòng nhập email!' }]}
              >
                <Input placeholder="Nhập email" style={{ borderRadius: '6px' }} />
              </Form.Item>

              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              >
                <Input.Password placeholder="Nhập mật khẩu" style={{ borderRadius: '6px' }} />
              </Form.Item>

              <Form.Item
                label="Họ tên"
                name="name"
                rules={[{ required: true, message: 'Vui lòng nhập tên người dùng!' }]}
              >
                <Input placeholder="Nhập tên người dùng" style={{ borderRadius: '6px' }} />
              </Form.Item>

              <Form.Item
                label="Số Điện Thoại"
                name="mobile"
                rules={[{ required: true, message: 'Vui lòng nhập số điện thoại!' }]}
              >
                <Input placeholder="Nhập số điện thoại" style={{ borderRadius: '6px' }} />
              </Form.Item>

              <Form.Item
                label="Chức danh / Chức vụ"
                name="position"
                rules={[{ required: true, message: 'Vui lòng chọn Chức danh / Chức vụ!' }]}
              >
                <Select placeholder="Chọn Chức danh / Chức vụ" loading={positions.length === 0} style={{ borderRadius: '6px' }}>
                  {positions.length > 0 ? (
                    positions.map((position) => (
                      <Select.Option key={position._id} value={position._id}>
                        {position.name}
                      </Select.Option>
                    ))
                  ) : (
                    <Spin size="small" />
                  )}
                </Select>
              </Form.Item>

              <Form.Item
                label="Phòng Ban"
                name="department"
                rules={[{ required: true, message: 'Vui lòng chọn phòng ban!' }]}
              >
                <Select placeholder="Chọn phòng ban" loading={departments.length === 0} style={{ borderRadius: '6px' }}>
                  {departments.length > 0 ? (
                    departments.map((department) => (
                      <Select.Option key={department._id} value={department._id}>
                        {department.name}
                      </Select.Option>
                    ))
                  ) : (
                    <Spin size="small" />
                  )}
                </Select>
              </Form.Item>

              {/* Thêm phần chọn role */}
              <Form.Item
                label="Vai Trò"
                name="role"
                rules={[{ required: true, message: 'Vui lòng chọn vai trò!' }]}
              >
                <Select placeholder="Chọn vai trò" style={{ borderRadius: '6px' }}>
                  {roles.map((role) => (
                    <Select.Option key={role._id} value={role._id}>
                      {role.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Mô Tả"
                name="description"
                rules={[{ message: 'Vui lòng nhập mô tả!' }]}
              >
                <Input.TextArea placeholder="Nhập mô tả" rows={4} style={{ borderRadius: '6px' }} />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  style={{
                    width: '100%',
                    backgroundColor: '#3498DB',
                    borderColor: '#3498DB',
                    borderRadius: '6px',
                    padding: '12px ',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}
                >
                  Tạo Người Dùng
                </Button>
                <Button
                onClick={() => navigate(-1)}
                size="large"
                disabled={loading}
                style={{
                  marginTop: '15px',
                  width: '100%',
                  backgroundColor: '#ffff',
                  borderColor: '#3498DB',
                  borderRadius: '6px',
                  padding: '12px 0',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              
              >
                Hủy
              </Button>
              </Form.Item>
             
            </Form>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default CreateUserPage;
