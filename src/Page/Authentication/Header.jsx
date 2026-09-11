// eslint-disable-next-line no-unused-vars
import React from "react";
import { Layout } from "antd";
import { useSystemConfig } from "../../context/SystemConfigContext";

const { Header } = Layout;

const AppHeader = () => {
  const { config, getLogoUrl } = useSystemConfig();

  return (
    <Header className="fixed w-full top-0 p-2 z-50 left-0 flex items-center bg-white shadow-md px-3 sm:px-6 h-14 sm:h-16">
      <div className="flex items-center min-w-0 max-w-full">
        <img
          src={getLogoUrl()}
          alt="Company Logo"
          className="w-8 h-8 sm:w-10 sm:h-10 mr-2 sm:mr-3 object-contain flex-shrink-0"
        />
        <h1 className="text-sm sm:text-lg md:text-xl font-bold text-gray-800 uppercase truncate">
          {config?.organizationName || 'Trường Cao Đẳng Bách Khoa Nam Sài Gòn'}
        </h1>
      </div>
    </Header> 
  );
};

export default AppHeader;
