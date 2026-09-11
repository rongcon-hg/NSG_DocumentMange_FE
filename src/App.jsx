/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import './App.css';

import PrivateRoute from './Page/Authentication/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';
import NotAuthorized from './components/Notauthorized';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { SystemConfigProvider } from './context/SystemConfigContext.jsx';
import { FloatButton } from 'antd';
import { UpOutlined } from '@ant-design/icons';

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
import SignatureSettings from './Page/Signature/SignatureSettings';
import SignDocument from './Page/Signature/SignDocument';
import SignedArchive from './Page/Signature/SignedArchive';
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
import KpiDashboard from './Page/Schedule/KpiDashboard.jsx';
import TaskReportPage from './Page/Schedule/TaskReportPage.jsx';
import ChatbotConfig from './Page/Chatbot/ChatbotConfig.jsx';
import ChatbotWidget from './components/ChatbotWidget/ChatbotWidget.jsx';
import BackupConfig from './Page/BackupConfig/BackupConfig.jsx';
import SmtpConfig from './Page/SystemConfig/SmtpConfig.jsx';
import GoogleLoginConfig from './Page/SystemConfig/GoogleLoginConfig.jsx';
import UnitConfigPage from './Page/SystemConfig/UnitConfigPage.jsx';
import AutoLogoutHandler from './components/AutoLogoutHandler.jsx';
import EmulationRegisterPage from './Page/Emulation/EmulationRegisterPage.jsx';
import EmulationListPage from './Page/Emulation/EmulationListPage.jsx';
import EmulationReportPage from './Page/Emulation/EmulationReportPage.jsx';
import EmulationTitlePage from './Page/Emulation/EmulationTitlePage.jsx';
import EmulationDocumentPage from './Page/Emulation/EmulationDocumentPage.jsx';
import EmulationAchievementListPage from './Page/Emulation/EmulationAchievementListPage.jsx';
import EmulationAchievementAddPage from './Page/Emulation/EmulationAchievementAddPage.jsx';
import TrainingRegisterPage from './Page/Training/TrainingRegisterPage.jsx';
import TrainingListPage from './Page/Training/TrainingListPage.jsx';
import TrainingReportPage from './Page/Training/TrainingReportPage.jsx';

function App() {
const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);


  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isTouchDevice);
    };
  
    checkMobile();
    setIsMounted(true);
  }, []);

  return (
    <SystemConfigProvider>
      <Router>
        <AutoLogoutHandler />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPass />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <NotificationProvider>
                  <div className="flex flex-col h-screen">
                    <div className="print:hidden">
                      <AppHeader 
                        onMenuClick={() => setMobileMenuOpen(true)}
                      />
                    </div>
                    <div className="flex flex-1 overflow-hidden print:overflow-visible">
                      <div className="print:hidden h-full">
                        <Sidebar 
                          mobileOpen={mobileMenuOpen}
                          onMobileClose={() => setMobileMenuOpen(false)}
                          onMenuItemClick={() => setMobileMenuOpen(false)}
                        />
                      </div>
                      <div id="main-scroll-container" className="flex-1 p-1 sm:p-2 overflow-y-auto bg-gray-100 print:bg-white print:overflow-visible print:p-0 print:m-0">
                        <Outlet />
                      </div>
                    </div>
                    <div className="print:hidden">
                      <ChatbotWidget />
                    </div>
                    {isMounted && (
                      <FloatButton.BackTop 
                        target={() => document.getElementById("main-scroll-container")}
                        icon={<UpOutlined />} 
                        type="primary" 
                        style={{ right: 24, bottom: 24, zIndex: 9999 }} 
                        visibilityHeight={100} 
                      />
                    )}
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
            <Route path="/signature/settings" element={<SignatureSettings />} />
            <Route path="/signature/sign" element={<SignDocument />} />
            <Route path="/signature/archive" element={<SignedArchive />} />
            <Route path="/replyDoc" element={<Replylist />} />
            <Route path="/getAllRepliedDoc" element={<AllRepliedDoc />} />
            <Route path="/repliedDocs/edit/:id" element={<EditRepliedDoc />} />
            <Route path="/bgh-review" element={<BGHReviewPage />} />
            <Route path="Report" element={<Report />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="schedule/kpi" element={<KpiDashboard />} />
            <Route path="schedule/report" element={<TaskReportPage />} />
            <Route path="schedule/:tab" element={<SchedulePage />} />
            <Route path="emulation/register" element={<EmulationRegisterPage />} />
            <Route path="emulation/list" element={<EmulationListPage />} />
            <Route path="emulation/report" element={<EmulationReportPage />} />
            <Route path="emulation/titles" element={<EmulationTitlePage />} />
            <Route path="emulation/documents" element={<EmulationDocumentPage />} />
            <Route path="emulation/achievements" element={<EmulationAchievementListPage />} />
            <Route path="emulation/achievements/add" element={<EmulationAchievementAddPage />} />
            <Route path="training/register" element={<TrainingRegisterPage />} />
            <Route path="training/list" element={<TrainingListPage />} />
            <Route path="training/report" element={<TrainingReportPage />} />
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
              <Route path="BackupConfig" element={<BackupConfig />} />
              <Route path="SmtpConfig" element={<SmtpConfig />} />
              <Route path="GoogleLoginConfig" element={<GoogleLoginConfig />} />
              <Route path="unit-config" element={<UnitConfigPage />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </SystemConfigProvider>
  );
}

export default App;
