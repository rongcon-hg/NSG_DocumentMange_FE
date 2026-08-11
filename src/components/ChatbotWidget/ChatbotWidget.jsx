import React, { useState, useEffect, useRef } from 'react';
import { RobotOutlined, CloseOutlined, SendOutlined, FileTextOutlined } from '@ant-design/icons';
import { Button, Input, Spin } from 'antd';
import axiosInstance from '../../api/axiosInstance';

const ChatbotWidget = () => {
    const [config, setConfig] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await axiosInstance.get('/chatbot-config');
            if (res.data.success && res.data.data.isActive) {
                setConfig(res.data.data);
            }
        } catch (error) {
            console.error("Failed to load chatbot config");
        }
    };

    const initChat = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.post('/chatbot/chat', { isInit: true });
            if (res.data.success) {
                setMessages([
                    { sender: 'bot', text: res.data.reply, suggestions: res.data.suggestions || [] }
                ]);
            }
        } catch (error) {
            console.error("Init chat error:", error);
            setMessages([
                { sender: 'bot', text: "Chào bạn, tôi có thể giúp gì cho bạn hôm nay?" }
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            initChat();
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (customMessage) => {
        const textToSend = typeof customMessage === 'string' ? customMessage : inputValue;
        if (!textToSend.trim()) return;
        
        // Extract chat history
        const chatHistory = messages
            .filter(m => m.sender === 'user' || m.sender === 'bot')
            .map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text }]
            }));

        const newMsg = { sender: 'user', text: textToSend };
        setMessages(prev => [...prev, newMsg]);
        if (typeof customMessage !== 'string') {
            setInputValue('');
        }
        setLoading(true);

        try {
            const res = await axiosInstance.post(
                '/chatbot/chat', 
                { message: textToSend, history: chatHistory }
            );
            if (res.data.success) {
                setMessages(prev => [...prev, { sender: 'bot', text: res.data.reply }]);
            } else {
                setMessages(prev => [...prev, { sender: 'bot', text: 'Ối, hệ thống AI đang hơi bận một chút 😅. Bạn vui lòng thử lại sau vài giây nhé!' }]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { sender: 'bot', text: 'Rất xin lỗi bạn, đường truyền tới máy chủ AI đang bị gián đoạn 🛠️. Bạn đợi một chút rồi thử lại nha!' }]);
        } finally {
            setLoading(false);
        }
    };

    if (!config) return null;

    const { primaryColor, position, width, height } = config;

    const parseBold = (str) => {
        if (typeof str !== 'string') return str;
        const parts = str.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) => i % 2 === 1 ? <strong key={i} style={{ color: '#0369a1' }}>{part}</strong> : part);
    };

    const parseMessage = (text) => {
        // Find markdown links [Text](URL)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            // Push preceding text
            if (match.index > lastIndex) {
                parts.push(parseBold(text.substring(lastIndex, match.index)));
            }
            // Push link component
            parts.push(
                <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', textDecoration: 'underline' }}>
                    {parseBold(match[1])}
                </a>
            );
            lastIndex = linkRegex.lastIndex;
        }
        // Push remaining text
        if (lastIndex < text.length) {
            parts.push(parseBold(text.substring(lastIndex)));
        }

        return parts.length > 0 ? parts : parseBold(text);
    };

    const widgetStyle = {
        position: 'fixed',
        bottom: '80px',
        [position === 'right' ? 'right' : 'left']: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: position === 'right' ? 'flex-end' : 'flex-start'
    };

    const chatWindowStyle = {
        width: width || '350px',
        height: height || '480px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        marginBottom: '10px',
        overflow: 'hidden'
    };

    return (
        <div style={widgetStyle}>
            <div style={chatWindowStyle}>
                <div style={{ backgroundColor: primaryColor, padding: '12px 16px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <RobotOutlined style={{ fontSize: '20px' }} />
                        <span>ChatbotAI QLVB NSG</span>
                    </div>
                    <CloseOutlined style={{ cursor: 'pointer' }} onClick={() => setIsOpen(false)} />
                </div>
                <div style={{ flex: 1, padding: '16px', overflowY: 'auto', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {messages.map((msg, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                            <div style={{ 
                                backgroundColor: msg.sender === 'user' ? '#e6f7ff' : '#fff',
                                color: '#333',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                maxWidth: '85%',
                                border: '1px solid #eee',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {parseMessage(msg.text)}
                            </div>
                            {msg.suggestions && msg.suggestions.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                    {msg.suggestions.map((sug, sIdx) => (
                                        <Button key={sIdx} size="small" style={{ borderRadius: '16px', fontSize: '12px' }} onClick={() => handleSend(sug)}>
                                            {sug}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div style={{ alignSelf: 'flex-start', padding: '8px' }}>
                            <Spin size="small" />
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div style={{ padding: '12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '8px' }}>
                    <Input 
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onPressEnter={handleSend}
                        placeholder="Nhập câu hỏi..." 
                        style={{ flex: 1 }}
                    />
                    <Button type="primary" style={{ backgroundColor: primaryColor, borderColor: primaryColor }} icon={<SendOutlined />} onClick={handleSend} />
                </div>
            </div>
            
            {!isOpen && (
                <Button 
                    type="primary" 
                    shape="circle" 
                    size="large" 
                    style={{ 
                        width: '60px', 
                        height: '60px', 
                        backgroundColor: primaryColor, 
                        borderColor: primaryColor,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                    icon={
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                            <FileTextOutlined style={{ fontSize: '26px' }} />
                            <RobotOutlined style={{ fontSize: '14px', position: 'absolute', bottom: 8, right: 8, backgroundColor: primaryColor, borderRadius: '50%', padding: '2px' }} />
                        </div>
                    }
                    onClick={() => setIsOpen(true)}
                />
            )}
        </div>
    );
};

export default ChatbotWidget;
