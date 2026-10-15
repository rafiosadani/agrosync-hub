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
  Laptop
} from 'lucide-react';
import Modal from './Modal';
import { api } from '../api';
import { useToast } from './Toast';

export default function SubnetScannerModal({ isOpen, onClose, networkInfo, configs, onNodeUpdated }) {
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pindai Instance SQL Server di Jaringan Lokal (WiFi)"
      subtitle="Otomatis mendeteksi perangkat dan laptop mentor yang membuka port 1433 dalam 1.5 detik"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Info Network Banner */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP Laptop Anda</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399', fontFamily: 'monospace' }}>
              {networkInfo?.local_ip || '127.0.0.1'}
            </div>
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
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: isMyLaptop ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            background: isMyLaptop ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isMyLaptop ? '#38bdf8' : '#34d399',
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            {isMyLaptop ? <Laptop size={16} /> : <Server size={16} />}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                {dev.ip}:1433
                              </span>
                              {isMyLaptop && (
                                <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                  Laptop Anda
                                </span>
                              )}
                              {!isMyLaptop && (
                                <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                  Device Jaringan / Mentor
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Latency TCP: <strong style={{ color: '#34d399' }}>{dev.latency_ms} ms</strong>
                              {dev.hostname && <span> • Hostname: {dev.hostname}</span>}
                            </div>
                          </div>
                        </div>

                        <span className="badge badge-success">
                          Port 1433 Terbuka
                        </span>
                      </div>

                      {/* Matched Node Options & Quick Update Buttons */}
                      {configs && configs.length > 0 && !isMyLaptop && (
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          border: '1px solid rgba(255, 255, 255, 0.06)'
                        }}>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Terapkan IP ini ke konfigurasi node:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {configs.map((cfg) => {
                              const isAlreadyPusat = cfg.ServerPusat && cfg.ServerPusat.includes(dev.ip);
                              const targetAddr = `${dev.ip},1433`;

                              return (
                                <div key={cfg.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={isAlreadyPusat || updatingId !== null}
                                    onClick={() => handleApplyAddress(cfg.id, 'pusat', targetAddr, cfg.CompanyName)}
                                    style={{
                                      fontSize: '0.72rem',
                                      padding: '4px 8px',
                                      borderColor: isAlreadyPusat ? 'rgba(16, 185, 129, 0.4)' : undefined,
                                      color: isAlreadyPusat ? '#34d399' : undefined
                                    }}
                                  >
                                    {isAlreadyPusat ? (
                                      <>
                                        <Check size={12} />
                                        <span>Aktif di Pusat [{cfg.CompanyName}]</span>
                                      </>
                                    ) : (
                                      <>
                                        <ArrowRight size={12} />
                                        <span>Set ke Pusat [{cfg.CompanyName}]</span>
                                      </>
                                    )}
                                  </button>
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
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: 'var(--radius-md)'
              }}>
                <AlertTriangle size={32} color="#fbbf24" style={{ margin: '0 auto 10px auto' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Tidak Ada Instance SQL Server yang Merespon
                </div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                  Pastikan SQL Server di laptop mentor sudah dijalankan dan fitur TCP/IP di SQL Server Configuration Manager berstatus Enabled.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
