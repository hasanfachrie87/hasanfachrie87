import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Users,
  ArrowLeftRight,
  Search,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  UserCheck,
  GraduationCap,
  ShieldCheck,
  Database,
  RefreshCw,
  Calendar,
  FileText,
  X,
  Copy,
  Check,
  Upload,
  Filter,
  Calculator,
  BookMarked,
  Phone,
  Hash,
  Layers,
  Printer,
  Download,
  Settings,
} from 'lucide-react';
import {
  supabase,
  SUPABASE_URL,
  Book,
  Member,
  LoanTransaction,
  INITIAL_BOOKS,
  INITIAL_MEMBERS,
  INITIAL_LOANS,
  FINE_PER_DAY,
  calculateFine,
  formatRupiah,
  formatDateId,
  SUPABASE_SQL_SCHEMA,
} from './lib/supabase';
import { BookCover } from './components/BookCover';

type UserRole = 'admin' | 'siswa' | null;
type AdminTab = 'ringkasan' | 'buku' | 'anggota' | 'transaksi' | 'supabase';
type StudentTab = 'katalog' | 'riwayat';

const STORAGE_KEYS = {
  BOOKS: 'pustakaedu_books_v1',
  MEMBERS: 'pustakaedu_members_v1',
  LOANS: 'pustakaedu_loans_v1',
  SESSION: 'pustakaedu_session_v1',
  ADMIN_CONFIG: 'pustakaedu_admin_config_v1',
};

interface AdminConfig {
  kepalaNama: string;
  kepalaNip: string;
  jabatan: string;
  namaSekolah: string;
  username: string;
  password: string;
  finePerDay: number;
}

const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  kepalaNama: 'Budi Santoso, S.IP.',
  kepalaNip: '198205142009011004',
  jabatan: 'Kepala Perpustakaan Sekolah',
  namaSekolah: 'SMA Negeri 1 Pustaka Nusantara',
  username: 'admin',
  password: 'admin123',
  finePerDay: FINE_PER_DAY,
};

interface SessionData {
  role: UserRole;
  adminName?: string;
  studentMemberId?: string;
}

export default function App() {
  // Data States
  const [books, setBooks] = useState<Book[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BOOKS);
    return saved ? JSON.parse(saved) : INITIAL_BOOKS;
  });

  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });

  const [loans, setLoans] = useState<LoanTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOANS);
    return saved ? JSON.parse(saved) : INITIAL_LOANS;
  });

  // Admin / Kepala Perpustakaan Configuration State
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_CONFIG);
    return saved ? { ...DEFAULT_ADMIN_CONFIG, ...JSON.parse(saved) } : DEFAULT_ADMIN_CONFIG;
  });
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [adminConfigForm, setAdminConfigForm] = useState<AdminConfig>(adminConfig);

  // Auth / Role Session State
  const [session, setSession] = useState<SessionData>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSION);
    return saved
      ? JSON.parse(saved)
      : { role: 'admin', adminName: 'Budi Santoso, S.IP. (Kepala Pustakawan)' };
  });

  // Login Modal / Screen State
  const [loginRoleTab, setLoginRoleTab] = useState<'admin' | 'siswa'>('admin');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('mb-201');
  const [nisInput, setNisInput] = useState('20241001');
  const [loginError, setLoginError] = useState('');

  // Navigation Tabs
  const [adminTab, setAdminTab] = useState<AdminTab>('ringkasan');
  const [studentTab, setStudentTab] = useState<StudentTab>('katalog');

  // Supabase Synchronization State
  const [isSyncing, setIsSyncing] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('Data tersimpan & disinkronkan dengan klien Supabase');
  const [copiedSql, setCopiedSql] = useState(false);

  // Filters & Search
  const [bookSearch, setBookSearch] = useState('');
  const [bookCategoryFilter, setBookCategoryFilter] = useState('Semua');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberTypeFilter, setMemberTypeFilter] = useState<'Semua' | 'Siswa' | 'Guru'>('Semua');
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState<'Semua' | 'Dipinjam' | 'Terlambat' | 'Dikembalikan'>('Semua');

  // Simulated Date for Fine Testing
  const [simulatedToday, setSimulatedToday] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  // CRUD Modal States - Books
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookForm, setBookForm] = useState({
    judul: '',
    penulis: '',
    penerbit: '',
    tahun_terbit: new Date().getFullYear(),
    kategori: 'Sastra & Fiksi',
    isbn: '',
    stok_total: 5,
    cover_url: '',
  });

  // CRUD Modal States - Members
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberForm, setMemberForm] = useState({
    nomor_induk: '',
    nama: '',
    tipe: 'Siswa' as 'Siswa' | 'Guru',
    kelas_unit: '',
    telepon: '',
  });

  // CRUD Modal States - New Loan
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanForm, setLoanForm] = useState({
    buku_id: '',
    anggota_id: '',
    tanggal_pinjam: new Date().toISOString().split('T')[0],
    tanggal_tenggat: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    })(),
    catatan: '',
  });

  // Return Confirmation Modal State
  const [returningLoan, setReturningLoan] = useState<LoanTransaction | null>(null);
  const [returnDateInput, setReturnDateInput] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  // Monthly Print Report Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState<string>(
    () => new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  // Toast Notification
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  // Persist to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
  }, [loans]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_CONFIG, JSON.stringify(adminConfig));
  }, [adminConfig]);

  // Initial Fetch from Supabase (with automatic fallback if tables not yet created)
  const syncFromSupabase = async (silent = false) => {
    setIsSyncing(true);
    try {
      const [booksRes, membersRes, loansRes] = await Promise.all([
        supabase.from('books').select('*').order('created_at', { ascending: false }),
        supabase.from('members').select('*').order('created_at', { ascending: false }),
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
      ]);

      if (booksRes.error || membersRes.error || loansRes.error) {
        setSupabaseConnected(false);
        setSyncMessage(
          'Klien Supabase aktif. Menggunakan penyimpanan lokal (tabel belum diinisialisasi di Supabase atau mode offline).'
        );
        if (!silent) {
          showToast('Menggunakan data lokal. Buka tab Skema Supabase jika ingin membuat tabel di cloud.', 'warning');
        }
      } else {
        setSupabaseConnected(true);
        if (booksRes.data && booksRes.data.length > 0) setBooks(booksRes.data);
        if (membersRes.data && membersRes.data.length > 0) setMembers(membersRes.data);
        if (loansRes.data && loansRes.data.length > 0) setLoans(loansRes.data);
        setSyncMessage('Terhubung langsung ke tabel cloud Supabase (psgijbjlkmxivkngxljb)');
        if (!silent) {
          showToast('Data berhasil disinkronkan dari Supabase Cloud!', 'success');
        }
      }
    } catch {
      setSupabaseConnected(false);
      setSyncMessage('Mode penyimpanan persisten browser aktif (Supabase siap dihubungkan).');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncFromSupabase(true);
  }, []);

  // Push local seed data to Supabase if cloud tables exist
  const pushAllToSupabase = async () => {
    setIsSyncing(true);
    try {
      const { error: errB } = await supabase.from('books').upsert(books);
      const { error: errM } = await supabase.from('members').upsert(members);
      const { error: errL } = await supabase.from('loans').upsert(loans);

      if (errB || errM || errL) {
        setSupabaseConnected(false);
        showToast(
          'Pastikan tabel books, members, dan loans sudah dibuat di SQL Editor Supabase Anda.',
          'warning'
        );
      } else {
        setSupabaseConnected(true);
        showToast('Seluruh data buku, anggota, dan transaksi berhasil diunggah ke Supabase!', 'success');
      }
    } catch {
      showToast('Gagal menghubungi endpoint Supabase. Data tetap aman di browser.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Derived Categories
  const categories = useMemo(() => {
    const set = new Set<string>(['Sastra & Fiksi', 'Sains & Matematika', 'Teknologi & Komputer', 'Sejarah & Sosial', 'Referensi & Bahasa']);
    books.forEach((b) => set.add(b.kategori));
    return ['Semua', ...Array.from(set)];
  }, [books]);

  // Enriched Loans with Book, Member, and Automatic Fine Calculation
  const enrichedLoans = useMemo(() => {
    return loans.map((loan) => {
      const book = books.find((b) => b.id === loan.buku_id);
      const member = members.find((m) => m.id === loan.anggota_id);
      const fineInfo = calculateFine(
        loan.tanggal_tenggat,
        loan.tanggal_kembali,
        loan.status,
        simulatedToday
      );

      const dynamicFineAmount = fineInfo.lateDays * (adminConfig.finePerDay || FINE_PER_DAY);
      const effectiveFine =
        loan.status === 'Dikembalikan' ? loan.denda_dibayar : dynamicFineAmount;

      return {
        ...loan,
        bookTitle: book?.judul || 'Buku Terhapus',
        bookIsbn: book?.isbn || '-',
        bookCategory: book?.kategori || 'Umum',
        bookCover: book?.cover_url || '',
        memberName: member?.nama || 'Anggota Terhapus',
        memberNomorInduk: member?.nomor_induk || '-',
        memberKelas: member?.kelas_unit || '-',
        memberTipe: member?.tipe || 'Siswa',
        lateDays: fineInfo.lateDays,
        calculatedFine: effectiveFine,
        isOverdue: loan.status === 'Dipinjam' && fineInfo.isOverdue,
      };
    });
  }, [loans, books, members, simulatedToday, adminConfig.finePerDay]);

  // Dashboard Metrics
  const stats = useMemo(() => {
    const totalTitles = books.length;
    const totalExemplars = books.reduce((acc, b) => acc + Number(b.stok_total), 0);
    const availableExemplars = books.reduce((acc, b) => acc + Number(b.stok_tersedia), 0);
    const activeLoans = enrichedLoans.filter((l) => l.status === 'Dipinjam').length;
    const overdueLoans = enrichedLoans.filter((l) => l.isOverdue).length;
    const activeFinePotentials = enrichedLoans
      .filter((l) => l.status === 'Dipinjam')
      .reduce((acc, l) => acc + l.calculatedFine, 0);
    const collectedFines = enrichedLoans
      .filter((l) => l.status === 'Dikembalikan')
      .reduce((acc, l) => acc + l.denda_dibayar, 0);

    return {
      totalTitles,
      totalExemplars,
      availableExemplars,
      activeLoans,
      overdueLoans,
      totalFines: activeFinePotentials + collectedFines,
      activeFinePotentials,
      collectedFines,
    };
  }, [books, enrichedLoans]);

  // Filtered Books
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const matchesCat = bookCategoryFilter === 'Semua' || b.kategori === bookCategoryFilter;
      const q = bookSearch.toLowerCase();
      const matchesQuery =
        !q ||
        b.judul.toLowerCase().includes(q) ||
        b.penulis.toLowerCase().includes(q) ||
        b.penerbit.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [books, bookCategoryFilter, bookSearch]);

  // Filtered Members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesType = memberTypeFilter === 'Semua' || m.tipe === memberTypeFilter;
      const q = memberSearch.toLowerCase();
      const matchesQuery =
        !q ||
        m.nama.toLowerCase().includes(q) ||
        m.nomor_induk.toLowerCase().includes(q) ||
        m.kelas_unit.toLowerCase().includes(q) ||
        m.telepon.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [members, memberTypeFilter, memberSearch]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return enrichedLoans.filter((l) => {
      const matchesStatus =
        loanStatusFilter === 'Semua' ||
        (loanStatusFilter === 'Dipinjam' && l.status === 'Dipinjam') ||
        (loanStatusFilter === 'Terlambat' && l.isOverdue) ||
        (loanStatusFilter === 'Dikembalikan' && l.status === 'Dikembalikan');

      const q = loanSearch.toLowerCase();
      const matchesQuery =
        !q ||
        l.bookTitle.toLowerCase().includes(q) ||
        l.memberName.toLowerCase().includes(q) ||
        l.memberNomorInduk.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [enrichedLoans, loanStatusFilter, loanSearch]);

  // Monthly Loans for 1-Month Print Report
  const monthlyReportLoans = useMemo(() => {
    return enrichedLoans
      .filter((l) => l.tanggal_pinjam.startsWith(reportMonth))
      .sort((a, b) => a.tanggal_pinjam.localeCompare(b.tanggal_pinjam));
  }, [enrichedLoans, reportMonth]);

  const formatMonthLabel = (yyyyMm: string) => {
    try {
      const [y, m] = yyyyMm.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d);
    } catch {
      return yyyyMm;
    }
  };

  const handleDownloadMonthlyCsv = () => {
    const headers = [
      'ID Transaksi',
      'Judul Buku',
      'ISBN',
      'Nama Peminjam',
      'NIS/NIP',
      'Kelas/Unit',
      'Tanggal Pinjam',
      'Batas Tenggat',
      'Tanggal Kembali',
      'Status',
      'Keterlambatan (Hari)',
      'Denda (Rp)',
    ];
    const rows = monthlyReportLoans.map((l) => [
      l.id,
      `"${l.bookTitle.replace(/"/g, '""')}"`,
      l.bookIsbn,
      `"${l.memberName.replace(/"/g, '""')}"`,
      l.memberNomorInduk,
      `"${l.memberKelas.replace(/"/g, '""')}"`,
      l.tanggal_pinjam,
      l.tanggal_tenggat,
      l.tanggal_kembali || '-',
      l.status,
      l.lateDays,
      l.calculatedFine,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Peminjaman_Bulanan_${reportMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Laporan bulan ${formatMonthLabel(reportMonth)} berhasil diunduh (CSV)`);
  };

  // Current Logged-In Student Member
  const activeStudent = useMemo(() => {
    if (session.role !== 'siswa') return null;
    return members.find((m) => m.id === session.studentMemberId) || members[0] || null;
  }, [session, members]);

  const studentLoans = useMemo(() => {
    if (!activeStudent) return [];
    return enrichedLoans.filter((l) => l.anggota_id === activeStudent.id);
  }, [enrichedLoans, activeStudent]);

  // Handlers: Login & Role Switching
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (loginRoleTab === 'admin') {
      if (
        adminUsername.trim().toLowerCase() === adminConfig.username.toLowerCase() &&
        adminPassword === adminConfig.password
      ) {
        setSession({
          role: 'admin',
          adminName: `${adminConfig.kepalaNama} (${adminConfig.jabatan})`,
        });
        showToast('Selamat datang di Panel Admin Perpustakaan', 'success');
      } else {
        setLoginError(
          `Kredensial Admin tidak cocok. Gunakan username: ${adminConfig.username} & sandi: ${adminConfig.password}`
        );
      }
    } else {
      const foundMember = members.find(
        (m) => m.id === selectedStudentId || m.nomor_induk.trim() === nisInput.trim()
      );
      if (foundMember) {
        setSession({
          role: 'siswa',
          studentMemberId: foundMember.id,
        });
        showToast(`Selamat datang, ${foundMember.nama}!`, 'success');
      } else {
        setLoginError('Nomor Induk Siswa/Guru (NIS/NIP) tidak ditemukan dalam database anggota.');
      }
    }
  };

  const handleQuickRoleSwitch = (targetRole: 'admin' | 'siswa') => {
    if (targetRole === 'admin') {
      setSession({
        role: 'admin',
        adminName: `${adminConfig.kepalaNama} (${adminConfig.jabatan})`,
      });
      showToast('Beralih ke tampilan Admin / Pustakawan', 'success');
    } else {
      const firstStudent = members.find((m) => m.tipe === 'Siswa') || members[0];
      setSession({
        role: 'siswa',
        studentMemberId: firstStudent?.id,
      });
      showToast(`Beralih ke tampilan Siswa (${firstStudent?.nama || 'Anggota'})`, 'success');
    }
  };

  const openAdminSettingsModal = () => {
    setAdminConfigForm(adminConfig);
    setIsAdminSettingsOpen(true);
  };

  const handleSaveAdminConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminConfigForm.kepalaNama.trim() || !adminConfigForm.username.trim()) {
      showToast('Nama Kepala Perpustakaan dan Username Admin wajib diisi.', 'warning');
      return;
    }
    const updated: AdminConfig = {
      ...adminConfigForm,
      kepalaNama: adminConfigForm.kepalaNama.trim(),
      kepalaNip: adminConfigForm.kepalaNip.trim(),
      jabatan: adminConfigForm.jabatan.trim() || 'Kepala Perpustakaan Sekolah',
      namaSekolah: adminConfigForm.namaSekolah.trim() || 'Perpustakaan Sekolah',
      username: adminConfigForm.username.trim(),
      password: adminConfigForm.password || 'admin123',
      finePerDay: Math.max(0, Number(adminConfigForm.finePerDay) || FINE_PER_DAY),
    };
    setAdminConfig(updated);
    if (session.role === 'admin') {
      setSession((prev) => ({
        ...prev,
        adminName: `${updated.kepalaNama} (${updated.jabatan})`,
      }));
    }
    setIsAdminSettingsOpen(false);
    showToast('Pengaturan Kepala Perpustakaan / Admin berhasil disimpan!', 'success');
  };

  // Handlers: Books CRUD
  const openAddBookModal = () => {
    setEditingBook(null);
    setBookForm({
      judul: '',
      penulis: '',
      penerbit: '',
      tahun_terbit: new Date().getFullYear(),
      kategori: 'Sastra & Fiksi',
      isbn: `978-602-${Math.floor(100 + Math.random() * 900)}-${Math.floor(10 + Math.random() * 89)}-1`,
      stok_total: 5,
      cover_url: '',
    });
    setIsBookModalOpen(true);
  };

  const openEditBookModal = (book: Book) => {
    setEditingBook(book);
    setBookForm({
      judul: book.judul,
      penulis: book.penulis,
      penerbit: book.penerbit,
      tahun_terbit: book.tahun_terbit,
      kategori: book.kategori,
      isbn: book.isbn,
      stok_total: book.stok_total,
      cover_url: book.cover_url || '',
    });
    setIsBookModalOpen(true);
  };

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 2MB', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBookForm((prev) => ({ ...prev, cover_url: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookForm.judul.trim() || !bookForm.penulis.trim() || !bookForm.isbn.trim()) {
      showToast('Judul, Penulis, dan ISBN wajib diisi', 'warning');
      return;
    }

    if (editingBook) {
      const borrowedCount = editingBook.stok_total - editingBook.stok_tersedia;
      const newTotal = Math.max(borrowedCount, Number(bookForm.stok_total));
      const newAvailable = Math.max(0, newTotal - borrowedCount);

      const updatedBook: Book = {
        ...editingBook,
        judul: bookForm.judul.trim(),
        penulis: bookForm.penulis.trim(),
        penerbit: bookForm.penerbit.trim(),
        tahun_terbit: Number(bookForm.tahun_terbit),
        kategori: bookForm.kategori.trim(),
        isbn: bookForm.isbn.trim(),
        stok_total: newTotal,
        stok_tersedia: newAvailable,
        cover_url: bookForm.cover_url.trim(),
      };

      setBooks((prev) => prev.map((b) => (b.id === editingBook.id ? updatedBook : b)));
      supabase.from('books').upsert(updatedBook).then(() => {});
      showToast(`Data buku "${updatedBook.judul}" berhasil diperbarui`);
    } else {
      const newBook: Book = {
        id: `bk-${Date.now().toString().slice(-5)}`,
        judul: bookForm.judul.trim(),
        penulis: bookForm.penulis.trim(),
        penerbit: bookForm.penerbit.trim() || 'Penerbit Nasional',
        tahun_terbit: Number(bookForm.tahun_terbit) || new Date().getFullYear(),
        kategori: bookForm.kategori.trim() || 'Umum',
        isbn: bookForm.isbn.trim(),
        stok_total: Math.max(1, Number(bookForm.stok_total)),
        stok_tersedia: Math.max(1, Number(bookForm.stok_total)),
        cover_url: bookForm.cover_url.trim(),
      };

      setBooks((prev) => [newBook, ...prev]);
      supabase.from('books').insert(newBook).then(() => {});
      showToast(`Buku "${newBook.judul}" berhasil ditambahkan ke koleksi`);
    }

    setIsBookModalOpen(false);
  };

  const handleDeleteBook = async (book: Book) => {
    const activeLoanForBook = loans.some(
      (l) => l.buku_id === book.id && l.status === 'Dipinjam'
    );
    if (activeLoanForBook) {
      showToast('Buku sedang dipinjam dan tidak dapat dihapus sebelum dikembalikan.', 'error');
      return;
    }

    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    supabase.from('books').delete().eq('id', book.id).then(() => {});
    showToast(`Buku "${book.judul}" telah dihapus dari katalog.`);
  };

  // Handlers: Members CRUD
  const openAddMemberModal = () => {
    setEditingMember(null);
    setMemberForm({
      nomor_induk: `2024${Math.floor(1000 + Math.random() * 8999)}`,
      nama: '',
      tipe: 'Siswa',
      kelas_unit: 'XI MIPA 1',
      telepon: '0812-',
    });
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (member: Member) => {
    setEditingMember(member);
    setMemberForm({
      nomor_induk: member.nomor_induk,
      nama: member.nama,
      tipe: member.tipe,
      kelas_unit: member.kelas_unit,
      telepon: member.telepon,
    });
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.nomor_induk.trim() || !memberForm.nama.trim()) {
      showToast('NIS/NIP dan Nama Lengkap wajib diisi', 'warning');
      return;
    }

    if (editingMember) {
      const updated: Member = {
        ...editingMember,
        nomor_induk: memberForm.nomor_induk.trim(),
        nama: memberForm.nama.trim(),
        tipe: memberForm.tipe,
        kelas_unit: memberForm.kelas_unit.trim(),
        telepon: memberForm.telepon.trim(),
      };
      setMembers((prev) => prev.map((m) => (m.id === editingMember.id ? updated : m)));
      supabase.from('members').upsert(updated).then(() => {});
      showToast(`Data anggota "${updated.nama}" berhasil diperbarui`);
    } else {
      const duplicate = members.some(
        (m) => m.nomor_induk.toLowerCase() === memberForm.nomor_induk.trim().toLowerCase()
      );
      if (duplicate) {
        showToast('Nomor Induk (NIS/NIP) sudah terdaftar pada anggota lain.', 'error');
        return;
      }

      const newMember: Member = {
        id: `mb-${Date.now().toString().slice(-5)}`,
        nomor_induk: memberForm.nomor_induk.trim(),
        nama: memberForm.nama.trim(),
        tipe: memberForm.tipe,
        kelas_unit: memberForm.kelas_unit.trim() || 'X Merdeka 1',
        telepon: memberForm.telepon.trim() || '-',
      };
      setMembers((prev) => [newMember, ...prev]);
      supabase.from('members').insert(newMember).then(() => {});
      showToast(`Anggota baru "${newMember.nama}" berhasil didaftarkan`);
    }

    setIsMemberModalOpen(false);
  };

  const handleDeleteMember = (member: Member) => {
    const hasActiveLoan = loans.some(
      (l) => l.anggota_id === member.id && l.status === 'Dipinjam'
    );
    if (hasActiveLoan) {
      showToast('Anggota masih memiliki tanggungan peminjaman buku aktif.', 'error');
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    supabase.from('members').delete().eq('id', member.id).then(() => {});
    showToast(`Data anggota "${member.nama}" telah dihapus.`);
  };

  // Handlers: Loan & Return Transactions
  const openNewLoanModal = (preselectedBookId?: string) => {
    const availableBooks = books.filter((b) => b.stok_tersedia > 0);
    const defaultBookId = preselectedBookId || availableBooks[0]?.id || '';
    const defaultMemberId = members[0]?.id || '';

    const todayStr = simulatedToday;
    const dueObj = new Date(`${todayStr}T00:00:00`);
    dueObj.setDate(dueObj.getDate() + 7);
    const dueStr = dueObj.toISOString().split('T')[0];

    setLoanForm({
      buku_id: defaultBookId,
      anggota_id: defaultMemberId,
      tanggal_pinjam: todayStr,
      tanggal_tenggat: dueStr,
      catatan: '',
    });
    setIsLoanModalOpen(true);
  };

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const targetBook = books.find((b) => b.id === loanForm.buku_id);
    const targetMember = members.find((m) => m.id === loanForm.anggota_id);

    if (!targetBook || !targetMember) {
      showToast('Pilih buku dan anggota peminjam terlebih dahulu.', 'warning');
      return;
    }

    if (targetBook.stok_tersedia <= 0) {
      showToast('Stok buku ini sedang habis dipinjam.', 'error');
      return;
    }

    if (loanForm.tanggal_tenggat < loanForm.tanggal_pinjam) {
      showToast('Tanggal batas tenggat tidak boleh lebih awal dari tanggal pinjam.', 'warning');
      return;
    }

    const newLoan: LoanTransaction = {
      id: `trx-${Date.now().toString().slice(-5)}`,
      buku_id: targetBook.id,
      anggota_id: targetMember.id,
      tanggal_pinjam: loanForm.tanggal_pinjam,
      tanggal_tenggat: loanForm.tanggal_tenggat,
      tanggal_kembali: null,
      status: 'Dipinjam',
      denda_dibayar: 0,
      catatan: loanForm.catatan.trim() || 'Peminjaman reguler perpustakaan',
    };

    const updatedBook: Book = {
      ...targetBook,
      stok_tersedia: Math.max(0, targetBook.stok_tersedia - 1),
    };

    setLoans((prev) => [newLoan, ...prev]);
    setBooks((prev) => prev.map((b) => (b.id === targetBook.id ? updatedBook : b)));

    supabase.from('loans').insert(newLoan).then(() => {});
    supabase.from('books').upsert(updatedBook).then(() => {});

    setIsLoanModalOpen(false);
    showToast(`Peminjaman "${targetBook.judul}" oleh ${targetMember.nama} berhasil dicatat!`);
  };

  const openReturnDialog = (loan: LoanTransaction) => {
    setReturningLoan(loan);
    setReturnDateInput(simulatedToday);
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningLoan) return;

    const fineResult = calculateFine(
      returningLoan.tanggal_tenggat,
      returnDateInput,
      'Dikembalikan'
    );

    const updatedLoan: LoanTransaction = {
      ...returningLoan,
      tanggal_kembali: returnDateInput,
      status: 'Dikembalikan',
      denda_dibayar: fineResult.fineAmount,
    };

    setLoans((prev) => prev.map((l) => (l.id === returningLoan.id ? updatedLoan : l)));

    const book = books.find((b) => b.id === returningLoan.buku_id);
    if (book) {
      const updatedBook: Book = {
        ...book,
        stok_tersedia: Math.min(book.stok_total, book.stok_tersedia + 1),
      };
      setBooks((prev) => prev.map((b) => (b.id === book.id ? updatedBook : b)));
      supabase.from('books').upsert(updatedBook).then(() => {});
    }

    supabase.from('loans').upsert(updatedLoan).then(() => {});

    setReturningLoan(null);
    if (fineResult.fineAmount > 0) {
      showToast(
        `Buku dikembalikan. Denda keterlambatan ${fineResult.lateDays} hari sebesar ${formatRupiah(
          fineResult.fineAmount
        )} telah dicatat.`,
        'warning'
      );
    } else {
      showToast('Buku berhasil dikembalikan tepat waktu tanpa denda!', 'success');
    }
  };

  const handleDeleteLoan = (loan: LoanTransaction) => {
    if (loan.status === 'Dipinjam') {
      const book = books.find((b) => b.id === loan.buku_id);
      if (book) {
        const updatedBook = {
          ...book,
          stok_tersedia: Math.min(book.stok_total, book.stok_tersedia + 1),
        };
        setBooks((prev) => prev.map((b) => (b.id === book.id ? updatedBook : b)));
        supabase.from('books').upsert(updatedBook).then(() => {});
      }
    }
    setLoans((prev) => prev.filter((l) => l.id !== loan.id));
    supabase.from('loans').delete().eq('id', loan.id).then(() => {});
    showToast('Data riwayat transaksi dihapus.');
  };

  // Student Self-Borrow Handler (from Student Portal)
  const handleStudentBorrow = (book: Book) => {
    if (!activeStudent) return;
    if (book.stok_tersedia <= 0) {
      showToast('Maaf, stok buku ini sedang habis dipinjam.', 'error');
      return;
    }

    const alreadyBorrowingSameBook = loans.some(
      (l) =>
        l.anggota_id === activeStudent.id &&
        l.buku_id === book.id &&
        l.status === 'Dipinjam'
    );
    if (alreadyBorrowingSameBook) {
      showToast('Anda sedang meminjam buku yang sama dan belum dikembalikan.', 'warning');
      return;
    }

    const todayStr = simulatedToday;
    const dueObj = new Date(`${todayStr}T00:00:00`);
    dueObj.setDate(dueObj.getDate() + 7);
    const dueStr = dueObj.toISOString().split('T')[0];

    const newLoan: LoanTransaction = {
      id: `trx-${Date.now().toString().slice(-5)}`,
      buku_id: book.id,
      anggota_id: activeStudent.id,
      tanggal_pinjam: todayStr,
      tanggal_tenggat: dueStr,
      tanggal_kembali: null,
      status: 'Dipinjam',
      denda_dibayar: 0,
      catatan: 'Pengajuan pinjam mandiri via Portal Siswa',
    };

    const updatedBook: Book = {
      ...book,
      stok_tersedia: Math.max(0, book.stok_tersedia - 1),
    };

    setLoans((prev) => [newLoan, ...prev]);
    setBooks((prev) => prev.map((b) => (b.id === book.id ? updatedBook : b)));

    supabase.from('loans').insert(newLoan).then(() => {});
    supabase.from('books').upsert(updatedBook).then(() => {});

    showToast(
      `Berhasil meminjam "${book.judul}". Batas pengembalian: ${formatDateId(dueStr)}`,
      'success'
    );
  };

  // LOGIN SCREEN IF NO ACTIVE ROLE
  if (!session.role) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">PustakaEdu</h1>
              <p className="text-xs text-slate-500">Sistem Informasi Perpustakaan Sekolah</p>
            </div>
          </div>

          {/* Role Selector Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginRoleTab('admin');
                setLoginError('');
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                loginRoleTab === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin / Pustakawan
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginRoleTab('siswa');
                setLoginError('');
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                loginRoleTab === 'siswa'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Portal Siswa / Guru
            </button>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginRoleTab === 'admin' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Username Pustakawan
                  </label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="Masukkan username (admin)"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Kata Sandi
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan kata sandi (admin123)"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <p className="font-medium text-slate-800 mb-1">Akses Demo Pustakawan:</p>
                  <p className="font-mono">Username: admin · Sandi: admin123</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Pilih Akun Anggota (Siswa / Guru)
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      const found = members.find((m) => m.id === e.target.value);
                      if (found) setNisInput(found.nomor_induk);
                    }}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nomor_induk} — {m.nama} ({m.kelas_unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Atau Ketik Nomor Induk (NIS / NIP)
                  </label>
                  <input
                    type="text"
                    value={nisInput}
                    onChange={(e) => setNisInput(e.target.value)}
                    placeholder="Contoh: 20241001"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  Siswa dan Guru dapat mencari katalog buku perpustakaan, memeriksa ketersediaan stok, dan memantau riwayat pinjam beserta denda keterlambatan.
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Masuk ke Sistem Perpustakaan
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN WORKSPACE
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center gap-3 text-xs font-medium no-print">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* TOP BAR CONTRACT: 3 Zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 sticky top-0 z-30 no-print">
        {/* Zone 1: Brand Title, One Line */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            if (session.role === 'admin') setAdminTab('ringkasan');
            else setStudentTab('katalog');
          }}
          className="text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          PustakaEdu
        </a>

        {/* Zone 2: 4-5 Concise Single-Line Nav Links */}
        {session.role === 'admin' ? (
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
            <button
              type="button"
              onClick={() => setAdminTab('ringkasan')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                adminTab === 'ringkasan'
                  ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Ringkasan
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('buku')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                adminTab === 'buku'
                  ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Manajemen Buku
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('anggota')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                adminTab === 'anggota'
                  ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Manajemen Anggota
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('transaksi')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                adminTab === 'transaksi'
                  ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Peminjaman & Denda
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('supabase')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                adminTab === 'supabase'
                  ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Database Supabase
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStudentTab('katalog')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studentTab === 'katalog'
                  ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Pencarian Katalog Buku
            </button>
            <button
              type="button"
              onClick={() => setStudentTab('riwayat')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studentTab === 'riwayat'
                  ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Riwayat Pinjam & Denda Saya
            </button>
          </nav>
        )}

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setSession({ role: null })}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Ganti Akun / Keluar
          </button>
        </div>
      </header>

      {/* WORKSPACE ROLE & CONTEXT TOOLBAR (Below Header) */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              {adminConfig.namaSekolah}
            </span>
            <span aria-hidden="true">·</span>
            {session.role === 'admin' ? (
              <span>
                {adminConfig.kepalaNama} (NIP: <span className="font-mono">{adminConfig.kepalaNip}</span>)
              </span>
            ) : (
              <span>
                {activeStudent?.nama} ({activeStudent?.nomor_induk} / {activeStudent?.kelas_unit})
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-500">
              Tarif Denda: {formatRupiah(adminConfig.finePerDay)}/hari
            </span>
          </div>

          {/* Interactive Role Switcher, Date Simulation & Admin Settings Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {session.role === 'admin' && (
              <button
                type="button"
                onClick={openAdminSettingsModal}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-600" />
                Pengaturan Kepala Perpustakaan / Admin
              </button>
            )}
            {session.role === 'siswa' && (
              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-slate-500 whitespace-nowrap">Simulasi Anggota:</label>
                <select
                  value={activeStudent?.id || ''}
                  onChange={(e) =>
                    setSession({ role: 'siswa', studentMemberId: e.target.value })
                  }
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 text-slate-800 font-medium"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.kelas_unit})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="sim-date" className="text-slate-500 whitespace-nowrap">
                Tanggal Hitung Denda:
              </label>
              <input
                id="sim-date"
                type="date"
                value={simulatedToday}
                onChange={(e) => setSimulatedToday(e.target.value)}
                className="px-2 py-1 text-xs font-mono border border-slate-200 rounded-md bg-slate-50 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleQuickRoleSwitch('admin')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  session.role === 'admin'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mode Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickRoleSwitch('siswa')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  session.role === 'siswa'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mode Siswa
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 no-print">
        {/* =========================================================
            ADMIN ROLE VIEWPORT
           ========================================================= */}
        {session.role === 'admin' && (
          <>
            {/* TAB 1: RINGKASAN DASHBOARD */}
            {adminTab === 'ringkasan' && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">
                      Ringkasan Operasional Perpustakaan
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                      Pantau koleksi buku, sirkulasi peminjaman aktif, keterlambatan, dan perhitungan denda otomatis.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={openAdminSettingsModal}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-700" />
                      Pengaturan Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPrintModalOpen(true)}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-700" />
                      Print Peminjaman 1 Bulan
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewLoanModal()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Transaksi Pinjam Baru
                    </button>
                    <button
                      type="button"
                      onClick={openAddBookModal}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      Tambah Buku
                    </button>
                  </div>
                </div>

                {/* 4-Column Metric Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>Koleksi & Eksemplar</span>
                      <BookOpen className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {stats.totalTitles} Judul
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                      {stats.availableExemplars} tersedia / {stats.totalExemplars} total stok
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>Anggota Terdaftar</span>
                      <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {members.length} Anggota
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {members.filter((m) => m.tipe === 'Siswa').length} Siswa ·{' '}
                      {members.filter((m) => m.tipe === 'Guru').length} Guru
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>Sedang Dipinjam</span>
                      <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {stats.activeLoans} Transaksi
                    </p>
                    <p className="text-xs text-red-600 mt-1.5 font-medium">
                      {stats.overdueLoans} melewati batas tenggat
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>Akumulasi Denda (Rp1.000/hr)</span>
                      <Calculator className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {formatRupiah(stats.totalFines)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                      Berjalan: {formatRupiah(stats.activeFinePotentials)} · Lunas:{' '}
                      {formatRupiah(stats.collectedFines)}
                    </p>
                  </div>
                </div>

                {/* Overdue & Active Loans Table Preview */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-display font-semibold text-slate-900">
                        Peminjaman Aktif & Pemantauan Denda Otomatis
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Denda dihitung otomatis sebesar Rp1.000/hari jika tanggal kembali atau tanggal hari ini melewati batas tenggat.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminTab('transaksi')}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Lihat Semua Transaksi →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                          <th className="py-3 px-4">ID / Buku</th>
                          <th className="py-3 px-4">Peminjam (NIS/NIP)</th>
                          <th className="py-3 px-4">Tgl Pinjam</th>
                          <th className="py-3 px-4">Batas Tenggat</th>
                          <th className="py-3 px-4">Status & Keterlambatan</th>
                          <th className="py-3 px-4 text-right">Denda Otomatis</th>
                          <th className="py-3 px-4 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {enrichedLoans
                          .filter((l) => l.status === 'Dipinjam')
                          .map((loan) => (
                            <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-900">{loan.bookTitle}</p>
                                <p className="text-xs text-slate-500 font-mono">
                                  {loan.id} · ISBN {loan.bookIsbn}
                                </p>
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-900">{loan.memberName}</p>
                                <p className="text-xs text-slate-500">
                                  {loan.memberNomorInduk} · {loan.memberKelas}
                                </p>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                                {formatDateId(loan.tanggal_pinjam)}
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-900 font-medium tabular-nums">
                                {formatDateId(loan.tanggal_tenggat)}
                              </td>
                              <td className="py-3 px-4 text-xs">
                                {loan.isOverdue ? (
                                  <span className="text-red-600 font-semibold flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    Terlambat {loan.lateDays} hari
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-medium flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    Dipinjam (Masih dalam tenggat)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-sm">
                                {loan.calculatedFine > 0 ? (
                                  <span className="font-semibold text-red-600">
                                    {formatRupiah(loan.calculatedFine)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Rp 0</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => openReturnDialog(loan)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  Proses Kembali
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MANAJEMEN BUKU (FULL CRUD) */}
            {adminTab === 'buku' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">
                      Manajemen Katalog Buku
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                      Kelola data buku perpustakaan: Judul, Penulis, Penerbit, Tahun Terbit, Kategori, ISBN, Stok, dan Cover Buku.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddBookModal}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap self-start cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Buku Baru
                  </button>
                </div>

                {/* Search & Category Filter Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={bookSearch}
                      onChange={(e) => setBookSearch(e.target.value)}
                      placeholder="Cari judul buku, penulis, penerbit, atau nomor ISBN..."
                      className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBookCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          bookCategoryFilter === cat
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Books Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                          <th className="py-3.5 px-4">Cover & Judul Buku</th>
                          <th className="py-3.5 px-4">Penulis & Penerbit</th>
                          <th className="py-3.5 px-4">Kategori · Tahun</th>
                          <th className="py-3.5 px-4">Nomor ISBN</th>
                          <th className="py-3.5 px-4 text-right">Stok Tersedia</th>
                          <th className="py-3.5 px-4 text-right">Aksi CRUD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredBooks.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-500">
                              Tidak ada data buku yang sesuai dengan pencarian.
                            </td>
                          </tr>
                        ) : (
                          filteredBooks.map((book) => (
                            <tr key={book.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3.5">
                                  <BookCover
                                    title={book.judul}
                                    author={book.penulis}
                                    category={book.kategori}
                                    coverUrl={book.cover_url}
                                    size="sm"
                                  />
                                  <div>
                                    <p className="font-semibold text-slate-900 leading-snug">
                                      {book.judul}
                                    </p>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                                      ID: {book.id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="font-medium text-slate-800">{book.penulis}</p>
                                <p className="text-xs text-slate-500">{book.penerbit}</p>
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-600">
                                <span>{book.kategori}</span>
                                <span aria-hidden="true"> · </span>
                                <span className="font-mono tabular-nums">{book.tahun_terbit}</span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-700 tabular-nums">
                                {book.isbn}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                                <span
                                  className={`font-semibold ${
                                    book.stok_tersedia > 0 ? 'text-emerald-600' : 'text-red-600'
                                  }`}
                                >
                                  {book.stok_tersedia}
                                </span>
                                <span className="text-slate-400"> / {book.stok_total}</span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openNewLoanModal(book.id)}
                                    disabled={book.stok_tersedia <= 0}
                                    className="px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 rounded-md transition-colors cursor-pointer"
                                    title="Pinjamkan Buku Ini"
                                  >
                                    Pinjamkan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditBookModal(book)}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                    title="Edit Buku"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBook(book)}
                                    className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                    title="Hapus Buku"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MANAJEMEN ANGGOTA (SISWA & GURU) */}
            {adminTab === 'anggota' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">
                      Manajemen Anggota (Siswa & Guru)
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                      Kelola data anggota perpustakaan meliputi Nomor Induk (NIS/NIP), Nama Lengkap, Kelas/Unit Kerja, dan Nomor Telepon.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddMemberModal}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap self-start cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Anggota Baru
                  </button>
                </div>

                {/* Member Filter Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Cari NIS/NIP, nama siswa/guru, kelas, atau nomor telepon..."
                      className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(['Semua', 'Siswa', 'Guru'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMemberTypeFilter(t)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                          memberTypeFilter === t
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Members Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                          <th className="py-3.5 px-4">NIS / NIP</th>
                          <th className="py-3.5 px-4">Nama Lengkap Anggota</th>
                          <th className="py-3.5 px-4">Status · Kelas / Unit</th>
                          <th className="py-3.5 px-4">No. Telepon</th>
                          <th className="py-3.5 px-4 text-right">Pinjaman Aktif</th>
                          <th className="py-3.5 px-4 text-right">Aksi CRUD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredMembers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-500">
                              Tidak ditemukan anggota yang cocok dengan pencarian.
                            </td>
                          </tr>
                        ) : (
                          filteredMembers.map((member) => {
                            const activeCount = loans.filter(
                              (l) => l.anggota_id === member.id && l.status === 'Dipinjam'
                            ).length;
                            return (
                              <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                                  {member.nomor_induk}
                                </td>
                                <td className="py-3.5 px-4">
                                  <p className="font-semibold text-slate-900">{member.nama}</p>
                                  <p className="text-xs text-slate-500 font-mono">ID: {member.id}</p>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600">
                                  <span className="font-medium text-slate-800">{member.tipe}</span>
                                  <span aria-hidden="true"> · </span>
                                  <span>{member.kelas_unit}</span>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                                  {member.telepon}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                                  {activeCount > 0 ? (
                                    <span className="font-semibold text-blue-600">
                                      {activeCount} buku
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">0 buku</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditMemberModal(member)}
                                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                      title="Edit Anggota"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMember(member)}
                                      className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                      title="Hapus Anggota"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TRANSAKSI PEMINJAMAN, PENGEMBALIAN & DENDA OTOMATIS */}
            {adminTab === 'transaksi' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">
                      Transaksi Peminjaman & Pengembalian
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                      Catat peminjaman buku, batas tenggat pengembalian, dan proses pengembalian dengan perhitungan denda otomatis Rp1.000/hari.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 self-start">
                    <button
                      type="button"
                      onClick={() => setIsPrintModalOpen(true)}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-700" />
                      Print Data Peminjaman 1 Bulan
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewLoanModal()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Input Peminjaman Buku
                    </button>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={loanSearch}
                      onChange={(e) => setLoanSearch(e.target.value)}
                      placeholder="Cari berdasarkan judul buku, nama peminjam, NIS/NIP, atau ID transaksi..."
                      className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                    {(['Semua', 'Dipinjam', 'Terlambat', 'Dikembalikan'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setLoanStatusFilter(st)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          loanStatusFilter === st
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Loans Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                          <th className="py-3.5 px-4">ID & Buku</th>
                          <th className="py-3.5 px-4">Anggota Peminjam</th>
                          <th className="py-3.5 px-4">Tgl Pinjam</th>
                          <th className="py-3.5 px-4">Batas Tenggat</th>
                          <th className="py-3.5 px-4">Tgl Kembali</th>
                          <th className="py-3.5 px-4">Status Sirkulasi</th>
                          <th className="py-3.5 px-4 text-right">Denda (Rp1.000/hr)</th>
                          <th className="py-3.5 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredLoans.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-500">
                              Belum ada transaksi peminjaman pada filter ini.
                            </td>
                          </tr>
                        ) : (
                          filteredLoans.map((loan) => (
                            <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4">
                                <p className="font-semibold text-slate-900">{loan.bookTitle}</p>
                                <p className="text-xs text-slate-500 font-mono">
                                  {loan.id} · {loan.bookIsbn}
                                </p>
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="font-medium text-slate-900">{loan.memberName}</p>
                                <p className="text-xs text-slate-500">
                                  {loan.memberNomorInduk} · {loan.memberKelas}
                                </p>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                                {formatDateId(loan.tanggal_pinjam)}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-900 font-medium tabular-nums">
                                {formatDateId(loan.tanggal_tenggat)}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                                {formatDateId(loan.tanggal_kembali)}
                              </td>
                              <td className="py-3.5 px-4 text-xs">
                                {loan.status === 'Dikembalikan' ? (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    Dikembalikan
                                  </span>
                                ) : loan.isOverdue ? (
                                  <span className="text-red-600 font-semibold flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    Terlambat ({loan.lateDays} hari)
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-medium flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    Dipinjam
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                                {loan.calculatedFine > 0 ? (
                                  <div>
                                    <span className="font-semibold text-red-600 text-sm">
                                      {formatRupiah(loan.calculatedFine)}
                                    </span>
                                    <p className="text-[11px] text-slate-500">
                                      {loan.status === 'Dikembalikan' ? 'Lunas dibayar' : `${loan.lateDays} hr × Rp1.000`}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Rp 0</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {loan.status === 'Dipinjam' && (
                                    <button
                                      type="button"
                                      onClick={() => openReturnDialog(loan)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer"
                                    >
                                      Kembalikan
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLoan(loan)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                    title="Hapus Transaksi"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: KONFIGURASI & SINKRONISASI SUPABASE */}
            {adminTab === 'supabase' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">
                      Integrasi Cloud Supabase
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                      Koneksi langsung ke project Supabase Anda beserta skrip SQL pembuatan tabel otomatis.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => syncFromSupabase(false)}
                      disabled={isSyncing}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      Tarik Data dari Supabase
                    </button>
                    <button
                      type="button"
                      onClick={pushAllToSupabase}
                      disabled={isSyncing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Unggah Data Lokal ke Supabase
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Endpoint API URL Supabase</p>
                      <p className="font-mono text-xs font-semibold text-slate-900 break-all">
                        {SUPABASE_URL}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Status Sinkronisasi</p>
                      <p className="text-xs font-semibold text-slate-900">{syncMessage}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Skema Tabel PostgreSQL Supabase (books, members, loans)
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                          setCopiedSql(true);
                          setTimeout(() => setCopiedSql(false), 2500);
                          showToast('Skrip SQL berhasil disalin ke clipboard!');
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Salin Skrip SQL
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                      {SUPABASE_SQL_SCHEMA}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* =========================================================
            STUDENT / MEMBER ROLE VIEWPORT (PENCARIAN & RIWAYAT)
           ========================================================= */}
        {session.role === 'siswa' && (
          <div className="space-y-8">
            {/* Student Header Banner */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-medium text-blue-600 mb-1">
                  Portal Anggota Perpustakaan Sekolah
                </p>
                <h1 className="text-2xl font-display font-bold text-slate-900">
                  Halo, {activeStudent?.nama}
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Nomor Induk: <span className="font-mono font-semibold">{activeStudent?.nomor_induk}</span> · Kelas/Unit:{' '}
                  <span className="font-semibold">{activeStudent?.kelas_unit}</span> · Status:{' '}
                  <span>{activeStudent?.tipe}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Sedang Dipinjam</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {studentLoans.filter((l) => l.status === 'Dipinjam').length} Buku
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Riwayat Pinjam</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {studentLoans.length} Transaksi
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tanggungan Denda Berjalan</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-red-600">
                    {formatRupiah(
                      studentLoans
                        .filter((l) => l.status === 'Dipinjam')
                        .reduce((acc, l) => acc + l.calculatedFine, 0)
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* STUDENT TAB 1: PENCARIAN KATALOG BUKU */}
            {studentTab === 'katalog' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={bookSearch}
                      onChange={(e) => setBookSearch(e.target.value)}
                      placeholder="Cari judul buku pelajaran, novel, penulis, penerbit, atau ISBN..."
                      className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBookCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          bookCategoryFilter === cat
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Book Catalog Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredBooks.map((book) => {
                    const isBorrowedByMe = studentLoans.some(
                      (l) => l.buku_id === book.id && l.status === 'Dipinjam'
                    );
                    return (
                      <div
                        key={book.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4 justify-between"
                      >
                        <BookCover
                          title={book.judul}
                          author={book.penulis}
                          category={book.kategori}
                          coverUrl={book.cover_url}
                          size="md"
                        />
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <p className="text-xs text-slate-500">
                              {book.kategori} · <span className="font-mono">{book.tahun_terbit}</span>
                            </p>
                            <h3 className="text-base font-display font-bold text-slate-900 mt-0.5 line-clamp-2">
                              {book.judul}
                            </h3>
                            <p className="text-xs text-slate-700 font-medium mt-1">
                              {book.penulis}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {book.penerbit} · <span className="font-mono">{book.isbn}</span>
                            </p>
                          </div>

                          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="text-xs font-mono tabular-nums">
                              {book.stok_tersedia > 0 ? (
                                <span className="text-emerald-700 font-semibold">
                                  Tersedia: {book.stok_tersedia}/{book.stok_total}
                                </span>
                              ) : (
                                <span className="text-red-600 font-semibold">Stok Habis (0)</span>
                              )}
                            </div>

                            {isBorrowedByMe ? (
                              <span className="text-xs font-semibold text-blue-600">
                                Sedang Anda Pinjam
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStudentBorrow(book)}
                                disabled={book.stok_tersedia <= 0}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Pinjam Buku
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STUDENT TAB 2: RIWAYAT PINJAM & DENDA SAYA */}
            {studentTab === 'riwayat' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-display font-semibold text-slate-900">
                    Riwayat Peminjaman & Perhitungan Denda Saya
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Daftar buku yang sedang atau pernah Anda pinjam beserta status pengembalian dan rincian denda keterlambatan (Rp1.000/hari).
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                        <th className="py-3.5 px-4">Judul Buku</th>
                        <th className="py-3.5 px-4">Tanggal Pinjam</th>
                        <th className="py-3.5 px-4">Batas Tenggat</th>
                        <th className="py-3.5 px-4">Tanggal Kembali</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Rincian Denda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {studentLoans.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500">
                            Anda belum memiliki riwayat peminjaman buku. Silakan pilih buku pada tab Pencarian Katalog Buku.
                          </td>
                        </tr>
                      ) : (
                        studentLoans.map((loan) => (
                          <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-900">{loan.bookTitle}</p>
                              <p className="text-xs text-slate-500 font-mono">
                                ID Pinjam: {loan.id} · ISBN {loan.bookIsbn}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                              {formatDateId(loan.tanggal_pinjam)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-900 font-medium tabular-nums">
                              {formatDateId(loan.tanggal_tenggat)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                              {formatDateId(loan.tanggal_kembali)}
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              {loan.status === 'Dikembalikan' ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  Sudah Dikembalikan
                                </span>
                              ) : loan.isOverdue ? (
                                <span className="text-red-600 font-semibold flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  Terlambat {loan.lateDays} hari
                                </span>
                              ) : (
                                <span className="text-amber-700 font-medium flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  Sedang Dipinjam
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                              {loan.calculatedFine > 0 ? (
                                <div>
                                  <span className="font-semibold text-red-600 text-sm">
                                    {formatRupiah(loan.calculatedFine)}
                                  </span>
                                  <p className="text-[11px] text-slate-500">
                                    {loan.status === 'Dikembalikan'
                                      ? 'Telah diselesaikan'
                                      : `Terlambat ${loan.lateDays} hari × Rp1.000`}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Rp 0 (Tepat Waktu)</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================
          MODAL 1: FORM INPUT / EDIT BUKU
         ========================================================= */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-lg font-display font-bold text-slate-900">
                {editingBook ? 'Edit Data Buku' : 'Input Data Buku Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsBookModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Judul Buku *
                  </label>
                  <input
                    type="text"
                    value={bookForm.judul}
                    onChange={(e) => setBookForm({ ...bookForm, judul: e.target.value })}
                    placeholder="Contoh: Bumi Manusia"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Penulis / Pengarang *
                  </label>
                  <input
                    type="text"
                    value={bookForm.penulis}
                    onChange={(e) => setBookForm({ ...bookForm, penulis: e.target.value })}
                    placeholder="Nama penulis"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Penerbit *
                  </label>
                  <input
                    type="text"
                    value={bookForm.penerbit}
                    onChange={(e) => setBookForm({ ...bookForm, penerbit: e.target.value })}
                    placeholder="Nama penerbit"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tahun Terbit *
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={bookForm.tahun_terbit}
                    onChange={(e) =>
                      setBookForm({ ...bookForm, tahun_terbit: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori *
                  </label>
                  <input
                    type="text"
                    list="kategori-options"
                    value={bookForm.kategori}
                    onChange={(e) => setBookForm({ ...bookForm, kategori: e.target.value })}
                    placeholder="Pilih atau ketik kategori"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                  <datalist id="kategori-options">
                    <option value="Sastra & Fiksi" />
                    <option value="Sains & Matematika" />
                    <option value="Teknologi & Komputer" />
                    <option value="Sejarah & Sosial" />
                    <option value="Referensi & Bahasa" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nomor ISBN *
                  </label>
                  <input
                    type="text"
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                    placeholder="978-602-..."
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jumlah Stok Eksemplar *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={bookForm.stok_total}
                    onChange={(e) =>
                      setBookForm({ ...bookForm, stok_total: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Cover Buku (Unggah File Gambar atau Masukkan URL)
                  </label>
                  <div className="flex items-center gap-3">
                    <BookCover
                      title={bookForm.judul || 'Judul Buku'}
                      author={bookForm.penulis || 'Penulis'}
                      category={bookForm.kategori}
                      coverUrl={bookForm.cover_url}
                      size="sm"
                    />
                    <div className="flex-1 space-y-2">
                      <input
                        type="url"
                        value={bookForm.cover_url}
                        onChange={(e) => setBookForm({ ...bookForm, cover_url: e.target.value })}
                        placeholder="https://... (Opsional, otomatis membuat sampul tipografi jika kosong)"
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium cursor-pointer inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          Pilih File Gambar Sampul
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverFileUpload}
                            className="hidden"
                          />
                        </label>
                        {bookForm.cover_url && (
                          <button
                            type="button"
                            onClick={() => setBookForm({ ...bookForm, cover_url: '' })}
                            className="text-xs text-red-600 hover:underline cursor-pointer"
                          >
                            Reset Sampul
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  {editingBook ? 'Simpan Perubahan' : 'Simpan Buku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: FORM INPUT / EDIT ANGGOTA (SISWA & GURU)
         ========================================================= */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-lg font-display font-bold text-slate-900">
                {editingMember ? 'Edit Data Anggota' : 'Registrasi Anggota Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kategori Anggota *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Siswa', 'Guru'] as const).map((tipe) => (
                    <button
                      key={tipe}
                      type="button"
                      onClick={() => setMemberForm({ ...memberForm, tipe })}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        memberForm.tipe === tipe
                          ? 'bg-blue-50 border-blue-600 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tipe}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {memberForm.tipe === 'Siswa' ? 'Nomor Induk Siswa (NIS) *' : 'Nomor Induk Pegawai (NIP) *'}
                </label>
                <input
                  type="text"
                  value={memberForm.nomor_induk}
                  onChange={(e) => setMemberForm({ ...memberForm, nomor_induk: e.target.value })}
                  placeholder={memberForm.tipe === 'Siswa' ? 'Contoh: 20241005' : 'Contoh: 19880312201501'}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  value={memberForm.nama}
                  onChange={(e) => setMemberForm({ ...memberForm, nama: e.target.value })}
                  placeholder="Nama lengkap siswa atau guru"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {memberForm.tipe === 'Siswa' ? 'Kelas / Jurusan *' : 'Unit Kerja / Mata Pelajaran *'}
                </label>
                <input
                  type="text"
                  value={memberForm.kelas_unit}
                  onChange={(e) => setMemberForm({ ...memberForm, kelas_unit: e.target.value })}
                  placeholder={memberForm.tipe === 'Siswa' ? 'Contoh: XII MIPA 2' : 'Contoh: Guru Matematika'}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nomor Telepon / WhatsApp *
                </label>
                <input
                  type="text"
                  value={memberForm.telepon}
                  onChange={(e) => setMemberForm({ ...memberForm, telepon: e.target.value })}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  {editingMember ? 'Simpan Perubahan' : 'Daftarkan Anggota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: FORM PEMINJAMAN BUKU BARU
         ========================================================= */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Form Transaksi Peminjaman Buku
              </h2>
              <button
                type="button"
                onClick={() => setIsLoanModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pilih Buku yang Dipinjam *
                </label>
                <select
                  value={loanForm.buku_id}
                  onChange={(e) => setLoanForm({ ...loanForm, buku_id: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.stok_tersedia <= 0}>
                      {b.judul} — (Stok: {b.stok_tersedia}/{b.stok_total})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pilih Anggota Peminjam (Siswa / Guru) *
                </label>
                <select
                  value={loanForm.anggota_id}
                  onChange={(e) => setLoanForm({ ...loanForm, anggota_id: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nomor_induk} — {m.nama} ({m.kelas_unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Pinjam *
                  </label>
                  <input
                    type="date"
                    value={loanForm.tanggal_pinjam}
                    onChange={(e) => setLoanForm({ ...loanForm, tanggal_pinjam: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Batas Tenggat Kembali *
                  </label>
                  <input
                    type="date"
                    value={loanForm.tanggal_tenggat}
                    onChange={(e) => setLoanForm({ ...loanForm, tanggal_tenggat: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Peminjaman (Opsional)
                </label>
                <input
                  type="text"
                  value={loanForm.catatan}
                  onChange={(e) => setLoanForm({ ...loanForm, catatan: e.target.value })}
                  placeholder="Contoh: Peminjaman mingguan reguler"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Apabila buku dikembalikan melewati tanggal batas tenggat, sistem otomatis menghitung denda keterlambatan sebesar <span className="font-mono font-semibold text-slate-900">Rp1.000 / hari</span>.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Simpan Transaksi Pinjam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 4: KONFIRMASI PENGEMBALIAN & KALKULASI DENDA OTOMATIS
         ========================================================= */}
      {returningLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Proses Pengembalian & Hitung Denda
              </h2>
              <button
                type="button"
                onClick={() => setReturningLoan(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const book = books.find((b) => b.id === returningLoan.buku_id);
              const member = members.find((m) => m.id === returningLoan.anggota_id);
              const previewFine = calculateFine(
                returningLoan.tanggal_tenggat,
                returnDateInput,
                'Dikembalikan'
              );

              return (
                <form onSubmit={handleConfirmReturn} className="space-y-4 mt-4">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <p className="font-semibold text-slate-900 text-sm">{book?.judul}</p>
                    <p className="text-slate-600">
                      Peminjam: <span className="font-medium text-slate-900">{member?.nama}</span> ({member?.nomor_induk})
                    </p>
                    <p className="text-slate-600 font-mono">
                      Tgl Pinjam: {formatDateId(returningLoan.tanggal_pinjam)} · Tenggat:{' '}
                      <span className="font-semibold text-slate-900">
                        {formatDateId(returningLoan.tanggal_tenggat)}
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Aktual Pengembalian Buku *
                    </label>
                    <input
                      type="date"
                      value={returnDateInput}
                      onChange={(e) => setReturnDateInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      required
                    />
                  </div>

                  {/* Automatic Fine Box */}
                  <div
                    className={`p-4 rounded-lg border ${
                      previewFine.isOverdue
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Status Pengembalian:</span>
                      <span className="text-xs font-mono font-bold">
                        {previewFine.isOverdue
                          ? `Terlambat ${previewFine.lateDays} Hari`
                          : 'Tepat Waktu (0 Hari)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10">
                      <span className="text-xs font-semibold">
                        Total Denda Otomatis (Rp1.000/hari):
                      </span>
                      <span className="text-base font-mono font-bold tabular-nums">
                        {formatRupiah(previewFine.fineAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setReturningLoan(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                    >
                      Konfirmasi Buku Kembali
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 5: PRINT LAPORAN PEMINJAMAN BUKU 1 BULAN
         ========================================================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl p-6 shadow-xl my-8 print-only-sheet">
            {/* Modal Control Bar (Hidden when printing) */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-200 no-print">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-display font-bold text-slate-900">
                    Cetak Laporan Peminjaman Buku Bulanan (1 Bulan)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pilih periode bulan peminjaman lalu klik Cetak / Simpan PDF atau Unduh CSV.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <label htmlFor="report-month-picker" className="text-xs font-medium text-slate-700">
                    Periode Bulan:
                  </label>
                  <input
                    id="report-month-picker"
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="text-xs font-mono font-semibold text-slate-900 bg-white px-2 py-1 rounded border border-slate-300"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleDownloadMonthlyCsv}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh CSV
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / Simpan PDF
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Official School Library Report Sheet */}
            <div className="space-y-6 text-slate-900">
              {/* Official School Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    {adminConfig.namaSekolah}
                  </p>
                  <h1 className="text-xl font-display font-bold text-slate-900 mt-0.5">
                    LAPORAN REKAPITULASI PEMINJAMAN BUKU BULANAN
                  </h1>
                  <p className="text-xs text-slate-600 mt-1">
                    Periode Bulan: <span className="font-semibold text-slate-900">{formatMonthLabel(reportMonth)}</span>
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-600 sm:text-right">
                  <p>Tanggal Cetak: {formatDateId(new Date().toISOString().split('T')[0])}</p>
                  <p>Tarif Denda: {formatRupiah(adminConfig.finePerDay)} / hari</p>
                </div>
              </div>

              {/* Monthly Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                  <p className="text-[11px] text-slate-500">Total Peminjaman (1 Bulan)</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {monthlyReportLoans.length} Transaksi
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                  <p className="text-[11px] text-slate-500">Sudah Dikembalikan</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                    {monthlyReportLoans.filter((l) => l.status === 'Dikembalikan').length} Buku
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                  <p className="text-[11px] text-slate-500">Masih Dipinjam / Terlambat</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-0.5">
                    {monthlyReportLoans.filter((l) => l.status === 'Dipinjam').length} Buku (
                    {monthlyReportLoans.filter((l) => l.isOverdue).length} Terlambat)
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                  <p className="text-[11px] text-slate-500">Total Denda Bulan Ini</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-red-600 mt-0.5">
                    {formatRupiah(
                      monthlyReportLoans.reduce((acc, l) => acc + l.calculatedFine, 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Monthly Report Data Table */}
              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3 border-r border-slate-200">No</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ID Pinjam</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Judul Buku & ISBN</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Nama Peminjam (NIS/NIP)</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Kelas / Unit</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Tgl Pinjam</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Batas Tenggat</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Tgl Kembali</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Status</th>
                      <th className="py-2.5 px-3 text-right">Denda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {monthlyReportLoans.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500">
                          Tidak ada transaksi peminjaman buku pada periode bulan {formatMonthLabel(reportMonth)}.
                        </td>
                      </tr>
                    ) : (
                      monthlyReportLoans.map((loan, idx) => (
                        <tr key={loan.id}>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono">
                            {loan.id}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <p className="font-semibold text-slate-900">{loan.bookTitle}</p>
                            <p className="text-[11px] font-mono text-slate-500">{loan.bookIsbn}</p>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <p className="font-medium text-slate-900">{loan.memberName}</p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {loan.memberNomorInduk}
                            </p>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            {loan.memberKelas}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums">
                            {formatDateId(loan.tanggal_pinjam)}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums">
                            {formatDateId(loan.tanggal_tenggat)}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums">
                            {formatDateId(loan.tanggal_kembali)}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            {loan.status === 'Dikembalikan'
                              ? 'Dikembalikan'
                              : loan.isOverdue
                              ? `Terlambat (${loan.lateDays} hr)`
                              : 'Dipinjam'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-medium">
                            {formatRupiah(loan.calculatedFine)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {monthlyReportLoans.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                        <td colSpan={9} className="py-2.5 px-3 text-right border-r border-slate-200">
                          Total Akumulasi Denda Periode {formatMonthLabel(reportMonth)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                          {formatRupiah(
                            monthlyReportLoans.reduce((acc, l) => acc + l.calculatedFine, 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Signature Block for Official Printout */}
              <div className="pt-6 flex items-center justify-between text-xs text-slate-700">
                <div>
                  <p className="text-slate-500">Dicetak melalui Sistem Informasi Perpustakaan PustakaEdu</p>
                  <p className="text-slate-500 mt-0.5">{adminConfig.namaSekolah}</p>
                </div>
                <div className="text-center min-w-[220px]">
                  <p>Mengetahui,</p>
                  <p className="font-semibold">{adminConfig.jabatan}</p>
                  <div className="h-14" />
                  <p className="font-semibold underline text-slate-900">
                    {adminConfig.kepalaNama}
                  </p>
                  {adminConfig.kepalaNip && (
                    <p className="font-mono text-[11px] text-slate-600 mt-0.5">
                      NIP. {adminConfig.kepalaNip}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 6: PENGATURAN KEPALA PERPUSTAKAAN / ADMIN
         ========================================================= */}
      {isAdminSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-slate-900">
                    Pengaturan Kepala Perpustakaan & Admin
                  </h2>
                  <p className="text-xs text-slate-500">
                    Atur identitas pejabat penandatangan laporan, instansi sekolah, tarif denda, dan akun login Admin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminSettingsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminConfig} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Sekolah / Instansi Perpustakaan *
                  </label>
                  <input
                    type="text"
                    value={adminConfigForm.namaSekolah}
                    onChange={(e) =>
                      setAdminConfigForm({ ...adminConfigForm, namaSekolah: e.target.value })
                    }
                    placeholder="Contoh: SMA Negeri 1 Pustaka Nusantara"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Lengkap Kepala Perpustakaan *
                  </label>
                  <input
                    type="text"
                    value={adminConfigForm.kepalaNama}
                    onChange={(e) =>
                      setAdminConfigForm({ ...adminConfigForm, kepalaNama: e.target.value })
                    }
                    placeholder="Contoh: Budi Santoso, S.IP."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NIP Kepala Perpustakaan *
                  </label>
                  <input
                    type="text"
                    value={adminConfigForm.kepalaNip}
                    onChange={(e) =>
                      setAdminConfigForm({ ...adminConfigForm, kepalaNip: e.target.value })
                    }
                    placeholder="Contoh: 198205142009011004"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jabatan Penandatangan *
                  </label>
                  <input
                    type="text"
                    value={adminConfigForm.jabatan}
                    onChange={(e) =>
                      setAdminConfigForm({ ...adminConfigForm, jabatan: e.target.value })
                    }
                    placeholder="Kepala Perpustakaan Sekolah"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tarif Denda Keterlambatan (Rp / Hari) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={adminConfigForm.finePerDay}
                    onChange={(e) =>
                      setAdminConfigForm({
                        ...adminConfigForm,
                        finePerDay: Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Username Login Admin *
                  </label>
                  <input
                    type="text"
                    value={adminConfigForm.username}
                    onChange={(e) =>
                      setAdminConfigForm({ ...adminConfigForm, username: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kata Sandi Login Admin *
                  </label>
                  <input
                    type="text"
                    value={adminConfigForm.password}
                    onChange={(e) =>
                      setAdminConfigForm({ ...adminConfigForm, password: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Perubahan nama Kepala Perpustakaan, NIP, dan nama sekolah akan otomatis diterapkan pada kop dan kolom tanda tangan saat mencetak **Laporan Peminjaman 1 Bulan**.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdminSettingsOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Simpan Pengaturan Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 mt-auto no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>PustakaEdu — Sistem Aplikasi Perpustakaan Sekolah Berbasis Web</span>
          <span className="font-mono">Terintegrasi dengan Supabase ({SUPABASE_URL})</span>
        </div>
      </footer>
    </div>
  );
}
