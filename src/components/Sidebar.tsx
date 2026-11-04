import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Route as RouteIcon,
  Clock,
  CreditCard,
  UserSquare2,
  BookOpenCheck,
  BarChart3,
  Settings,
  Landmark,
  ChevronRight,
  ChevronDown,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Truck,
  ShieldAlert,
} from 'lucide-react';
import { UserRole } from '../types/index.js';

export type NavItemKey =
  | 'dashboard'
  | 'members'
  | 'resumes'
  | 'staff'
  | 'routes'
  | 'operations'
  | 'fees'
  | 'expenses'
  | 'vehicles'
  | 'accounts'
  | 'masters'
  | 'reports'
  | 'setup';

export interface SubTabSelection {
  navKey: NavItemKey;
  subTab?: string;
}

interface SidebarSubItem {
  id: string;
  label: string;
  navKey: NavItemKey;
  subTab?: string;
  badge?: number;
  badgeColor?: string;
  allowedRoles?: UserRole[];
}

interface SidebarGroupItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  defaultNavKey: NavItemKey;
  defaultSubTab?: string;
  badge?: number;
  badgeColor?: string;
  allowedRoles?: UserRole[];
  subItems?: SidebarSubItem[];
}

interface SidebarProps {
  activeKey: NavItemKey;
  activeSubTab?: string;
  onSelect: (key: NavItemKey, subTab?: string) => void;
  currentRole?: UserRole;
  mismatchCount?: number;
  unsettledAdvancesCount?: number;
  suspendedCount?: number;
  resumesCount?: number;
  pendingApprovalsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeKey,
  activeSubTab,
  onSelect,
  currentRole = 'Admin',
  suspendedCount = 0,
  resumesCount = 0,
  pendingApprovalsCount = 0,
}) => {
  const isApkOrCompactDevice = () => {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    const isMobileOrAndroid =
      window.innerWidth < 1024 || /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return isStandalone || isMobileOrAndroid;
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => isApkOrCompactDevice());
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    members_group: false,
    employees_group: false,
    routes_group: false,
    operations_group: false,
    fees_group: false,
    expenses_group: true,
    accounts_group: true,
    masters_group: false,
    assistant_vehicles_group: true,
    incharge_operations_group: true,
  });

  useEffect(() => {
    const handleResize = () => {
      if (isApkOrCompactDevice()) {
        setIsSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeKey === 'members') {
      setExpandedGroups((prev) => ({ ...prev, members_group: true }));
    } else if (activeKey === 'resumes' || activeKey === 'staff') {
      setExpandedGroups((prev) => ({ ...prev, employees_group: true }));
    } else if (activeKey === 'routes' || (activeKey === 'vehicles' && activeSubTab === 'maintenance')) {
      setExpandedGroups((prev) => ({
        ...prev,
        routes_group: true,
        assistant_vehicles_group: true,
      }));
    } else if (activeKey === 'operations') {
      setExpandedGroups((prev) => ({
        ...prev,
        operations_group: true,
        incharge_operations_group: true,
      }));
    } else if (activeKey === 'fees') {
      setExpandedGroups((prev) => ({ ...prev, fees_group: true }));
    } else if (
      activeKey === 'expenses' ||
      (activeKey === 'accounts' &&
        (activeSubTab === 'income' ||
          activeSubTab === 'day_book' ||
          activeSubTab === 'student_ledger' ||
          activeSubTab === 'vehicle_ledger'))
    ) {
      setExpandedGroups((prev) => ({
        ...prev,
        expenses_group: true,
        accounts_group: true,
      }));
    } else if (activeKey === 'accounts' || activeKey === 'vehicles') {
      setExpandedGroups((prev) => ({
        ...prev,
        accounts_group: true,
        assistant_vehicles_group: true,
      }));
    } else if (activeKey === 'masters') {
      setExpandedGroups((prev) => ({ ...prev, masters_group: true }));
    }
  }, [activeKey, activeSubTab]);

  const toggleGroup = (groupKey: string, defaultNavKey: NavItemKey, defaultSubTab?: string) => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      setExpandedGroups((prev) => ({ ...prev, [groupKey]: true }));
      onSelect(defaultNavKey, defaultSubTab);
      return;
    }
    const willExpand = !expandedGroups[groupKey];
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: willExpand }));
    if (willExpand) {
      onSelect(defaultNavKey, defaultSubTab);
    }
  };

  // Dedicated sidebar for Transport Assistant with expanded operational & view-only ledger rights
  const assistantGroups: SidebarGroupItem[] = [
    {
      key: 'dashboard',
      label: '1- Assistant Operations Desk',
      icon: <LayoutDashboard className="w-5 h-5" />,
      defaultNavKey: 'dashboard',
    },
    {
      key: 'members_group',
      label: '2- Members (Add / Drop)',
      icon: <Users className="w-5 h-5" />,
      defaultNavKey: 'members',
      defaultSubTab: 'all',
      subItems: [
        { id: 'as-mem-all', label: '1- Member Directory & Add/Drop', navKey: 'members', subTab: 'all' },
        { id: 'as-mem-req', label: '2- Add / Drop Approval Status', navKey: 'members', subTab: 'requests' },
        { id: 'as-mem-disc', label: '3- Behaviour & Discipline', navKey: 'members', subTab: 'discipline' },
        { id: 'as-mem-comp', label: '4- Feedback & Complaints', navKey: 'members', subTab: 'complaints' },
      ],
    },
    {
      key: 'employees_group',
      label: '3- Resumes & Staff Attendance',
      icon: <UserSquare2 className="w-5 h-5" />,
      defaultNavKey: 'resumes',
      subItems: [
        {
          id: 'as-emp-resumes',
          label: '1- Candidate Resumes (Receive)',
          navKey: 'resumes',
          badge: resumesCount > 0 ? resumesCount : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300',
        },
        {
          id: 'as-emp-att',
          label: '2- Mark Staff Attendance',
          navKey: 'staff',
          subTab: 'attendance',
        },
      ],
    },
    {
      key: 'routes_group',
      label: '4- Routes and Trips',
      icon: <RouteIcon className="w-5 h-5" />,
      defaultNavKey: 'routes',
      defaultSubTab: 'routes',
      subItems: [
        { id: 'as-rt-routes', label: '1- Active Routes & Stops', navKey: 'routes', subTab: 'routes' },
        { id: 'as-rt-services', label: '2- Vehicle Schedule', navKey: 'routes', subTab: 'services' },
        { id: 'as-rt-pack', label: '3- Print Route List', navKey: 'routes', subTab: 'pack' },
      ],
    },
    {
      key: 'operations_group',
      label: '5- Attendance Module',
      icon: <Clock className="w-5 h-5" />,
      defaultNavKey: 'operations',
      defaultSubTab: 'arrival',
      subItems: [
        { id: 'op-arrival', label: '1- Arrival Attendance', navKey: 'operations', subTab: 'arrival' },
        { id: 'op-departure', label: '2- Departure Attendance', navKey: 'operations', subTab: 'departure' },
        { id: 'op-unmarked', label: '3- Unmarked & Mismatch Report', navKey: 'operations', subTab: 'unmarked_mismatch' },
        { id: 'op-absentees', label: '4- Call Absentees (Follow-up)', navKey: 'operations', subTab: 'call_absentees' },
        { id: 'op-calendar', label: '5- Monthly Calendar (P/A/L/H)', navKey: 'operations', subTab: 'calendar' },
        { id: 'op-summary', label: '6- Attendance Summary Sheet', navKey: 'operations', subTab: 'summary' },
      ],
    },
    {
      key: 'fees_group',
      label: '6- Receive Fees & Financial',
      icon: <CreditCard className="w-5 h-5" />,
      defaultNavKey: 'fees',
      defaultSubTab: 'collect',
      subItems: [
        { id: 'as-fe-collect', label: '1- Collect Fees & Receipts', navKey: 'fees', subTab: 'collect' },
        { id: 'as-fe-invoices', label: '2- Monthly Invoices', navKey: 'fees', subTab: 'invoices' },
        { id: 'as-fe-demand', label: '3- Demand Slip & Phone Follow-up', navKey: 'fees', subTab: 'demand_slip' },
        { id: 'as-fe-matrix', label: '4- Month-wise Fee & Previous Dues', navKey: 'fees', subTab: 'monthly_matrix' },
        { id: 'as-fe-recovery', label: '5- Follow-Up Dues & Recovery', navKey: 'fees', subTab: 'recovery' },
      ],
    },
    {
      key: 'expenses_group',
      label: '7- Expense Bills & Day Book',
      icon: <BookOpenCheck className="w-5 h-5" />,
      defaultNavKey: 'expenses',
      defaultSubTab: 'expenses',
      subItems: [
        { id: 'as-ex-expenses', label: '1- Enter Expense Bills', navKey: 'expenses', subTab: 'expenses' },
        { id: 'as-ex-daybook', label: '2- Print / View Day Book', navKey: 'accounts', subTab: 'day_book' },
        { id: 'as-ac-stu', label: '3- Member Fee Ledger', navKey: 'accounts', subTab: 'student_ledger' },
        { id: 'as-ac-veh', label: '4- Vehicle Cost Ledger', navKey: 'accounts', subTab: 'vehicle_ledger' },
        { id: 'as-ac-tb', label: '5- Trial Balance', navKey: 'accounts', subTab: 'trial_balance' },
      ],
    },
    {
      key: 'accounts_group',
      label: '8- Day Book & Ledgers (View)',
      icon: <Landmark className="w-5 h-5" />,
      defaultNavKey: 'accounts',
      defaultSubTab: 'day_book',
      subItems: [
        { id: 'as-led-daybook', label: '1- Print / View Day Book', navKey: 'accounts', subTab: 'day_book' },
        { id: 'as-led-stu', label: '2- Member Fee Ledger', navKey: 'accounts', subTab: 'student_ledger' },
        { id: 'as-led-veh', label: '3- Vehicle Cost Ledger', navKey: 'accounts', subTab: 'vehicle_ledger' },
        { id: 'as-led-tb', label: '4- Trial Balance', navKey: 'accounts', subTab: 'trial_balance' },
      ],
    },
    {
      key: 'assistant_vehicles_group',
      label: '9- Log Book & Work Orders',
      icon: <Truck className="w-5 h-5" />,
      defaultNavKey: 'vehicles',
      defaultSubTab: 'odometer',
      subItems: [
        { id: 'as-odo', label: '1- Vehicle Log Book (24-Hr)', navKey: 'vehicles', subTab: 'odometer' },
        { id: 'as-fuel', label: '2- Driver Fuel Advances', navKey: 'vehicles', subTab: 'fuel' },
        { id: 'as-maint', label: '3- Raise Work Order Request', navKey: 'vehicles', subTab: 'maintenance' },
      ],
    },
  ];

  // Full / Coordinator Sidebar Groups filtered by role
  const standardGroups: SidebarGroupItem[] = [
    {
      key: 'dashboard',
      label: currentRole === 'Admin' ? '1- Dashboard (Admin)' : '1- Operations Desk',
      icon: <LayoutDashboard className="w-5 h-5" />,
      defaultNavKey: 'dashboard',
      badge: currentRole === 'Admin' && pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeColor: 'bg-amber-500 text-slate-950',
      allowedRoles: ['Admin', 'Transport Coordinator'],
    },
    {
      key: 'members_group',
      label: '2- Members',
      icon: <Users className="w-5 h-5" />,
      defaultNavKey: 'members',
      defaultSubTab: 'all',
      badge: suspendedCount > 0 ? suspendedCount : undefined,
      badgeColor: 'bg-rose-100 text-rose-700',
      allowedRoles: ['Admin', 'Transport Coordinator'],
      subItems: [
        { id: 'mem-all', label: '1- Member Directory', navKey: 'members', subTab: 'all' },
        {
          id: 'mem-requests',
          label: '2- Add / Drop / Suspend Approvals',
          navKey: 'members',
          subTab: 'requests',
        },
        {
          id: 'mem-suspended',
          label: '3- Suspended & Permission',
          navKey: 'members',
          subTab: 'Suspended',
          badge: suspendedCount > 0 ? suspendedCount : undefined,
          badgeColor: 'bg-rose-500/20 text-rose-300',
        },
        {
          id: 'mem-discipline',
          label: '4- Behaviour & Discipline',
          navKey: 'members',
          subTab: 'discipline',
        },
        {
          id: 'mem-complaints',
          label: '5- Feedback & Complaints',
          navKey: 'members',
          subTab: 'complaints',
        },
      ],
    },
    {
      key: 'employees_group',
      label: '3- Employees',
      icon: <UserSquare2 className="w-5 h-5" />,
      defaultNavKey: 'resumes',
      allowedRoles: ['Admin', 'Transport Coordinator'],
      subItems: [
        {
          id: 'emp-resumes',
          label: '1- Candidate Resumes',
          navKey: 'resumes',
          badge: resumesCount > 0 ? resumesCount : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300',
        },
        {
          id: 'emp-staff',
          label: '2- Onboarded Employees',
          navKey: 'staff',
          subTab: 'employees',
        },
        {
          id: 'emp-attendance',
          label: '3- Staff Attendance',
          navKey: 'staff',
          subTab: 'attendance',
        },
        {
          id: 'emp-payroll',
          label: '4- Payroll & Advances',
          navKey: 'staff',
          subTab: 'payroll',
          allowedRoles: ['Admin', 'Transport Coordinator'],
        },
      ],
    },
    {
      key: 'routes_group',
      label: '4- Routes and Trips',
      icon: <RouteIcon className="w-5 h-5" />,
      defaultNavKey: 'routes',
      defaultSubTab: 'routes',
      allowedRoles: ['Admin', 'Transport Coordinator'],
      subItems: [
        { id: 'rt-routes', label: '1- Active Routes & Stops', navKey: 'routes', subTab: 'routes' },
        { id: 'rt-services', label: '2- Vehicle Schedule', navKey: 'routes', subTab: 'services' },
        { id: 'rt-pack', label: '3- Print Route List', navKey: 'routes', subTab: 'pack' },
        { id: 'rt-maint', label: '4- Work Orders & Maintenance', navKey: 'vehicles', subTab: 'maintenance' },
      ],
    },
    {
      key: 'operations_group',
      label: '5- Attendance Module',
      icon: <Clock className="w-5 h-5" />,
      defaultNavKey: 'operations',
      defaultSubTab: 'arrival',
      allowedRoles: ['Admin', 'Transport Coordinator'],
      subItems: [
        { id: 'op-arrival', label: '1- Arrival Attendance', navKey: 'operations', subTab: 'arrival' },
        { id: 'op-departure', label: '2- Departure Attendance', navKey: 'operations', subTab: 'departure' },
        { id: 'op-unmarked', label: '3- Unmarked & Mismatch Report', navKey: 'operations', subTab: 'unmarked_mismatch' },
        { id: 'op-absentees', label: '4- Call Absentees (Follow-up)', navKey: 'operations', subTab: 'call_absentees' },
        { id: 'op-calendar', label: '5- Monthly Calendar (P/A/L/H)', navKey: 'operations', subTab: 'calendar' },
        { id: 'op-summary', label: '6- Attendance Summary Sheet', navKey: 'operations', subTab: 'summary' },
      ],
    },
    {
      key: 'fees_group',
      label: '6- Fees & Collection',
      icon: <CreditCard className="w-5 h-5" />,
      defaultNavKey: 'fees',
      defaultSubTab: 'collect',
      allowedRoles: ['Admin', 'Transport Coordinator'],
      subItems: [
        { id: 'fe-collect', label: '1- Collect Fees & Receipts', navKey: 'fees', subTab: 'collect' },
        { id: 'fe-invoices', label: '2- Monthly Invoices', navKey: 'fees', subTab: 'invoices' },
        { id: 'fe-demand', label: '3- Demand Slip & Phone Follow-up', navKey: 'fees', subTab: 'demand_slip' },
        { id: 'fe-matrix', label: '4- Month-wise Fee & Previous Dues', navKey: 'fees', subTab: 'monthly_matrix' },
        { id: 'fe-recovery', label: '5- Overdue & Recovery', navKey: 'fees', subTab: 'recovery' },
      ],
    },
    {
      key: 'expenses_group',
      label: '7- Income, Expense & Day Book',
      icon: <BookOpenCheck className="w-5 h-5" />,
      defaultNavKey: 'expenses',
      defaultSubTab: 'expenses',
      allowedRoles: ['Admin', 'Transport Coordinator'],
      subItems: [
        { id: 'ex-expenses', label: '1- Expenses & Categories', navKey: 'expenses', subTab: 'expenses' },
        {
          id: 'ex-heads',
          label: '2- Expense Approval Categories',
          navKey: 'expenses',
          subTab: 'expense_heads',
          allowedRoles: ['Admin'],
        },
        {
          id: 'ex-income',
          label: '3- Other Income & Heads',
          navKey: 'accounts',
          subTab: 'income',
          allowedRoles: ['Admin', 'Transport Coordinator'],
        },
        {
          id: 'ex-daybook',
          label: '4- Print / View Day Book',
          navKey: 'accounts',
          subTab: 'day_book',
        },
      ],
    },
    {
      key: 'accounts_group',
      label: '8- Ledger and Accounts',
      icon: <Landmark className="w-5 h-5" />,
      defaultNavKey: 'accounts',
      defaultSubTab: 'day_book',
      allowedRoles: ['Admin', 'Transport Coordinator'],
      subItems: [
        {
          id: 'ac-daybook',
          label: '1- Print / View Day Book',
          navKey: 'accounts',
          subTab: 'day_book',
        },
        {
          id: 'ac-stu',
          label: '2- Member Fee Ledger',
          navKey: 'accounts',
          subTab: 'student_ledger',
        },
        {
          id: 'ac-veh',
          label: '3- Vehicle Cost Ledger',
          navKey: 'accounts',
          subTab: 'vehicle_ledger',
        },
        { id: 'ac-odo', label: '4- Vehicle Log Book (24-Hr)', navKey: 'vehicles', subTab: 'odometer' },
        { id: 'ac-fuel', label: '5- Driver Fuel Advances', navKey: 'vehicles', subTab: 'fuel' },
        {
          id: 'ac-vch',
          label: '6- Vouchers & Chart of A/C',
          navKey: 'accounts',
          subTab: 'vouchers',
        },
        {
          id: 'ac-tb',
          label: '7- Trial Balance',
          navKey: 'accounts',
          subTab: 'trial_balance',
        },
      ],
    },
    {
      key: 'masters_group',
      label: '9- Masters & Fees Setup',
      icon: <Layers className="w-5 h-5" />,
      defaultNavKey: 'masters',
      defaultSubTab: 'fees_setup',
      allowedRoles: ['Admin', 'Transport Coordinator'],
      subItems: [
        {
          id: 'm-fees-setup',
          label: 'Fees Setup (Session Months)',
          navKey: 'masters',
          subTab: 'fees_setup',
        },
        {
          id: 'm-users',
          label: 'Users & Passwords (RBAC)',
          navKey: 'masters',
          subTab: 'users',
          allowedRoles: ['Admin'],
        },
        { id: 'm-routes', label: 'Routes', navKey: 'masters', subTab: 'routes' },
        { id: 'm-vehicles', label: 'Vehicles', navKey: 'masters', subTab: 'vehicles' },
        { id: 'm-assignments', label: 'Vehicle-Driver-Helper Link', navKey: 'masters', subTab: 'assignments' },
        { id: 'm-villages', label: 'Villages & Stops', navKey: 'masters', subTab: 'villages' },
        {
          id: 'm-campuses',
          label: 'Campuses',
          navKey: 'masters',
          subTab: 'campuses',
        },
        {
          id: 'm-member-types',
          label: 'Member Types',
          navKey: 'masters',
          subTab: 'member_types',
        },
        {
          id: 'm-trips',
          label: 'Trips',
          navKey: 'masters',
          subTab: 'trips',
        },
        {
          id: 'm-classes',
          label: 'Classes & Sections',
          navKey: 'masters',
          subTab: 'classes',
        },
        {
          id: 'm-designations',
          label: 'Designations & Roles',
          navKey: 'masters',
          subTab: 'designations',
        },
        {
          id: 'm-institute',
          label: 'Name of Institute',
          navKey: 'masters',
          subTab: 'institute',
          allowedRoles: ['Admin'],
        },
      ],
    },
    {
      key: 'reports',
      label: '10- Business Reports',
      icon: <BarChart3 className="w-5 h-5" />,
      defaultNavKey: 'reports',
      allowedRoles: ['Admin', 'Transport Coordinator'],
    },
  ];

  // Dedicated strict sidebar for Attendance Incharge (Sr & Jr): Zero finance modules; ONLY Attendance Dashboard & Attendance Module
  const attendanceInchargeGroups: SidebarGroupItem[] = [
    {
      key: 'dashboard',
      label: '1- Attendance Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      defaultNavKey: 'dashboard',
    },
    {
      key: 'incharge_operations_group',
      label: '2- Attendance Module',
      icon: <Clock className="w-5 h-5" />,
      defaultNavKey: 'operations',
      defaultSubTab: 'arrival',
      subItems: [
        { id: 'inc-arrival', label: '1- Arrival Attendance', navKey: 'operations', subTab: 'arrival' },
        { id: 'inc-departure', label: '2- Departure Attendance', navKey: 'operations', subTab: 'departure' },
        { id: 'inc-unmarked', label: '3- Unmarked & Mismatch Report', navKey: 'operations', subTab: 'unmarked_mismatch' },
        { id: 'inc-absentees', label: '4- Call Absentees (Follow-up)', navKey: 'operations', subTab: 'call_absentees' },
        { id: 'inc-calendar', label: '5- Monthly Calendar (P/A/L/H)', navKey: 'operations', subTab: 'calendar' },
        { id: 'inc-summary', label: '6- Attendance Summary Sheet', navKey: 'operations', subTab: 'summary' },
      ],
    },
  ];

  const baseGroupsForRole =
    currentRole === 'Attendance Incharge'
      ? attendanceInchargeGroups
      : currentRole === 'Transport Assistant'
      ? assistantGroups
      : standardGroups;

  const visibleGroups = baseGroupsForRole
    .filter((g) => !g.allowedRoles || g.allowedRoles.includes(currentRole))
    .map((g) => ({
      ...g,
      subItems: g.subItems?.filter((s) => !s.allowedRoles || s.allowedRoles.includes(currentRole)),
    }));

  const roleColorBadge =
    currentRole === 'Admin'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : currentRole === 'Transport Coordinator'
      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
      : currentRole === 'Attendance Incharge'
      ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  const handleItemSelect = (navKey: NavItemKey, subTab?: string) => {
    onSelect(navKey, subTab);
    if (isApkOrCompactDevice()) {
      setIsSidebarCollapsed(true);
    }
  };

  return (
    <>
      {/* Backdrop when sidebar is expanded on mobile / APK */}
      {!isSidebarCollapsed && (
        <div
          onClick={() => setIsSidebarCollapsed(true)}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px] z-30 lg:hidden print:hidden"
        />
      )}

      {/* Spacer in layout flow on mobile/APK when sidebar expands as overlay */}
      {!isSidebarCollapsed && <div className="w-12 sm:w-14 shrink-0 lg:hidden print:hidden" />}

      <aside
        className={`${
          isSidebarCollapsed
            ? 'w-12 sm:w-16 relative'
            : 'w-64 fixed inset-y-0 left-0 z-40 shadow-2xl lg:static lg:w-64 lg:shadow-none'
        } bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen lg:min-h-[calc(100vh-61px)] transition-all duration-200 border-r border-slate-800 print:hidden`}
      >
        <div
          className={`${
            isSidebarCollapsed ? 'p-2 justify-center' : 'p-3 justify-between'
          } border-b border-slate-800 flex items-center gap-2`}
        >
          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                Authorized Menu
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border truncate ${roleColorBadge}`}
                >
                  {currentRole}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            title={isSidebarCollapsed ? 'Expand Side Ribbon' : 'Minimize Side Ribbon'}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-amber-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>

        <nav className={`${isSidebarCollapsed ? 'p-1.5' : 'p-2.5'} space-y-1 flex-1 overflow-y-auto`}>
          {visibleGroups.map((group) => {
            const hasSubItems = group.subItems && group.subItems.length > 0;
            const isGroupActive = hasSubItems
              ? group.subItems!.some(
                  (sub) =>
                    sub.navKey === activeKey &&
                    (!sub.subTab || !activeSubTab || sub.subTab === activeSubTab)
                )
              : activeKey === group.defaultNavKey &&
                (!group.defaultSubTab || group.defaultSubTab === activeSubTab);
            const isExpanded = !!expandedGroups[group.key];

            return (
              <div key={group.key} className="space-y-1">
                <button
                  onClick={() => {
                    if (hasSubItems) {
                      toggleGroup(group.key, group.defaultNavKey, group.defaultSubTab);
                    } else {
                      handleItemSelect(group.defaultNavKey, group.defaultSubTab);
                    }
                  }}
                  title={group.label}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? 'justify-center px-1.5 py-2.5' : 'justify-between px-3 py-2.5'
                  } rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isGroupActive && (!hasSubItems || isSidebarCollapsed)
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                      : isGroupActive
                      ? 'bg-slate-800/90 text-amber-400 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} min-w-0`}>
                    <span
                      className={
                        isGroupActive && (!hasSubItems || isSidebarCollapsed)
                          ? 'text-slate-950 shrink-0'
                          : isGroupActive
                          ? 'text-amber-400 shrink-0'
                          : 'text-slate-400 shrink-0'
                      }
                    >
                      {group.icon}
                    </span>
                    {!isSidebarCollapsed && <span className="truncate">{group.label}</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {group.badge !== undefined && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            group.badgeColor || 'bg-slate-700 text-slate-200'
                          }`}
                        >
                          {group.badge}
                        </span>
                      )}
                      {hasSubItems ? (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )
                      ) : (
                        isGroupActive && <ChevronRight className="w-4 h-4 text-slate-950" />
                      )}
                    </div>
                  )}
                </button>

                {hasSubItems && isExpanded && !isSidebarCollapsed && (
                  <div className="pl-4 pr-1 py-1 space-y-1 border-l-2 border-slate-800 ml-3.5">
                    {group.subItems!.map((sub) => {
                      const isSubActive =
                        activeKey === sub.navKey &&
                        (!sub.subTab || !activeSubTab || activeSubTab === sub.subTab);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleItemSelect(sub.navKey, sub.subTab)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isSubActive
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                              : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                          }`}
                        >
                          <span className="truncate">{sub.label}</span>
                          {sub.badge !== undefined && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                isSubActive
                                  ? 'bg-slate-950 text-amber-400'
                                  : sub.badgeColor || 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
