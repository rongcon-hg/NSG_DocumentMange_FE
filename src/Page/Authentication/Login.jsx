/* eslint-disable no-unused-vars */
import React from "react";
import Header from "./Header";
import FormLogin from "./Fromlogin";
import { useSystemConfig } from "../../context/SystemConfigContext";

const Login = () => {
    const { getLoginBgUrl, config } = useSystemConfig();
    const bgUrl = getLoginBgUrl();

    return (
        <>
            <Header />
            <div
                className="login-container flex justify-center items-center max-h-[100vw] w-full bg-gray-100 overflow-hidden"
                style={config?.loginBackground ? { backgroundImage: `url(${bgUrl})`, backgroundSize: '100% 100%' } : undefined}
            >
                <FormLogin />
            </div>
        </>
    );
};

export default Login;
