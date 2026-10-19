import React, { useState } from 'react';
import { 
  Radar, 
  Search, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight, 
  Wifi, 
  Check, 
  X,
  Laptop,
  Copy,
  Zap
} from 'lucide-react';
import Modal from './Modal';
import { api } from '../api';
import { useToast } from './Toast';

export default function SubnetScannerModal({ 
  isOpen, 
  onClose, 
  networkInfo, 
  configs, 
  onNodeUpdated, 
  onSelectHost = null, 
  targetRole = 'pusat' 
}) {
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Disalin ke Clipboard', `${label}: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleStartScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const data = await api.scanSubnet({
        subnet_prefix: networkInfo?.subnet_prefix,
        port: 1433
      });
      setScanResult(data);
      if (data.total_found > 0) {
        toast.success(
          'Pemindaian Selesai', 
          `Ditemukan ${data.total_found} instance SQL Server di subnet ${data.scanned_subnet} (${data.duration_seconds}s).`
        );
      } else {
        toast.info(
          'Tidak Ada Instance', 
          `Tidak ditemukan port 1433 yang terbuka di subnet ${data.scanned_subnet}.`
        );
      }
    } catch (err) {
      toast.error('Gagal Memindai', err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleApplyAddress = async (nodeId, role, newAddress, companyName) => {
    setUpdatingId(`${nodeId}-${role}`);
    try {
      await api.updateNodeAddress({
        node_id: nodeId,
        role: role,
        new_address: newAddress
      });
      toast.success(
        'Alamat Diperbarui', 
        `Alamat Server ${role.toUpperCase()} untuk node [${companyName}] berhasil diubah ke ${newAddress}.`
      );
      onNodeUpdated?.();
      onClose();
    } catch (err) {
      toast.error('Gagal Memperbarui Alamat', err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSelectAndClose = (chosenAddress) => {
    if (onSelectHost) {
      onSelectHost(chosenAddress, targetRole);
      toast.success(
        'Alamat Diterapkan', 
        `Host Server ${targetRole === 'pusat' ? 'Pusat' : 'Lokal'} diisi: ${chosenAddress}`
      );
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pindai Instance SQL Server di Jaringan Lokal (WiFi)"
      subtitle="Otomatis mendeteksi perangkat dan SQL Server yang membuka port 1433 dalam 1.5 detik"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Info Network Banner */}
        <div style={{
          background: 'var(--bg-card-inner)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              padding: '10px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wifi size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Subnet Jaringan WiFi Anda</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {networkInfo?.subnet_cidr || '192.168.2.0/24'} (Port 1433)
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP & Hostname Anda</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399', fontFamily: 'monospace' }}>
                {networkInfo?.local_ip || scanResult?.local_machine_ip || '192.168.2.99'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(networkInfo?.local_ip || scanResult?.local_machine_ip || '192.168.2.99', 'my-ip', 'IP Laptop Anda')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Salin IP Laptop Anda"
              >
                {copiedKey === 'my-ip' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
              </button>
            </div>
            {networkInfo?.local_hostname && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {networkInfo.local_hostname}
              </div>
            )}
          </div>
        </div>

        {/* Scan Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartScan}
            disabled={scanning}
            style={{
              padding: '12px 28px',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            {scanning ? (
              <>
                <RefreshCw size={18} className="spin" />
                <span>Memindai 254 IP Subnet...</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>Mulai Pemindaian Otomatis Port 1433</span>
              </>
            )}
          </button>
        </div>

        {/* Scan Results Area */}
        {scanResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '8px'
            }}>
              <span>Hasil Pemindaian ({scanResult.devices?.length || 0} Perangkat Ditemukan)</span>
              <span>Waktu Eksekusi: <strong style={{ color: 'var(--text-primary)' }}>{scanResult.duration_seconds}s</strong></span>
            </div>

            {scanResult.devices && scanResult.devices.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                {scanResult.devices.map((dev, idx) => {
                  const isMyLaptop = dev.ip === networkInfo?.local_ip;

                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-card-inner)',
                        border: isMyLaptop ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: 'var(--shadow-card, var(--shadow-sm))'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            background: isMyLaptop ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isMyLaptop ? '#38bdf8' : '#10b981',
                            padding: '8px',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            {isMyLaptop ? <Laptop size={18} /> : <Server size={18} />}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.98rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                {dev.ip}:1433
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(`${dev.ip},1433`, `ip-${idx}`, 'Alamat IP:Port')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title="Salin IP:Port"
                              >
                                {copiedKey === `ip-${idx}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                              </button>
                              {isMyLaptop && (
                                <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                  Laptop Anda
                                </span>
                              )}
                              {!isMyLaptop && (
                                <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                  Device Jaringan (Server Pusat)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>Latency TCP: <strong style={{ color: '#10b981' }}>{dev.latency_ms} ms</strong></span>
                              {(dev.hostname || dev.mdns_hostname) && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span>• Hostname: <strong style={{ color: '#0284c7' }}>{dev.hostname || dev.mdns_hostname}</strong> ({dev.mdns_hostname || `${dev.hostname}.local`})</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(dev.mdns_hostname || `${dev.hostname}.local`, `host-${idx}`, 'Hostname mDNS')}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: '2px',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                    title="Salin Hostname"
                                  >
                                    {copiedKey === `host-${idx}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="badge badge-success">
                          Port 1433 Terbuka
                        </span>
                      </div>

                      {/* MODE 1: Pilihan Cepat untuk Form Modal Node (Auto-fill & Auto-close) */}
                      {onSelectHost && (
                        <div style={{
                          background: 'var(--bg-card)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 14px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Pilih untuk Server {targetRole === 'pusat' ? 'Pusat' : 'Lokal'}:
                          </span>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSelectAndClose(`${dev.ip},1433`)}
                              style={{ fontSize: '0.74rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              title={`Gunakan IP ${dev.ip},1433 dan langsung terapkan ke form`}
                            >
                              <Zap size={13} />
                              <span>Gunakan IP ({dev.ip},1433)</span>
                            </button>
                            {(dev.mdns_hostname || dev.hostname) && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSelectAndClose(`${dev.mdns_hostname || `${dev.hostname}.local`},1433`)}
                                style={{ fontSize: '0.74rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', borderColor: 'rgba(56, 189, 248, 0.35)' }}
                                title={`Gunakan Hostname ${dev.mdns_hostname || `${dev.hostname}.local`},1433 dan langsung terapkan ke form`}
                              >
                                <Wifi size={13} />
                                <span>Gunakan Hostname ({dev.mdns_hostname || `${dev.hostname}.local`},1433)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* MODE 2: Terapkan ke Konfigurasi Database Node yang Ada */}
                      {!onSelectHost && configs && configs.length > 0 && !isMyLaptop && (
                        <div style={{
                          background: 'var(--bg-card)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 14px',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>
                            Terapkan IP / Hostname ke Konfigurasi Database:
                          </div>

                          {/* Penjelasan Edukatif Maksud Set IP & Set Hostname */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '10px',
                            background: 'var(--bg-subtle)',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            lineHeight: 1.4
                          }}>
                            <div>📌 <strong>Set IP:</strong> Menerapkan nomor IP langsung (<code>{dev.ip},1433</code>) ke server pusat node database terpilih.</div>
                            <div>🌐 <strong>Set Hostname:</strong> Menerapkan nama hostname mDNS (<code>{(dev.mdns_hostname || (dev.hostname ? `${dev.hostname}.local` : 'WIN-SERVER-01.local'))},1433</code>) agar koneksi tetap terhubung otomatis meskipun IP server pusat berganti di WiFi.</div>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {configs.map((cfg) => {
                              const devHost = dev.hostname || '';
                              const devMdns = dev.mdns_hostname || (devHost ? `${devHost}.local` : '');
                              const isAlreadyPusatIp = cfg.ServerPusat && cfg.ServerPusat.includes(dev.ip);
                              const isAlreadyPusatHost = devHost && cfg.ServerPusat && cfg.ServerPusat.includes(devHost);
                              const targetAddr = `${dev.ip},1433`;
                              const targetHostAddr = devMdns ? `${devMdns},1433` : null;
                              const nodeLabel = `${cfg.CompanyName}: ${cfg.DatabasePusat}`;

                              return (
                                <div key={cfg.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={isAlreadyPusatIp || updatingId !== null}
                                    onClick={() => handleApplyAddress(cfg.id, 'pusat', targetAddr, nodeLabel)}
                                    title={isAlreadyPusatIp ? `Node [${nodeLabel}] sudah memakai IP ini` : `Pasang IP ${targetAddr} ke node [${nodeLabel}]`}
                                    style={{
                                      fontSize: '0.72rem',
                                      padding: '5px 9px',
                                      borderColor: isAlreadyPusatIp ? 'rgba(16, 185, 129, 0.4)' : undefined,
                                      color: isAlreadyPusatIp ? '#10b981' : undefined
                                    }}
                                  >
                                    {isAlreadyPusatIp ? (
                                      <>
                                        <Check size={12} />
                                        <span>Aktif IP [{nodeLabel}]</span>
                                      </>
                                    ) : (
                                      <>
                                        <ArrowRight size={12} />
                                        <span>Set IP [{nodeLabel}]</span>
                                      </>
                                    )}
                                  </button>

                                  {targetHostAddr && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      disabled={isAlreadyPusatHost || updatingId !== null}
                                      onClick={() => handleApplyAddress(cfg.id, 'pusat', targetHostAddr, nodeLabel)}
                                      title={isAlreadyPusatHost ? `Node [${nodeLabel}] sudah memakai Hostname ini` : `Pasang Hostname ${targetHostAddr} ke node [${nodeLabel}]`}
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '5px 9px',
                                        borderColor: isAlreadyPusatHost ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.25)',
                                        color: isAlreadyPusatHost ? '#0284c7' : '#0284c7'
                                      }}
                                    >
                                      {isAlreadyPusatHost ? (
                                        <>
                                          <Check size={12} />
                                          <span>Aktif Hostname [{nodeLabel}]</span>
                                        </>
                                      ) : (
                                        <>
                                          <ArrowRight size={12} />
                                          <span>Set Hostname [{nodeLabel}]</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '30px 20px',
                color: 'var(--text-muted)',
                background: 'var(--bg-card-inner)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)'
              }}>
                <AlertTriangle size={32} color="#fbbf24" style={{ margin: '0 auto 10px auto' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Tidak Ada Instance SQL Server yang Merespon
                </div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                  Pastikan SQL Server di Server Pusat sudah dijalankan dan fitur TCP/IP di SQL Server Configuration Manager berstatus Enabled.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
