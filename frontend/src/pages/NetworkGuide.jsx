import React, { useState } from 'react';
import { 
  Network, 
  Wifi, 
  ShieldAlert, 
  Terminal, 
  CheckCircle2, 
  Server, 
  Laptop, 
  ArrowRight, 
  Copy, 
  Check, 
  ExternalLink 
} from 'lucide-react';

export default function NetworkGuide() {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: "Langkah 1: Hubungkan Kedua Perangkat ke Jaringan yang Sama (Wi-Fi / LAN)",
      description: "Pastikan laptop Anda (host database & backend) dan laptop mentor berada di subnet atau router Wi-Fi yang sama (misal sama-sama terhubung ke Wi-Fi kantor atau hotspot seluler).",
      command: "# Pada macOS / Linux:\nifconfig | grep \"inet \" | grep -v 127.0.0.1\n\n# Pada Windows (Command Prompt / PowerShell):\nipconfig",
      note: "Catat IPv4 Anda, misalnya: 192.168.1.50"
    },
    {
      title: "Langkah 2: Konfigurasi SQL Server TCP/IP Port",
      description: "Jika SQL Server berjalan langsung di Windows OS, pastikan protokol TCP/IP diaktifkan di SQL Server Configuration Manager dan mendengarkan port 1433 (Pusat) dan 1434 (Lokal). Jika berjalan di Docker container, Docker sudah otomatis mapping port 0.0.0.0:1433 dan 0.0.0.0:1434.",
      command: "# Verifikasi listener port di terminal host:\nnc -zv localhost 1433\nnc -zv localhost 1434",
      note: "Status harus menunjukkan 'Connection succeeded'."
    },
    {
      title: "Langkah 3: Buka Port pada Firewall Host",
      description: "Pastikan firewall di laptop Anda mengizinkan lalu lintas masuk (Inbound) untuk port database dan port backend API.",
      command: "# Port yang wajib dibuka di Firewall:\n- Port 8000 : FastAPI Backend REST API\n- Port 5173 : Vite Web Dashboard (Frontend)\n- Port 1433 : SQL Server Pusat\n- Port 1434 : SQL Server Lokal",
      note: "Pada macOS: Sistem Pengaturan ➔ Jaringan ➔ Firewall. Pada Windows: Windows Defender Firewall ➔ Advanced Settings ➔ Inbound Rules ➔ New Rule (Port)."
    },
    {
      title: "Langkah 4: Jalankan Backend & Frontend dengan Binding 0.0.0.0",
      description: "Backend FastAPI dan Frontend Vite harus dijalankan dengan host 0.0.0.0 agar dapat menerima koneksi dari perangkat luar (laptop mentor).",
      command: "# Menjalankan Backend API (Terminal 1):\npython3 run_backend.py\n\n# Menjalankan Frontend Web (Terminal 2):\ncd frontend && npm run dev -- --host 0.0.0.0",
      note: "Sistem telah dikonfigurasi dengan binding 0.0.0.0 secara default."
    },
    {
      title: "Langkah 5: Akses dari Laptop Mentor",
      description: "Dari laptop mentor, buka browser dan arahkan ke alamat IP laptop Anda.",
      command: "# Buka di browser laptop mentor:\nhttp://<IP_ANDA>:5173\n\n# Atau untuk melihat Swagger API Docs:\nhttp://<IP_ANDA>:8000/docs",
      note: "Contoh: http://192.168.1.50:5173"
    },
    {
      title: "Langkah 6: Uji Sinkronisasi Multi-Device (Simulasi DML)",
      description: "Lakukan pengujian langsung bersama mentor untuk memverifikasi keandalan mesin sinkronisasi.",
      command: "# 1. Buka halaman Config & Node Manager pada web\n# 2. Masukkan IP nyata SQL Server mentor pada Server Pusat atau Server Lokal\n# 3. Klik tombol 'Test Koneksi' untuk mengukur ping latensi\n# 4. Klik 'Sync Now (On-Demand)' dan amati Live Terminal Viewer!",
      note: "Setiap data INSERT, UPDATE perbedaan kolom, dan DELETE akan tercatat sejajar tanpa delay."
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(6, 182, 212, 0.2)',
            color: '#06b6d4',
            padding: '12px',
            borderRadius: 'var(--radius-md)'
          }}>
            <Network size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Panduan Integrasi & Pengujian Multi-Device (Tahap 2)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Prosedur teknis terstruktur untuk menghubungkan AgroSync Hub antar-device (laptop Anda & laptop mentor) dalam jaringan LAN/Wi-Fi nyata.
            </p>
          </div>
        </div>

        <span className="badge badge-info" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
          Deployment Strategy: Tahap 2
        </span>
      </div>

      {/* Network Architecture Diagram */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Topologi Jaringan Pengujian Multi-Device
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '20px',
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '24px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }}>
          {/* Laptop Anda */}
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <Laptop size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
            <h4 style={{ color: '#34d399', fontWeight: 700, fontSize: '0.92rem' }}>Laptop Anda (Host Server)</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '6px' }}>
              FastAPI (:8000) & Vite (:5173)<br />
              SQL Server Pusat (:1433)<br />
              IP: <code>192.168.x.x</code>
            </p>
          </div>

          {/* Wi-Fi / Router */}
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6, 182, 212, 0.25)', marginBottom: '8px' }}>
              <Wifi size={22} color="#06b6d4" style={{ margin: '0 auto 4px' }} />
              <div style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700 }}>LAN / WI-FI HUB</div>
            </div>
            <ArrowRight size={20} />
          </div>

          {/* Laptop Mentor */}
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <Laptop size={36} color="#6366f1" style={{ margin: '0 auto 10px' }} />
            <h4 style={{ color: '#818cf8', fontWeight: 700, fontSize: '0.92rem' }}>Laptop Mentor (Client / Node)</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '6px' }}>
              Web Dashboard Browser<br />
              SQL Server Lokal (:1434 atau :1433)<br />
              IP: <code>192.168.x.y</code>
            </p>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {steps.map((st, i) => (
          <div key={i} className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {st.title}
              </h4>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(st.command, i)}
                title="Salin Perintah"
              >
                {copiedIndex === i ? (
                  <>
                    <Check size={12} color="#10b981" />
                    <span style={{ color: '#10b981' }}>Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
              {st.description}
            </p>

            <div style={{
              background: '#080b12',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: '#34d399',
              whiteSpace: 'pre-wrap',
              marginBottom: '10px'
            }}>
              {st.command}
            </div>

            {st.note && (
              <div style={{ fontSize: '0.76rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={13} color="#fbbf24" />
                <span>Catatan: {st.note}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
