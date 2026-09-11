// eslint-disable-next-line no-unused-vars
import React from "react";
import { Layout } from "antd";
import { useSystemConfig } from "../../context/SystemConfigContext";

const { Header } = Layout;

const AppHeader = () => {
  const { config, getLogoUrl } = useSystemConfig();

  return (
    <Header className=" fixed w-full top-0 p-2 z-50 left-0 items-center bg-white shadow-md px-6">
      <div className="flex items-center">
        <img
          src={getLogoUrl()}
          alt="Company Logo"
          className="w-10 h-10 mr-3 object-contain"
        />
        <h1 className="text-xl font-bold text-gray-800">
          {config?.organizationName || 'Trường Cao Đẳng Bách Khoa Nam Sài Gòn'}
        </h1>
      </div>
    </Header> 
  );
};

export default AppHeader;
