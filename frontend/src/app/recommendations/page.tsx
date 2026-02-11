'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import './recommendations.css';

interface ExerciseSet {
  id: number;
  set_number: number;
  reps: number | null;
  time: number | null;
  rest: number;
}

interface Exercise {
  id: number;
  name: string;
  order: number;
  sets: ExerciseSet[];
}

interface ProgramSection {
  id: number;
  format: string;
  type: string;
  order: number;
  exercises: Exercise[];
}

interface Program {
  id: number;
  name: string;
  description: string;
  focus: string[];
  difficulty: string;
  weekly_frequency: number;
  session_length: number;
  trainer: number;
  trainer_name: string;
  created_at: string;
  sections: ProgramSection[];
}

interface RecommendationsResponse {
  user_focuses: string[];
  total_recommendations: number;
  programs: Program[];
  message?: string;
}

const RecommendationsPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recommendations/`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch recommendations');
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFocusIcon = (focuses: string[]) => {
    const icons: { [key: string]: string } = {
      strength: '💪',
      cardio: '❤️',
      flexibility: '🧘',
      balance: '⚖️',
    };
    if (!focuses || focuses.length === 0) return '💪';
    const firstFocus = focuses[0].toLowerCase();
    return icons[firstFocus] || '💪';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  };

const handleViewProgram = (programId: number) => {
  router.push(`/program/${programId}`);
};

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="recommendations-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="recommendations-container">
          <div className="header">
            <button className="back-button" onClick={() => router.push('/dashboard')}>
              ← Back to Dashboard
            </button>
            <h1>Recommended Programs</h1>
          </div>
          <div className="content">
            <div className="error-state">
              <h3>⚠️ {error}</h3>
              {error.includes('profile') && (
                <button 
                  className="btn-primary"
                  onClick={() => router.push(`/profile/${user?.id}`)}
                >
                  Complete Your Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="recommendations-container">
        <div className="header">
          <button className="back-button" onClick={() => router.push('/dashboard')}>
            ← Back to Dashboard
          </button>
          <h1>Recommended Programs</h1>
        </div>

        <div className="content">
          {/* User Focus Summary */}
          {recommendations?.user_focuses && recommendations.user_focuses.length > 0 && (
            <div className="focus-summary">
              <h2>Your Fitness Focuses</h2>
              <div className="focus-tags">
                {recommendations.user_focuses.map((focus) => (
                  <span key={focus} className="focus-tag">
                    {focus.charAt(0).toUpperCase() + focus.slice(1)}
                  </span>
                ))}
              </div>
              <p className="summary-text">
                Showing {recommendations.total_recommendations} programs matching your interests
              </p>
            </div>
          )}

          {/* No Profile Setup Message */}
          {recommendations?.message && (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>{recommendations.message}</h3>
              <button 
                className="btn-primary"
                onClick={() => router.push(`/profile/${user?.id}`)}
              >
                Set Up Your Profile
              </button>
            </div>
          )}

          {/* Programs Grid */}
          {recommendations?.programs && recommendations.programs.length > 0 ? (
            <div className="programs-grid">
              {recommendations.programs.map((program) => {
                const totalExercises = program.sections?.reduce(
                  (sum, section) => sum + (section.exercises?.length || 0),
                  0
                );

                return (
                  <div key={program.id} className="program-card">
                    <div className="program-badge">RECOMMENDED</div>

                    <div className="program-header">
                      <span className="focus-icon">{getFocusIcon(program.focus)}</span>
                      <h3 className="program-title">{program.name}</h3>
                    </div>

                    <p className="program-description">
                      {program.description || 'No description provided'}
                    </p>

                    {/* Author Information */}
                    <div className="program-author">
                      <strong>Trainer:</strong> {program.trainer_name}
                    </div>

                    {/* Program Details */}
                    <div className="program-meta">
                      <div className="meta-item">
                        <span className="meta-label">Focus:</span>
                        <div className="focus-tags-inline">
                          {program.focus.map((f) => (
                            <span key={f} className="focus-tag-small">
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Difficulty:</span>
                        <span className={`difficulty-badge ${program.difficulty}`}>
                          {program.difficulty.charAt(0).toUpperCase() + program.difficulty.slice(1)}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Weekly Frequency:</span>
                        <span className="meta-value">{program.weekly_frequency} days/week</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Session Length:</span>
                        <span className="meta-value">{program.session_length} min</span>
                      </div>
                    </div>

                    {/* Program Stats */}
                    <div className="program-stats">
                      <div className="stat">
                        <span className="stat-value">{program.sections?.length || 0}</span>
                        <span className="stat-label">Days</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{totalExercises || 0}</span>
                        <span className="stat-label">Exercises</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="program-actions">
                      <button
                        className="btn-view"
                        onClick={() => handleViewProgram(program.id)}
                      >
                        View Details
                      </button>
                    </div>

                    <p className="program-date">Created {formatDate(program.created_at)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            !recommendations?.message && (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No Matching Programs Found</h3>
                <p>
                  We couldn&apos;t find any programs matching your fitness focuses.
                  Check back later as trainers add new programs!
                </p>
                <button 
                  className="btn-secondary"
                  onClick={() => router.push('/trainer-programs')}
                >
                  Browse All Programs
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default RecommendationsPage;
