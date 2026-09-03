import { useEffect, useState } from "react";
import { Layout, Avatar, Dropdown, Menu, message, Button, Badge, Popover } from "antd";
import { Link } from "react-router-dom";
import { UserOutlined,/* LockOutlined,*/ LogoutOutlined, MenuOutlined, BellOutlined } from "@ant-design/icons";
import Logo from "../../assets/Logo.webp";
import Cookies from "js-cookie";
import PropTypes from "prop-types";
import { useNotificationContext } from "../../context/NotificationContext.jsx";
import { getPendingRepliesForRecipient } from "../../api/repliedDocApi.js";
import { getDeadlineStatusCounts } from "../../api/documentApi.js";
import { clearAuthSession } from "../../utils/authUtils.js";
import "./bell.css";

const { Header } = Layout;

const AppHeader = ({ onMenuClick }) => {
  const [userName, setUserName] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const { unreadDocCount, myPendingReplyCount, userRole, userId, todoTaskCount } = useNotificationContext();
  const [totalPendingReplies, setTotalPendingReplies] = useState(0);
  const [deadlineCounts, setDeadlineCounts] = useState({ soonCount: 0, dueTodayCount: 0, overdueCount: 0 });
  const [showPopover, setShowPopover] = useState(false);

  const isAdmin = userRole === "admin" || userRole === "manager";


  useEffect(() => {
    const storedUserName = Cookies.get("currentUser");
    if (storedUserName) {
      setUserName(storedUserName);
    }
  }, []);

  // Fetch pending replies
  useEffect(() => {
    let interval;
    const fetchPendingReplies = async () => {
      if (isAdmin && userId) {
        try {
          const count = await getPendingRepliesForRecipient(userId);
          setTotalPendingReplies(count);
        } catch (error) {
          setTotalPendingReplies(0);
        }
      }
    };

    fetchPendingReplies();
    interval = setInterval(fetchPendingReplies, 600000);

    return () => clearInterval(interval);
  }, [userId, isAdmin]);

  // Fetch deadline counts
  useEffect(() => {
    let interval;
    const fetchDeadlineCounts = async () => {
      if (userId) {
        try {
          const counts = await getDeadlineStatusCounts(userId);
          setDeadlineCounts(counts);
        } catch (error) {
          setDeadlineCounts({ soonCount: 0, dueTodayCount: 0, overdueCount: 0 });
        }
      }
    };

    fetchDeadlineCounts();
    interval = setInterval(fetchDeadlineCounts, 600000);

    return () => clearInterval(interval);
  }, [userId]);

  // Show Popover when there are notifications
  useEffect(() => {
    if ((unreadDocCount > 0 || myPendingReplyCount > 0 || totalPendingReplies > 0 || todoTaskCount > 0 ||
         deadlineCounts.soonCount > 0 || deadlineCounts.dueTodayCount > 0 || deadlineCounts.overdueCount > 0) && userId) {
      setShowPopover(true);
      const timer = setTimeout(() => setShowPopover(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [unreadDocCount, myPendingReplyCount, totalPendingReplies, deadlineCounts, todoTaskCount, userId]);

  // Check if mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Hàm đăng xuất
  const handleLogout = () => {
    clearAuthSession();
    message.success("Đăng xuất thành công!");
    setTimeout(() => {
      window.location.href = "/login";
    }, 500);
  };

  // Tính tổng số lượng thông báo
  const totalNotifications = (unreadDocCount || 0) + (isAdmin ? (totalPendingReplies || 0) : (myPendingReplyCount || 0)) + (todoTaskCount || 0);

  const menuItems = [
    {
      key: "1",
      icon: <UserOutlined />,
      label: <Link to="/members">Hồ sơ</Link>,
    },
    // {
    //   key: "2",
    //   icon: <LockOutlined />,
    //   label: <span>Đổi mật khẩu</span>,
    // },
    {
      key: "3",
      icon: <LogoutOutlined />,
      label: <span onClick={handleLogout}>Đăng xuất</span>,
    },
  ];

  return (
                <Header
                  className="bg-gray-800"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: isMobile ? "0 15px" : "0 25px",
                    color: "#fff",
                    height: isMobile ? "70px" : "80px",
                    minHeight: isMobile ? "70px" : "80px",
                  }}
                >
      {/* Left side - Menu button and Logo */}
      <div className="flex items-center space-x-3">
        {/* Mobile menu button */}
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onMenuClick}
            style={{ color: "#fff", border: "none" }}
            className="hover:bg-gray-700"
          />
        )}
        
        {/* Logo */}
        <div className="text-white text-lg font-bold">
          <Link to="/" className="hover:text-gray-300 transition duration-300 cursor-pointer flex items-center space-x-3">
            <img src={Logo} alt="Company Logo" className="w-10 h-10 sm:w-12 sm:h-12" />
            <p className={`${isMobile ? 'text-base' : 'text-xl'} hidden sm:block`}>
              HỆ THỐNG QUẢN LÝ VĂN BẢN
            </p>
            <p className={`${isMobile ? 'text-sm' : 'hidden'} sm:hidden`}>
              QLVB
            </p>
          </Link>
        </div>
      </div>

      {/* Right side - Bell notification and User info */}
      <div className="flex items-center gap-2 sm:gap-5">
        {/* Bell notification */}
          <Popover
            content={
              <div className="text-sm space-y-2">
                {unreadDocCount > 0 && (
                  <p>
                    <Link 
                      to="/documents/ReceivedDocumentList" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Bạn có tổng <b>{unreadDocCount}</b> văn bản đến chưa xem.
                    </Link>
                  </p>
                )}
                {deadlineCounts.soonCount > 0 && (
                  <p>
                    <Link 
                      to="/documents/ReceivedDocumentList" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Có <b>{deadlineCounts.soonCount}</b> văn bản sắp đến hạn xử lý.
                    </Link>
                  </p>
                )}
                {deadlineCounts.dueTodayCount > 0 && (
                  <p>
                    <Link 
                      to="/documents/ReceivedDocumentList" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Có <b>{deadlineCounts.dueTodayCount}</b> văn bản đến hạn xử lý.
                    </Link>
                  </p>
                )}
                {deadlineCounts.overdueCount > 0 && (
                  <p>
                    <Link 
                      to="/documents/ReceivedDocumentList" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Có <b>{deadlineCounts.overdueCount}</b> văn bản quá hạn xử lý.
                    </Link>
                  </p>
                )}
                {(isAdmin ? totalPendingReplies : myPendingReplyCount) > 0 && (
                  <p>
                    <Link 
                      to="/getAllRepliedDoc" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Bạn có <b>{isAdmin ? totalPendingReplies : myPendingReplyCount}</b> văn bản trình ký cần xử lý.
                    </Link>
                  </p>
                )}
                {todoTaskCount > 0 && (
                  <p>
                    <Link 
                      to="/schedule/todo" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Bạn có <b>{todoTaskCount}</b> công việc chưa làm.
                    </Link>
                  </p>
                )}
              </div>
            }
            title="Thông báo mới"
            trigger="click"
            open={showPopover}
            onOpenChange={(open) => {
              setShowPopover(open);
              if (open) {
                setTimeout(() => {
                  setShowPopover(false);
                }, 5000);
              }
            }}
          >
            <Badge count={totalNotifications} size="small" offset={[-5, 5]}>
              <BellOutlined className={`text-white text-xl cursor-pointer transition-all ${showPopover ? "shake" : ""}`} />
            </Badge>
          </Popover>

        {!isMobile && (
          <span className="font-bold text-white">{userName}</span>
        )}
        <Dropdown
          overlay={<Menu items={menuItems} />}
          placement="bottomRight"
          trigger={["click"]}
        >
          <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 rounded px-3 py-2">
            {isMobile && (
              <span className="font-bold text-white text-sm">{userName}</span>
            )}
            <Avatar
              style={{ backgroundColor: "#87d068", cursor: "pointer" }}
              icon={<UserOutlined />}
              size={isMobile ? "default" : "large"}
            />
          </div>
        </Dropdown>
      </div>
    </Header>
  );
};

AppHeader.propTypes = {
  onMenuClick: PropTypes.func.isRequired,
};

export default AppHeader;
