'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { profileAPI } from '@/library/api';
import Logo from '@/components/ui/Logo';
import SettingsModal from '@/components/ui/SettingsModal';
import './dashboard.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ============================================================================
// TYPES
// ============================================================================

interface StatCard {
  icon: string;
  iconColor: 'blue' | 'green' | 'purple' | 'orange';
  label: string;
  value: string | number;
  subtext: string;
}

interface Program {
  id: number;
  name: string;
  trainer: number;
  is_deleted: boolean;
  created_at: string;
}
interface WorkoutHistorySession {
  id: number;
  date: string;                 // "YYYY-MM-DD"
  plan_name?: string | null;
  duration_minutes?: number | null;
  notes?: string;
}
// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE_URL = 'http://localhost:8000/api';

const USER_STATS: StatCard[] = [
  {
    icon: '📊',
    iconColor: 'blue',
    label: 'Total Workouts',
    value: 0,
    subtext: 'Start your first workout today!',
  },
  {
    icon: '🔥',
    iconColor: 'green',
    label: 'Current Streak',
    value: '0 days',
    subtext: 'Build consistency!',
  },
  {
    icon: '⏱️',
    iconColor: 'purple',
    label: 'Total Time',
    value: '0 min',
    subtext: 'Every minute counts',
  },
  {
    icon: '🏆',
    iconColor: 'orange',
    label: 'Achievements',
    value: 0,
    subtext: 'Unlock your first badge!',
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // UI state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Profile state
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Trainer stats state
  const [programsCount, setProgramsCount] = useState(0);
  const [activeProgramsCount, setActiveProgramsCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

    // Member workout history + stats
  const [historySessions, setHistorySessions] = useState<WorkoutHistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

const buildMonSunWeekData = (sessions: WorkoutHistorySession[]) => {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toLocalISODate = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // ✅ Anchor week to latest session date if we have any
  const anchor = sessions.length
    ? new Date(sessions.map(s => s.date).sort().slice(-1)[0] + "T12:00:00")
    : new Date();

  // Find Monday of anchor week (local time)
  const day = anchor.getDay(); // Sun=0..Sat=6
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(anchor);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(anchor.getDate() - diffToMonday);

  // Sum minutes by date (dates are already YYYY-MM-DD from backend)
  const minutesByDate = new Map<string, number>();
  for (const s of sessions) {
    const m = typeof s.duration_minutes === 'number' ? s.duration_minutes : 0;
    minutesByDate.set(s.date, (minutesByDate.get(s.date) ?? 0) + m);
  }

  // Build Mon..Sun
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toLocalISODate(d);

    const mins = minutesByDate.get(iso) ?? 0;
    const hours = Math.round((mins) * 10) / 10;
    week.push({ day: labels[i], hours, iso }); // include iso for debugging
  }

  console.log("WEEKLY DATA:", week); // ✅ temporary debug
  return week;
};

const weeklyChartData = buildMonSunWeekData(historySessions);

  // ========================================
  // Effects
  // ========================================

  // Check if user has completed their profile
  useEffect(() => {
    const checkProfile = async () => {
      try {
        const profile = await profileAPI.getProfile();
        setHasCompletedProfile(!!profile.age);
      } catch {
        setHasCompletedProfile(false);
      } finally {
        setProfileLoading(false);
      }
    };

    checkProfile();
  }, []);

// Fetch trainer stats (programs count)
useEffect(() => {
  const fetchTrainerStats = async () => {
    if (!user?.is_trainer || !user?.id) {
      setStatsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/programs/`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        
        // Handle paginated response
        const programs = Array.isArray(data) 
          ? data 
          : Array.isArray(data.results) 
            ? data.results 
            : [];
        
        // Count all programs created by current user (including deleted)
        const myPrograms = programs.filter(
          (p: Program) => String(p.trainer) === String(user.id)
        );
        
        // Count only active (non-deleted) programs
        const activePrograms = myPrograms.filter(
          (p: Program) => !p.is_deleted
        );
        
        setProgramsCount(myPrograms.length);
        setActiveProgramsCount(activePrograms.length);
      }
    } catch (error) {
      console.error('Error fetching trainer stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  fetchTrainerStats();
}, [user?.id, user?.is_trainer]);

// Fetch member workout history (completed sessions)
useEffect(() => {
  const fetchHistory = async () => {
    if (!user || user.is_trainer) {
      setHistoryLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/history/`, {
        credentials: 'include',
      });

      if (!res.ok) {
        setHistorySessions([]);
        return;
      }

      const data = await res.json();
      // backend returns { total, sessions }
      setHistorySessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e) {
      console.error('Error fetching workout history:', e);
      setHistorySessions([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  fetchHistory();
}, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // ========================================
  // Event Handlers
  // ========================================

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setIsDropdownOpen(false);
    await logout();
  };

  const openSettings = () => {
    setIsDropdownOpen(false);
    setIsSettingsOpen(true);
  };

  // ========================================
  // Loading & Auth States
  // ========================================

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // ========================================
  // Render Helpers
  // ========================================

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() 
    || user.username[0].toUpperCase();

  // Dynamic trainer stats with live program countt
  const TRAINER_STATS: StatCard[] = [
    {
      icon: '📊',
      iconColor: 'blue',
      label: 'Programs Created',
      value: statsLoading ? '...' : programsCount,
      subtext: programsCount === 0 ? 'Create your first program!' : 'Keep building!',
    },
    {
      icon: '🏋️',
      iconColor: 'green',
      label: 'Exercises Created',
      value: 0,
      subtext: 'Build your exercise library',
    },
    {
      icon: '💪',
      iconColor: 'purple',
      label: 'Active Programs',
      value: statsLoading ? '...' : activeProgramsCount,
      subtext: 'Publish and share your work',
    },
    {
      icon: '🏆',
      iconColor: 'orange',
      label: 'Total Trainees',
      value: 0,
      subtext: 'See how many people follow your workouts!',
    },
  ];

    // Compute member stats from history
  const totalWorkouts = historySessions.length;

  const totalMinutes = historySessions.reduce((sum, s) => {
    const m = typeof s.duration_minutes === 'number' ? s.duration_minutes : 0;
    return sum + m;
  }, 0);

  // Simple streak: consecutive days including today OR yesterday
  const computeStreak = (sessions: WorkoutHistorySession[]) => {
    if (!sessions.length) return 0;

    const dates = Array.from(new Set(sessions.map(s => s.date))).sort().reverse();

    const today = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0, 10);

    const todayISO = toISO(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayISO = toISO(yesterday);

    let current: Date | null =
      dates[0] === todayISO ? today : (dates[0] === yesterdayISO ? yesterday : null);
    if (!current) return 0;

    let streak = 0;
    for (const d of dates) {
      if (!current) break;

      const currentISO = toISO(current);

      if (d === currentISO) {
        streak++;

        const prev: Date = new Date(current);
        prev.setDate(current.getDate() - 1);

        current = prev;
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = computeStreak(historySessions);

  const MEMBER_STATS: StatCard[] = [
    {
      icon: '📊',
      iconColor: 'blue',
      label: 'Total Workouts',
      value: historyLoading ? '...' : totalWorkouts,
      subtext: totalWorkouts === 0 ? 'Start your first workout today!' : 'Nice work—keep going!',
    },
    {
      icon: '🔥',
      iconColor: 'green',
      label: 'Current Streak',
      value: historyLoading ? '...' : `${currentStreak} days`,
      subtext: currentStreak === 0 ? 'Build consistency!' : 'Momentum looks good!',
    },
    {
      icon: '⏱️',
      iconColor: 'purple',
      label: 'Total Time',
      value: historyLoading ? '...' : `${totalMinutes} min`,
      subtext: 'Every minute counts',
    },
    {
      icon: '🏆',
      iconColor: 'orange',
      label: 'Achievements',
      value: 0,
      subtext: 'Unlock your first badge!',
    },
  ];

  const stats = user.is_trainer ? TRAINER_STATS : MEMBER_STATS;

  // ========================================
  // Render
  // ========================================

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <Logo variant="text" size="sm" />
        </div>
        
        <nav className="dashboard-nav">
          {/* User Menu with Dropdown */}
          <div className="user-menu" ref={dropdownRef}>
            <button 
              className="user-menu-trigger" 
              onClick={toggleDropdown}
              aria-label="User menu"
              aria-expanded={isDropdownOpen}
            >
              <div className="user-avatar">{initials}</div>
              <div className="user-details">
                <div className="user-name">
                  {user.first_name} {user.last_name}
                </div>
                <div className="user-email">{user.email}</div>
                <span className={`user-badge ${user.is_trainer ? 'trainer' : ''}`}>
                  {user.is_trainer ? 'Trainer' : 'Member'}
                </span>
              </div>
              <svg 
                className={`dropdown-icon ${isDropdownOpen ? 'open' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            <div className={`user-menu-dropdown ${isDropdownOpen ? 'open' : ''}`}>
              <div className="dropdown-header">
                <div className="dropdown-user-name">{user.first_name} {user.last_name}</div>
                <div className="dropdown-user-email">{user.email}</div>
              </div>
              
              <ul className="dropdown-menu-items">
                <li>
                  <Link 
                    href="/profile" 
                    className="dropdown-menu-item"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <span>Profile</span>
                  </Link>
                </li>
                <li>
                  <button 
                    className="dropdown-menu-item"
                    onClick={openSettings}
                  >
                    <span>Settings</span>
                  </button>
                </li>
                <div className="dropdown-divider"></div>
                <li>
                  <button 
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="dropdown-menu-item danger"
                  >
                    <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <h1 className="welcome-title">
            Welcome back, {user.first_name}! 👋
          </h1>
          <p className="welcome-subtitle">
            {user.is_trainer 
              ? "Ready to inspire and train your clients today?" 
              : "Ready to crush your fitness goals today?"}
          </p>
          <div className="welcome-message">
            <span className="welcome-icon">🎯</span>
            {user.is_trainer ? (
              <>
                <strong>Trainer Journey:</strong> Manage your workout programs, track client progress, 
                and share your expertise with the Fitiva community.
              </>
            ) : (
              <>
                <strong>Your Fitness Journey:</strong> Complete your profile to get personalized workout 
                recommendations tailored to your goals and experience level.
              </>
            )}
          </div>
        </section>

        {/* Stats Grid */}
        <section className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className={`stat-icon ${stat.iconColor}`}>{stat.icon}</div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-subtext">{stat.subtext}</div>
            </div>
          ))}
        </section>
        {/* Weekly Workout Graph (Members only) */}
{!user.is_trainer && (
  <section style={{ marginTop: '24px' }}>
    <h2 className="section-title">This Week</h2>

    <div
      style={{
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: '12px',
        padding: '16px',
        height: '260px',
      }}
    >
      {historyLoading ? (
        <p>Loading chart...</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weeklyChartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tickMargin={8} />
            <YAxis tickMargin={8}
              label={{ value: "Minutes", angle: -90, position: "insideLeft" }}
              domain={[0, 'auto']}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="hours"
              strokeWidth={3}
              dot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  </section>
)}

        {/* Quick Actions */}
        <section className="quick-actions">
          <h2 className="section-title">Quick Actions</h2>
          <div className="action-buttons">
            {/* Profile Action */}
            <Link href="/profile" className="action-button">
              <div className="action-button-icon">👤</div>
              <div className="action-button-title">
                {hasCompletedProfile ? 'Edit your profile' : 'Complete Profile'}
              </div>
              <div className="action-button-description">
                {hasCompletedProfile 
                  ? 'Change your fitness details to customize for your new preferences'
                  : 'Add your fitness details to get started'}
              </div>
            </Link>

            {/* Browse Programs Action */}
            <Link href="/trainer-programs" className="action-button">
              <div className="action-button-icon">💪</div>
              <div className="action-button-title">Browse Programs</div>
              <div className="action-button-description">
                Explore trainer-created workouts
              </div>
            </Link>
            
            {user.is_trainer ? (
              <>
                <Link href="/add-exercise" className="action-button">
                  <div className="action-button-icon">🏋️</div>
                  <div className="action-button-title">Add Exercise</div>
                  <div className="action-button-description">
                    Create exercises for your programs
                  </div>
                </Link>
                
                <Link href="/create-program" className="action-button">
                  <div className="action-button-icon">✨</div>
                  <div className="action-button-title">Create Program</div>
                  <div className="action-button-description">
                    Design a new workout plan
                  </div>
                </Link>
              </>
            ) : (
              <>
                
                <Link href="/recommendations" className="action-button">
                  <div className="action-button-icon">🎯</div>
                  <div className="action-button-title">View Recommendations</div>
                  <div className="action-button-description">
                    Discover workout plans for you
                  </div>
                </Link>
              </>
            )}
            <Link href="/schedule" className="action-button">
                  <div className="action-button-icon">📅</div>
                  <div className="action-button-title">My Workout Schedule</div>
                  <div className="action-button-description">
                    View and manage your personalized calendar
                  </div>
                </Link>
          </div>
        </section>
      </main>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
