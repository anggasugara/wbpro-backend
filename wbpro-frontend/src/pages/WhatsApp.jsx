import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Link2, MoreHorizontal, Plus, Smartphone, Wifi, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { whatsappApi } from "../api";

const initialForm = { name: "", phone: "" };

export default function WhatsApp() {
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [qrAccount, setQrAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const load = async () => {
    try {
      const r = await whatsappApi.list();
      setAccounts(r.data);
    } catch (e) {
      setError(e.response?.data?.error || "Gagal memuat akun.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => timer.current && clearInterval(timer.current);
  }, []);

  const poll = (account) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const r = await whatsappApi.status(account.id);
        const data = r.data;
        setQrAccount((current) => current ? { ...current, ...data } : current);
        setAccounts((items) => items.map((a) => a.id === account.id ? { ...a, status: data.status } : a));
        if (data.status === "CONNECTED") {
          clearInterval(timer.current);
          timer.current = null;
          await load();
        }
      } catch {}
    }, 2000);
  };

  const add = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const r = await whatsappApi.create(form);
      setOpen(false);
      setForm(initialForm);
      await load();
      await connect(r.data);
    } catch (e) {
      setError(e.response?.data?.error || "Gagal menambahkan akun.");
    }
  };

  const connect = async (account) => {
    setBusy(true);
    setError("");
    try {
      const r = await whatsappApi.connect(account.id);
      setQrAccount({ ...account, ...r.data });
      poll(account);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Gagal memulai koneksi WhatsApp.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (account) => {
    setBusy(true);
    try {
      await whatsappApi.disconnect(account.id);
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setQrAccount(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Gagal memutuskan WhatsApp.");
    } finally {
      setBusy(false);
    }
  };

  return <div>
    <div className="welcome">
      <div><span className="eyebrow">CHANNELS</span><h1>WhatsApp</h1><p>Hubungkan WhatsApp langsung melalui QR, tanpa BSP.</p></div>
      <button className="primary-btn small" onClick={() => setOpen(true)}><Plus size={17}/> Add WhatsApp</button>
    </div>

    {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

    {open && <div className="modal-backdrop" onClick={() => setOpen(false)}><form className="modal" onClick={e => e.stopPropagation()} onSubmit={add}>
      <h2>Tambah WhatsApp</h2><p>Setelah disimpan, WBPro akan membuka QR untuk ditautkan ke WhatsApp Anda.</p>
      <label>Nama<input required value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Main Business" /></label>
      <label>Nomor WhatsApp<input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="62812xxxx" /><small>Opsional; nomor akan diperbarui setelah WhatsApp terhubung.</small></label>
      <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setOpen(false)}>Cancel</button><button className="primary-btn">Simpan & Hubungkan</button></div>
    </form></div>}

    <div className="connection-banner"><div className="banner-icon"><Link2 /></div><div><strong>WhatsApp Web Connector</strong><span>Tidak menggunakan BSP atau WhatsApp Cloud API. Scan QR dari WhatsApp → Perangkat tertaut.</span></div><span className="status-pill success">QR CONNECT</span></div>

    {loading ? <div className="panel empty">Memuat akun...</div> : <div className="cards-grid">
      {accounts.map(a => <div className="panel account" key={a.id}>
        <div className="account-head"><div className="phone-icon"><Smartphone/></div><button className="icon-button"><MoreHorizontal size={18}/></button></div>
        <h3>{a.name}</h3><p>{a.phone || "Nomor belum terbaca"}</p>
        <div className={`account-status ${a.status === "CONNECTED" ? "connected" : ""}`}>
          {a.status === "CONNECTED" ? <CheckCircle2 size={16}/> : <Wifi size={16}/>} {a.status}
        </div>
        <div className="account-meta">Connector: Baileys / WhatsApp Web</div>
        <div className="modal-actions" style={{ marginTop: 14 }}>
          {a.status === "CONNECTED" ? <button className="outline-btn" onClick={() => disconnect(a)} disabled={busy}><XCircle size={15}/> Disconnect</button> : <button className="primary-btn" onClick={() => connect(a)} disabled={busy}><Link2 size={15}/> {a.status === "QR_READY" ? "Tampilkan QR" : "Hubungkan"}</button>}
        </div>
      </div>)}
      {!accounts.length && <div className="panel empty">Belum ada akun WhatsApp. Klik “Add WhatsApp” untuk mulai.</div>}
    </div>}

    {qrAccount && qrAccount.status !== "CONNECTED" && <div className="modal-backdrop" onClick={() => setQrAccount(null)}><div className="modal qr-modal" onClick={e => e.stopPropagation()}>
      <button className="qr-close" onClick={() => setQrAccount(null)}><XCircle size={20}/></button>
      <h2>Hubungkan WhatsApp</h2><p>Buka <b>WhatsApp → Perangkat tertaut → Tautkan perangkat</b>, lalu scan QR di bawah.</p>
      {qrAccount.qr ? <div className="qr-box"><QRCodeSVG value={qrAccount.qr} size={280} includeMargin /></div> : <div className="qr-loading">Menunggu QR dari WhatsApp…</div>}
      <div className="account-status"><Wifi size={16}/> {qrAccount.status}</div>
      <small>QR dapat berubah otomatis. Jangan bagikan QR ini kepada orang lain.</small>
    </div></div>}
  </div>;
}
