'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './create-program.css';

interface Exercise {
  name: string;
  sets: Array<{
    reps?: number;
    time?: number;
    rest: number;
  }>;
}

interface Section {
  id: string;
  format: string;
  type: string;
  exercises: Exercise[];
}

// Helper function to get CSRF token from cookies
function getCookie(name: string): string | null {
  let cookieValue = null;
  if (typeof document !== 'undefined' && document.cookie && document.cookie !== '') {
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

export default function CreateProgramPage() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<'main' | 'add-section' | 'add-exercise' | 'exercise-details'>('main');
  const [programName, setProgramName] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // For adding section
  const [newSection, setNewSection] = useState({
    format: '',
    type: ''
  });
  
  // For adding exercise
  const [currentSectionId, setCurrentSectionId] = useState('');
  const [currentExercise, setCurrentExercise] = useState<Exercise>({
    name: '',
    sets: [{ reps: 0, time: 0, rest: 0 }]
  });

  const handleAddSection = () => {
    setCurrentView('add-section');
    setNewSection({ format: '', type: '' });
  };

  const handleSectionSubmit = () => {
    if (newSection.format && newSection.type) {
      const section: Section = {
        id: Date.now().toString(),
        format: newSection.format,
        type: newSection.type,
        exercises: []
      };
      setSections([...sections, section]);
      setCurrentView('main');
    }
  };

  const handleAddExerciseToSection = (sectionId: string) => {
    setCurrentSectionId(sectionId);
    setCurrentView('add-exercise');
  };

  const handleExerciseSelect = () => {
    setCurrentView('exercise-details');
  };

  const handleAddSet = () => {
    setCurrentExercise({
      ...currentExercise,
      sets: [...currentExercise.sets, { reps: 0, time: 0, rest: 0 }]
    });
  };

  const handleSetChange = (index: number, field: 'reps' | 'time' | 'rest', value: number) => {
    const newSets = [...currentExercise.sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setCurrentExercise({ ...currentExercise, sets: newSets });
  };

  const handleSaveExercise = () => {
    const updatedSections = sections.map(section => {
      if (section.id === currentSectionId) {
        return {
          ...section,
          exercises: [...section.exercises, currentExercise]
        };
      }
      return section;
    });
    setSections(updatedSections);
    setCurrentView('main');
    setCurrentExercise({ name: '', sets: [{ reps: 0, time: 0, rest: 0 }] });
  };

  // Check if the form is valid for saving
  const canSaveProgram = (): boolean => {
    // Must have a program name
    if (!programName.trim()) return false;
    
    // Must have at least one section
    if (sections.length === 0) return false;
    
    // Each section must have at least one exercise
    const allSectionsHaveExercises = sections.every(section => section.exercises.length > 0);
    if (!allSectionsHaveExercises) return false;
    
    return true;
  };

  const handleFinalSave = async () => {
    if (!canSaveProgram()) {
      alert('Please ensure:\n- Program has a name\n- At least one section exists\n- Each section has at least one exercise');
      return;
    }

    setIsSaving(true);

    // Transform sections data to match backend format
    const formattedSections = sections.map((section) => ({
      format: section.format,
      type: section.type,
      exercises: section.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets.map((set, index) => ({
          set_number: index + 1,
          reps: set.reps || null,
          time: set.time || null,
          rest: set.rest || 0,
        })),
      })),
    }));

    const payload = {
      name: programName,
      sections: formattedSections,
    };

    console.log('Sending payload:', JSON.stringify(payload, null, 2));

    try {
      const csrfToken = getCookie('csrftoken');

      const response = await fetch('http://localhost:8000/api/programs/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Response:', data);

      if (response.ok) {
        alert('Program created successfully!');
        // Redirect to trainer programs page
        router.push('/trainer-programs');
      } else {
        console.error('Error response:', data);
        alert(`Failed to create program: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error creating program: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // Main View
  if (currentView === 'main') {
    return (
      <div className="create-program-container">
        <div className="header">
          <button onClick={() => router.push('/dashboard')} className="back-button">
            ← Back
          </button>
          <h1>Create Workout Program</h1>
        </div>

        <div className="content">
          <div className="form-group">
            <label>Program Name</label>
            <input
              type="text"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="Enter program name"
              className="input-field"
            />
          </div>

          <div className="sections-container">
            <h2>Sections</h2>
            {sections.map((section) => (
              <div key={section.id} className="section-card">
                <div className="section-header">
                  <div>
                    <strong>{section.format}</strong> - {section.type}
                  </div>
                  <button 
                    onClick={() => handleAddExerciseToSection(section.id)}
                    className="btn-small"
                  >
                    + Add Exercise
                  </button>
                </div>
                <div className="exercises-list">
                  {section.exercises.length === 0 ? (
                    <div className="exercise-item empty">No exercises added yet</div>
                  ) : (
                    section.exercises.map((ex, idx) => (
                      <div key={idx} className="exercise-item">
                        {ex.name} - {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleAddSection} className="btn-add-section">
            + Add Section
          </button>

          <button 
            onClick={handleFinalSave} 
            className="btn-save"
            disabled={!canSaveProgram() || isSaving}
            style={{
              opacity: canSaveProgram() && !isSaving ? 1 : 0.5,
              cursor: canSaveProgram() && !isSaving ? 'pointer' : 'not-allowed',
            }}
          >
            {isSaving ? 'Saving...' : 'Save Program'}
          </button>

          {/* Validation hints */}
          {!canSaveProgram() && sections.length > 0 && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '5px',
              fontSize: '14px',
              color: '#856404'
            }}>
              ⚠️ To save: {!programName.trim() && 'Add a program name. '}
              {sections.some(s => s.exercises.length === 0) && 'All sections need at least one exercise.'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Add Section View
  if (currentView === 'add-section') {
    return (
      <div className="create-program-container">
        <div className="header">
          <button onClick={() => setCurrentView('main')} className="back-button">
            ← Back
          </button>
          <h1>Add Section</h1>
        </div>

        <div className="content">
          <div className="form-group">
            <label>Section Format</label>
            <div className="options-grid">
              {['Straight Sets', 'Superset', 'Triset', 'Giant Set', 'Circuit'].map((format) => (
                <button
                  key={format}
                  onClick={() => setNewSection({ ...newSection, format })}
                  className={`option-btn ${newSection.format === format ? 'active' : ''}`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Section Type</label>
            <div className="options-grid">
              {['Warm Up', 'Working Sets', 'Drop Sets', 'Cool Down'].map((type) => (
                <button
                  key={type}
                  onClick={() => setNewSection({ ...newSection, type })}
                  className={`option-btn ${newSection.type === type ? 'active' : ''}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleSectionSubmit}
            disabled={!newSection.format || !newSection.type}
            className="btn-primary"
          >
            Add Section
          </button>
        </div>
      </div>
    );
  }

  // Add Exercise View
  if (currentView === 'add-exercise') {
    return (
      <div className="create-program-container">
        <div className="header">
          <button onClick={() => setCurrentView('main')} className="back-button">
            ← Back
          </button>
          <h1>Add Exercise</h1>
        </div>

        <div className="content">
          <p className="placeholder-text">Exercise selection will be implemented in User Story 1.5</p>
          <button onClick={handleExerciseSelect} className="btn-primary">
            Continue to Exercise Details
          </button>
        </div>
      </div>
    );
  }

  // Exercise Details View
  if (currentView === 'exercise-details') {
    return (
      <div className="create-program-container">
        <div className="header">
          <button onClick={() => setCurrentView('add-exercise')} className="back-button">
            ← Back
          </button>
          <h1>Exercise Details</h1>
        </div>

        <div className="content">
          <div className="form-group">
            <label>Exercise Name</label>
            <input
              type="text"
              value={currentExercise.name}
              onChange={(e) => setCurrentExercise({ ...currentExercise, name: e.target.value })}
              placeholder="Enter exercise name"
              className="input-field"
            />
          </div>

          <div className="sets-container">
            <h3>Sets</h3>
            <table className="sets-table">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Reps</th>
                  <th>Time (sec)</th>
                  <th>Rest (sec)</th>
                </tr>
              </thead>
              <tbody>
                {currentExercise.sets.map((set, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        type="number"
                        value={set.reps}
                        onChange={(e) => handleSetChange(index, 'reps', parseInt(e.target.value) || 0)}
                        className="input-small"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={set.time}
                        onChange={(e) => handleSetChange(index, 'time', parseInt(e.target.value) || 0)}
                        className="input-small"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={set.rest}
                        onChange={(e) => handleSetChange(index, 'rest', parseInt(e.target.value) || 0)}
                        className="input-small"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={handleAddSet} className="btn-add-set">
              + Add Set
            </button>
          </div>

          <button 
            onClick={handleSaveExercise} 
            className="btn-save"
            disabled={!currentExercise.name.trim()}
          >
            Save Exercise
          </button>
        </div>
      </div>
    );
  }

  return null;
}
