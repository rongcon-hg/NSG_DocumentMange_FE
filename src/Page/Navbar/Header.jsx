import { useEffect, useState } from "react";
import { Layout, Avatar, Dropdown, Menu, message, Button, Badge, Popover, Tooltip } from "antd";
import { Link } from "react-router-dom";
import { UserOutlined,/* LockOutlined,*/ LogoutOutlined, MenuOutlined, BellOutlined, CheckOutlined } from "@ant-design/icons";
import Cookies from "js-cookie";
import PropTypes from "prop-types";
import { useNotificationContext } from "../../context/NotificationContext.jsx";
import { useSystemConfig } from "../../context/SystemConfigContext.jsx";
import { getPendingRepliesForRecipient } from "../../api/repliedDocApi.js";
import { getDeadlineStatusCounts } from "../../api/documentApi.js";
import { clearAuthSession } from "../../utils/authUtils.js";
import dayjs from "dayjs";
import "./bell.css";

const { Header } = Layout;

const AppHeader = ({ onMenuClick }) => {
  const [userName, setUserName] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const { 
    unreadDocCount, 
    myPendingReplyCount, 
    userRole, 
    userId, 
    todoTaskCount, 
    inProgressTaskCount, 
    avatarUrl, 
    emulationCounts,
    userNotifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead
  } = useNotificationContext();
  const { config, getLogoUrl } = useSystemConfig();
  const [totalPendingReplies, setTotalPendingReplies] = useState(0);
  const [deadlineCounts, setDeadlineCounts] = useState({ soonCount: 0, dueTodayCount: 0, overdueCount: 0 });
  const [showPopover, setShowPopover] = useState(false);

  const isAdmin = userRole === "admin" || userRole === "manager";
  const isGvCv = userRole === "chuyenvien";

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
    const hasPendingReply = !isGvCv && (isAdmin ? totalPendingReplies > 0 : myPendingReplyCount > 0);
    if ((unreadDocCount > 0 || hasPendingReply || todoTaskCount > 0 ||
         deadlineCounts.soonCount > 0 || deadlineCounts.dueTodayCount > 0 || deadlineCounts.overdueCount > 0 ||
         (emulationCounts?.totalActionableCount || 0) > 0 || (unreadNotificationCount || 0) > 0) && userId) {
      setShowPopover(true);
      const timer = setTimeout(() => setShowPopover(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [unreadDocCount, myPendingReplyCount, totalPendingReplies, deadlineCounts, todoTaskCount, emulationCounts, unreadNotificationCount, userId, isGvCv, isAdmin]);

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
  const pendingReplyBadgeCount = !isGvCv ? (isAdmin ? (totalPendingReplies || 0) : (myPendingReplyCount || 0)) : 0;
  const totalNotifications = (unreadDocCount || 0) + pendingReplyBadgeCount + (todoTaskCount || 0) + (emulationCounts?.totalActionableCount || 0) + (unreadNotificationCount || 0);

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
        <div className="text-white text-lg font-bold min-w-0">
          <Link to="/" className="hover:text-gray-300 transition duration-300 cursor-pointer flex items-center space-x-2 sm:space-x-3 min-w-0">
            <img src={getLogoUrl()} alt="Company Logo" className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain flex-shrink-0" />
            <span className="hidden sm:inline-block font-bold uppercase text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl truncate max-w-[200px] sm:max-w-[320px] md:max-w-[460px] lg:max-w-[620px]">
              {config?.siteName || 'HỆ THỐNG QUẢN LÝ VĂN BẢN'}
            </span>
            <span className="sm:hidden font-bold uppercase text-sm truncate max-w-[150px]">
              {config?.shortName || 'QLVB'}
            </span>
          </Link>
        </div>
      </div>

      {/* Right side - Bell notification and User info */}
      <div className="flex items-center gap-2 sm:gap-5">
        {/* Bell notification */}
          <Popover
            content={
              <div className="text-sm space-y-2 max-w-sm">
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
                {!isGvCv && (isAdmin ? totalPendingReplies : myPendingReplyCount) > 0 && (
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
                {inProgressTaskCount > 0 && (
                  <p>
                    <Link 
                      to="/schedule/inprogress" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Bạn có <b>{inProgressTaskCount}</b> công việc đang làm.
                    </Link>
                  </p>
                )}
                {emulationCounts?.pendingForManager > 0 && (
                  <p>
                    <Link 
                      to="/emulation/list?status=PENDING" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Bạn có <b>{emulationCounts.pendingForManager}</b> hồ sơ đề nghị thi đua chờ xét duyệt.
                    </Link>
                  </p>
                )}
                {emulationCounts?.pendingForBGH > 0 && (
                  <p>
                    <Link 
                      to="/emulation/list?status=SUBMITTED_TO_BGH" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Có <b>{emulationCounts.pendingForBGH}</b> hồ sơ đề nghị thi đua chờ BGH phê duyệt.
                    </Link>
                  </p>
                )}
                {emulationCounts?.rejectedForUser > 0 && (
                  <p>
                    <Link 
                      to="/emulation/list?status=REJECTED" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => setShowPopover(false)}
                    >
                      Bạn có <b>{emulationCounts.rejectedForUser}</b> hồ sơ đề nghị thi đua bị từ chối cần điều chỉnh.
                    </Link>
                  </p>
                )}

                {/* Danh sách thông báo tiến độ việc con (chỉ hiển thị những thông báo chưa đọc) */}
                {userNotifications && userNotifications.filter(n => !n.isRead).length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Việc con & Tiến độ</span>
                      <span className="text-emerald-700 bg-emerald-100 text-[10px] px-1.5 py-0.5 rounded font-bold">
                        {userNotifications.filter(n => !n.isRead).length} chưa đọc
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                      {userNotifications.filter(n => !n.isRead).slice(0, 8).map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => {
                            markNotificationAsRead(notif._id);
                            setShowPopover(false);
                            if (notif.link) {
                              window.location.href = notif.link;
                            }
                          }}
                          className="p-2 rounded-lg text-xs cursor-pointer transition-all border flex items-start gap-2 bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100 text-slate-800 shadow-xs group"
                        >
                          <span className="text-emerald-600 text-sm mt-0.5 flex-shrink-0 font-bold">✓</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 leading-snug line-clamp-2">
                              {notif.message}
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {notif.createdAt ? dayjs(notif.createdAt).format("DD/MM/YYYY HH:mm") : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                            <Tooltip title="Đánh dấu đã xem">
                              <Button
                                size="small"
                                type="text"
                                icon={<CheckOutlined className="text-xs text-slate-400 group-hover:text-emerald-600" />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markNotificationAsRead(notif._id);
                                }}
                                className="h-5 w-5 min-w-[20px] p-0 flex items-center justify-center hover:bg-emerald-200/50 rounded"
                              />
                            </Tooltip>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            }
            title={
              <div className="flex items-center justify-between gap-4 py-0.5">
                <span className="font-semibold text-slate-800">Thông báo mới</span>
                {((userNotifications && userNotifications.filter(n => !n.isRead).length > 0) || unreadNotificationCount > 0) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllNotificationsAsRead();
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer border-none bg-transparent p-0 font-medium"
                  >
                    Đã đọc tất cả
                  </button>
                )}
              </div>
            }
            trigger="click"
            open={showPopover}
            onOpenChange={(open) => {
              setShowPopover(open);
              if (open) {
                setTimeout(() => {
                  setShowPopover(false);
                }, 7000);
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
              src={avatarUrl}
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
