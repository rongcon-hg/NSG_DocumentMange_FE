import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Alert } from "antd";
import { LockOutlined, UserOutlined, LoginOutlined, UnlockOutlined, GoogleOutlined } from "@ant-design/icons";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../../redux/authSlice";
import { login } from "../../redux/authActions";
import axiosInstance from "../../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import "../../../src/App.css";
import Logo from "../../assets/Logo.webp";
import { recordLoginSession, isSessionExpired, clearAuthSession } from "../../utils/authUtils";

const getCookie = (name) => {
    const cookies = document.cookie.split("; ");
    const cookie = cookies.find((row) => row.startsWith(`${name}=`));
    return cookie ? cookie.split("=")[1] : null;
};
const FormLogin = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [googleErrorMsg, setGoogleErrorMsg] = useState("");
    const navigate = useNavigate();
    const accessToken = getCookie("accessToken");

    useEffect(() => {
        // Parse URL params for Google Login
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const nameParam = params.get('name');
        const error = params.get('error');

        if (token) {
            // Setup cookie
            document.cookie = `accessToken=${token}; path=/; max-age=${4 * 60 * 60}; Secure`;
            if (nameParam) {
                document.cookie = `currentUser=${encodeURIComponent(nameParam)}; path=/; max-age=${4 * 60 * 60}; Secure`;
                dispatch(loginSuccess({ name: nameParam, accessToken: token }));
            }
            recordLoginSession();
            message.success("Đăng nhập thành công!");
            navigate("/dashboard");
        } else if (error === 'account_not_found') {
            setGoogleErrorMsg("Tài khoản email của bạn chưa được liên kết với tài khoản trên hệ thống, vui lòng liên hệ quản trị viên để được hỗ trợ.");
            // Xóa URL param để tránh hiển thị lại lỗi khi refresh
            window.history.replaceState({}, document.title, "/login");
        } else if (error === 'google_login_disabled') {
            setGoogleErrorMsg("Tính năng Đăng nhập bằng Google hiện đang tạm tắt bởi Quản trị viên.");
            window.history.replaceState({}, document.title, "/login");
        } else if (accessToken) {
            if (isSessionExpired()) {
                clearAuthSession();
            } else {
                navigate("/dashboard");
            }
        }
    }, [accessToken, navigate, dispatch]);

    const handleGoogleLogin = async () => {
        try {
            const res = await axiosInstance.get('/google/auth-login');
            if (res.data && res.data.url) {
                window.location.href = res.data.url;
            }
        } catch (error) {
            const errorMsg = error?.response?.data?.message || "Lỗi khi kết nối đến Google, vui lòng thử lại sau!";
            message.error(errorMsg);
        }
    };

    const onFinish = async (values) => {
        const { email, password } = values;
        setLoading(true);
        try {
            await dispatch(login(email, password));
            message.success("Đăng nhập thành công!");
            navigate("/dashboard");
        } catch (error) {
            const errorMessage =
                error?.response?.data?.message ||
                error.message ||
                "Đăng nhập thất bại. Vui lòng kiểm tra lại!";
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-form-wrapper bg-white border-4 border-cyan-800 shadow-lg rounded-lg p-8 w-full max-w-md flex flex-col items-center relative">
          
        {/* Logo (Nằm trên viền của khung) */}

        <div className="relative flex justify-center items-center bottom-20">
            {/* Viền nửa trên */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-12 border-t-4 border-l-4 border-r-4 border-cyan-800 rounded-t-full"></div>

            {/* Logo */}
            <div className="bg-white p-2 sm:bottom-2 rounded-full shadow-md">
                <img
                    src={Logo}
                    alt="Logo"
                    className="w-20 h-20 object-contain"
                />
            </div>
        </div>
 
        <Form
            name="login_form"
            onFinish={onFinish}
            layout="vertical"
            autoComplete="off"
            className="w-full pb-10 mt-[-40px] "
        >
            {googleErrorMsg && (
                <Alert 
                    message={googleErrorMsg} 
                    type="error" 
                    showIcon 
                    className="mb-4"
                    closable
                    onClose={() => setGoogleErrorMsg("")}
                />
            )}
            
            <Form.Item 
    
                name="email"
                rules={[
                    { required: true, message: "Vui lòng nhập email!" },
                    { type: "email", message: "Email không hợp lệ!" }
                ]}
            >
                <Input
                    prefix={<UserOutlined className="text-gray-400 text-lg" />}
                    placeholder="Email"
                    className="rounded-md border border-cyan-800 px-4 py-3 text-lg"
                    autoComplete="email"
                />
            </Form.Item>

            <Form.Item
                name="password"
                rules={[
                    { required: true, message: "Vui lòng nhập mật khẩu!" },
                    { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự!" }
                ]}
            >
                <Input.Password
                    prefix={<LockOutlined className="text-gray-400 text-lg" />}
                    placeholder="Mật khẩu"
                    className="rounded-md border border-cyan-800 px-4 py-3 text-lg"
                    autoComplete="current-password"
                />
            </Form.Item>

            <div className="flex flex-col gap-4">
                <Button
                    type="primary"
                    htmlType="submit"
                    className="w-full bg-blue-500 hover:bg-cyan-800 border-none rounded-md flex items-center justify-center text-white py-3 text-lg"
                    loading={loading}
                    icon={<LoginOutlined />}
                >
                    Đăng Nhập
                </Button>

                <Button
                    type="link"
                    className="text-cyan-800 hover:text-cyan-600 flex items-center justify-center text-lg"
                    icon={<UnlockOutlined />}
                    onClick={() => navigate("/reset-password")}
                >
                    Quên mật khẩu?
                </Button>

                <div className="flex items-center justify-center my-2">
                    <span className="bg-white px-2 text-gray-500">Hoặc</span>
                </div>

                <Button
                    type="default"
                    className="w-full flex items-center justify-center text-lg py-3 rounded-md border border-gray-300 hover:border-blue-500 hover:text-blue-500"
                    icon={<GoogleOutlined style={{ color: '#db4437' }} />}
                    onClick={handleGoogleLogin}
                >
                    Đăng nhập bằng Google
                </Button>
            </div>
        </Form>
    </div>
    );
};
export default FormLogin;