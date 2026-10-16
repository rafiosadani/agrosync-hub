import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Server, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ShieldCheck, 
  HelpCircle,
  Database,
  AlertTriangle,
  Radar,
  Wifi
} from 'lucide-react';
import Modal from '../components/Modal';
import SubnetScannerModal from '../components/SubnetScannerModal';
import { api } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

export default function NodeManager({ configs, onRefreshConfigs }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [networkInfo, setNetworkInfo] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    api.getNetworkInfo().then(info => {
      if (info && (info.local_ip || info.status === 'success')) {
        setNetworkInfo(info);
      }
    }).catch(err => {
      console.debug("Gagal memuat network info:", err);
    });
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    CompanyName: '',
    ServerPusat: '',
    DatabasePusat: '',
    UserPusat: 'sa',
    PasswordPusat: '',
    ServerLokal: '',
    DatabaseLokal: '',
    UserLokal: 'sa',
    PasswordLokal: ''
  });

  // Test connection state in modal
  const [testingPusat, setTestingPusat] = useState(false);
  const [resultPusat, setResultPusat] = useState(null);
  const [creatingDbPusat, setCreatingDbPusat] = useState(false);

  const [testingLokal, setTestingLokal] = useState(false);
  const [resultLokal, setResultLokal] = useState(null);
  const [creatingDbLokal, setCreatingDbLokal] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [showModalPassPusat, setShowModalPassPusat] = useState(false);
  const [showModalPassLokal, setShowModalPassLokal] = useState(false);

  const togglePasswordVisibility = (nodeId, field) => {
    const key = `${nodeId}-${field}`;
    setRevealedPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenAddModal = () => {
    setEditingNodeId(null);
    setShowModalPassPusat(false);
    setShowModalPassLokal(false);
    setFormData({
      CompanyName: '',
      ServerPusat: '',
      DatabasePusat: '',
      UserPusat: '',
      PasswordPusat: '',
      ServerLokal: '',
      DatabaseLokal: '',
      UserLokal: '',
      PasswordLokal: ''
    });
    setResultPusat(null);
    setResultLokal(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node) => {
    setEditingNodeId(node.id);
    setShowModalPassPusat(false);
    setShowModalPassLokal(false);
    setFormData({
      CompanyName: node.CompanyName,
      ServerPusat: node.ServerPusat,
      DatabasePusat: node.DatabasePusat,
      UserPusat: node.UserPusat,
      PasswordPusat: '', // biarkan kosong jika tidak ingin ubah password
      ServerLokal: node.ServerLokal,
      DatabaseLokal: node.DatabaseLokal,
      UserLokal: node.UserLokal,
      PasswordLokal: ''
    });
    setResultPusat(null);
    setResultLokal(null);
    setIsModalOpen(true);
  };

  const handleTestPusat = async () => {
    if (!formData.ServerPusat || !formData.DatabasePusat || !formData.UserPusat) {
      toast.warning('Input Kurang Lengkap', 'Mohon lengkapi Server, Database, dan User Pusat terlebih dahulu.');
      return;
    }
    setTestingPusat(true);
    setResultPusat(null);
    try {
      const res = await api.testConnection(
        formData.ServerPusat,
        formData.DatabasePusat,
        formData.UserPusat,
        formData.PasswordPusat || '',
        editingNodeId,
        'pusat'
      );
      setResultPusat(res);
      if (res.success) {
        toast.success('Koneksi Pusat Berhasil', `Ping latency: ${res.latency_ms} ms`);
      } else {
        toast.error('Koneksi Pusat Gagal', res.message);
      }
    } catch (err) {
      setResultPusat({ success: false, message: err.message, latency_ms: 0 });
      toast.error('Koneksi Pusat Gagal', err.message);
    } finally {
      setTestingPusat(false);
    }
  };

  const handleTestLokal = async () => {
    if (!formData.ServerLokal || !formData.DatabaseLokal || !formData.UserLokal) {
      toast.warning('Input Kurang Lengkap', 'Mohon lengkapi Server, Database, dan User Lokal terlebih dahulu.');
      return;
    }
    setTestingLokal(true);
    setResultLokal(null);
    try {
      const res = await api.testConnection(
        formData.ServerLokal,
        formData.DatabaseLokal,
        formData.UserLokal,
        formData.PasswordLokal || '',
        editingNodeId,
        'lokal'
      );
      setResultLokal(res);
      if (res.success) {
        toast.success('Koneksi Lokal Berhasil', `Ping latency: ${res.latency_ms} ms`);
      } else {
        toast.error('Koneksi Lokal Gagal', res.message);
      }
    } catch (err) {
      setResultLokal({ success: false, message: err.message, latency_ms: 0 });
      toast.error('Koneksi Lokal Gagal', err.message);
    } finally {
      setTestingLokal(false);
    }
  };

  const handleCreateDatabase = async (target) => {
    const isPusat = target === 'pusat';
    const server = isPusat ? formData.ServerPusat : formData.ServerLokal;
    const database = isPusat ? formData.DatabasePusat : formData.DatabaseLokal;
    const user = isPusat ? formData.UserPusat : formData.UserLokal;
    const password = isPusat ? (formData.PasswordPusat || '••••••••') : (formData.PasswordLokal || '••••••••');

    if (!database) {
      toast.warning('Validasi Diperlukan', 'Nama database tidak boleh kosong!');
      return;
    }

    if (isPusat) setCreatingDbPusat(true);
    else setCreatingDbLokal(true);

    try {
      const res = await api.createDatabase(server, database, user, password);
      toast.success('Database Berhasil Dibuat', res.message);
      // Otomatis re-test koneksi agar status langsung hijau
      if (isPusat) {
        await handleTestPusat();
      } else {
        await handleTestLokal();
      }
    } catch (err) {
      toast.error('Gagal Membuat Database', err.message);
    } finally {
      if (isPusat) setCreatingDbPusat(false);
      else setCreatingDbLokal(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingNodeId !== null) {
        // Update Node
        const payload = { ...formData };
        if (!payload.PasswordPusat) delete payload.PasswordPusat;
        if (!payload.PasswordLokal) delete payload.PasswordLokal;
        await api.updateConfig(editingNodeId, payload);
        toast.success('Node Berhasil Diperbarui', `Konfigurasi ${formData.CompanyName} (${formData.DatabasePusat}) telah disimpan.`);
      } else {
        // Create Node
        if (!formData.PasswordPusat || !formData.PasswordLokal) {
          toast.warning('Input Wajib Diisi', 'Password Pusat dan Password Lokal wajib diisi untuk node baru!');
          setIsSaving(false);
          return;
        }
        await api.createConfig(formData);
        toast.success('Node Baru Ditambahkan', `Node ${formData.CompanyName} (${formData.DatabasePusat}) berhasil disimpan.`);
      }
      setIsModalOpen(false);
      onRefreshConfigs();
    } catch (err) {
      toast.error('Gagal Menyimpan Node', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (nodeId, company, db) => {
    const isConfirmed = await confirm({
      title: 'Hapus Konfigurasi Node',
      description: `Apakah Anda yakin ingin menghapus konfigurasi node ${company} (${db})? Tindakan ini akan memperbarui file sync_config.json dan menghentikan pemantauan node tersebut.`,
      confirmText: 'Hapus Node',
      variant: 'danger',
    });

    if (isConfirmed) {
      try {
        await api.deleteConfig(nodeId);
        toast.success('Node Dihapus', `Konfigurasi ${company} (${db}) berhasil dihapus.`);
        onRefreshConfigs();
      } catch (err) {
        toast.error('Gagal Menghapus Node', err.message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Manajemen Konfigurasi & Node Database
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            Kelola file <code>sync_config.json</code> enterprise secara aman melalui antarmuka web dengan fitur masking password otomatis dan auto-backup.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setIsScannerOpen(true)}>
            <Radar size={15} />
            <span>Scan WiFi</span>
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} />
            <span>Tambah Node Database</span>
          </button>
        </div>
      </div>

      {/* Nodes Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Perusahaan</th>
                <th>Server Pusat (Host, Port, DB)</th>
                <th>Kredensial Pusat</th>
                <th>Server Lokal (Host, Port, DB)</th>
                <th>Kredensial Lokal</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {configs && configs.length > 0 ? (
                configs.map((node) => (
                  <tr key={node.id}>
                    <td>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 800,
                        fontSize: '0.85rem'
                      }}>
                        {node.CompanyName}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{node.DatabasePusat}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{node.ServerPusat}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>User: <strong>{node.UserPusat}</strong></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span>Pass: ••••••••</span>
                        <ShieldCheck size={14} color="#10b981" title="Terenkripsi / Ter-masking" />
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{node.DatabaseLokal}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{node.ServerLokal}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>User: <strong>{node.UserLokal}</strong></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span>Pass: ••••••••</span>
                        <ShieldCheck size={14} color="#10b981" title="Terenkripsi / Ter-masking" />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEditModal(node)}
                          title="Edit Konfigurasi Node"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(node.id, node.CompanyName, node.DatabasePusat)}
                          title="Hapus Node"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Tidak ada konfigurasi database ditemukan. Klik "Tambah Node Database" untuk memulai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingNodeId !== null ? `Edit Node #${editingNodeId} (${formData.CompanyName})` : "Tambah Node Database Baru"}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Entitas Perusahaan (CompanyName)</label>
            <input
              type="text"
              className="form-input"
              required
              autoComplete="on"
              value={formData.CompanyName}
              onChange={(e) => setFormData({ ...formData, CompanyName: e.target.value.toUpperCase() })}
              placeholder="Contoh: API, AGC, TTM"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            {/* Box Konfigurasi Pusat */}
            <div style={{
              background: 'var(--bg-card-inner)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              boxShadow: 'var(--shadow-card, var(--shadow-sm))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', minHeight: '32px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Server Pusat (Source)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsScannerOpen(true)}
                    style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      borderColor: 'rgba(56, 189, 248, 0.3)',
                      color: '#0284c7',
                      padding: '4px 8px'
                    }}
                    title="Pindai port 1433 di subnet WiFi untuk menemukan IP & Hostname Server Pusat"
                  >
                    <Radar size={12} />
                    <span>Pindai Subnet</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleTestPusat}
                    disabled={testingPusat}
                  >
                    <RefreshCw size={12} className={testingPusat ? 'animate-spin' : ''} />
                    <span>{testingPusat ? 'Menguji...' : 'Test Koneksi'}</span>
                  </button>
                </div>
              </div>

              {resultPusat && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.74rem',
                  marginBottom: '12px',
                  background: resultPusat.success 
                    ? 'rgba(16, 185, 129, 0.15)' 
                    : (resultPusat.server_online && !resultPusat.database_exists) 
                      ? 'rgba(245, 158, 11, 0.15)' 
                      : 'rgba(244, 63, 94, 0.15)',
                  color: resultPusat.success 
                    ? '#34d399' 
                    : (resultPusat.server_online && !resultPusat.database_exists) 
                      ? '#fbbf24' 
                      : '#fb7185',
                  border: `1px solid ${
                    resultPusat.success 
                      ? 'rgba(16, 185, 129, 0.3)' 
                      : (resultPusat.server_online && !resultPusat.database_exists) 
                        ? 'rgba(245, 158, 11, 0.4)' 
                        : 'rgba(244, 63, 94, 0.3)'
                  }`
                }}>
                  <div style={{ fontWeight: 600, marginBottom: (resultPusat.server_online && !resultPusat.database_exists) ? '8px' : '0' }}>
                    {resultPusat.success
                      ? `✅ Berhasil (${resultPusat.latency_ms} ms)`
                      : (resultPusat.server_online && !resultPusat.database_exists)
                        ? `⚠️ Server Terhubung (${resultPusat.latency_ms} ms) - Database "${formData.DatabasePusat}" belum ada di server.`
                        : `❌ ${resultPusat.message}`
                    }
                  </div>
                  {resultPusat.server_online && !resultPusat.database_exists && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        borderColor: 'rgba(245, 158, 11, 0.5)',
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.1)',
                        marginTop: '6px'
                      }}
                      onClick={() => handleCreateDatabase('pusat')}
                      disabled={creatingDbPusat}
                    >
                      <Plus size={13} className={creatingDbPusat ? 'animate-spin' : ''} />
                      <span>{creatingDbPusat ? 'Sedang membuat database...' : `Buat Database "${formData.DatabasePusat}" Otomatis`}</span>
                    </button>
                  )}
                </div>
              )}

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Host & Port Server Pusat</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const port = formData.ServerPusat && formData.ServerPusat.includes(',') ? formData.ServerPusat.split(',')[1] : (formData.ServerPusat && formData.ServerPusat.includes(':') ? formData.ServerPusat.split(':')[1] : '1433');
                        setFormData({ ...formData, ServerPusat: `192.168.2.126,${port}` });
                      }}
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#10b981',
                        fontSize: '0.68rem',
                        padding: '2px 8px',
                        cursor: 'pointer'
                      }}
                      title="Gunakan IP Server Pusat: 192.168.2.126"
                    >
                      IP: 192.168.2.126
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const port = formData.ServerPusat && formData.ServerPusat.includes(',') ? formData.ServerPusat.split(',')[1] : (formData.ServerPusat && formData.ServerPusat.includes(':') ? formData.ServerPusat.split(':')[1] : '1433');
                        setFormData({ ...formData, ServerPusat: `LAPTOP-IVSFKQ1T.local,${port}` });
                      }}
                      style={{
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#0284c7',
                        fontSize: '0.68rem',
                        padding: '2px 8px',
                        cursor: 'pointer'
                      }}
                      title="Gunakan Hostname Server Pusat: LAPTOP-IVSFKQ1T.local"
                    >
                      Hostname: LAPTOP-IVSFKQ1T
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="form-input"
                  required
                  autoComplete="on"
                  value={formData.ServerPusat}
                  onChange={(e) => setFormData({ ...formData, ServerPusat: e.target.value })}
                  placeholder="Contoh: 192.168.2.126,1433 atau localhost,1433"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Database Pusat</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  autoComplete="on"
                  value={formData.DatabasePusat}
                  onChange={(e) => setFormData({ ...formData, DatabasePusat: e.target.value })}
                  placeholder="Contoh: APIdb001"
                />
              </div>

              <div className="form-group">
                <label className="form-label">User Login</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  autoComplete="on"
                  value={formData.UserPusat}
                  onChange={(e) => setFormData({ ...formData, UserPusat: e.target.value })}
                  placeholder="Contoh: sa"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password {editingNodeId !== null && "(Kosongkan jika tidak diubah)"}</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showModalPassPusat ? "text" : "password"}
                    className="form-input"
                    autoComplete="on"
                    style={{ paddingRight: '42px', width: '100%' }}
                    value={formData.PasswordPusat}
                    onChange={(e) => setFormData({ ...formData, PasswordPusat: e.target.value })}
                    placeholder={editingNodeId !== null ? "•••••••• (Tetap password lama)" : "Password SQL Server"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassPusat(!showModalPassPusat)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                    title={showModalPassPusat ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showModalPassPusat ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Box Konfigurasi Lokal */}
            <div style={{
              background: 'var(--bg-card-inner)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              boxShadow: 'var(--shadow-card, var(--shadow-sm))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Server Lokal (Destination)
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestLokal}
                  disabled={testingLokal}
                >
                  <RefreshCw size={12} className={testingLokal ? 'animate-spin' : ''} />
                  <span>{testingLokal ? 'Menguji...' : 'Test Koneksi'}</span>
                </button>
              </div>

              {resultLokal && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.74rem',
                  marginBottom: '12px',
                  background: resultLokal.success 
                    ? 'rgba(16, 185, 129, 0.15)' 
                    : (resultLokal.server_online && !resultLokal.database_exists) 
                      ? 'rgba(245, 158, 11, 0.15)' 
                      : 'rgba(244, 63, 94, 0.15)',
                  color: resultLokal.success 
                    ? '#34d399' 
                    : (resultLokal.server_online && !resultLokal.database_exists) 
                      ? '#fbbf24' 
                      : '#fb7185',
                  border: `1px solid ${
                    resultLokal.success 
                      ? 'rgba(16, 185, 129, 0.3)' 
                      : (resultLokal.server_online && !resultLokal.database_exists) 
                        ? 'rgba(245, 158, 11, 0.4)' 
                        : 'rgba(244, 63, 94, 0.3)'
                  }`
                }}>
                  <div style={{ fontWeight: 600, marginBottom: (resultLokal.server_online && !resultLokal.database_exists) ? '8px' : '0' }}>
                    {resultLokal.success
                      ? `✅ Berhasil (${resultLokal.latency_ms} ms)`
                      : (resultLokal.server_online && !resultLokal.database_exists)
                        ? `⚠️ Server Terhubung (${resultLokal.latency_ms} ms) - Database "${formData.DatabaseLokal}" belum ada di server.`
                        : `❌ ${resultLokal.message}`
                    }
                  </div>
                  {resultLokal.server_online && !resultLokal.database_exists && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        borderColor: 'rgba(245, 158, 11, 0.5)',
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.1)',
                        marginTop: '6px'
                      }}
                      onClick={() => handleCreateDatabase('lokal')}
                      disabled={creatingDbLokal}
                    >
                      <Plus size={13} className={creatingDbLokal ? 'animate-spin' : ''} />
                      <span>{creatingDbLokal ? 'Sedang membuat database...' : `Buat Database "${formData.DatabaseLokal}" Otomatis`}</span>
                    </button>
                  )}
                </div>
              )}

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Host & Port Server Lokal</label>
                  {networkInfo && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const current = formData.ServerLokal || '';
                          const port = current.includes(',') ? current.split(',')[1] : (current.includes(':') ? current.split(':')[1] : '1433');
                          setFormData({ ...formData, ServerLokal: `${networkInfo.local_ip},${port}` });
                        }}
                        style={{
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          color: '#10b981',
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          cursor: 'pointer'
                        }}
                        title={`Gunakan IP Laptop ini: ${networkInfo.local_ip}`}
                      >
                        IP: {networkInfo.local_ip}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = formData.ServerLokal || '';
                          const port = current.includes(',') ? current.split(',')[1] : (current.includes(':') ? current.split(':')[1] : '1433');
                          setFormData({ ...formData, ServerLokal: `${networkInfo.local_hostname},${port}` });
                        }}
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          color: '#0284c7',
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          cursor: 'pointer'
                        }}
                        title={`Gunakan Hostname Laptop: ${networkInfo.local_hostname}`}
                      >
                        Hostname: {networkInfo.local_hostname?.split('.')[0] || 'Lokal'}
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  className="form-input"
                  required
                  autoComplete="on"
                  value={formData.ServerLokal}
                  onChange={(e) => setFormData({ ...formData, ServerLokal: e.target.value })}
                  placeholder="Contoh: 192.168.2.99,1433 atau localhost,1433"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Database Lokal</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  autoComplete="on"
                  value={formData.DatabaseLokal}
                  onChange={(e) => setFormData({ ...formData, DatabaseLokal: e.target.value })}
                  placeholder="Contoh: APIdb001"
                />
              </div>

              <div className="form-group">
                <label className="form-label">User Login</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  autoComplete="on"
                  value={formData.UserLokal}
                  onChange={(e) => setFormData({ ...formData, UserLokal: e.target.value })}
                  placeholder="Contoh: sa"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password {editingNodeId !== null && "(Kosongkan jika tidak diubah)"}</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showModalPassLokal ? "text" : "password"}
                    className="form-input"
                    autoComplete="on"
                    style={{ paddingRight: '42px', width: '100%' }}
                    value={formData.PasswordLokal}
                    onChange={(e) => setFormData({ ...formData, PasswordLokal: e.target.value })}
                    placeholder={editingNodeId !== null ? "•••••••• (Tetap password lama)" : "Password SQL Server"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassLokal(!showModalPassLokal)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                    title={showModalPassLokal ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showModalPassLokal ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Subnet Scanner Modal */}
      <SubnetScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        networkInfo={networkInfo}
        configs={configs}
        onNodeUpdated={onRefreshConfigs}
      />
    </div>
  );
}
