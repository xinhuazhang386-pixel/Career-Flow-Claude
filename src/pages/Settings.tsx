import React, { useState, useEffect } from 'react';
import { User, Mail, ShieldCheck, Bell, Layout, SortAsc, LogOut, Camera, CheckCircle2, Globe, Moon, Smartphone, Key, Eye, EyeOff, Zap, Loader2, Server } from 'lucide-react';
import { motion } from 'motion/react';
import PageHeader from '../components/ui/PageHeader';
import { SafeInput } from '../components/ui/SafeInput';
import { storage } from '../lib/storage';
import { STORAGE_KEYS } from '../lib/storageKeys';
import { UserSettings, ApiSettings } from '../types';

const INITIAL_SETTINGS: UserSettings = {
  userName: '求职者用户',
  email: 'zhouyang021011@gmail.com',
  theme: 'light',
};

const Settings = () => {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');
  const [isSaved, setIsSaved] = useState(false);

  // API 配置
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('https://api.openai.com');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
  const [apiSaved, setApiSaved] = useState(false);

  useEffect(() => {
    const saved = storage.getData(STORAGE_KEYS.USER_SETTINGS);
    if (saved) setSettings(saved);
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.API_SETTINGS);
      if (raw) {
        const s: ApiSettings = JSON.parse(raw);
        if (s.apiKey) setApiKey(s.apiKey);
        if (s.apiUrl) setApiUrl(s.apiUrl);
      }
    } catch (e) { /* ignore */ }
  }, []);

  const handleSave = () => {
    storage.setData(STORAGE_KEYS.USER_SETTINGS, settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleSaveApiSettings = () => {
    const apiSettings: ApiSettings = {
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim() || 'https://api.openai.com',
    };
    localStorage.setItem(STORAGE_KEYS.API_SETTINGS, JSON.stringify(apiSettings));
    setApiSaved(true);
    setTimeout(() => setApiSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) { setTestResult('fail'); setTimeout(() => setTestResult(null), 3000); return; }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say OK' }],
          temperature: 0,
          apiKey: apiKey.trim(),
          apiUrl: apiUrl.trim() || 'https://api.openai.com',
        }),
      });
      setTestResult(res.ok ? 'success' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  const tabs = [
    { id: 'profile', label: '账户信息', icon: User },
    { id: 'preferences', label: '偏好设置', icon: Layout },
  ] as const;

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <PageHeader title="设置" description="管理你的账户信息和应用偏好" icon={Layout} />

      <div className="mt-8 flex gap-8">
        <div className="w-56 shrink-0">
          <div className="bg-gray-100/80 backdrop-blur-sm rounded-3xl p-3 flex flex-col gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-white hover:text-gray-900'}`}>
                  <Icon size={20} />{tab.label}
                </button>
              );
            })}
            <hr className="border-gray-200/60 mx-2 my-1" />
            <button className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold text-red-500 hover:bg-white hover:text-red-600 transition-all">
              <LogOut size={20} />退出登录
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === 'profile' ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center gap-6 mb-10">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {settings.userName.charAt(0)}
                  </div>
                  <button className="absolute -bottom-1 -right-1 bg-white p-2.5 rounded-full shadow-md hover:shadow-lg transition-shadow border border-gray-100">
                    <Camera size={16} className="text-gray-500" />
                  </button>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{settings.userName}</h2>
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1 mt-1">
                    <ShieldCheck size={14} />已登录
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{settings.email}</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">用户昵称</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={settings.userName}
                      onChange={(e) => setSettings(p => ({ ...p, userName: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">电子邮箱</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={settings.email}
                      onChange={(e) => setSettings(p => ({ ...p, email: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-50">
                <button onClick={handleSave}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center gap-2">
                  {isSaved ? <><CheckCircle2 size={18} />已保存</> : '保存修改'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ====== AI 服务配置卡片 ====== */}
              <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Key size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">AI 服务配置</h2>
                    <p className="text-sm text-gray-500 mt-0.5">配置你的 OpenAI API Key 来启用所有 AI 功能</p>
                  </div>
                </div>

                {/* API Key */}
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">OpenAI API Key</label>
                  <div className="relative">
                    <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showApiKey ? 'text' : 'password'} value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)} placeholder="sk-proj-..."
                      className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm" />
                    <button onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {!apiKey && (
                    <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <Zap size={12} />尚未配置 API Key，所有 AI 功能将无法使用
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    API Key 仅存储在浏览器本地。<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">获取 OpenAI API Key →</a>
                  </p>
                </div>

                {/* API URL */}
                <div className="mt-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="flex items-center gap-1.5"><Server size={14} />API 地址（可选）</span>
                  </label>
                  <input type="text" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.openai.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-mono" />
                  <p className="mt-1.5 text-xs text-gray-400">默认 OpenAI 官方。如用中转服务（如 gptsapi.net），改为对应地址。</p>
                </div>

                {/* 按钮 */}
                <div className="mt-6 flex items-center gap-3">
                  <button onClick={handleTestConnection} disabled={isTesting || !apiKey.trim()}
                    className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isTesting ? <><Loader2 size={16} className="animate-spin" />测试中...</> : <><Zap size={16} />测试连接</>}
                  </button>
                  <button onClick={handleSaveApiSettings}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-100 transition-all flex items-center gap-2">
                    {apiSaved ? <><CheckCircle2 size={18} />已保存</> : '保存 API 配置'}
                  </button>
                </div>

                {testResult && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${testResult === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {testResult === 'success'
                      ? <><CheckCircle2 size={16} />连接成功！AI 功能已就绪。</>
                      : <><Zap size={16} />连接失败。请检查 API Key 和地址是否正确。</>}
                  </motion.div>
                )}
              </div>

              {/* 其他偏好 */}
              <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6">应用偏好</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-5 border-b border-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Layout size={20} className="text-blue-600" /></div>
                      <div><p className="font-semibold text-gray-800">默认启动页</p><p className="text-sm text-gray-500">设置打开应用时显示的首页</p></div>
                    </div>
                    <select className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                      <option>首页 (Home)</option><option>工作台 (Workspace)</option><option>投递管理 (Tracker)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-5 border-b border-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><SortAsc size={20} className="text-purple-600" /></div>
                      <div><p className="font-semibold text-gray-800">列表排序方式</p><p className="text-sm text-gray-500">简历与投递列表的默认排序</p></div>
                    </div>
                    <select className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                      <option>按更新时间</option><option>按创建时间</option><option>按名称 A-Z</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-5 border-b border-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><Bell size={20} className="text-green-600" /></div>
                      <div><p className="font-semibold text-gray-800">面试提醒</p><p className="text-sm text-gray-500">面试前发送系统通知</p></div>
                    </div>
                    <div className="w-12 h-7 bg-gray-200 rounded-full cursor-pointer relative"><div className="w-5 h-5 bg-white rounded-full absolute top-1 left-1 shadow transition-all" /></div>
                  </div>
                  <div className="flex items-center justify-between py-5 border-b border-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Moon size={20} className="text-indigo-600" /></div>
                      <div><p className="font-semibold text-gray-800">深色模式</p><p className="text-sm text-gray-500">切换视觉主题（开发中）</p></div>
                    </div>
                    <div className="w-12 h-7 bg-gray-200 rounded-full cursor-not-allowed relative opacity-50"><div className="w-5 h-5 bg-white rounded-full absolute top-1 left-1 shadow" /></div>
                  </div>
                  <div className="flex items-center justify-between py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center"><Smartphone size={20} className="text-teal-600" /></div>
                      <div><p className="font-semibold text-gray-800">移动端同步</p><p className="text-sm text-gray-500">移动端 App 正在开发中，敬请期待。</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
