'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { programAPI } from '@/library/api';
import './edit-program.css';

// Helper function to get CSRF token
function getCsrfToken(): string {
  const name = 'csrftoken';
  let cookieValue = '';
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

interface ExerciseSet {
  set_number: number;
  reps: number | null;
  time: number | null;
  rest: number;
}

interface Exercise {
  template_id?: number;
  name: string;
  sets: ExerciseSet[];
}

interface DaySection {
  format: string;
  type: string;
  is_rest_day: boolean;
  exercises: Exercise[];
}

interface ExerciseTemplate {
  id: number;
  name: string;
  description: string;
  muscle_groups: string[];
  exercise_type: 'reps' | 'time';
  default_recommendations: string;
  is_default: boolean;
}

interface SetConfig {
  reps: string;
  time: string;
  rest: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EditProgramPage = () => {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const programId = params.id as string;

  // Program details
  const [programName, setProgramName] = useState('');
  const [description, setDescription] = useState('');
  const [focuses, setFocuses] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState('beginner');
  const [sessionLength, setSessionLength] = useState(45);

  // Initialize 7 days
  const [daySections, setDaySections] = useState<DaySection[]>(
    DAYS_OF_WEEK.map((day) => ({
      format: day,
      type: '',
      is_rest_day: false,
      exercises: [],
    }))
  );

  // Exercise Library Modal
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState<number | null>(null);
  const [exerciseTemplates, setExerciseTemplates] = useState<ExerciseTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Sets Configuration Modal
  const [showSetsConfig, setShowSetsConfig] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExerciseTemplate | null>(null);
  const [numberOfSets, setNumberOfSets] = useState('3');
  const [setsConfig, setSetsConfig] = useState<SetConfig[]>([]);

  // Rest Day Confirmation
  const [showRestDayConfirm, setShowRestDayConfirm] = useState(false);
  const [pendingRestDayIndex, setPendingRestDayIndex] = useState<number | null>(null);

  // Delete Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [draggedExercise, setDraggedExercise] = useState<{
    dayIndex: number;
    exerciseIndex: number;
  } | null>(null);

  // Form state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const focusOptions = [
    { value: 'strength', label: 'Strength', icon: '💪' },
    { value: 'cardio', label: 'Cardio', icon: '❤️' },
    { value: 'flexibility', label: 'Flexibility', icon: '🧘' },
    { value: 'balance', label: 'Balance', icon: '⚖️' },
  ];

  // Load program data on mount
  useEffect(() => {
    const loadProgram = async () => {
      try {
        setLoading(true);
        const program = await programAPI.getProgram(parseInt(programId));
        
        // Check if current user is the owner
        if (program.trainer !== user?.id) {
          router.push('/trainer-programs');
          return;
        }

        // Set basic details
        setProgramName(program.name);
        setDescription(program.description);
        setFocuses(program.focus);
        setDifficulty(program.difficulty);
        setSessionLength(program.session_length);

        // Map sections to day sections
        const loadedDaySections = DAYS_OF_WEEK.map((day) => {
          const section = program.sections.find((s) => s.format === day);
          if (section) {
            return {
              format: day,
              type: section.type,
              is_rest_day: section.is_rest_day,
              exercises: section.exercises.map((ex) => ({
                name: ex.name,
                sets: ex.sets.map((set) => ({
                  set_number: set.set_number,
                  reps: set.reps,
                  time: set.time,
                  rest: set.rest,
                })),
              })),
            };
          }
          return {
            format: day,
            type: '',
            is_rest_day: false,
            exercises: [],
          };
        });

        setDaySections(loadedDaySections);
      } catch (error) {
        console.error('Error loading program:', error);
        alert('Failed to load program');
        router.push('/trainer-programs');
      } finally {
        setLoading(false);
      }
    };

    if (programId && user) {
      loadProgram();
    }
  }, [programId, user, router]);

  const handleFocusToggle = (focus: string) => {
    setFocuses((prev) =>
      prev.includes(focus)
        ? prev.filter((f) => f !== focus)
        : [...prev, focus]
    );
    setErrors((prev) => ({ ...prev, focuses: '' }));
  };

  // Calculate workout summary
  const getWorkoutSummary = () => {
    const workoutDays = daySections.filter((day) => day.exercises.length > 0).length;
    const restDays = 7 - workoutDays;
    return { workoutDays, restDays };
  };

  // Update day description
  const updateDayDescription = (index: number, description: string) => {
    if (description.length > 30) return;
    const updated = [...daySections];
    updated[index].type = description;
    setDaySections(updated);
  };

  // Toggle rest day
  const toggleRestDay = (index: number) => {
    const day = daySections[index];
    
    if (!day.is_rest_day && day.exercises.length > 0) {
      setPendingRestDayIndex(index);
      setShowRestDayConfirm(true);
      return;
    }

    const updated = [...daySections];
    updated[index].is_rest_day = !updated[index].is_rest_day;
    setDaySections(updated);
  };

  const confirmRestDay = () => {
    if (pendingRestDayIndex === null) return;
    
    const updated = [...daySections];
    updated[pendingRestDayIndex].is_rest_day = true;
    updated[pendingRestDayIndex].exercises = [];
    setDaySections(updated);
    
    setShowRestDayConfirm(false);
    setPendingRestDayIndex(null);
  };

  const cancelRestDay = () => {
    setShowRestDayConfirm(false);
    setPendingRestDayIndex(null);
  };

  // Open Exercise Library
  const openExerciseLibrary = async (dayIndex: number) => {
    setCurrentDayIndex(dayIndex);
    setShowExerciseLibrary(true);
    setLoadingTemplates(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/exercise-templates/`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setExerciseTemplates(data.exercises || []);
      }
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const searchExercises = async () => {
    setLoadingTemplates(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/exercise-templates/?search=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(url, { credentials: 'include' });

      if (response.ok) {
        const data = await response.json();
        setExerciseTemplates(data.exercises || []);
      }
    } catch (error) {
      console.error('Error searching exercises:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Select exercise from library
  const selectExercise = (template: ExerciseTemplate) => {
    setSelectedTemplate(template);
    setNumberOfSets('3');
    const defaultSets: SetConfig[] = Array(3).fill(null).map((_, i) => ({
      reps: template.exercise_type === 'reps' ? '10' : '',
      time: template.exercise_type === 'time' ? '30' : '',
      rest: '60',
    }));
    setSetsConfig(defaultSets);
    setShowSetsConfig(true);
  };

  // Update number of sets
  const updateNumberOfSets = (num: number) => {
    setNumberOfSets(num.toString());
    const newConfig: SetConfig[] = Array(num).fill(null).map((_, i) => {
      if (i < setsConfig.length) {
        return setsConfig[i];
      }
      return {
        reps: selectedTemplate?.exercise_type === 'reps' ? '10' : '',
        time: selectedTemplate?.exercise_type === 'time' ? '30' : '',
        rest: '60',
      };
    });
    setSetsConfig(newConfig);
  };

  // Update individual set config
  const updateSetConfig = (setIndex: number, field: keyof SetConfig, value: string) => {
    const updated = [...setsConfig];
    updated[setIndex] = { ...updated[setIndex], [field]: value };
    setSetsConfig(updated);
  };

  // Complete exercise configuration
  const completeExerciseConfig = () => {
    if (!selectedTemplate || currentDayIndex === null) return;

    const isValid = setsConfig.every((set) => {
      if (selectedTemplate.exercise_type === 'reps') {
        return set.reps && parseInt(set.reps) > 0;
      } else {
        return set.time && parseInt(set.time) > 0;
      }
    });

    if (!isValid) {
      alert('Please fill in all set configurations');
      return;
    }

    const newExercise: Exercise = {
      template_id: selectedTemplate.id,
      name: selectedTemplate.name,
      sets: setsConfig.map((set, index) => ({
        set_number: index + 1,
        reps: selectedTemplate.exercise_type === 'reps' ? parseInt(set.reps) : null,
        time: selectedTemplate.exercise_type === 'time' ? parseInt(set.time) : null,
        rest: parseInt(set.rest) || 0,
      })),
    };

    const updated = [...daySections];
    updated[currentDayIndex].exercises.push(newExercise);
    updated[currentDayIndex].is_rest_day = false;
    setDaySections(updated);

    setShowSetsConfig(false);
    setShowExerciseLibrary(false);
    setSelectedTemplate(null);
    setCurrentDayIndex(null);
  };

  // Remove exercise from day
  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const updated = [...daySections];
    updated[dayIndex].exercises = updated[dayIndex].exercises.filter((_, i) => i !== exerciseIndex);
    setDaySections(updated);
  };

  // Drag and drop handlers
  const handleDragStart = (dayIndex: number, exerciseIndex: number) => {
    setDraggedExercise({ dayIndex, exerciseIndex });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (dayIndex: number, targetExerciseIndex: number) => {
    if (!draggedExercise || draggedExercise.dayIndex !== dayIndex) {
      setDraggedExercise(null);
      return;
    }

    const updated = [...daySections];
    const exercises = [...updated[dayIndex].exercises];
    
    const [movedExercise] = exercises.splice(draggedExercise.exerciseIndex, 1);
    exercises.splice(targetExerciseIndex, 0, movedExercise);
    
    updated[dayIndex].exercises = exercises;
    setDaySections(updated);
    setDraggedExercise(null);
  };

  const handleDragEnd = () => {
    setDraggedExercise(null);
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (focuses.length === 0) {
      newErrors.focuses = 'Select at least one focus';
    }

    const hasAtLeastOneWorkout = daySections.some((day) => day.exercises.length > 0);
    if (!hasAtLeastOneWorkout) {
      newErrors.sections = 'Add at least one workout day with exercises';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit program update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    const { workoutDays } = getWorkoutSummary();

    const programData = {
      name: programName,
      description,
      focus: focuses,
      difficulty,
      weekly_frequency: workoutDays,
      session_length: sessionLength,
      sections: daySections.map((section, index) => ({
        format: section.format,
        type: section.type,
        is_rest_day: section.exercises.length === 0 || section.is_rest_day,
        order: index,
        exercises: section.exercises.map((exercise, exIndex) => ({
          name: exercise.name,
          order: exIndex,
          sets: exercise.sets,
        })),
      })),
    };

    try {
      await programAPI.updateProgram(parseInt(programId), programData);
      router.push('/trainer-programs');
    } catch (error) {
      console.error('Error updating program:', error);
      alert('Failed to update program');
    } finally {
      setSaving(false);
    }
  };

  // Delete program
const handleDelete = async () => {
  try {
    setDeleting(true);
    await programAPI.deleteProgram(Number(params.id));
    router.push('/trainer-programs');
  } catch (error) {
    console.error('Error deleting program:', error);
    alert('Failed to delete program');
  } finally {
    setDeleting(false);
    setShowDeleteConfirm(false);
  }
};


  if (!user?.is_trainer) {
    return null;
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="create-program-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading program...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const { workoutDays, restDays } = getWorkoutSummary();

  return (
    <ProtectedRoute>
      <div className="create-program-container">
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="modal-content-small" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Delete Program?</h3>
                <button onClick={() => setShowDeleteConfirm(false)} className="modal-close">×</button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete <strong>{programName}</strong>?</p>
                <p className="modal-warning">This action cannot be undone. The program will be marked as deleted and stats will be preserved.</p>
              </div>
              <div className="modal-actions">
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-modal-cancel">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting} className="btn-modal-delete">
                  {deleting ? 'Deleting...' : 'Delete Program'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rest Day Confirmation Modal - SAME AS CREATE PROGRAM */}
        {showRestDayConfirm && (
          <div className="modal-overlay" onClick={cancelRestDay}>
            <div className="modal-content-small" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Mark as Rest Day?</h3>
                <button onClick={cancelRestDay} className="modal-close">×</button>
              </div>
              <div className="modal-body">
                <p>This day has {daySections[pendingRestDayIndex!]?.exercises.length} exercise(s).</p>
                <p className="modal-warning">Marking as rest day will remove all exercises.</p>
              </div>
              <div className="modal-actions">
                <button onClick={cancelRestDay} className="btn-modal-cancel">
                  Cancel
                </button>
                <button onClick={confirmRestDay} className="btn-modal-delete">
                  Mark as Rest Day
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exercise Library Modal - SAME AS CREATE PROGRAM */}
        {showExerciseLibrary && (
          <div className="modal-overlay" onClick={() => setShowExerciseLibrary(false)}>
            <div className="modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Select Exercise</h3>
                <button onClick={() => setShowExerciseLibrary(false)} className="modal-close">
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="exercise-search">
                  <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchExercises()}
                    className="search-input"
                  />
                  <button onClick={searchExercises} className="btn-search-modal">
                    🔍 Search
                  </button>
                </div>

                {loadingTemplates ? (
                  <div className="loading-container">
                    <div className="loading-spinner"></div>
                  </div>
                ) : (
                  <div className="exercise-list-modal">
                    {exerciseTemplates.length === 0 ? (
                      <div className="empty-state-modal">
                        <p>No exercises found</p>
                      </div>
                    ) : (
                      exerciseTemplates.map((template) => (
                        <div key={template.id} className="exercise-item-modal">
                          <div className="exercise-item-info">
                            <h4>{template.name}</h4>
                            <p>{template.description}</p>
                            <div className="exercise-item-meta">
                              <span className={`type-badge-small ${template.exercise_type}`}>
                                {template.exercise_type === 'reps' ? '🔢 Reps' : '⏱️ Time'}
                              </span>
                              <div className="muscle-tags-small">
                                {template.muscle_groups.slice(0, 2).map((group) => (
                                  <span key={group} className="muscle-tag-tiny">
                                    {group}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => selectExercise(template)}
                            className="btn-add-exercise"
                          >
                            + Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sets Configuration Modal - SAME AS CREATE PROGRAM */}
        {showSetsConfig && selectedTemplate && (
          <div className="modal-overlay">
            <div className="modal-medium" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Configure Sets - {selectedTemplate.name}</h3>
                <button
                  onClick={() => {
                    setShowSetsConfig(false);
                    setSelectedTemplate(null);
                  }}
                  className="modal-close"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Number of Sets</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={numberOfSets}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value > 10) {
                        updateNumberOfSets(10);
                      } else if (value < 1 || isNaN(value)) {
                        updateNumberOfSets(1);
                      } else {
                        updateNumberOfSets(value);
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 1) {
                        updateNumberOfSets(1);
                      } else if (value > 10) {
                        updateNumberOfSets(10);
                      }
                    }}
                    className="form-input"
                  />
                </div>

                <div className="sets-config-container">
                  {setsConfig.map((set, index) => (
                    <div key={index} className="set-config-row">
                      <span className="set-label">Set {index + 1}</span>
                      
                      {selectedTemplate.exercise_type === 'reps' ? (
                        <div className="set-input-group">
                          <label>Reps</label>
                          <input
                            type="text"
                            value={set.reps}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^\d+$/.test(value)) {
                                updateSetConfig(index, 'reps', value);
                              }
                            }}
                            className="set-input"
                            placeholder="e.g., 10"
                          />
                        </div>
                      ) : (
                        <div className="set-input-group">
                          <label>Time (sec)</label>
                          <input
                            type="text"
                            value={set.time}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^\d+$/.test(value)) {
                                updateSetConfig(index, 'time', value);
                              }
                            }}
                            className="set-input"
                            placeholder="e.g., 30"
                          />
                        </div>
                      )}

                      <div className="set-input-group">
                        <label>Rest (sec)</label>
                        <input
                          type="text"
                          value={set.rest}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d+$/.test(value)) {
                              updateSetConfig(index, 'rest', value);
                            }
                          }}
                          className="set-input"
                          placeholder="e.g., 60"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => {
                    setShowSetsConfig(false);
                    setSelectedTemplate(null);
                  }}
                  className="btn-modal-cancel"
                >
                  Cancel
                </button>
                <button onClick={completeExerciseConfig} className="btn-modal-confirm">
                  Add to Program
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header - DIFFERENT FROM CREATE */}
        <div className="header">
          <button className="back-button" onClick={() => router.push('/trainer-programs')}>
            ← Back
          </button>
          <div className="header-title-row">
            <h1>Edit Program: {programName}</h1>
            <button 
              onClick={() => setShowDeleteConfirm(true)} 
              className="btn-delete-program"
              type="button"
            >
              🗑️ Delete Program
            </button>
          </div>
          <p className="header-note">Note: Program name cannot be changed</p>
        </div>

        <div className="content">
          <form onSubmit={handleSubmit} className="create-form">
            {/* Program Details - NAME IS DISABLED */}
            <div className="form-section">
              <h2>Program Details</h2>

              <div className="form-group">
                <label>Program Name (Cannot be changed)</label>
                <input
                  type="text"
                  value={programName}
                  disabled
                  className="form-input input-disabled"
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your program..."
                  rows={4}
                  className={`form-textarea ${errors.description ? 'input-error' : ''}`}
                />
                {errors.description && <span className="error-text">{errors.description}</span>}
              </div>

              <div className="form-group">
                <label>Focus Areas *</label>
                <div className="focus-options">
                  {focusOptions.map((option) => (
                    <label key={option.value} className="focus-checkbox">
                      <input
                        type="checkbox"
                        checked={focuses.includes(option.value)}
                        onChange={() => handleFocusToggle(option.value)}
                      />
                      <span>
                        {option.icon} {option.label}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.focuses && <span className="error-text">{errors.focuses}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="form-select"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Session Length (min)</label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    value={sessionLength}
                    onChange={(e) => setSessionLength(parseInt(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* Weekly Schedule - SAME AS CREATE */}
            <div className="form-section">
              <div className="section-header">
                <h2>Weekly Schedule</h2>
                <div className="workout-summary">
                  <span className="summary-badge workout-badge">
                    🏋️ {workoutDays} Workout {workoutDays !== 1 ? 'Days' : 'Day'}
                  </span>
                  <span className="summary-badge rest-badge">
                    💤 {restDays} Rest {restDays !== 1 ? 'Days' : 'Day'}
                  </span>
                </div>
              </div>

              {errors.sections && <span className="error-text">{errors.sections}</span>}

              <div className="weekly-grid">
                {daySections.map((section, dayIndex) => {
                  const isRestDay = section.is_rest_day || section.exercises.length === 0;

                  return (
                    <div key={dayIndex} className={`day-card ${isRestDay ? 'rest-day' : 'workout-day'}`}>
                      <div className="day-card-header">
                        <div className="day-title-section">
                          <h3 className="day-name">{section.format}</h3>
                          <input
                            type="text"
                            value={section.type}
                            onChange={(e) => updateDayDescription(dayIndex, e.target.value)}
                            placeholder="e.g., Upper Body, Chest Day"
                            className="day-description-input"
                            maxLength={30}
                          />
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => toggleRestDay(dayIndex)}
                          className={`btn-rest-toggle ${section.is_rest_day ? 'active' : ''}`}
                          title={section.is_rest_day ? 'Mark as Workout Day' : 'Mark as Rest Day'}
                        >
                          {section.is_rest_day ? '💤 Rest' : '🏋️'}
                        </button>
                      </div>

                      <div className="day-card-body">
                        {section.is_rest_day ? (
                          <div className="rest-day-indicator">
                            <span className="rest-icon">💤</span>
                            <p>Rest Day</p>
                          </div>
                        ) : (
                          <>
                            {section.exercises.length === 0 ? (
                              <p className="no-exercises-hint">No exercises added yet</p>
                            ) : (
                              <div className="day-exercises-list">
                                {section.exercises.map((exercise, exIndex) => (
                                  <div
                                    key={exIndex}
                                    draggable
                                    onDragStart={() => handleDragStart(dayIndex, exIndex)}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(dayIndex, exIndex)}
                                    onDragEnd={handleDragEnd}
                                    className={`exercise-item-compact ${
                                      draggedExercise?.dayIndex === dayIndex &&
                                      draggedExercise?.exerciseIndex === exIndex
                                        ? 'dragging'
                                        : ''
                                    }`}
                                  >
                                    <div className="exercise-compact-header">
                                      <span className="drag-handle">⋮⋮</span>
                                      <span className="exercise-number">{exIndex + 1}</span>
                                      <h4>{exercise.name}</h4>
                                      <button
                                        type="button"
                                        onClick={() => removeExercise(dayIndex, exIndex)}
                                        className="btn-remove-exercise-small"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <div className="exercise-sets-compact">
                                      {exercise.sets.map((set, setIndex) => (
                                        <span key={setIndex} className="set-chip">
                                          {set.set_number}: {set.reps ? `${set.reps} reps` : `${set.time}s`} | Rest: {set.rest || 0}s
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => openExerciseLibrary(dayIndex)}
                              className="btn-add-exercise-card"
                            >
                              + Add Exercise
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit - DIFFERENT TEXT */}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => router.push('/trainer-programs')}
                className="btn-cancel-form"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-submit">
                {saving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default EditProgramPage;
