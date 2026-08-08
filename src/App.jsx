/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Draggable from 'react-draggable';
import { FloatButton } from 'antd';
import { MessageOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import './App.css';

import PrivateRoute from './Page/Authentication/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';
import NotAuthorized from './components/Notauthorized';
import { NotificationProvider } from './context/NotificationContext.jsx';

import Sidebar from './Page/Navbar/Navbar';
import AppHeader from './Page/Navbar/Header';
import Dashboard from './Page/Dashboard/Dashboard';
import CreateDocument from './Page/Documents/CreateDocument';
import UpdateDocumentPage from './Page/Documents/UpdateDocument';
import SentDocumentList from './Page/Documents/SentDocumentList.jsx';
import ReceivedDocumentList from './Page/Documents/ReceivedDocumentList.jsx';
import AllRepliedDoc from './Page/Reply/getAllRepliedDoc';
import Replylist from './Page/Reply/replyDoc';
import EditRepliedDoc from './Page/Reply/EditRepliedDoc';
import BGHReviewPage from './Page/Reply/BGHReviewPage';
import DocVariantPage from './Page/DocVariant/DocVariantPage';
import DriveConfig from './Page/DriveConfig/DriveConfig.jsx'
import Members from './Page/Members/Menber';
import Login from './Page/Authentication/Login';
import ResetPass from './Page/Authentication/resetPassword';
import DepartmentForm from './Page/Department/DepartmentForm';
import Position from './Page/Position/PositionFrom';
import CreateUser from './Page/CreateUser/Createuser';
import UserListPage from './Page/CreateUser/UserListPage';
import UnitList from './Page/Units/UnitList';
import Report from './Page/Report/Report.jsx';
import Statistics from './Page/Statistics/statistics.jsx';
import SchedulePage from './Page/Schedule/SchedulePage.jsx';
import ChatbotConfig from './Page/Chatbot/ChatbotConfig.jsx';
import ChatbotWidget from './components/ChatbotWidget/ChatbotWidget.jsx';

function App() {
  const ZaloOAID = import.meta.env.VITE_ZALO_OAID;
  const TAWKTO_PROPERTY_ID = import.meta.env.VITE_TAWK_ID;
  const zaloWidgetRef = useRef(null);
const [isMobile, setIsMobile] = useState(false);
  const [isZaloOpen, setIsZaloOpen] = useState(false);
  const [isTawkOpen, setIsTawkOpen] = useState(false);
  const [isButtonGroupOpen, setIsButtonGroupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isTouchDevice);
    };
  
    checkMobile();
  }, []);

  // Load Zalo SDK
  useEffect(() => {
    if (!document.getElementById('zalo-sdk')) {
      const script = document.createElement('script');
      script.id = 'zalo-sdk';
      script.src = 'https://sp.zalo.me/plugins/sdk.js';
      script.async = true;
      script.onload = () => {
        window.Zalo?.init({
          oaid: ZaloOAID,
          welcomeMessage: 'Rất vui khi được hỗ trợ bạn!',
          autopopup: 0,
        });
        if (window.Zalo && window.Zalo.ChatWidget) {
          window.Zalo.ChatWidget.hide();
        }
      };
      script.onerror = () => console.error('Failed to load Zalo SDK');
      document.body.appendChild(script);
    }
  }, [ZaloOAID]);

  // Load Tawk.to script and ensure widget is hidden
  useEffect(() => {
    if (!document.getElementById('tawkto-script')) {
      const script = document.createElement('script');
      script.id = 'tawkto-script';
      script.async = true;
      script.src = `https://embed.tawk.to/${TAWKTO_PROPERTY_ID}`;
      script.charset = 'UTF-8';
      script.setAttribute('crossorigin', '*');
      script.onload = () => {
     
        if (window.Tawk_API && window.Tawk_API.hideWidget) {
          window.Tawk_API.hideWidget();
       
        }
        const hideTawkWidget = (attempts = 10, delay = 500) => {
          if (attempts <= 0) {
            console.warn('Failed to hide Tawk.to widget after retries');
            return;
          }
          if (window.Tawk_API && window.Tawk_API.hideWidget) {
            window.Tawk_API.hideWidget();
            
          } else {
          
            setTimeout(() => hideTawkWidget(attempts - 1, delay), delay);
          }
        };
        hideTawkWidget();
      };
      script.onerror = () => console.error('Failed to load Tawk.to script');
      document.body.appendChild(script);
    }
    return () => {
      if (window.Tawk_API && window.Tawk_API.hideWidget) {
        window.Tawk_API.hideWidget();
     
      }
    };
    
  }, []);

  const toggleZaloWidget = () => {
    if (!isZaloOpen) {
      if (window.Tawk_API && window.Tawk_API.hideWidget) {
        window.Tawk_API.hideWidget();
       
      }
      setIsTawkOpen(false);
      setIsZaloOpen(true);
      if (window.Zalo && zaloWidgetRef.current) {
        try {
          window.Zalo.ChatWidget?.show();
          
        } catch (error) {
          console.error('Failed to show Zalo widget:', error);
        }
      }
    } else {
      setIsZaloOpen(false);
      if (window.Zalo) {
        try {
          window.Zalo.ChatWidget?.hide();
         
        } catch (error) {
          console.error('Failed to hide Zalo widget:', error);
        }
      }
    }
  };

  const toggleTawkWidget = () => {
    if (!window.Tawk_API) {
      console.warn('Tawk.to API not available');
      return;
    }
    if (!isTawkOpen) {
      if (window.Zalo && window.Zalo.ChatWidget) {
        window.Zalo.ChatWidget.hide();
     
      }
      setIsZaloOpen(false);
      setIsTawkOpen(true);
      try {
        window.Tawk_API.showWidget();
      } catch (error) {
        console.error('Failed to show Tawk.to widget:', error);
      }
    } else {
      try {
        window.Tawk_API.hideWidget();
      } catch (error) {
        console.error('Failed to hide Tawk.to widget:', error);
      }
      setIsTawkOpen(false);
    }
  };

  const toggleButtonGroup = (open) => {
    setIsButtonGroupOpen(open);
    if (!open) {
      if (isZaloOpen) {
        setIsZaloOpen(false);
        if (window.Zalo && window.Zalo.ChatWidget) {
          window.Zalo.ChatWidget.hide();
        }
      }
      if (isTawkOpen) {
        setIsTawkOpen(false);
        if (window.Tawk_API && window.Tawk_API.hideWidget) {
          window.Tawk_API.hideWidget();
        }
      }
    }
  };
  const renderFloatingButtonGroup = () => {
    const buttonGroup = (
      <div className="fixed z-[2500] bottom-5 left-5 draggable-handle">
        <FloatButton.Group
          open={isButtonGroupOpen}
          trigger="click"
          icon={<MessageOutlined />}
          onOpenChange={toggleButtonGroup}
          className="bg-blue-500 text-white w-16 h-16 text-2xl flex items-center justify-center rounded-full shadow-lg"
        >
          <FloatButton
            icon={<CustomerServiceOutlined />}
            description="Tawk.to"
            className={`tawk-button w-12 h-12 text-base ${isTawkOpen ? 'tawk-button-open' : ''}`}
            onClick={toggleTawkWidget}
          />
          <FloatButton
            icon={<MessageOutlined />}
            description="Zalo"
            className={`mb-5 zalo-button w-12 h-12 text-base ${isZaloOpen ? 'zalo-button-open' : ''}`}
            onClick={toggleZaloWidget}
          />
        </FloatButton.Group>
      </div>
    );
  
    // 🟢 Trên mobile: cố định bên trái
    if (isMobile) return (
      <div className="fixed z-[2500] bottom-[-20px]  left-24 transform -translate-x-1/2">
        {buttonGroup}
      </div>
    );
    // 🟡 Trên desktop: có thể kéo (draggable)
    return (
      <Draggable defaultPosition={{ x: 80, y: 20 }} bounds="body" handle=".draggable-handle">
        {buttonGroup}
      </Draggable>
    );
  };
  

  const renderChatWidgets = () => {
    return (
      <div
        className={`fixed z-[1999] bottom-24 left-50 ${isZaloOpen ? 'block' : 'hidden'}`}
      >
        <div
          className="zalo-chat-widget-container"
          ref={zaloWidgetRef}
        >
          <div
            className="zalo-chat-widget"
            data-oaid={ZaloOAID}
            data-welcome-message="Rất vui khi được hỗ trợ bạn!"
            data-autopopup="0"
            data-width="350"
            data-height="420"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    );
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPass />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <NotificationProvider>
                <div className="flex flex-col h-screen">
                  <AppHeader 
                    onMenuClick={() => setMobileMenuOpen(true)}
                  />
                  <div className="flex flex-1">
                    <Sidebar 
                      mobileOpen={mobileMenuOpen}
                      onMobileClose={() => setMobileMenuOpen(false)}
                      onMenuItemClick={() => setMobileMenuOpen(false)}
                    />
                    <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-gray-100">
                      <Outlet />
                    </div>
                  </div>
                  {renderChatWidgets()}
                  {renderFloatingButtonGroup()}
                  <ChatbotWidget />
                </div>
              </NotificationProvider>
            </PrivateRoute>
          }
        >
          <Route path="not-authorized" element={<NotAuthorized />} />
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="documents/create" element={<CreateDocument />} />
          <Route path="documents/SentDocumentList" element={<SentDocumentList />} />
          <Route
            path="documents/ReceivedDocumentList"
            element={<ReceivedDocumentList />}
          />
          <Route path="/documents/edit/:documentId" element={<UpdateDocumentPage />} />
          <Route path="/members" element={<Members />} />
          <Route path="/replyDoc" element={<Replylist />} />
          <Route path="/getAllRepliedDoc" element={<AllRepliedDoc />} />
          <Route path="/repliedDocs/edit/:id" element={<EditRepliedDoc />} />
          <Route path="/bgh-review" element={<BGHReviewPage />} />
          <Route path="Report" element={<Report />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="schedule/:tab" element={<SchedulePage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="DepartmentForm" element={<DepartmentForm />} />
            <Route path="Position" element={<Position />} />
            <Route path="DocVariantPage" element={<DocVariantPage />} />
            <Route path="DriveConfig" element={<DriveConfig />} />
            <Route path="CreateUser" element={<CreateUser />} />
            <Route path="Listusers" element={<UserListPage />} />
            <Route path="Units" element={<UnitList />} />
            <Route path="Statistics" element={<Statistics />} />
            <Route path="ChatbotConfig" element={<ChatbotConfig />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;