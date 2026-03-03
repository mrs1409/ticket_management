'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import {
  TicketCheck,
  ShieldCheck,
  Zap,
  BarChart3,
  Users,
  Mail,
  ArrowRight,
  GitBranch,
  Lock,
  CheckCircle2,
} from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Role-Based Access Control',
    description: 'Five distinct roles — Customer, Agent L1/L2/L3, and Admin — each with precisely scoped permissions on every route.',
    accent: 'bg-violet-500',
    light: 'bg-violet-50 text-violet-600',
  },
  {
    icon: GitBranch,
    title: 'Tiered Escalation Engine',
    description: 'Tickets auto-escalate from L1 → L2 → L3 based on SLA thresholds enforced by an hourly BullMQ cron job.',
    accent: 'bg-blue-500',
    light: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Zap,
    title: 'Background Job Queues',
    description: 'BullMQ powers four independent worker queues: classification, auto-escalation, email notifications, and archival.',
    accent: 'bg-amber-500',
    light: 'bg-amber-50 text-amber-600',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Daily ticket volume, priority breakdown, average resolution time, and escalation rate — all in one admin dashboard.',
    accent: 'bg-emerald-500',
    light: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Lock,
    title: 'Secure by Default',
    description: 'JWT access tokens (15 min) + Redis-backed refresh tokens (7 days), token blacklisting, Helmet, and strict CORS.',
    accent: 'bg-rose-500',
    light: 'bg-rose-50 text-rose-600',
  },
  {
    icon: Mail,
    title: 'Email Notifications',
    description: 'Automated Nodemailer emails on ticket creation, agent assignment, and resolution with zero config in development.',
    accent: 'bg-cyan-500',
    light: 'bg-cyan-50 text-cyan-600',
  },
];

const STEPS = [
  { step: '01', title: 'Customer creates a ticket', body: 'Linked to an order. Priority is auto-detected from description keywords.', color: 'border-blue-400 bg-blue-600' },
  { step: '02', title: 'Agent triages and resolves', body: 'L1 handles it first. Unresolved past the SLA? Auto-escalates to L2, then L3.', color: 'border-violet-400 bg-violet-600' },
  { step: '03', title: 'Admin monitors everything', body: 'Full analytics, audit logs, user management, and job retry dashboard.', color: 'border-emerald-400 bg-emerald-600' },
];

const ROLES = [
  { role: 'Customer', icon: '\uD83D\uDED2', bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', desc: 'Submit & track tickets' },
  { role: 'Agent L1', icon: '\uD83C\uDFA7', bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', desc: 'First-line triage' },
  { role: 'Agent L2', icon: '\uD83D\uDD27', bg: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', desc: 'Handles escalations' },
  { role: 'Agent L3', icon: '\u26A1', bg: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700', desc: 'Top-tier resolution' },
  { role: 'Admin', icon: '\uD83D\uDC51', bg: 'bg-rose-50 border-rose-200', badge: 'bg-rose-100 text-rose-700', desc: 'Full system control' },
];

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    switch (user?.role) {
      case 'admin': router.replace('/admin/dashboard'); break;
      case 'agent_l1':
      case 'agent_l2':
      case 'agent_l3': router.replace('/agent/dashboard'); break;
      default: router.replace('/dashboard');
    }
  }, [user, isLoading, isAuthenticated, router]);

  return (
    <main className="min-h-screen bg-white text-gray-900 antialiased">

      {/* â”€â”€ Nav â”€â”€ */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-900 shadow-lg shadow-slate-900/20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-xl text-white">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <TicketCheck className="w-4 h-4 text-white" />
            </div>
            TicketDesk
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/register" className="text-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white px-5 py-2 rounded-lg transition shadow-md shadow-blue-500/30">
              Get started →
            </Link>
          </div>
        </div>
      </nav>

      {/* â”€â”€ Hero â”€â”€ */}
      <section className="pt-32 pb-16 px-6 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 relative overflow-hidden">
        {/* subtle grid overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZjA4IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide uppercase">
            <Zap className="w-3 h-3" />
            Production-grade · Full-stack · Open source
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6">
            Customer support,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              engineered properly
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            A multi-role support platform with tiered agent escalation, BullMQ background workers,
            JWT auth, Google OAuth, and a full analytics dashboard.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold text-base px-8 py-3.5 rounded-xl transition shadow-xl shadow-blue-500/30"
          >
            Open the app
            <ArrowRight className="w-5 h-5" />
          </Link>


        </div>
      </section>

      {/* â”€â”€ Features â”€â”€ */}
      <section className="py-14 md:py-20 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Features</p>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">Everything you need, nothing you don&apos;t</h2>
            <p className="text-slate-500 mt-3 text-base max-w-lg mx-auto">
              Built with clean separation of concerns, testable services, and zero magic.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.light}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ How It Works â”€â”€ */}
      <section className="py-14 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Workflow</p>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">How it works</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((item) => (
              <div key={item.step} className="relative bg-slate-900 rounded-2xl p-7 text-white overflow-hidden">
                <div className="absolute top-0 right-0 text-8xl font-black text-white/5 leading-none select-none pr-3 -mt-2">{item.step}</div>
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-5 text-white font-bold text-sm shadow-lg`}>
                  {item.step}
                </div>
                <h3 className="font-bold text-base text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ Roles â”€â”€ */}
      <section className="py-14 md:py-20 px-4 sm:px-6 bg-gradient-to-br from-slate-50 to-blue-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Access Control</p>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">One system, five roles</h2>
            <p className="text-slate-500 mt-2 text-sm">Every user sees only what they need — nothing more.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {ROLES.map((r) => (
              <div key={r.role} className={`rounded-2xl border-2 ${r.bg} p-5 flex flex-col items-center text-center gap-2`}>
                <span className="text-3xl">{r.icon}</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${r.badge}`}>{r.role}</span>
                <p className="text-xs text-slate-600">{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              'Parameterized SQL, no string concatenation',
              'Access tokens in memory, never localStorage',
              'Token blacklist on logout via Redis',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-600">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ CTA â”€â”€ */}
      <section className="py-14 md:py-20 px-4 sm:px-6 bg-gradient-to-r from-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZjBjIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-60" />
        <div className="relative z-10 max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3">Ready to explore?</h2>
          <p className="text-blue-200 mb-8 text-base">
            Sign in with the test credentials from the README, or register a new customer account.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition shadow-2xl text-base"
          >
            Go to login
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* â”€â”€ Footer â”€â”€ */}
      <footer className="py-6 px-6 bg-slate-900 text-center text-sm text-slate-500">
        <div className="flex items-center justify-center gap-2 mb-1">
          <TicketCheck className="w-4 h-4 text-blue-400" />
          <span className="font-bold text-slate-300">TicketDesk</span>
        </div>
        Built with Next.js · Express · PostgreSQL · Redis · BullMQ
      </footer>

    </main>
  );
}


