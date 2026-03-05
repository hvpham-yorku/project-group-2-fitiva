'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Notification from '@/components/Notification';
import ConfirmModal from '@/components/ConfirmModal';
import './schedule.css';

interface CalendarEvent {
  date: string;
  day: string;
  sections: Array<{
    id: number;
    name: string;
    type: string;
    exercise_count: number;
    program_id: number;
    program_name: string;
    focus: string;
  }>;
  section_type: string;
  exercise_count: number;
  session_status?: 'in_progress' | 'completed' | null;
  has_feedback?: boolean;
}

interface Program {
  id: number;
  name: string;
  focus: string[];
  difficulty: string;
  trainer_name: string;
}

interface Schedule {
  id: number;
  programs: number[];
  program_names: string;
  program_list: Program[];
  start_date: string;
  weekly_schedule: { [key: string]: number[] | string };
  is_active: boolean;
  created_at: string;
}

interface ScheduleResponse {
  schedule: Schedule | null;
  calendar_events: CalendarEvent[];
}

const SchedulePage = () => {
  const router = useRouter();
  const { user } = useAuth();

  const [scheduleData, setScheduleData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [workoutDetail, setWorkoutDetail] = useState<any>(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [newStartDate, setNewStartDate] = useState('');

  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  } | null>(null);

  // Confirm modal state
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  // Feedback form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackFatigue, setFeedbackFatigue] = useState<number | null>(null);
  const [feedbackPain, setFeedbackPain] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/schedule/active/`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setScheduleData(data);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message: string) => setNotification({ type: 'success', message });
  const showError = (message: string) => setNotification({ type: 'error', message });
  const showInfo = (message: string) => setNotification({ type: 'info', message });

  const resetFeedbackForm = () => {
    setFeedbackRating(0);
    setFeedbackFatigue(null);
    setFeedbackPain(false);
    setFeedbackNotes('');
  };

  const handleCloseModal = () => {
    setShowWorkoutModal(false);
    setShowFeedbackForm(false);
    resetFeedbackForm();
  };

  const handleUpdateStartDate = async () => {
    if (!newStartDate || !scheduleData?.schedule) return;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/schedule/${scheduleData.schedule.id}/update-start-date/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ start_date: newStartDate }),
        }
      );
      if (response.ok) {
        showSuccess('Start date updated!');
        setEditingStartDate(false);
        fetchSchedule();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to update start date');
      }
    } catch (error) {
      console.error('Error updating start date:', error);
      showError('Error updating start date. Please try again.');
    }
  };

  const fetchWorkoutForDate = async (dateStr: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/schedule/workout/${dateStr}/`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setWorkoutDetail(data);
        setShowWorkoutModal(true);
      }
    } catch (error) {
      console.error('Error fetching workout:', error);
      showError('Failed to load workout details');
    }
  };

  const startSession = async (dateStr: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/start/${dateStr}/`,
      { method: 'POST', credentials: 'include' }
    );
    if (!res.ok) throw new Error('Failed to start session');
    return res.json();
  };

  const completeSession = async (dateStr: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/complete/${dateStr}/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      }
    );
    if (!res.ok) throw new Error('Failed to complete session');
    return res.json();
  };

  const submitFeedback = async (dateStr: string) => {
    if (feedbackRating === 0) {
      showError('Please rate the difficulty before submitting.');
      return;
    }
    setSubmittingFeedback(true);
    try {
      const body: Record<string, any> = {
        difficulty_rating: feedbackRating,
        pain_reported: feedbackPain,
        notes: feedbackNotes,
      };
      if (feedbackFatigue !== null) body.fatigue_level = feedbackFatigue;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/feedback/${dateStr}/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error('Failed to submit feedback');
      showSuccess('Feedback submitted! 🙌');
      setShowFeedbackForm(false);
      setShowWorkoutModal(false);
      resetFeedbackForm();
      await fetchSchedule();
    } catch {
      showError('Could not submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleDateClick = (event: CalendarEvent) => {
    setSelectedDate(event.date);
    setShowFeedbackForm(false);
    resetFeedbackForm();
    fetchWorkoutForDate(event.date);
  };

  const handleDeactivateSchedule = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/schedule/deactivate/`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (response.ok) {
        showSuccess('Schedule cleared successfully');
        setTimeout(() => router.push('/trainer-programs'), 1500);
      } else {
        showError('Failed to clear schedule');
      }
    } catch (error) {
      console.error('Error deactivating schedule:', error);
      showError('Error clearing schedule. Please try again.');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0 sec';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} sec`;
    if (secs === 0) return `${mins} min`;
    return `${mins} min ${secs} sec`;
  };

  const getFocusIcon = (focus: string) => {
    const icons: { [key: string]: string } = {
      strength: '💪',
      cardio: '❤️',
      flexibility: '🧘',
      balance: '⚖️',
    };
    return icons[focus?.toLowerCase()] || '🏋️';
  };

  const groupEventsByWeek = (events: CalendarEvent[]) => {
    const weeks: CalendarEvent[][] = [];
    let currentWeek: CalendarEvent[] = [];
    events.forEach((event, index) => {
      currentWeek.push(event);
      if ((index + 1) % 7 === 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="schedule-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!scheduleData?.schedule) {
    return (
      <ProtectedRoute>
        <div className="schedule-container">
          <div className="header">
            <button className="back-button" onClick={() => router.push('/trainer-programs')}>
              ← Back to Programs
            </button>
            <h1>My Workout Schedule</h1>
          </div>
          <div className="content">
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>No Active Schedule</h3>
              <p>You haven&apos;t selected a workout program yet.</p>
              <button className="btn-primary" onClick={() => router.push('/trainer-programs')}>
                Browse Programs
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const { schedule, calendar_events } = scheduleData;
  const weeks = groupEventsByWeek(calendar_events);
  const allFocuses = schedule.program_list
    ? [...new Set(schedule.program_list.flatMap((p) => p.focus))]
    : [];

  return (
    <ProtectedRoute>
      <div className="schedule-container">
        {/* Header */}
        <div className="header">
          <button className="back-button" onClick={() => router.push('/trainer-programs')}>
            ← Back to Programs
          </button>
          <h1>My Workout Schedule</h1>
        </div>

        <div className="content">
          {/* Program Info Card */}
          <div className="program-info-card">
            <div className="program-info-header">
              <div className="program-info-main">
                <h2>{schedule.program_names || 'My Schedule'}</h2>
                {allFocuses.length > 0 && (
                  <div className="focus-badges">
                    {allFocuses.map((f) => (
                      <span key={f} className="focus-badge">
                        {getFocusIcon(f)} {f.charAt(0).toUpperCase() + f.slice(1)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn-deactivate" onClick={() => setShowDeactivateConfirm(true)}>
                🗑️ Clear Schedule
              </button>
            </div>

            {schedule.program_list && schedule.program_list.length > 0 && (
              <div className="programs-in-schedule">
                <h4>Programs in Schedule ({schedule.program_list.length})</h4>
                <div className="program-chips">
                  {schedule.program_list.map((program) => (
                    <div
                      key={program.id}
                      className="program-chip program-chip-clickable"
                      onClick={() => router.push(`/program/${program.id}`)}
                    >
                      <span className="program-chip-name">{program.name}</span>
                      <span className={`program-chip-difficulty difficulty-${program.difficulty}`}>
                        {program.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="program-stats-row">
              <div className="stat-box">
                <span className="stat-icon">👤</span>
                <div className="stat-content">
                  <span className="stat-label">Trainers</span>
                  <span className="stat-value">
                    {schedule.program_list && schedule.program_list.length > 0
                      ? [...new Set(schedule.program_list.map((p) => p.trainer_name))].join(', ')
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="stat-box">
                <span className="stat-icon">📅</span>
                <div className="stat-content">
                  <span className="stat-label">Start Date</span>
                  {editingStartDate ? (
                    <div className="date-edit-section">
                      <input
                        type="date"
                        className="date-input"
                        value={newStartDate}
                        onChange={(e) => setNewStartDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <div className="date-edit-buttons">
                        <button className="btn-save-date" onClick={handleUpdateStartDate}>✓</button>
                        <button
                          className="btn-cancel-date"
                          onClick={() => { setEditingStartDate(false); setNewStartDate(''); }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="stat-value-editable"
                      onClick={() => { setEditingStartDate(true); setNewStartDate(schedule.start_date); }}
                    >
                      {new Date(schedule.start_date).toLocaleDateString()}
                      <span className="edit-icon">✏️</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="stat-box">
                <span className="stat-icon">📊</span>
                <div className="stat-content">
                  <span className="stat-label">Programs</span>
                  <span className="stat-value">
                    {schedule.program_list ? schedule.program_list.length : 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="calendar-section">
            <h3 className="calendar-title">4-Week Schedule</h3>

            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="calendar-week">
                <div className="week-header">
                  <h4>Week {weekIndex + 1}</h4>
                  <span className="week-dates">
                    {formatDate(week[0].date)} - {formatDate(week[week.length - 1].date)}
                  </span>
                </div>

                <div className="week-grid">
                  {week.map((event) => (
                    <div
                      key={event.date}
                      className={`calendar-day ${event.section_type === 'rest' ? 'rest-day' : 'workout-day'} ${selectedDate === event.date ? 'selected' : ''}`}
                      onClick={() => handleDateClick(event)}
                    >
                      <div className="day-header">
                        <span className="day-name">{event.day}</span>
                        <span className="day-date">{new Date(event.date).getDate()}</span>
                      </div>

                      <div className="day-content">
                        {event.section_type === 'rest' ? (
                          <div className="rest-indicator">
                            <span className="rest-icon">😴</span>
                            <span className="rest-text">Rest Day</span>
                          </div>
                        ) : (
                          <div className="workout-indicator">
                            <span className="workout-icon">🏋️</span>
                            {event.sections && event.sections.length > 0 && (
                              <div className="workout-programs-table">
                                {event.sections.map((section, idx) => (
                                  <div key={idx} className="program-row">
                                    <div className="program-name-col">
                                      <div className="program-name-line">
                                        <a
                                          href={`/program/${section.program_id}`}
                                          className="program-link"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/program/${section.program_id}`);
                                          }}
                                        >
                                          {section.program_name}
                                        </a>
                                      </div>
                                      <div className="program-focus-line">
                                        <span className="program-focus-text">
                                          {typeof section.focus === 'string'
                                            ? section.focus
                                            : Array.isArray(section.focus)
                                            ? (section.focus as string[]).slice(0, 2).join(', ')
                                            : 'N/A'}
                                        </span>
                                        {event.session_status === 'completed' && (
                                          <span className="program-complete-badge">✅ Complete</span>
                                        )}
                                        {event.session_status === 'in_progress' && (
                                          <span className="program-inprogress-badge">In Progress</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="total-count">{event.exercise_count} total</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Workout Detail Modal */}
          {showWorkoutModal && workoutDetail ? (
            <div className="modal-overlay" onClick={handleCloseModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>
                    {showFeedbackForm
                      ? '📝 Rate Your Workout'
                      : workoutDetail.is_rest_day
                      ? '😴 Rest Day'
                      : '🏋️ Workout Day'}
                  </h3>
                  <button className="modal-close" onClick={handleCloseModal}>✕</button>
                </div>

                <div className="modal-body">
                  <div className="workout-date">
                    {new Date(workoutDetail.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>

                  {workoutDetail.is_rest_day ? (
                    <div className="rest-message">
                      <p>{workoutDetail.message}</p>
                    </div>
                  ) : (
                    <>
                      {/* Exercise details — hidden while feedback form is active */}
                      {!showFeedbackForm &&
                        workoutDetail.workouts &&
                        workoutDetail.workouts.map((workout: any, workoutIdx: number) => (
                          <div key={workoutIdx} className="workout-section-detail">
                            <h4 className="workout-program-name">
                              {workout.program_name} - {workout.section.format}
                            </h4>
                            {workout.section.exercises && workout.section.exercises.length > 0 && (
                              <div className="exercises-section">
                                {workout.section.exercises.map((exercise: any, index: number) => (
                                  <div key={exercise.id} className="exercise-detail">
                                    <div className="exercise-detail-header">
                                      <span className="exercise-number">{index + 1}</span>
                                      <h5>{exercise.name}</h5>
                                    </div>
                                    <table className="sets-table">
                                      <thead>
                                        <tr>
                                          <th>Set</th>
                                          <th>Reps</th>
                                          <th>Time</th>
                                          <th>Rest</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {exercise.sets.map((set: any) => (
                                          <tr key={set.id}>
                                            <td>{set.set_number}</td>
                                            <td>{set.reps || '-'}</td>
                                            <td>{set.time ? formatTime(set.time) : '-'}</td>
                                            <td>{formatTime(set.rest)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                      {/* ── FEEDBACK FORM ── */}
                      {showFeedbackForm && (
                        <div className="feedback-form">
                          {/* Difficulty — required */}
                          <div className="feedback-section">
                            <label className="feedback-label">
                              Difficulty <span className="feedback-required">*</span>
                            </label>
                            <div className="rating-buttons">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  className={`rating-btn ${feedbackRating === n ? 'rating-btn-active' : ''}`}
                                  onClick={() => setFeedbackRating(n)}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                            <div className="rating-scale-labels">
                              <span>Very Easy</span>
                              <span>Very Hard</span>
                            </div>
                          </div>

                          {/* Fatigue — optional */}
                          <div className="feedback-section">
                            <label className="feedback-label">
                              Fatigue Level{' '}
                              <span className="feedback-optional">(optional)</span>
                            </label>
                            <div className="rating-buttons">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  className={`rating-btn ${feedbackFatigue === n ? 'rating-btn-active' : ''}`}
                                  onClick={() =>
                                    setFeedbackFatigue(feedbackFatigue === n ? null : n)
                                  }
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                            <div className="rating-scale-labels">
                              <span>Not Tired</span>
                              <span>Exhausted</span>
                            </div>
                          </div>

                          {/* Pain — optional toggle */}
                          <div className="feedback-section feedback-section-inline">
                            <label className="feedback-label">Any pain or discomfort?</label>
                            <button
                              className={`toggle-pain-btn ${feedbackPain ? 'toggle-pain-yes' : 'toggle-pain-no'}`}
                              onClick={() => setFeedbackPain(!feedbackPain)}
                            >
                              {feedbackPain ? '⚠️ Yes' : 'No'}
                            </button>
                          </div>

                          {/* Notes — optional */}
                          <div className="feedback-section">
                            <label className="feedback-label">
                              Notes{' '}
                              <span className="feedback-optional">(optional)</span>
                            </label>
                            <textarea
                              className="feedback-textarea"
                              placeholder="How did it go? Any observations..."
                              value={feedbackNotes}
                              onChange={(e) => setFeedbackNotes(e.target.value)}
                              rows={3}
                            />
                          </div>

                          <div className="feedback-actions">
                            <button
                              className="btn-skip-feedback"
                              onClick={() => {
                                setShowFeedbackForm(false);
                                setShowWorkoutModal(false);
                                resetFeedbackForm();
                              }}
                            >
                              Skip
                            </button>
                            <button
                              className="btn-submit-feedback"
                              onClick={() => submitFeedback(workoutDetail.date)}
                              disabled={feedbackRating === 0 || submittingFeedback}
                            >
                              {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── MODAL ACTIONS (hidden while feedback form is open) ── */}
                      {!showFeedbackForm && (
                        <div className="modal-actions">
                          {/* Completed + feedback already given */}
                          {workoutDetail.session_status === 'completed' &&
                            workoutDetail.has_feedback && (
                              <div className="workout-completed-label">
                                ✅ Completed · Feedback Given ✓
                              </div>
                            )}

                          {/* Completed + no feedback yet */}
                          {workoutDetail.session_status === 'completed' &&
                            !workoutDetail.has_feedback && (
                              <div className="completed-no-feedback-row">
                                <div className="workout-completed-label">✅ Completed</div>
                                <button
                                  className="btn-add-feedback"
                                  onClick={() => setShowFeedbackForm(true)}
                                >
                                  📝 Rate this Workout
                                </button>
                              </div>
                            )}

                          {/* No session yet */}
                          {!workoutDetail.session_status && (
                            <button
                              className="btn-start-workout"
                              onClick={async () => {
                                try {
                                  await startSession(workoutDetail.date);
                                  showSuccess('Workout started!');
                                  await fetchSchedule();
                                  await fetchWorkoutForDate(workoutDetail.date);
                                } catch {
                                  showError('Could not start workout.');
                                }
                              }}
                            >
                              ▶️ Start Workout
                            </button>
                          )}

                          {/* In progress */}
                          {workoutDetail.session_status === 'in_progress' && (
                            <button
                              className="btn-complete-workout"
                              onClick={async () => {
                                try {
                                  await completeSession(workoutDetail.date);
                                  showSuccess('Workout completed! 🎉');
                                  await fetchSchedule();
                                  await fetchWorkoutForDate(workoutDetail.date);
                                  setShowFeedbackForm(true);
                                } catch {
                                  showError('Could not complete workout.');
                                }
                              }}
                            >
                              ✅ Complete
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Notification */}
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Confirm deactivate */}
        {showDeactivateConfirm && (
          <ConfirmModal
            title="Clear Entire Schedule?"
            message="This will remove all programs from your schedule. This action cannot be undone."
            confirmText="Clear Schedule"
            cancelText="Cancel"
            type="danger"
            onConfirm={() => {
              setShowDeactivateConfirm(false);
              handleDeactivateSchedule();
            }}
            onCancel={() => setShowDeactivateConfirm(false)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
};

export default SchedulePage;
