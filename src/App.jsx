/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import './App.css';

import PrivateRoute from './Page/Authentication/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';
import NotAuthorized from './components/Notauthorized';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { FloatButton } from 'antd';

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
const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isTouchDevice);
    };
  
    checkMobile();
  }, []);

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
                    <div id="main-scroll-container" className="flex-1 p-3 sm:p-6 overflow-y-auto bg-gray-100">
                      <Outlet />
                    </div>
                  </div>
                  <ChatbotWidget />
                  <FloatButton.BackTop 
                    target={() => document.getElementById('main-scroll-container')} 
                    style={{ right: 20, bottom: 20 }} 
                  />
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