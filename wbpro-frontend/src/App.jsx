import { useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Bot, ChevronLeft, ChevronRight, FileText, LayoutDashboard,
  LogOut, Menu, MessageCircle, Megaphone, Moon, Settings, Smartphone, Sun,
  Users, X
} from "lucide-react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import WhatsApp from "./pages/WhatsApp";
import Broadcast from "./pages/Broadcast";
import Bots from "./pages/Bots";
import Templates from "./pages/Templates";
import Contacts from "./pages/Contacts";
import SettingsPage from "./pages/Settings";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/whatsapp", label: "WhatsApp", icon: Smartphone },
  { to: "/broadcast", label: "Broadcast", icon: Megaphone },
  { to: "/bots", label: "Bot Automation", icon: Bot },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings }
];

function Protected({ children }) {
  return localStorage.getItem("wbpro_token") ? children : <Navigate to="/login" replace />;
}

function Layout({ children, dark, setDark }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("wbpro_token");
    localStorage.removeItem("wbpro_user");
    navigate("/login");
  };

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><MessageCircle size={22} /></div>
          {!collapsed && <div><strong>WBPro</strong><span>WhatsApp Platform</span></div>}
          <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={20}/></button>
        </div>

        {!collapsed && <div className="menu-label">MAIN MENU</div>}
        <nav>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className="nav-item">
              <Icon size={19} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item ghost" onClick={() => setDark(v => !v)}>
            {dark ? <Sun size={19}/> : <Moon size={19}/>}
            {!collapsed && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
          </button>
          <button className="nav-item ghost danger" onClick={logout}>
            <LogOut size={19}/>{!collapsed && <span>Logout</span>}
          </button>
        </div>

        <button className="collapse" onClick={() => setCollapsed(v => !v)}>
          {collapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu/></button>
          <div>
            <div className="page-title">{nav.find(n => n.to === location.pathname)?.label || "WBPro"}</div>
            <div className="breadcrumb">Workspace / {nav.find(n => n.to === location.pathname)?.label || "Dashboard"}</div>
          </div>
          <div className="top-actions">
            <button className="icon-button" onClick={() => setDark(v => !v)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <div className="avatar">{(JSON.parse(localStorage.getItem("wbpro_user") || '{"name":"A"}').name || "A")[0].toUpperCase()}</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(localStorage.getItem("wbpro_dark") === "1");
  const toggleDark = (value) => {
    setDark(value);
    localStorage.setItem("wbpro_dark", value ? "1" : "0");
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={
        <Protected>
          <Layout dark={dark} setDark={toggleDark}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/whatsapp" element={<WhatsApp />} />
              <Route path="/broadcast" element={<Broadcast />} />
              <Route path="/bots" element={<Bots />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </Protected>
      } />
    </Routes>
  );
}