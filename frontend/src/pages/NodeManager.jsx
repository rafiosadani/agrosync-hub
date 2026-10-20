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
  Wifi,
  Laptop,
  ChevronDown,
  Zap,
  Check,
  CheckSquare,
  Square,
  Search,
  ArrowRight,
  ArrowLeft,
  Lock,
  Layers
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

  // Form State
  const [formData, setFormData] = useState({
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

  // Batch Multi-Select Database & Form Validation States
  const [creationMode, setCreationMode] = useState('single'); // 'single' | 'batch'
  const [serverDatabasesPusat, setServerDatabasesPusat] = useState([]);
  const [isFetchingDbsPusat, setIsFetchingDbsPusat] = useState(false);
  const [selectedDatabasesPusat, setSelectedDatabasesPusat] = useState([]);
  const [searchDbPusat, setSearchDbPusat] = useState('');
  const [localDbMappings, setLocalDbMappings] = useState({});
  const [autoMatchLocal, setAutoMatchLocal] = useState(true);
  const [formErrors, setFormErrors] = useState({});
  const [existingLocalDbs, setExistingLocalDbs] = useState([]);
  const [isCheckingLocalDbs, setIsCheckingLocalDbs] = useState(false);

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
  const [scannerTargetRole, setScannerTargetRole] = useState('pusat');
  const [showLocalHostMenu, setShowLocalHostMenu] = useState(false);

  useEffect(() => {
    api.getNetworkInfo().then(info => {
      if (info && (info.local_ip || info.status === 'success')) {
        setNetworkInfo(info);
      }
    }).catch(err => {
      console.debug("Gagal memuat network info:", err);
    });
  }, []);

  useEffect(() => {
    if (!showLocalHostMenu) return;
    const handleClickOutside = () => setShowLocalHostMenu(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showLocalHostMenu]);

  const handleOpenScannerFor = (role = 'pusat') => {
    setScannerTargetRole(role);
    setIsScannerOpen(true);
  };

  const handleSelectHostFromScanner = (chosenAddress, role) => {
    if (role === 'pusat') {
      handleFieldChange('ServerPusat', chosenAddress);
    } else {
      handleFieldChange('ServerLokal', chosenAddress);
    }
  };

  const togglePasswordVisibility = (nodeId, field) => {
    const key = `${nodeId}-${field}`;
    setRevealedPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getCanonicalServer = (serverStr, netInfo = networkInfo) => {
    if (!serverStr) return '';
    const s = serverStr.trim();
    let port = '1433';
    let host = s;

    if (s.includes(',')) {
      const parts = s.split(',');
      host = parts[0].trim();
      if (parts.length > 1 && !isNaN(parts[1])) port = parts[1].trim();
    } else if (s.includes(':') && !s.startsWith('[')) {
      const parts = s.split(':');
      host = parts[0].trim();
      if (parts.length > 1 && !isNaN(parts[1])) port = parts[1].trim();
    }

    const hostLower = host.toLowerCase();
    const localSet = new Set([
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      (netInfo?.local_ip || '').toLowerCase(),
      (netInfo?.hostname || '').toLowerCase(),
      (netInfo?.local_hostname || '').toLowerCase(),
      ((netInfo?.hostname || '') + '.local').toLowerCase(),
    ].filter(Boolean));

    const baseHost = hostLower.replace(/\.local$/, '');
    if (localSet.has(hostLower) || localSet.has(baseHost)) {
      return `__LOCAL__:${port}`;
    }

    return `${hostLower}:${port}`;
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field] || formErrors.conflictDetail) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        delete copy.conflictDetail;
        return copy;
      });
    }
  };

  const isDbConfigured = (dbName, srvPusat = formData.ServerPusat) => {
    const canonSrv = getCanonicalServer(srvPusat, networkInfo);
    return (configs || []).some(c =>
      getCanonicalServer(c.ServerPusat, networkInfo) === canonSrv &&
      (c.DatabasePusat || '').toLowerCase() === (dbName || '').toLowerCase()
    );
  };

  const handleOpenAddModal = () => {
    setEditingNodeId(null);
    setShowModalPassPusat(false);
    setShowModalPassLokal(false);
    setCreationMode('single');
    setServerDatabasesPusat([]);
    setSelectedDatabasesPusat([]);
    setSearchDbPusat('');
    setLocalDbMappings({});
    setAutoMatchLocal(true);
    setFormErrors({});
    setExistingLocalDbs([]);
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
    setCreationMode('single');
    setServerDatabasesPusat([]);
    setSelectedDatabasesPusat([]);
    setSearchDbPusat('');
    setLocalDbMappings({});
    setAutoMatchLocal(true);
    setFormErrors({});
    setExistingLocalDbs([]);
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

  const handleFetchDatabasesPusat = async () => {
    const errs = {};
    if (!formData.ServerPusat?.trim()) errs.ServerPusat = 'Host server pusat wajib diisi.';
    if (!formData.UserPusat?.trim()) errs.UserPusat = 'User login pusat wajib diisi.';
    if (editingNodeId === null && !formData.PasswordPusat?.trim()) {
      errs.PasswordPusat = 'Password server pusat wajib diisi.';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(prev => ({ ...prev, ...errs }));
      toast.warning('Kredensial Belum Lengkap', 'Lengkapi Host, User, dan Password Pusat terlebih dahulu untuk menarik database.');
      return;
    }

    setIsFetchingDbsPusat(true);
    try {
      const res = await api.fetchDatabases(
        formData.ServerPusat,
        formData.UserPusat,
        formData.PasswordPusat || '',
        editingNodeId,
        'pusat'
      );
      const dbs = res.databases || [];
      setServerDatabasesPusat(dbs);
      setCreationMode('batch');

      // Auto-select all databases that are not already configured
      const unconfigured = dbs.filter(d => !isDbConfigured(d, formData.ServerPusat));
      setSelectedDatabasesPusat(unconfigured);

      // Pre-fill local mapping with 1:1 match
      const initialMap = {};
      dbs.forEach(d => {
        initialMap[d] = d;
      });
      setLocalDbMappings(initialMap);

      if (dbs.length === 0) {
        toast.info('Tidak Ada Database User', 'Hanya database sistem (master, tempdb, model, msdb) yang ditemukan di server.');
      } else {
        toast.success(
          'Database Berhasil Ditarik',
          `Ditemukan ${dbs.length} database di server pusat (${unconfigured.length} database baru siap ditambahkan).`
        );
      }
    } catch (err) {
      toast.error('Gagal Menarik Database', err.message);
    } finally {
      setIsFetchingDbsPusat(false);
    }
  };

  const handleCheckLocalDatabases = async () => {
    if (!formData.ServerLokal?.trim() || !formData.UserLokal?.trim()) {
      toast.warning('Kredensial Lokal Belum Lengkap', 'Lengkapi Host dan User Server Lokal terlebih dahulu.');
      return;
    }
    setIsCheckingLocalDbs(true);
    try {
      const res = await api.fetchDatabases(
        formData.ServerLokal,
        formData.UserLokal,
        formData.PasswordLokal || '',
        editingNodeId,
        'lokal'
      );
      const dbs = res.databases || [];
      setExistingLocalDbs(dbs);
      toast.success('Pengecekan Server Lokal Selesai', `Terdeteksi ${dbs.length} database di server lokal laptop/cabang.`);
    } catch (err) {
      toast.error('Gagal Cek Database Lokal', err.message);
    } finally {
      setIsCheckingLocalDbs(false);
    }
  };

  const handleToggleDatabase = (dbName) => {
    if (isDbConfigured(dbName, formData.ServerPusat)) {
      toast.info('Database Sudah Terdaftar', `Database [${dbName}] sudah memiliki konfigurasi node aktif di server pusat ini.`);
      return;
    }
    setSelectedDatabasesPusat(prev => {
      const exists = prev.includes(dbName);
      const updated = exists ? prev.filter(d => d !== dbName) : [...prev, dbName];
      if (formErrors.selectedDatabasesPusat) {
        setFormErrors(e => {
          const copy = { ...e };
          delete copy.selectedDatabasesPusat;
          return copy;
        });
      }
      return updated;
    });
    if (!localDbMappings[dbName]) {
      setLocalDbMappings(prev => ({ ...prev, [dbName]: dbName }));
    }
  };

  const handleSelectAllUnconfigured = () => {
    const unconfigured = serverDatabasesPusat.filter(d => !isDbConfigured(d, formData.ServerPusat));
    setSelectedDatabasesPusat(unconfigured);
    const mappings = { ...localDbMappings };
    unconfigured.forEach(d => {
      if (!mappings[d]) mappings[d] = d;
    });
    setLocalDbMappings(mappings);
    if (formErrors.selectedDatabasesPusat) {
      setFormErrors(e => {
        const copy = { ...e };
        delete copy.selectedDatabasesPusat;
        return copy;
      });
    }
  };

  const handleDeselectAll = () => {
    setSelectedDatabasesPusat([]);
  };

  const handleMappingChange = (dbPusat, val) => {
    setLocalDbMappings(prev => ({ ...prev, [dbPusat]: val }));
    const errKey = `localDbMapping_${dbPusat}`;
    if (formErrors[errKey]) {
      setFormErrors(e => {
        const copy = { ...e };
        delete copy[errKey];
        return copy;
      });
    }
  };

  const handleTestPusat = async () => {
    if (!formData.ServerPusat || !formData.UserPusat) {
      toast.warning('Input Kurang Lengkap', 'Mohon lengkapi Server dan User Pusat terlebih dahulu.');
      return;
    }
    setTestingPusat(true);
    setResultPusat(null);
    try {
      const testDb = creationMode === 'batch'
        ? (selectedDatabasesPusat[0] || 'master')
        : (formData.DatabasePusat || 'master');

      const res = await api.testConnection(
        formData.ServerPusat,
        testDb,
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
    if (!formData.ServerLokal || !formData.UserLokal) {
      toast.warning('Input Kurang Lengkap', 'Mohon lengkapi Server dan User Lokal terlebih dahulu.');
      return;
    }
    setTestingLokal(true);
    setResultLokal(null);
    try {
      const testDb = creationMode === 'batch'
        ? (selectedDatabasesPusat[0] ? (localDbMappings[selectedDatabasesPusat[0]] || selectedDatabasesPusat[0]) : 'master')
        : (formData.DatabaseLokal || 'master');

      const res = await api.testConnection(
        formData.ServerLokal,
        testDb,
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

  const checkIsDuplicate = (serverPusat, dbPusat, serverLokal, dbLokal, excludeId = null) => {
    const norm = (srv, db) => {
      const canon = getCanonicalServer(srv, networkInfo);
      return `${canon}/${(db || '').trim().toLowerCase()}`;
    };

    const newSrc = norm(serverPusat, dbPusat);
    const newTgt = norm(serverLokal, dbLokal);

    for (const cfg of configs || []) {
      if (excludeId !== null && cfg.id === excludeId) continue;
      const exSrc = norm(cfg.ServerPusat, cfg.DatabasePusat);
      const exTgt = norm(cfg.ServerLokal, cfg.DatabaseLokal);

      if (newSrc === exSrc && newTgt === exTgt) {
        return `Duplikasi Terdeteksi: Database pusat '${dbPusat}' menuju target '${dbLokal}' pada server lokal '${serverLokal}' sudah terdaftar di Node #${cfg.id !== undefined ? cfg.id + 1 : ''} (${cfg.CompanyName}).`;
      }
      if (newTgt === exTgt) {
        return `Konflik Target: Database lokal '${dbLokal}' pada host '${serverLokal}' sudah digunakan oleh Node #${cfg.id !== undefined ? cfg.id + 1 : ''} (${cfg.CompanyName} - ${cfg.DatabasePusat}). Satu database lokal tidak dapat menerima sinkronisasi dari dua sumber berbeda.`;
      }
    }
    return null;
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.CompanyName?.trim()) {
      errors.CompanyName = 'Nama Company/Entitas wajib diisi (misal: API, AGC, TTM).';
    }
    if (!formData.ServerPusat?.trim()) {
      errors.ServerPusat = 'Host server pusat wajib diisi (misal: 192.168.1.100,1433).';
    }
    if (!formData.UserPusat?.trim()) {
      errors.UserPusat = 'Username login SQL Server pusat wajib diisi.';
    }
    if (editingNodeId === null && !formData.PasswordPusat?.trim()) {
      errors.PasswordPusat = 'Password SQL Server pusat wajib diisi untuk node baru.';
    }

    if (!formData.ServerLokal?.trim()) {
      errors.ServerLokal = 'Host server lokal wajib diisi (misal: localhost,1435).';
    }
    if (!formData.UserLokal?.trim()) {
      errors.UserLokal = 'Username login SQL Server lokal wajib diisi.';
    }
    if (editingNodeId === null && !formData.PasswordLokal?.trim()) {
      errors.PasswordLokal = 'Password SQL Server lokal wajib diisi untuk node baru.';
    }

    if (creationMode === 'single' || editingNodeId !== null) {
      if (!formData.DatabasePusat?.trim()) {
        errors.DatabasePusat = 'Nama database pusat wajib diisi.';
      }
      if (!formData.DatabaseLokal?.trim()) {
        errors.DatabaseLokal = 'Nama database lokal tujuan wajib diisi.';
      }

      if (formData.ServerPusat && formData.DatabasePusat && formData.ServerLokal && formData.DatabaseLokal) {
        const dup = checkIsDuplicate(
          formData.ServerPusat,
          formData.DatabasePusat,
          formData.ServerLokal,
          formData.DatabaseLokal,
          editingNodeId
        );
        if (dup) {
          errors.DatabaseLokal = 'Terdeteksi duplikasi konfigurasi atau bentrok target database lokal.';
          errors.conflictDetail = dup;
        }
      }
    } else {
      // Batch Mode
      if (!selectedDatabasesPusat || selectedDatabasesPusat.length === 0) {
        errors.selectedDatabasesPusat = 'Pilih minimal 1 database pusat dari daftar untuk menambahkan konfigurasi node.';
      }

      // Check mappings
      const targetTracker = new Set();
      for (const dbPusat of selectedDatabasesPusat) {
        const localName = (autoMatchLocal ? dbPusat : (localDbMappings[dbPusat] || dbPusat)).trim();
        if (!localName) {
          errors[`localDbMapping_${dbPusat}`] = `Nama database lokal untuk ${dbPusat} tidak boleh kosong.`;
        } else {
          if (targetTracker.has(localName.toLowerCase())) {
            errors[`localDbMapping_${dbPusat}`] = `Nama database lokal '${localName}' ganda dalam batch ini.`;
            errors.conflictDetail = `Duplikasi dalam batch: Database lokal '${localName}' digunakan lebih dari 1 kali dalam daftar pemetaan ini.`;
          }
          targetTracker.add(localName.toLowerCase());

          const dup = checkIsDuplicate(
            formData.ServerPusat,
            dbPusat,
            formData.ServerLokal,
            localName
          );
          if (dup) {
            errors[`localDbMapping_${dbPusat}`] = 'Konflik target atau duplikasi.';
            errors.conflictDetail = dup;
          }
        }
      }
    }

    return errors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    const errorCount = Object.keys(errors).filter(k => k !== 'conflictDetail').length;
    if (errorCount > 0) {
      setFormErrors(errors);
      toast.warning(
        'Validasi Form Gagal',
        `Terdapat ${errorCount} kolom yang belum lengkap atau terdeteksi duplikasi. Silakan periksa kolom bergaris merah.`
      );
      return;
    }

    setIsSaving(true);
    try {
      if (editingNodeId !== null) {
        // Update single node
        const payload = { ...formData };
        if (!payload.PasswordPusat) delete payload.PasswordPusat;
        if (!payload.PasswordLokal) delete payload.PasswordLokal;
        await api.updateConfig(editingNodeId, payload);
        toast.success('Node Berhasil Diperbarui', `Konfigurasi ${formData.CompanyName} (${formData.DatabasePusat}) telah disimpan.`);
      } else if (creationMode === 'batch') {
        // Batch create
        const batchPayload = selectedDatabasesPusat.map(dbPusat => ({
          CompanyName: formData.CompanyName,
          ServerPusat: formData.ServerPusat,
          DatabasePusat: dbPusat,
          UserPusat: formData.UserPusat,
          PasswordPusat: formData.PasswordPusat,
          ServerLokal: formData.ServerLokal,
          DatabaseLokal: (autoMatchLocal ? dbPusat : (localDbMappings[dbPusat] || dbPusat)).trim(),
          UserLokal: formData.UserLokal,
          PasswordLokal: formData.PasswordLokal
        }));
        const res = await api.createBatchConfigs(batchPayload);
        toast.success('Batch Node Berhasil Dibuat', res.message || `${batchPayload.length} database node berhasil ditambahkan.`);
      } else {
        // Single create
        await api.createConfig(formData);
        toast.success('Node Baru Ditambahkan', `Node ${formData.CompanyName} (${formData.DatabasePusat}) berhasil disimpan.`);
      }
      setIsModalOpen(false);
      onRefreshConfigs();
    } catch (err) {
      if (err.message && (err.message.includes('Duplikasi') || err.message.includes('Konflik'))) {
        setFormErrors(prev => ({
          ...prev,
          DatabaseLokal: 'Terdeteksi duplikasi konfigurasi atau bentrok target database lokal.',
          conflictDetail: err.message
        }));
      }
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
        maxWidth="1000px"
      >
        <form onSubmit={handleSave} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Mode Switcher (Hanya saat tambah node baru) */}
          {editingNodeId === null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Metode Pembuatan Konfigurasi:
              </div>
              <div className="theme-segmented-control" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`theme-segment-btn ${creationMode === 'single' ? 'active' : ''}`}
                  onClick={() => setCreationMode('single')}
                  title="Tambah satu node database secara manual"
                >
                  <span>Mode 1 Database</span>
                </button>
                <button
                  type="button"
                  className={`theme-segment-btn ${creationMode === 'batch' ? 'active' : ''}`}
                  onClick={() => {
                    setCreationMode('batch');
                    if (serverDatabasesPusat.length === 0 && formData.ServerPusat && formData.UserPusat && formData.PasswordPusat) {
                      handleFetchDatabasesPusat();
                    }
                  }}
                  title="Pilih banyak database sekaligus dari SQL Server Pusat"
                >
                  <Layers size={13} />
                  <span>Mode Batch (Multi-Database)</span>
                </button>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Entitas Perusahaan (CompanyName)</label>
            <input
              type="text"
              className={`form-input ${formErrors.CompanyName ? 'input-error' : ''}`}
              autoComplete="on"
              value={formData.CompanyName}
              onChange={(e) => handleFieldChange('CompanyName', e.target.value.toUpperCase())}
              placeholder="Contoh: API, AGC, TTM"
            />
            {formErrors.CompanyName && (
              <div className="form-field-error">
                <AlertTriangle size={12} />
                <span>{formErrors.CompanyName}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
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
                  border: `1px solid ${resultPusat.success
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

              {/* 1. Host & Port Server Pusat */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Host & Port Server Pusat</label>
                  <button
                    type="button"
                    onClick={() => handleOpenScannerFor('pusat')}
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#0284c7',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '3px 10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                    title="Pindai instance SQL Server di subnet WiFi untuk mengisi Host Server Pusat secara otomatis"
                  >
                    <Radar size={12} />
                    <span>Pindai Subnet</span>
                  </button>
                </div>
                <input
                  type="text"
                  className={`form-input ${formErrors.ServerPusat ? 'input-error' : ''}`}
                  autoComplete="on"
                  value={formData.ServerPusat}
                  onChange={(e) => handleFieldChange('ServerPusat', e.target.value)}
                  placeholder="Contoh: 192.168.1.100,1433 atau WIN-SERVER-01.local,1433"
                />
                {formErrors.ServerPusat && (
                  <div className="form-field-error">
                    <AlertTriangle size={12} />
                    <span>{formErrors.ServerPusat}</span>
                  </div>
                )}
              </div>

              {/* 2. Kredensial User & Password (Berdampingan 2 Kolom) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">User Login</label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.UserPusat ? 'input-error' : ''}`}
                    autoComplete="on"
                    value={formData.UserPusat}
                    onChange={(e) => handleFieldChange('UserPusat', e.target.value)}
                    placeholder="Username login"
                  />
                  {formErrors.UserPusat && (
                    <div className="form-field-error">
                      <AlertTriangle size={12} />
                      <span>{formErrors.UserPusat}</span>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Password {editingNodeId !== null && "(Opsional)"}</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showModalPassPusat ? "text" : "password"}
                      className={`form-input ${formErrors.PasswordPusat ? 'input-error' : ''}`}
                      autoComplete="on"
                      style={{ paddingRight: '38px', width: '100%' }}
                      value={formData.PasswordPusat}
                      onChange={(e) => handleFieldChange('PasswordPusat', e.target.value)}
                      placeholder={editingNodeId !== null ? "••••••••" : "Password login"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassPusat(!showModalPassPusat)}
                      style={{
                        position: 'absolute',
                        right: '8px',
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
                      {showModalPassPusat ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {formErrors.PasswordPusat && (
                    <div className="form-field-error">
                      <AlertTriangle size={12} />
                      <span>{formErrors.PasswordPusat}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Database Pusat Section (Single vs Batch) */}
              {creationMode === 'single' || editingNodeId !== null ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Nama Database Pusat</label>
                    {editingNodeId === null && (
                      <button
                        type="button"
                        onClick={handleFetchDatabasesPusat}
                        disabled={isFetchingDbsPusat}
                        style={{
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: 'var(--radius-sm)',
                          color: '#0284c7',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '3px 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                        title="Tarik daftar database yang ada di server SQL Server ini"
                      >
                        <Zap size={12} className={isFetchingDbsPusat ? 'animate-spin' : ''} />
                        <span>{isFetchingDbsPusat ? 'Menarik DB...' : 'Tarik dari Server (Batch)'}</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    className={`form-input ${formErrors.DatabasePusat ? 'input-error' : ''}`}
                    autoComplete="on"
                    value={formData.DatabasePusat}
                    onChange={(e) => handleFieldChange('DatabasePusat', e.target.value)}
                    placeholder="Contoh: APIdb001"
                  />
                  {formErrors.DatabasePusat && (
                    <div className="form-field-error">
                      <AlertTriangle size={12} />
                      <span>{formErrors.DatabasePusat}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Multi-Select Database Discovery Box (Batch Mode) */
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Database size={13} color="#0284c7" />
                      <span>Pilih Database Pusat ({selectedDatabasesPusat.length} dipilih)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setCreationMode('single')}
                        style={{
                          background: 'rgba(148, 163, 184, 0.12)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Beralih kembali ke mode input 1 database manual"
                      >
                        <ArrowLeft size={11} />
                        <span>Mode 1 DB</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFetchDatabasesPusat}
                        disabled={isFetchingDbsPusat}
                        style={{
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: 'var(--radius-sm)',
                          color: '#0284c7',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RefreshCw size={11} className={isFetchingDbsPusat ? 'animate-spin' : ''} />
                        <span>Muat Ulang DB</span>
                      </button>
                    </div>
                  </div>

                  {serverDatabasesPusat.length > 0 ? (
                    <div className={`db-multi-select-box ${formErrors.selectedDatabasesPusat ? 'input-error' : ''}`}>
                      {serverDatabasesPusat.every(d => isDbConfigured(d, formData.ServerPusat)) && (
                        <div style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#0284c7',
                          fontSize: '0.74rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={13} color="#10b981" />
                            <span>Semua database ({serverDatabasesPusat.length}) di server ini sudah terdaftar.</span>
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                            onClick={() => setCreationMode('single')}
                          >
                            Ke Mode 1 DB
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Cari nama database..."
                            value={searchDbPusat}
                            onChange={(e) => setSearchDbPusat(e.target.value)}
                            style={{ fontSize: '0.78rem', padding: '5px 8px 5px 28px' }}
                          />
                          <Search size={13} style={{ position: 'absolute', left: '9px', top: '8px', color: 'var(--text-muted)' }} />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleSelectAllUnconfigured}
                          style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                          title="Pilih seluruh database yang belum terdaftar di sistem"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleDeselectAll}
                          style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                          title="Kosongkan seluruh pilihan"
                        >
                          Kosongkan
                        </button>
                      </div>

                      <div className="db-select-list">
                        {serverDatabasesPusat
                          .filter(d => !searchDbPusat || d.toLowerCase().includes(searchDbPusat.toLowerCase()))
                          .map(dbName => {
                            const configured = isDbConfigured(dbName, formData.ServerPusat);
                            const isSelected = selectedDatabasesPusat.includes(dbName);
                            return (
                              <div
                                key={dbName}
                                className={`db-select-item ${configured ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleToggleDatabase(dbName)}
                                title={configured ? `Database [${dbName}] sudah terdaftar di sistem` : (isSelected ? "Klik untuk membatalkan pilihan" : "Klik untuk memilih")}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {configured ? (
                                    <div style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '3px',
                                      background: 'rgba(148, 163, 184, 0.15)',
                                      border: '1px solid rgba(148, 163, 184, 0.3)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'var(--text-muted)'
                                    }}>
                                      <Lock size={10} />
                                    </div>
                                  ) : isSelected ? (
                                    <CheckSquare size={15} color="#10b981" />
                                  ) : (
                                    <Square size={15} color="var(--border-hover)" />
                                  )}
                                  <span style={{ fontWeight: isSelected ? 600 : 400, color: configured ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                    {dbName}
                                  </span>
                                </div>
                                {configured ? (
                                  <span className="badge badge-neutral" style={{ fontSize: '0.66rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Lock size={10} />
                                    <span>Sudah Terdaftar</span>
                                  </span>
                                ) : isSelected ? (
                                  <span className="badge badge-success" style={{ fontSize: '0.66rem', padding: '2px 6px' }}>
                                    Terpilih
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    Klik utk pilih
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px',
                      textAlign: 'center',
                      background: 'var(--bg-subtle)'
                    }}>
                      <Database size={24} color="var(--text-muted)" style={{ margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Daftar database belum dimuat dari Server Pusat.
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleFetchDatabasesPusat}
                        disabled={isFetchingDbsPusat}
                        style={{ margin: '0 auto' }}
                      >
                        <Zap size={13} color="#0284c7" className={isFetchingDbsPusat ? 'animate-spin' : ''} />
                        <span>{isFetchingDbsPusat ? 'Menghubungi Server...' : 'Ambil Database dari Server Pusat'}</span>
                      </button>
                    </div>
                  )}

                  {formErrors.selectedDatabasesPusat && (
                    <div className="form-field-error">
                      <AlertTriangle size={12} />
                      <span>{formErrors.selectedDatabasesPusat}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Box Konfigurasi Lokal */}
            <div style={{
              background: 'var(--bg-card-inner)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              boxShadow: 'var(--shadow-card, var(--shadow-sm))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', minHeight: '32px' }}>
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
                  border: `1px solid ${resultLokal.success
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

              {/* 1. Host & Port Server Lokal */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Host & Port Server Lokal</label>
                  {networkInfo && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowLocalHostMenu(prev => !prev);
                        }}
                        style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          borderRadius: 'var(--radius-sm)',
                          color: '#10b981',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '3px 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Pilihan cepat host lokal (IP, Hostname, atau Localhost)"
                      >
                        <Laptop size={12} />
                        <span>Host Lokal</span>
                        <ChevronDown size={11} style={{ transform: showLocalHostMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                      </button>

                      {showLocalHostMenu && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 'calc(100% + 4px)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                            padding: '6px',
                            zIndex: 100,
                            width: 'max-content',
                            minWidth: '260px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px'
                          }}
                        >
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '4px 10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            Pilih Host Laptop Ini:
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const current = formData.ServerLokal || '';
                              const port = current.includes(',') ? current.split(',')[1] : (current.includes(':') ? current.split(':')[1] : '1433');
                              handleFieldChange('ServerLokal', `${networkInfo.local_ip},${port}`);
                              setShowLocalHostMenu(false);
                              toast.success('Host Lokal Diterapkan', `IP: ${networkInfo.local_ip},${port}`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '20px',
                              padding: '7px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: 'var(--text-primary)',
                              fontSize: '0.74rem',
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ whiteSpace: 'nowrap' }}>IP WiFi / LAN:</span>
                            <span style={{ color: '#10b981', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{networkInfo.local_ip}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const current = formData.ServerLokal || '';
                              const port = current.includes(',') ? current.split(',')[1] : (current.includes(':') ? current.split(':')[1] : '1433');
                              handleFieldChange('ServerLokal', `${networkInfo.local_hostname},${port}`);
                              setShowLocalHostMenu(false);
                              toast.success('Host Lokal Diterapkan', `Hostname: ${networkInfo.local_hostname},${port}`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '20px',
                              padding: '7px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: 'var(--text-primary)',
                              fontSize: '0.74rem',
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ whiteSpace: 'nowrap' }}>Hostname mDNS:</span>
                            <span style={{ color: '#0284c7', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{networkInfo.local_hostname?.split('.')[0] || 'Lokal'}.local</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const current = formData.ServerLokal || '';
                              const port = current.includes(',') ? current.split(',')[1] : (current.includes(':') ? current.split(':')[1] : '1433');
                              handleFieldChange('ServerLokal', `localhost,${port}`);
                              setShowLocalHostMenu(false);
                              toast.success('Host Lokal Diterapkan', `localhost,${port}`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '20px',
                              padding: '7px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: 'var(--text-primary)',
                              fontSize: '0.74rem',
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ whiteSpace: 'nowrap' }}>Localhost:</span>
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>localhost</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  className={`form-input ${formErrors.ServerLokal ? 'input-error' : ''}`}
                  autoComplete="on"
                  value={formData.ServerLokal}
                  onChange={(e) => handleFieldChange('ServerLokal', e.target.value)}
                  placeholder="Contoh: 192.168.2.99,1433 atau localhost,1433"
                />
                {formErrors.ServerLokal && (
                  <div className="form-field-error">
                    <AlertTriangle size={12} />
                    <span>{formErrors.ServerLokal}</span>
                  </div>
                )}
              </div>

              {/* 2. Kredensial User & Password (Berdampingan 2 Kolom) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">User Login</label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.UserLokal ? 'input-error' : ''}`}
                    autoComplete="on"
                    value={formData.UserLokal}
                    onChange={(e) => handleFieldChange('UserLokal', e.target.value)}
                    placeholder="Username login"
                  />
                  {formErrors.UserLokal && (
                    <div className="form-field-error">
                      <AlertTriangle size={12} />
                      <span>{formErrors.UserLokal}</span>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Password {editingNodeId !== null && "(Opsional)"}</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showModalPassLokal ? "text" : "password"}
                      className={`form-input ${formErrors.PasswordLokal ? 'input-error' : ''}`}
                      autoComplete="on"
                      style={{ paddingRight: '38px', width: '100%' }}
                      value={formData.PasswordLokal}
                      onChange={(e) => handleFieldChange('PasswordLokal', e.target.value)}
                      placeholder={editingNodeId !== null ? "••••••••" : "Password login"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassLokal(!showModalPassLokal)}
                      style={{
                        position: 'absolute',
                        right: '8px',
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
                      {showModalPassLokal ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {formErrors.PasswordLokal && (
                    <div className="form-field-error">
                      <AlertTriangle size={12} />
                      <span>{formErrors.PasswordLokal}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Database Lokal Section (Single vs Batch Preview) */}
              {creationMode === 'single' || editingNodeId !== null ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nama Database Lokal</label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.DatabaseLokal ? 'input-error' : ''}`}
                    autoComplete="on"
                    value={formData.DatabaseLokal}
                    onChange={(e) => handleFieldChange('DatabaseLokal', e.target.value)}
                    placeholder="Contoh: APIdb001"
                  />
                  {formErrors.DatabaseLokal && (
                    <div className="form-field-error">
                      <AlertTriangle size={12} />
                      <span>{formErrors.DatabaseLokal}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Dynamic Destination Mapping Table (Batch Mode) */
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                      Pemetaan Database Lokal ({selectedDatabasesPusat.length} Node)
                    </label>
                    <button
                      type="button"
                      onClick={handleCheckLocalDatabases}
                      disabled={isCheckingLocalDbs}
                      style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#10b981',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Periksa keberadaan database di SQL Server lokal"
                    >
                      <RefreshCw size={11} className={isCheckingLocalDbs ? 'animate-spin' : ''} />
                      <span>Cek DB Lokal</span>
                    </button>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '8px'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={autoMatchLocal}
                        onChange={(e) => {
                          setAutoMatchLocal(e.target.checked);
                          if (e.target.checked) {
                            const initialMap = {};
                            selectedDatabasesPusat.forEach(d => { initialMap[d] = d; });
                            setLocalDbMappings(initialMap);
                          }
                        }}
                      />
                      <span>Samakan nama database lokal dengan pusat (1:1 Auto)</span>
                    </label>
                  </div>

                  {selectedDatabasesPusat.length > 0 ? (
                    <div style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      padding: '4px 8px'
                    }}>
                      <table className="mapping-preview-table">
                        <thead>
                          <tr>
                            <th style={{ width: '42%' }}>Pusat</th>
                            <th style={{ width: '10%', textAlign: 'center' }}></th>
                            <th style={{ width: '48%' }}>Lokal (Tujuan)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDatabasesPusat.map(dbPusat => {
                            const currentVal = autoMatchLocal ? dbPusat : (localDbMappings[dbPusat] || dbPusat);
                            const isDbExisting = existingLocalDbs.some(d => d.toLowerCase() === currentVal.toLowerCase());
                            const errKey = `localDbMapping_${dbPusat}`;
                            return (
                              <React.Fragment key={dbPusat}>
                                <tr>
                                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Database size={12} color="#0284c7" />
                                      <span>{dbPusat}</span>
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <ArrowRight size={13} />
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <input
                                        type="text"
                                        className={`form-input ${formErrors[errKey] ? 'input-error' : ''}`}
                                        style={{ fontSize: '0.76rem', padding: '4px 8px', height: '28px' }}
                                        value={currentVal}
                                        disabled={autoMatchLocal}
                                        onChange={(e) => handleMappingChange(dbPusat, e.target.value)}
                                      />
                                      {existingLocalDbs.length > 0 && (
                                        <span
                                          className={isDbExisting ? 'badge badge-success' : 'badge badge-warning'}
                                          style={{ fontSize: '0.62rem', padding: '2px 5px', whiteSpace: 'nowrap' }}
                                          title={isDbExisting ? 'Database sudah ada di SQL Server lokal' : 'Database belum dibuat di lokal (bisa dibuat via DDL Migration)'}
                                        >
                                          {isDbExisting ? 'Ada' : 'Baru'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {formErrors[errKey] && (
                                  <tr>
                                    <td colSpan={3} style={{ padding: '0 8px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                                      <div className="form-field-error" style={{ margin: 0 }}>
                                        <AlertTriangle size={11} />
                                        <span>{formErrors[errKey]}</span>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      padding: '16px',
                      textAlign: 'center',
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      Pilih minimal 1 database pusat di sebelah kiri untuk melihat pemetaan database lokal.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Banner Peringatan Duplikasi / Konflik yang Elegan & Jelas */}
          {formErrors.conflictDetail && (
            <div className="alert-banner" style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.82rem',
              lineHeight: '1.45'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
              <div>
                <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: '2px' }}>
                  Perhatian: Validasi Konfigurasi Gagal
                </div>
                <div>{formErrors.conflictDetail}</div>
              </div>
            </div>
          )}

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
              disabled={isSaving || (creationMode === 'batch' && selectedDatabasesPusat.length === 0)}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : editingNodeId !== null ? (
                <span>Perbarui Konfigurasi Node</span>
              ) : creationMode === 'batch' ? (
                <span>Simpan Semua ({selectedDatabasesPusat.length} Node Database)</span>
              ) : (
                <span>Simpan Node Database</span>
              )}
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
        onSelectHost={isModalOpen ? handleSelectHostFromScanner : null}
        targetRole={scannerTargetRole}
      />
    </div>
  );
}
