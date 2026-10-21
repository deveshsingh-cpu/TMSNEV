import React, { useState, useRef, useEffect } from 'react';
import {
  GraduationCap,
  Bus,
  Lock,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  Building2,
  BookOpen,
  ShieldCheck,
  Award,
  Users,
  ArrowRight,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { SchoolConfig, CampusMaster } from '../../types/index.js';

interface PublicWebsiteViewProps {
  config: SchoolConfig;
  campuses: CampusMaster[];
  routesCount: number;
  vehiclesCount: number;
  villagesCount: number;
  onOpenTransportLogin: () => void;
}

export const PublicWebsiteView: React.FC<PublicWebsiteViewProps> = ({
  config,
  campuses,
  routesCount,
  vehiclesCount,
  villagesCount,
  onOpenTransportLogin,
}) => {
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  const [academicsModalOpen, setAcademicsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLoginDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const schoolName = config.schoolName || 'Narendra Edu Valley';
  const session = config.currentAcademicSession || config.academicYear || '2026-2027';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Institutional Announcement Strip */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 sm:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[11px]">
              Academic Session {session}
            </span>
            <span className="hidden sm:inline text-slate-400">
              Admissions &amp; Student Transport Registration Open for LKG to Class XII
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            {config.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-amber-400" />
                {config.phone}
              </span>
            )}
            {config.email && (
              <span className="hidden md:flex items-center gap-1">
                <Mail className="w-3 h-3 text-amber-400" />
                {config.email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Public Website Navbar */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          {/* School Logo & Name */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-sm shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                {schoolName}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Senior &amp; Junior Wing • Holistic K–12 Education
              </p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-600">
            <a href="#about" className="hover:text-slate-950 transition-colors">
              About Us
            </a>
            <a href="#campuses" className="hover:text-slate-950 transition-colors">
              Campuses
            </a>
            <a href="#academics" className="hover:text-slate-950 transition-colors">
              Academics
            </a>
            <a href="#transport" className="hover:text-slate-950 transition-colors">
              Transport Facilities
            </a>
            <a href="#contact" className="hover:text-slate-950 transition-colors">
              Contact
            </a>
          </nav>

          {/* Top-Right Login Dropdown Button (1- Academics | 2- Transport) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setLoginDropdownOpen((prev) => !prev)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer border border-slate-800"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Login</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${loginDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {loginDropdownOpen && (
              <div className="absolute right-0 mt-2.5 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Select ERP Portal Login
                </div>

                <div className="p-1.5 space-y-1">
                  {/* Option 1: Academics */}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginDropdownOpen(false);
                      setAcademicsModalOpen(true);
                    }}
                    className="w-full px-3.5 py-3 rounded-xl hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">1- Academics</div>
                        <div className="text-[10px] text-slate-500">Faculty, Exams &amp; Admissions</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                      Soon
                    </span>
                  </button>

                  {/* Option 2: Transport */}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginDropdownOpen(false);
                      onOpenTransportLogin();
                    }}
                    className="w-full px-3.5 py-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/80 flex items-center justify-between text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
                        <Bus className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">2- Transport</div>
                        <div className="text-[10px] text-slate-600">Fleet, Routes &amp; Fee ERP</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-slate-900 text-white py-16 sm:py-24 px-4 sm:px-8 border-b border-slate-800 relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Award className="w-3.5 h-3.5" />
              <span>Welcome to {schoolName}</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Empowering Young Minds Through Excellence, Discipline &amp; Care.
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              {schoolName} provides a modern, safe, and academically rigorous learning environment from LKG to Class XII across our Senior and Junior Campuses, supported by a dedicated institutional transport fleet.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#academics"
                className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-md"
              >
                Explore Academics
              </a>
              <button
                type="button"
                onClick={onOpenTransportLogin}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Bus className="w-4 h-4 text-amber-400" />
                <span>Transport ERP Portal</span>
              </button>
            </div>
          </div>

          {/* Right Institutional Highlight Card */}
          <div className="lg:col-span-5 bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                  Digital Campus Infrastructure
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Online ERP Portals
                </h3>
              </div>
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>

            <div className="space-y-3">
              <div
                onClick={() => setAcademicsModalOpen(true)}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80 hover:border-slate-600 transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">1- Academic ERP</div>
                    <p className="text-xs text-slate-400">
                      Student Attendance, Timetable, Exams &amp; Report Cards
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-amber-300 text-[10px] font-bold shrink-0">
                  Coming Soon
                </span>
              </div>

              <div
                onClick={onOpenTransportLogin}
                className="p-4 rounded-2xl bg-slate-900 border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                    <Bus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">2- Transport Management ERP</div>
                    <p className="text-xs text-slate-300">
                      Live Route Lists, Gate Attendance, Fleet &amp; Fee Collection
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold shrink-0 flex items-center gap-1">
                  <span>Login</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Campuses & Academic Wings Section */}
      <section id="campuses" className="py-16 px-4 sm:px-8 max-w-7xl w-full mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
            Our Wings &amp; Infrastructure
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            Campuses &amp; Academic Divisions
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            Dedicated learning environments tailored to foundational years, middle school, and senior secondary excellence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(campuses.length > 0
            ? campuses
            : [
                { id: 'sr', name: 'Senior Campus', code: 'Sr', address: 'Classes VI to XII' },
                { id: 'jr', name: 'Junior Campus', code: 'Jr', address: 'LKG to Class V' },
              ]
          ).map((cmp) => (
            <div
              key={cmp.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900">{cmp.name}</h4>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                  Code: {cmp.code}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {cmp.address ||
                  `Equipped with modern classrooms, science & computer labs, and dedicated transport boarding bays for ${cmp.name}.`}
              </p>
            </div>
          ))}

          <div
            id="transport"
            className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 shadow-2xs space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center">
                <Bus className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold">Safe School Transport Network</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Verified morning pickup and afternoon drop attendance, 24-hour vehicle logbook monitoring, and village-wise route connectivity.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-amber-400 font-mono font-bold">
                {vehiclesCount > 0 ? `${vehiclesCount} Vehicles • ${routesCount} Routes` : 'Verified Fleet Operations'}
              </span>
              <button
                type="button"
                onClick={onOpenTransportLogin}
                className="text-white hover:text-amber-400 font-bold underline cursor-pointer"
              >
                Staff Portal &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer / Contact Info */}
      <footer id="contact" className="mt-auto bg-slate-950 text-slate-400 py-10 px-4 sm:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs">
          <div className="space-y-1">
            <div className="font-bold text-white text-sm">{schoolName}</div>
            <p>{config.address || 'Prayagraj, Uttar Pradesh, India'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onOpenTransportLogin}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold border border-slate-800 cursor-pointer"
            >
              Transport ERP Sign In
            </button>
            <span>&copy; {new Date().getFullYear()} {schoolName}. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Modal: 1- Academics ERP Coming Soon */}
      {academicsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">1- Academic ERP Portal</h3>
              </div>
              <button
                type="button"
                onClick={() => setAcademicsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              The <strong>Academic ERP Module</strong> for {schoolName} is scheduled for upcoming release. For Transport Operations, Fleet, Routes, and Transport Fee Collection, please select <strong>2- Transport</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcademicsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcademicsModalOpen(false);
                  onOpenTransportLogin();
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-amber-400 text-xs font-bold cursor-pointer"
              >
                Open 2- Transport Login &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
