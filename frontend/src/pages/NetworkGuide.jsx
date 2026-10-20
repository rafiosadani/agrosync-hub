import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Wifi, 
  Server, 
  Laptop, 
  ArrowRight, 
  Copy, 
  Check, 
  Database,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function NetworkGuide() {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('database-setup');
  const [networkInfo, setNetworkInfo] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    api.getNetworkInfo().then(info => {
      if (info && (info.local_ip || info.status === 'success')) {
        setNetworkInfo(info);
      }
    }).catch(err => {
      console.debug("Gagal memuat network info di guide:", err);
    });
  }, []);

  const handleCopy = (text, key, label) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Disalin ke Clipboard', `${label}: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const localIp = networkInfo?.local_ip || '192.168.x.x';
  const localHostname = networkInfo?.local_hostname || 'host.local';
  const networkWebUrl = `http://${localIp}:5173`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '22px 26px',
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
            <Network size={30} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Pusat Panduan & Integrasi Jaringan (Knowledge Hub)
              </h2>
              <span className="badge badge-info" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                Panduan Resmi v1.0
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '4px', margin: 0 }}>
              Panduan interaktif langkah demi langkah untuk menghubungkan database node, solusi penanganan IP berubah, serta konfigurasi port multi-device.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/nodes')}
          >
            <Database size={13} />
            <span>Ke Config & Nodes</span>
          </button>
        </div>
      </div>

      {/* Live Device Status Banner */}
      <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-card-inner)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="pulse-dot pulse-dot-green" />
            <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              Status Jaringan Host Anda:
            </span>
            <span style={{
              background: 'rgba(56, 189, 248, 0.1)',
              color: '#0284c7',
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontFamily: 'var(--font-mono)'
            }}>
              IP: {localIp}
            </span>
            <span style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontFamily: 'var(--font-mono)'
            }}>
              Hostname: {localHostname}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Akses dari Laptop Lain di WiFi:</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleCopy(networkWebUrl, 'url', 'URL Akses Jaringan')}
              style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              {copiedKey === 'url' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{networkWebUrl}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Segmented Tab Navigation Bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        gap: '8px',
        paddingBottom: '2px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('database-setup')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'database-setup' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'database-setup' ? '1px solid var(--border-subtle)' : '1px solid transparent',
            borderBottom: activeTab === 'database-setup' ? '2px solid #0284c7' : '1px solid transparent',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            color: activeTab === 'database-setup' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'database-setup' ? 700 : 500,
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Database size={15} color={activeTab === 'database-setup' ? '#0284c7' : 'inherit'} />
          <span>1. Setup Node Database (Pusat ➔ Lokal)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ip-resolution')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'ip-resolution' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'ip-resolution' ? '1px solid var(--border-subtle)' : '1px solid transparent',
            borderBottom: activeTab === 'ip-resolution' ? '2px solid #10b981' : '1px solid transparent',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            color: activeTab === 'ip-resolution' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'ip-resolution' ? 700 : 500,
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Wifi size={15} color={activeTab === 'ip-resolution' ? '#10b981' : 'inherit'} />
          <span>2. Solusi IP Berubah (Hostname vs Tailscale)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('firewall-ports')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'firewall-ports' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'firewall-ports' ? '1px solid var(--border-subtle)' : '1px solid transparent',
            borderBottom: activeTab === 'firewall-ports' ? '2px solid #6366f1' : '1px solid transparent',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            color: activeTab === 'firewall-ports' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'firewall-ports' ? 700 : 500,
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Network size={15} color={activeTab === 'firewall-ports' ? '#6366f1' : 'inherit'} />
          <span>3. Topologi Jaringan & Port Firewall</span>
        </button>
      </div>

      {/* TAB 1: Setup Node Database */}
      {activeTab === 'database-setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Alur Setup Database Node Baru (Pusat ➔ Lokal)
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Ikuti 4 langkah mudah di bawah ini untuk menghubungkan database ERP Server Pusat ke SQL Server Lokal target Anda.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Step Card 1 */}
              <div style={{
                background: 'var(--bg-card-inner)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>1</span>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Identitas Perusahaan
                  </h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Masukkan nama kode entitas perusahaan (misal: <code>API</code>, <code>AGC</code>, atau <code>TTM</code>). Nama ini digunakan untuk mengelompokkan kartu transaksi di dashboard.
                </p>
              </div>

              {/* Step Card 2 */}
              <div style={{
                background: 'var(--bg-card-inner)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>2</span>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Tarik Batch dari Pusat
                  </h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Gunakan tombol <strong>"Tarik dari Server (Batch)"</strong>. Sistem akan langsung membaca daftar database nyata dari SQL Server Pusat via <code>sys.databases</code> tanpa perlu input satu per satu.
                </p>
              </div>

              {/* Step Card 3 */}
              <div style={{
                background: 'var(--bg-card-inner)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#f59e0b',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>3</span>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Auto-Mapping 1:1 & Buat DB
                  </h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Nama database di lokal otomatis dipetakan 1:1 sama dengan pusat. Jika database belum ada di server lokal, cukup klik tombol <strong>"Buat Database Otomatis"</strong> di modal.
                </p>
              </div>

              {/* Step Card 4 */}
              <div style={{
                background: 'var(--bg-card-inner)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#6366f1',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>4</span>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Migrasi DDL Skema (330+ Tabel)
                  </h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Setelah database lokal siap, buka menu <strong>Smart DDL Migration</strong> untuk membuat 330+ tabel dan skema kolom identik secara non-destruktif (*Zero Data Loss*).
                </p>
              </div>
            </div>

            <div style={{
              marginTop: '20px',
              padding: '14px 18px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={18} color="#0284c7" />
                <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                  Siap menambahkan database node pertama Anda sekarang?
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/nodes')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Buka Menu Config & Nodes</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Solusi IP Berubah */}
      {activeTab === 'ip-resolution' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Solusi Praktis Mengatasi Perubahan IP Jaringan (DHCP)
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Ketika laptop berpindah lokasi WiFi atau router restart, alamat IP angka (misal: <code>192.168.1.100</code>) sering berubah. Pilih salah satu dari 2 solusi enterprise di bawah ini agar koneksi tidak pernah terputus:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
              {/* Opsi 1: Hostname */}
              <div style={{
                background: 'var(--bg-card-inner)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Laptop size={20} color="#10b981" />
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Opsi 1: Hostname Komputer (.local)
                      </h4>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Tanpa Install Apapun</span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
                    Gunakan <strong>Nama Komputer (Hostname)</strong> alih-alih IP angka. Protokol mDNS (Multicast DNS) di Windows & Mac akan otomatis mencari IP baru di jaringan WiFi yang sama!
                  </p>

                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cara Cek Hostname di Windows (CMD/PowerShell):</span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#080b12',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      color: '#34d399',
                      marginTop: '4px'
                    }}>
                      <span>hostname</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('hostname', 'host_win', 'Perintah Hostname Windows')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Salin"
                      >
                        {copiedKey === 'host_win' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Format Input di AgroSync Hub:</span>
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      color: '#10b981',
                      marginTop: '4px'
                    }}>
                      WIN-SERVER-01,1433 atau MacBook.local,1434
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  ✓ Syarat: Kedua perangkat terhubung ke WiFi / LAN yang sama.
                </div>
              </div>

              {/* Opsi 2: Tailscale */}
              <div style={{
                background: 'var(--bg-card-inner)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={20} color="#6366f1" />
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Opsi 2: Tailscale Mesh VPN
                      </h4>
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Standar Enterprise & WFH</span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
                    Solusi terbaik jika Server Pusat di kantor dan laptop lokal di rumah (beda WiFi / WFH). Tailscale memberikan <strong>IP Virtual Statis Permanen (100.x.y.z)</strong> yang tidak akan pernah berubah.
                  </p>

                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Langkah Pemasangan Cepat:</span>
                    <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '18px', marginTop: '4px', lineHeight: 1.6 }}>
                      <li>Unduh di <a href="https://tailscale.com" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>tailscale.com</a> di kedua komputer.</li>
                      <li>Login dengan akun yang sama & nyalakan koneksi.</li>
                      <li>Salin IP Tailscale (contoh: <code>100.85.20.110</code>).</li>
                    </ul>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Format Input di AgroSync Hub:</span>
                    <div style={{
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      color: '#818cf8',
                      marginTop: '4px'
                    }}>
                      100.85.20.110,1433
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  ✓ Beda WiFi, tethering HP, maupun antar-kota tetap terhubung lancar.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Topologi LAN & Port Firewall */}
      {activeTab === 'firewall-ports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Architecture Card */}
          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Topologi Replikasi Hub-and-Spoke
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
              AgroSync Hub bertindak sebagai koordinator terpusat yang menghubungkan database SQL Server Pusat dengan berbagai server lokal cabang secara paralel.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              alignItems: 'center',
              gap: '16px',
              background: 'var(--bg-card-inner)',
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}>
              {/* Server Pusat */}
              <div style={{
                textAlign: 'center',
                padding: '16px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <Server size={30} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <h4 style={{ color: '#10b981', fontWeight: 700, fontSize: '0.88rem', margin: '0 0 4px' }}>Server Pusat (HQ Hub)</h4>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', lineHeight: 1.4 }}>
                  Port SQL Server: <code>1433</code><br />
                  Source of Truth ERP
                </div>
              </div>

              {/* Wi-Fi / Router */}
              <div style={{ textAlign: 'center', padding: '10px' }}>
                <div style={{
                  background: 'var(--bg-card)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  marginBottom: '8px',
                  display: 'inline-block'
                }}>
                  <Wifi size={20} color="#0284c7" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700 }}>LAN / WI-FI / MESH</div>
                </div>
                <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.74rem' }}>Port 1433 / 1434</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Server Lokal Target */}
              <div style={{
                textAlign: 'center',
                padding: '16px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}>
                <Laptop size={30} color="#6366f1" style={{ margin: '0 auto 8px' }} />
                <h4 style={{ color: '#6366f1', fontWeight: 700, fontSize: '0.88rem', margin: '0 0 4px' }}>Server Lokal (Branch Spokes)</h4>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', lineHeight: 1.4 }}>
                  Port Target: <code>1434</code> / <code>1435</code><br />
                  Dashboard Web: <code>:5173</code>
                </div>
              </div>
            </div>
          </div>

          {/* Port Matrix Table */}
          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Daftar Port Layanan & Firewall (Inbound Rules)
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 14px' }}>Port</th>
                    <th style={{ padding: '10px 14px' }}>Layanan</th>
                    <th style={{ padding: '10px 14px' }}>Protokol</th>
                    <th style={{ padding: '10px 14px' }}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10b981' }}>1433</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>SQL Server Pusat (Source)</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>TCP</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Wajib dibuka di Firewall host server pusat agar spoke dapat menarik data.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>1434 / 1435</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>SQL Server Lokal (Target)</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>TCP</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Listener instance lokal di laptop / server cabang untuk menerima INSERT/UPDATE.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f59e0b' }}>8000</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>FastAPI Backend REST API</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>HTTP</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Endpoint sinkronisasi engine & dokumentasi Swagger (<code>/docs</code>).</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#818cf8' }}>5173</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>Vite Web Dashboard UI</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>HTTP</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Antarmuka grafis yang dapat diakses dari browser komputer lain di jaringan LAN.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Test Connection Commands */}
            <div style={{ marginTop: '20px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Perintah Verifikasi Port Terbuka (Uji Socket Ping):
              </span>
              <div style={{
                background: '#080b12',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: '#34d399',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span>nc -zv {localIp} 1433</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy(`nc -zv ${localIp} 1433`, 'ping_cmd', 'Perintah Ping Port')}
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                >
                  {copiedKey === 'ping_cmd' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>Salin Perintah</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
