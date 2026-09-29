import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { authApi } from "../api";
import { AuthShell } from "./Login";

export default function Register() {
  const navigate=useNavigate(); const [form,setForm]=useState({workspaceName:"",name:"",email:"",password:""}); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  const update=k=>e=>setForm({...form,[k]:e.target.value});
  const submit=async e=>{e.preventDefault();setError("");setLoading(true);try{const {data}=await authApi.register(form);localStorage.setItem("wbpro_token",data.token);localStorage.setItem("wbpro_user",JSON.stringify(data.user));navigate("/",{replace:true});}catch(err){setError(err.response?.data?.error||"Registrasi gagal.");}finally{setLoading(false);}};
  return <AuthShell title="Buat akun WBPro" subtitle="Buat workspace baru untuk bisnis Anda."><form onSubmit={submit} className="auth-form">{error&&<div className="form-error">{error}</div>}<label>Nama Workspace<div className="input-icon"><Building2 size={18}/><input required minLength="2" placeholder="Nama bisnis" value={form.workspaceName} onChange={update("workspaceName")}/></div></label><label>Nama<div className="input-icon"><UserRound size={18}/><input required minLength="2" placeholder="Nama Anda" value={form.name} onChange={update("name")}/></div></label><label>Email<div className="input-icon"><Mail size={18}/><input required type="email" placeholder="nama@email.com" value={form.email} onChange={update("email")}/></div></label><label>Password<div className="input-icon"><LockKeyhole size={18}/><input required minLength="8" type="password" placeholder="Minimal 8 karakter" value={form.password} onChange={update("password")}/></div></label><button className="primary-btn" disabled={loading}>{loading?"Membuat akun...":<>Buat Akun <ArrowRight size={18}/></>}</button></form><p className="auth-footer">Sudah punya akun? <Link to="/login">Masuk</Link></p></AuthShell>;
}
