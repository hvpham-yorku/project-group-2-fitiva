'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import './trainer-programs.css';

interface Program {
  id: number;
  name: string;
  created_at: string;
  created_by: {
    id: number;
    first_name: string;
    last_name: string;
  };
  sections: Array<{
    format: string;
    type: string;
    exercises: Array<{
      name: string;
      sets: any[];
    }>;
  }>;
}

export default function TrainerProgramsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [myPrograms, setMyPrograms] = useState<Program[]>([]);
  const [otherPrograms, setOtherPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'others'>('my');

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/programs/all/', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        
        const mine = data.filter((p: Program) => p.created_by?.id === user?.id);
        const others = data.filter((p: Program) => p.created_by?.id !== user?.id);
        
        setMyPrograms(mine);
        setOtherPrograms(others);
      }
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficulty = (program: Program) => {
    // Determine difficulty based on number of exercises
    const totalExercises = program.sections.reduce((acc, section) => 
      acc + section.exercises.length, 0
    );
    if (totalExercises <= 3) return 'Beginner';
    if (totalExercises <= 6) return 'Intermediate';
    return 'Advanced';
  };

  const getFocusArea = (program: Program) => {
    // Determine focus based on section types
    const hasWarmUp = program.sections.some(s => s.type === 'Warm Up');
    const hasWorkingSets = program.sections.some(s => s.type === 'Working Sets');
    if (hasWarmUp && hasWorkingSets) return 'Full Body';
    if (hasWorkingSets) return 'Strength';
    return 'Mixed';
  };

  const viewProgramDetails = (programId: number) => {
    router.push(`/program/${programId}`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="trainer-programs-container">
      {/* Header */}
      <div className="header">
        <button onClick={() => router.push('/dashboard')} className="back-button">
          ← Back to Dashboard
        </button>
        <h1>Workout Programs</h1>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button 
          className={`tab ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          My Programs ({myPrograms.length})
        </button>
        <button 
          className={`tab ${activeTab === 'others' ? 'active' : ''}`}
          onClick={() => setActiveTab('others')}
        >
          Other Trainers ({otherPrograms.length > 2 ? '2+' : otherPrograms.length})
        </button>
      </div>

      <div className="content">
        {/* My Programs Tab */}
        {activeTab === 'my' && (
          <section className="programs-section">
            <div className="section-header">
              <h2>My Created Workout Plans</h2>
              <button 
                onClick={() => router.push('/create-program')}
                className="btn-create"
              >
                + Create New Program
              </button>
            </div>

            {myPrograms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No Programs Yet</h3>
                <p>You haven't created any workout programs yet.</p>
                <button 
                  onClick={() => router.push('/create-program')}
                  className="btn-primary"
                >
                  Create Your First Program
                </button>
              </div>
            ) : (
              <div className="programs-grid">
                {myPrograms.map((program) => (
                  <div key={program.id} className="program-card my-program">
                    <div className="program-badge">Your Program</div>
                    <h3 className="program-title">{program.name}</h3>
                    
                    <div className="program-meta">
                      <div className="meta-item">
                        <span className="meta-label">Trainer:</span>
                        <span className="meta-value">
                          {program.created_by.first_name} {program.created_by.last_name}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Focus Area:</span>
                        <span className="meta-value">{getFocusArea(program)}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Difficulty:</span>
                        <span className={`difficulty-badge ${getDifficulty(program).toLowerCase()}`}>
                          {getDifficulty(program)}
                        </span>
                      </div>
                    </div>

                    <div className="program-stats">
                      <div className="stat">
                        <span className="stat-value">{program.sections.length}</span>
                        <span className="stat-label">Sections</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">
                          {program.sections.reduce((acc, s) => acc + s.exercises.length, 0)}
                        </span>
                        <span className="stat-label">Exercises</span>
                      </div>
                    </div>

                    <div className="program-actions">
                      <button 
                        onClick={() => viewProgramDetails(program.id)}
                        className="btn-view"
                      >
                        View Details
                      </button>
                      <button 
                        onClick={() => router.push(`/edit-program/${program.id}`)}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                    </div>

                    <p className="program-date">
                      Created {new Date(program.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Other Trainers Tab */}
        {activeTab === 'others' && (
          <section className="programs-section">
            <h2>Other Trainers' Workout Plans</h2>
            <p className="section-description">
              Explore programs from other trainers. Subscribe to unlock unlimited access.
            </p>

            <div className="programs-grid">
              {/* Show only 2 free programs */}
              {otherPrograms.slice(0, 2).map((program) => (
                <div key={program.id} className="program-card">
                  <div className="program-badge free">Free Preview</div>
                  <h3 className="program-title">{program.name}</h3>
                  
                  <div className="program-meta">
                    <div className="meta-item">
                      <span className="meta-label">Trainer:</span>
                      <span className="meta-value">
                        {program.created_by.first_name} {program.created_by.last_name}
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Focus Area:</span>
                      <span className="meta-value">{getFocusArea(program)}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Difficulty:</span>
                      <span className={`difficulty-badge ${getDifficulty(program).toLowerCase()}`}>
                        {getDifficulty(program)}
                      </span>
                    </div>
                  </div>

                  <div className="program-stats">
                    <div className="stat">
                      <span className="stat-value">{program.sections.length}</span>
                      <span className="stat-label">Sections</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">
                        {program.sections.reduce((acc, s) => acc + s.exercises.length, 0)}
                      </span>
                      <span className="stat-label">Exercises</span>
                    </div>
                  </div>

                  <div className="program-actions">
                    <button 
                      onClick={() => viewProgramDetails(program.id)}
                      className="btn-view"
                    >
                      View Details
                    </button>
                  </div>

                  <p className="program-date">
                    Created {new Date(program.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}

              {/* Subscription Card */}
              <div className="program-card subscription-card">
                <div className="lock-icon">🔒</div>
                <h3>Premium Access</h3>
                <p className="subscription-description">
                  Subscribe to unlock all trainer programs and exclusive features
                </p>
                
                <div className="subscription-benefits">
                  <div className="benefit">✓ Unlimited trainer programs</div>
                  <div className="benefit">✓ Exclusive workout content</div>
                  <div className="benefit">✓ Progress tracking</div>
                  <div className="benefit">✓ Personalized recommendations</div>
                </div>

                <div className="subscription-pricing">
                  <span className="price">$9.99</span>
                  <span className="period">/month</span>
                </div>

                <button className="btn-subscribe">
                  Subscribe Now
                </button>

                <p className="subscription-note">
                  Cancel anytime. No commitments.
                </p>
              </div>

              {/* Locked Programs (if there are more than 2) */}
              {otherPrograms.length > 2 && (
                <div className="program-card locked-card">
                  <div className="lock-overlay">
                    <div className="lock-icon-large">🔒</div>
                    <p>Subscribe to unlock</p>
                  </div>
                  <h3 className="program-title blurred">Advanced Training Program</h3>
                  <div className="program-meta blurred">
                    <div className="meta-item">
                      <span className="meta-label">More programs available</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}