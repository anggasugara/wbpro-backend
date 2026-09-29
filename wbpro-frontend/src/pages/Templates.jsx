import { useEffect,useState } from "react";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { templatesApi } from "../api";

export default function Templates(){
 const [rows,setRows]=useState([]),[open,setOpen]=useState(false),[form,setForm]=useState({name:"",body:""}),[q,setQ]=useState(""),[error,setError]=useState("");
 const load=()=>templatesApi.list().then(r=>setRows(r.data)).catch(e=>setError(e.response?.data?.error||"Gagal memuat template."));
 useEffect(()=>{load()},[]);
 const add=async e=>{e.preventDefault();try{await templatesApi.create(form);setForm({name:"",body:""});setOpen(false);load()}catch(e){setError(e.response?.data?.error||"Gagal membuat template.")}};
 const remove=async id=>{if(!confirm("Hapus template ini?"))return;await templatesApi.remove(id);load()};
 const filtered=rows.filter(x=>`${x.name} ${x.body}`.toLowerCase().includes(q.toLowerCase()));
 return <div><div className="welcome"><div><span className="eyebrow">MESSAGING</span><h1>Templates</h1><p>Template pesan yang tersimpan di workspace.</p></div><button className="primary-btn small" onClick={()=>setOpen(true)}><Plus size={17}/> New Template</button></div>
 {open&&<div className="modal-backdrop"><form className="modal" onSubmit={add}><h2>New Template</h2>{error&&<div className="form-error">{error}</div>}<label>Nama<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="welcome_customer"/></label><label>Body<textarea required rows="6" value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Halo {nama}, selamat datang..."/></label><div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setOpen(false)}>Cancel</button><button className="primary-btn">Create</button></div></form></div>}
 <div className="panel"><div className="search-row"><div className="input-icon search"><Search size={17}/><input placeholder="Search templates..." value={q} onChange={e=>setQ(e.target.value)}/></div><span>{filtered.length} templates</span></div><div className="table-head"><div>Template</div><div>Body</div><div>Created</div><div>Action</div></div>{filtered.map(r=><div className="table-row" key={r.id}><div className="campaign"><div className="list-icon"><FileText size={16}/></div><strong>{r.name}</strong></div><div>{r.body.length>60?r.body.slice(0,60)+"…":r.body}</div><div>{new Date(r.createdAt).toLocaleDateString("id-ID")}</div><div><button className="icon-button" onClick={()=>remove(r.id)}><Trash2 size={16}/></button></div></div>)}{!filtered.length&&<div className="empty">Belum ada template.</div>}</div></div>
}