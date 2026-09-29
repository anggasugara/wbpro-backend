import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, MessageCircle } from "lucide-react";
import { authApi } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try { const { data } = await authApi.login(form); localStorage.setItem("wbpro_token", data.token); localStorage.setItem("wbpro_user", JSON.stringify(data.user)); navigate("/", { replace: true }); }
    catch (err) { setError(err.response?.data?.error || "Login gagal. Periksa email dan password."); }
    finally { setLoading(false); }
  };
  return <AuthShell title="Selamat datang kembali" subtitle="Masuk ke dashboard WBPro Anda.">
    <form onSubmit={submit} className="auth-form">
      {error && <div className="form-error">{error}</div>}
      <label>Email <div className="input-icon"><Mail size={18}/><input required type="email" placeholder="nama@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div></label>
      <label>Password <div className="input-icon"><LockKeyhole size={18}/><input required type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div></label>
      <button className="primary-btn" disabled={loading}>{loading ? "Memproses..." : <>Masuk <ArrowRight size={18}/></>}</button>
    </form>
    <p className="auth-footer">Belum punya akun? <Link to="/register">Daftar sekarang</Link></p>
  </AuthShell>;
}

export function AuthShell({ title, subtitle, children }) {
  return <div className="auth-page"><div className="auth-visual"><div className="auth-brand"><MessageCircle/> WBPro</div><div className="visual-copy"><span className="eyebrow">WHATSAPP BUSINESS PLATFORM</span><h1>Kelola komunikasi pelanggan dalam satu tempat.</h1><p>Hubungkan WhatsApp, kelola kontak, campaign, template, dan automation dari satu dashboard.</p></div><div className="visual-card"><MessageCircle size={20}/><div><strong>Workspace aktif</strong><span>Semua operasional WhatsApp Anda.</span></div><span className="online-dot"/></div></div><div className="auth-panel"><div className="auth-box"><h2>{title}</h2><p>{subtitle}</p>{children}</div></div></div>;
}
