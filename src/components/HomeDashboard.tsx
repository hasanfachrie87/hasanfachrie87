import React, { useState, useMemo } from 'react';
import {
  Search,
  Bell,
  User,
  BookOpen,
  BookMarked,
  Star,
  Home,
  Compass,
  Clock,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Printer,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { Book, Member, LoanTransaction, formatRupiah, formatDateId, FINE_PER_DAY } from '../lib/supabase';
import { BookCover } from './BookCover';

export type FrontNavTab = 'beranda' | 'katalog' | 'riwayat' | 'kartu';

interface EnrichedLoan extends LoanTransaction {
  bookTitle: string;
  bookIsbn: string;
  bookCategory: string;
  bookCover: string;
  memberName: string;
  memberNomorInduk: string;
  memberKelas: string;
  memberTipe: 'Siswa' | 'Guru';
  lateDays: number;
  calculatedFine: number;
  isOverdue: boolean;
}

interface HomeDashboardProps {
  appName: string;
  schoolName: string;
  books: Book[];
  members: Member[];
  activeStudent: Member | null;
  studentLoans: EnrichedLoan[];
  totalBooksCount: number;
  totalExemplarsCount: number;
  activeBorrowedCount: number;
  categories: string[];
  onSelectStudent: (memberId: string) => void;
  onBorrowBook: (book: Book) => void;
  onSwitchToAdmin: () => void;
  onLogout: () => void;
}

const SCHOOL_LOGO_PATH = '/src/assets/images/school_logo_emblem_1793331547455.jpg';

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  appName,
  schoolName,
  books,
  members,
  activeStudent,
  studentLoans,
  totalBooksCount,
  totalExemplarsCount,
  activeBorrowedCount,
  categories,
  onSelectStudent,
  onBorrowBook,
  onSwitchToAdmin,
  onLogout,
}) => {
  const [activeNav, setActiveNav] = useState<FrontNavTab>('beranda');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [selectedBookDetail, setSelectedBookDetail] = useState<Book | null>(null);

  const currentMember = activeStudent || members[0];

  // Dynamic notifications from student's active & overdue loans
  const notifications = useMemo(() => {
    const list: { id: string; title: string; desc: string; type: 'overdue' | 'active' | 'info' }[] = [];

    studentLoans
      .filter((l) => l.status === 'Dipinjam')
      .forEach((loan) => {
        if (loan.isOverdue) {
          list.push({
            id: `notif-${loan.id}`,
            title: `Terlambat ${loan.lateDays} Hari: ${loan.bookTitle}`,
            desc: `Batas kembali ${formatDateId(loan.tanggal_tenggat)}. Denda berjalan: ${formatRupiah(
              loan.calculatedFine
            )}.`,
            type: 'overdue',
          });
        } else {
          list.push({
            id: `notif-${loan.id}`,
            title: `Masa Pinjam Aktif: ${loan.bookTitle}`,
            desc: `Harap dikembalikan sebelum batas tenggat ${formatDateId(loan.tanggal_tenggat)}.`,
            type: 'active',
          });
        }
      });

    list.push({
      id: 'notif-welcome',
      title: 'Koleksi Buku Baru Tersedia',
      desc: `${totalBooksCount} judul buku siap dipinjam di perpustakaan ${schoolName}.`,
      type: 'info',
    });

    return list;
  }, [studentLoans, totalBooksCount, schoolName]);

  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const matchCat = selectedCategory === 'Semua' || b.kategori === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.judul.toLowerCase().includes(q) ||
        b.penulis.toLowerCase().includes(q) ||
        b.kategori.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [books, selectedCategory, searchQuery]);

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveNav('katalog');
    }
  };

  const getBookRating = (book: Book, index: number): string => {
    if (book.rating) return book.rating.toFixed(1);
    const defaults = [4.9, 4.8, 4.9, 4.7, 4.8, 4.9];
    return defaults[index % defaults.length].toFixed(1);
  };

  return (
    <div className="min-h-screen bg-sky-100/80 text-slate-900 flex flex-col pb-24">
      {/* =========================================================
          1. HEADER: Left School Logo + App Name | Right Notifications & Student Profile
         ========================================================= */}
      <header className="bg-[#0F2557] text-white sticky top-0 z-30 border-b border-blue-900/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: School Logo (Placeholder/Emblem) + Application Name */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveNav('beranda')}
              className="flex items-center gap-3 text-left focus:outline-none cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 border border-blue-300/30 shadow-xs">
                {!logoError ? (
                  <img
                    src={SCHOOL_LOGO_PATH}
                    alt="Logo Sekolah"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <BookOpen className="w-5 h-5 text-[#0F2557]" />
                )}
              </div>
              <div className="truncate">
                <span className="text-lg font-display font-bold tracking-tight text-white block leading-none">
                  {appName}
                </span>
                <span className="text-[11px] text-blue-200/90 truncate block mt-0.5">
                  {schoolName}
                </span>
              </div>
            </button>
          </div>

          {/* Right: Notifications & Student Profile Menu */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 relative">
            {/* Quick Admin Panel Switch Button */}
            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/70 hover:bg-blue-800 text-blue-100 text-xs font-medium border border-blue-700/60 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              Panel Pustakawan
            </button>

            {/* Notification Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNotifOpen((prev) => !prev);
                  setIsProfileMenuOpen(false);
                }}
                aria-label="Notifikasi Perpustakaan"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-blue-900/60 hover:bg-blue-800/80 border border-blue-800 flex items-center justify-center text-white transition-colors relative cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {notifications.some((n) => n.type === 'overdue') && (
                  <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#0F2557]" />
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="px-4 py-3 bg-[#0F2557] text-white flex items-center justify-between">
                    <span className="text-xs font-semibold">Notifikasi Peminjaman</span>
                    <button
                      type="button"
                      onClick={() => setIsNotifOpen(false)}
                      className="text-blue-200 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-2.5">
                          {n.type === 'overdue' ? (
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          ) : n.type === 'active' ? (
                            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                              {n.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Student Profile Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen((prev) => !prev);
                  setIsNotifOpen(false);
                }}
                className="min-h-[44px] pl-2 pr-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-white text-[#0F2557] font-display font-bold text-xs flex items-center justify-center shrink-0">
                  {currentMember?.nama
                    ? currentMember.nama
                        .split(' ')
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                    : 'SW'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-white leading-tight truncate max-w-[130px]">
                    {currentMember?.nama || 'Siswa'}
                  </p>
                  <p className="text-[10px] text-blue-200 font-mono">
                    {currentMember?.kelas_unit || 'Anggota'}
                  </p>
                </div>
              </button>

              {/* Profile Menu Dropdown */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="p-4 bg-[#0F2557] text-white">
                    <p className="text-xs text-blue-200">Profil Anggota Aktif</p>
                    <p className="text-sm font-display font-bold mt-0.5">
                      {currentMember?.nama}
                    </p>
                    <p className="text-xs font-mono text-blue-200 mt-0.5">
                      NIS/NIP: {currentMember?.nomor_induk} · {currentMember?.kelas_unit}
                    </p>
                  </div>

                  <div className="p-3 border-b border-slate-100">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                      Ganti Simulasi Akun Siswa / Guru:
                    </label>
                    <select
                      value={currentMember?.id || ''}
                      onChange={(e) => {
                        onSelectStudent(e.target.value);
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-medium"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nama} ({m.kelas_unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveNav('kartu');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 text-blue-700" />
                      Lihat Kartu Anggota Digital
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchToAdmin();
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-700" />
                      Buka Panel Admin / Pustakawan
                    </button>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar dari Aplikasi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================
          2. HERO SECTION (Navy Blue & Crisp White Educational Theme)
         ========================================================= */}
      {(activeNav === 'beranda' || activeNav === 'katalog') && (
        <section className="bg-gradient-to-br from-[#0F2557] via-[#16347A] to-[#1E40AF] text-white pt-8 pb-12 px-4 sm:px-6 border-b border-blue-900">
          <div className="max-w-5xl mx-auto text-center space-y-5">
            <p className="text-xs sm:text-sm font-medium text-blue-200 tracking-wide">
              Selamat datang kembali, <span className="font-semibold text-white">{currentMember?.nama}</span> ({currentMember?.kelas_unit})
            </p>

            <h1 className="text-2xl sm:text-4xl font-display font-bold tracking-tight text-white leading-tight">
              Mau baca buku apa hari ini?
            </h1>

            <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl mx-auto">
              Jelajahi koleksi buku pelajaran, literatur sastra, sains, hingga teknologi informasi di perpustakaan digital sekolah.
            </p>

            {/* Prominent Search Bar */}
            <form
              onSubmit={handleHeroSearchSubmit}
              className="max-w-2xl mx-auto pt-2"
            >
              <div className="relative flex items-center bg-white rounded-2xl p-1.5 shadow-lg border border-blue-200/30">
                <Search className="w-5 h-5 text-slate-400 ml-3.5 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari judul buku, nama penulis, topik pelajaran, atau ISBN..."
                  className="w-full px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#0F2557] hover:bg-blue-950 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cari Buku
                </button>
              </div>
            </form>

            {/* Category Quick Filter Buttons */}
            <div className="flex items-center justify-center gap-2 overflow-x-auto pt-2 pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-white text-[#0F2557] font-semibold shadow-xs'
                      : 'bg-white/10 text-blue-100 hover:bg-white/20'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =========================================================
          3. MAIN CONTENT AREA
         ========================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* VIEW A: BERANDA (HOME SCREEN) */}
        {activeNav === 'beranda' && (
          <div className="space-y-8">
            {/* Quick Statistics Row (Total Buku, Buku Dipinjam, dll.) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-12 relative z-10">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0F2557] text-white flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total Buku</p>
                  <p className="text-xl sm:text-2xl font-display font-bold font-mono tabular-nums text-slate-900">
                    {totalExemplarsCount}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {totalBooksCount} judul koleksi
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <BookMarked className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Buku Dipinjam</p>
                  <p className="text-xl sm:text-2xl font-display font-bold font-mono tabular-nums text-slate-900">
                    {activeBorrowedCount}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {studentLoans.filter((l) => l.status === 'Dipinjam').length} oleh Anda
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Stok Tersedia</p>
                  <p className="text-xl sm:text-2xl font-display font-bold font-mono tabular-nums text-emerald-700">
                    {books.reduce((acc, b) => acc + Number(b.stok_tersedia), 0)}
                  </p>
                  <p className="text-[11px] text-slate-500">Siap dipinjam hari ini</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Denda Berjalan Saya</p>
                  <p className="text-xl sm:text-2xl font-display font-bold font-mono tabular-nums text-slate-900">
                    {formatRupiah(
                      studentLoans
                        .filter((l) => l.status === 'Dipinjam')
                        .reduce((acc, l) => acc + l.calculatedFine, 0)
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">Tarif Rp1.000 / hari</p>
                </div>
              </div>
            </div>

            {/* Recommended Books Card Grid */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-display font-bold text-[#0F2557]">
                    Rekomendasi Buku Terbaru
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Koleksi buku pilihan terpopuler lengkap dengan rating pembaca dan status stok.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('katalog')}
                  className="text-xs font-semibold text-[#0F2557] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Lihat Semua Katalog
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {filteredBooks.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-800">
                    Buku tidak ditemukan untuk kata kunci "{searchQuery}"
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('Semua');
                    }}
                    className="px-4 py-2 bg-[#0F2557] text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Tampilkan Semua Buku
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {filteredBooks.map((book, idx) => {
                    const ratingStr = getBookRating(book, idx);
                    const isBorrowedByMe = studentLoans.some(
                      (l) => l.buku_id === book.id && l.status === 'Dipinjam'
                    );

                    return (
                      <div
                        key={book.id}
                        className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs hover:shadow-md transition-shadow group"
                      >
                        <div>
                          {/* Book Cover Image */}
                          <div
                            onClick={() => setSelectedBookDetail(book)}
                            className="cursor-pointer overflow-hidden rounded-xl mb-3 relative"
                          >
                            <BookCover
                              title={book.judul}
                              author={book.penulis}
                              category={book.kategori}
                              coverUrl={book.cover_url}
                              size="lg"
                            />
                          </div>

                          {/* Category & Rating Line (Unboxed clean metadata) */}
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span className="truncate max-w-[65%]">{book.kategori}</span>
                            <span className="flex items-center gap-1 font-mono font-semibold text-amber-600 shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {ratingStr}
                            </span>
                          </div>

                          {/* Book Title & Author */}
                          <h3
                            onClick={() => setSelectedBookDetail(book)}
                            className="font-display font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-[#0F2557] cursor-pointer"
                          >
                            {book.judul}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 truncate">{book.penulis}</p>
                        </div>

                        {/* Availability & Borrow Action */}
                        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-mono font-semibold tabular-nums ${
                              book.stok_tersedia > 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            Stok: {book.stok_tersedia}/{book.stok_total}
                          </span>

                          {isBorrowedByMe ? (
                            <span className="text-[11px] font-semibold text-blue-700">
                              Dipinjam
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onBorrowBook(book)}
                              disabled={book.stok_tersedia <= 0}
                              className="px-3 py-1.5 bg-[#0F2557] hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Pinjam
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* VIEW B: KATALOG LENGKAP */}
        {activeNav === 'katalog' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-display font-bold text-[#0F2557]">
                  Katalog Lengkap Perpustakaan ({filteredBooks.length} Buku)
                </h2>
                <p className="text-xs text-slate-600">
                  Klik pada sampul buku untuk melihat detail ISBN, penerbit, atau langsung meminjam.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredBooks.map((book, idx) => {
                const ratingStr = getBookRating(book, idx);
                const isBorrowedByMe = studentLoans.some(
                  (l) => l.buku_id === book.id && l.status === 'Dipinjam'
                );
                return (
                  <div
                    key={book.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs"
                  >
                    <div>
                      <div
                        onClick={() => setSelectedBookDetail(book)}
                        className="cursor-pointer mb-3"
                      >
                        <BookCover
                          title={book.judul}
                          author={book.penulis}
                          category={book.kategori}
                          coverUrl={book.cover_url}
                          size="lg"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="truncate">{book.kategori}</span>
                        <span className="flex items-center gap-1 font-mono font-semibold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {ratingStr}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base line-clamp-2">
                        {book.judul}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">{book.penulis}</p>
                      <p className="text-[11px] font-mono text-slate-400 mt-1">
                        ISBN: {book.isbn} · {book.tahun_terbit}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-emerald-700">
                        Stok: {book.stok_tersedia}/{book.stok_total}
                      </span>
                      {isBorrowedByMe ? (
                        <span className="text-xs font-semibold text-blue-700">Sedang Dipinjam</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onBorrowBook(book)}
                          disabled={book.stok_tersedia <= 0}
                          className="px-3.5 py-1.5 bg-[#0F2557] hover:bg-blue-900 disabled:bg-slate-200 text-white text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Pinjam Buku
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW C: RIWAYAT PEMINJAMAN & DENDA */}
        {activeNav === 'riwayat' && (
          <div className="space-y-6">
            <div className="bg-[#0F2557] text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-display font-bold">
                  Riwayat Peminjaman & Status Denda
                </h2>
                <p className="text-xs text-blue-200 mt-1">
                  Anggota: {currentMember?.nama} ({currentMember?.nomor_induk} · {currentMember?.kelas_unit})
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-blue-200">Pinjaman Aktif</p>
                  <p className="text-xl font-mono font-bold">
                    {studentLoans.filter((l) => l.status === 'Dipinjam').length} Buku
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-200">Total Denda Berjalan</p>
                  <p className="text-xl font-mono font-bold text-amber-300">
                    {formatRupiah(
                      studentLoans
                        .filter((l) => l.status === 'Dipinjam')
                        .reduce((acc, l) => acc + l.calculatedFine, 0)
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                      <th className="py-3.5 px-4">Judul Buku</th>
                      <th className="py-3.5 px-4">Tanggal Pinjam</th>
                      <th className="py-3.5 px-4">Batas Tenggat</th>
                      <th className="py-3.5 px-4">Tanggal Kembali</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Denda Otomatis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {studentLoans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          Belum ada riwayat peminjaman untuk anggota ini.
                        </td>
                      </tr>
                    ) : (
                      studentLoans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-900">{loan.bookTitle}</p>
                            <p className="text-xs font-mono text-slate-500">
                              ID: {loan.id} · ISBN {loan.bookIsbn}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                            {formatDateId(loan.tanggal_pinjam)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-900 font-semibold tabular-nums">
                            {formatDateId(loan.tanggal_tenggat)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                            {formatDateId(loan.tanggal_kembali)}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {loan.status === 'Dikembalikan' ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                Dikembalikan
                              </span>
                            ) : loan.isOverdue ? (
                              <span className="text-red-600 font-semibold flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                Terlambat {loan.lateDays} hari
                              </span>
                            ) : (
                              <span className="text-blue-700 font-semibold flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                Sedang Dipinjam
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {loan.calculatedFine > 0 ? (
                              <span className="font-bold text-red-600">
                                {formatRupiah(loan.calculatedFine)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Rp 0</span>
                            )}
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

        {/* VIEW D: KARTU ANGGOTA DIGITAL */}
        {activeNav === 'kartu' && currentMember && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-display font-bold text-[#0F2557]">
                Kartu Anggota Perpustakaan Digital
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Tunjukkan kartu anggota digital ini kepada petugas pustakawan saat peminjaman atau pengembalian buku.
              </p>
            </div>

            {/* Digital Member Card (Navy Blue & White Modern Educational Card) */}
            <div className="bg-gradient-to-br from-[#0F2557] via-[#173578] to-[#1E40AF] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-800 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center shrink-0">
                    {!logoError ? (
                      <img
                        src={SCHOOL_LOGO_PATH}
                        alt="Logo Sekolah"
                        referrerPolicy="no-referrer"
                        onError={() => setLogoError(true)}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <BookOpen className="w-6 h-6 text-[#0F2557]" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-blue-200 uppercase">
                      KARTU ANGGOTA PERPUSTAKAAN
                    </p>
                    <h3 className="text-base font-display font-bold text-white">
                      {schoolName}
                    </h3>
                  </div>
                </div>
                <span className="text-xs font-mono text-amber-300 font-semibold">
                  {currentMember.tipe.toUpperCase()}
                </span>
              </div>

              <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-blue-200">Nama Lengkap Anggota</p>
                    <p className="text-xl font-display font-bold tracking-tight">
                      {currentMember.nama}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-blue-200">Nomor Induk (NIS/NIP)</p>
                      <p className="text-sm font-mono font-semibold text-white">
                        {currentMember.nomor_induk}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-blue-200">Kelas / Unit</p>
                      <p className="text-sm font-semibold text-white">
                        {currentMember.kelas_unit}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-blue-200">Kontak Terdaftar</p>
                    <p className="text-xs font-mono text-blue-100">{currentMember.telepon}</p>
                  </div>
                </div>

                {/* Digital QR / Verification Box */}
                <div className="bg-white text-[#0F2557] p-3.5 rounded-2xl flex flex-col items-center justify-center shrink-0 self-start sm:self-center shadow-md">
                  <QrCode className="w-20 h-20 text-[#0F2557]" />
                  <span className="text-[10px] font-mono font-bold mt-1.5 tracking-widest">
                    {currentMember.id.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-200">
                <span>Status Keanggotaan: Aktif</span>
                <span className="font-mono">Berlaku Selama Menjadi Warga Sekolah</span>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-[#0F2557] border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak Kartu Anggota Digital
              </button>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          BOOK DETAIL MODAL
         ========================================================= */}
      {selectedBookDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <BookCover
                  title={selectedBookDetail.judul}
                  author={selectedBookDetail.penulis}
                  category={selectedBookDetail.kategori}
                  coverUrl={selectedBookDetail.cover_url}
                  size="md"
                />
                <div>
                  <p className="text-xs text-slate-500">{selectedBookDetail.kategori}</p>
                  <h3 className="text-base font-display font-bold text-slate-900 mt-0.5">
                    {selectedBookDetail.judul}
                  </h3>
                  <p className="text-xs font-medium text-slate-700 mt-1">
                    {selectedBookDetail.penulis}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedBookDetail.penerbit} ({selectedBookDetail.tahun_terbit})
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    ISBN: {selectedBookDetail.isbn}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">Ketersediaan Eksemplar:</span>
              <span className="font-mono font-bold text-[#0F2557]">
                {selectedBookDetail.stok_tersedia} tersedia dari {selectedBookDetail.stok_total} stok
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBookDetail(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  onBorrowBook(selectedBookDetail);
                  setSelectedBookDetail(null);
                }}
                disabled={selectedBookDetail.stok_tersedia <= 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2557] hover:bg-blue-900 disabled:bg-slate-200 rounded-xl cursor-pointer"
              >
                Pinjam Buku Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          4. FOOTER / BOTTOM NAVIGATION BAR (Beranda, Katalog, Riwayat Peminjaman, Kartu Anggota Digital)
         ========================================================= */}
      <nav
        aria-label="Navigasi Utama Bawah"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg no-print"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-4 items-center h-16 px-2">
          <button
            type="button"
            onClick={() => setActiveNav('beranda')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              activeNav === 'beranda'
                ? 'text-[#0F2557] font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">Beranda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav('katalog')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              activeNav === 'katalog'
                ? 'text-[#0F2557] font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">Katalog</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav('riwayat')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors relative cursor-pointer ${
              activeNav === 'riwayat'
                ? 'text-[#0F2557] font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">
              Riwayat Pinjam
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav('kartu')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              activeNav === 'kartu'
                ? 'text-[#0F2557] font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">
              Kartu Anggota
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};
