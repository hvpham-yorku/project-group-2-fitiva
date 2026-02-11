'use client';

import { useState, useEffect } from 'react';
import { profileAPI, ApiError } from '@/library/api';
import './EditProfileModal.css';

type ProfileForm = {
  age: string;
  experience_level: string;
  training_location: string;
  fitness_focus: string[];
};

type ProfileData = {
  age?: number | null;
  experience_level?: string;
  training_location?: string;
  fitness_focus?: string[];
};

type EditProfileModalProps = {
  currentProfile: ProfileData | null;
  isFirstTime: boolean;
  onClose: () => void;
  onSave: (profile: ProfileData) => void;
};

const FOCUS_OPTIONS = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'balance', label: 'Balance' },
];

export default function EditProfileModal({ 
  currentProfile, 
  isFirstTime, 
  onClose, 
  onSave 
}: EditProfileModalProps) {
  const [form, setForm] = useState<ProfileForm>({
    age: '',
    experience_level: 'beginner',
    training_location: 'home',
    fitness_focus: [],
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentProfile) {
      setForm({
        age: currentProfile.age !== undefined && currentProfile.age !== null ? String(currentProfile.age) : '',
        experience_level: currentProfile.experience_level || 'beginner',
        training_location: currentProfile.training_location || 'home',
        fitness_focus: currentProfile.fitness_focus || [],
      });
    }
  }, [currentProfile]);

  const setField = (name: keyof ProfileForm, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ✅ NEW: Handler for checkbox changes
  const handleFocusChange = (focusValue: string) => {
    setForm(prev => {
      const currentFocuses = prev.fitness_focus;
      if (currentFocuses.includes(focusValue)) {
        // Remove if already selected
        return {
          ...prev,
          fitness_focus: currentFocuses.filter(f => f !== focusValue)
        };
      } else {
        // Add if not selected
        return {
          ...prev,
          fitness_focus: [...currentFocuses, focusValue]
        };
      }
    });
    setErrors(prev => ({ ...prev, fitness_focus: '' }));
  };

  const validateClientSide = () => {
    const newErrors: Record<string, string> = {};

    if (!form.age) newErrors.age = 'Age is required';
    if (!form.experience_level) newErrors.experience_level = 'Experience level is required';
    if (!form.training_location) newErrors.training_location = 'Training location is required';
    if (!form.fitness_focus || form.fitness_focus.length === 0) {
      newErrors.fitness_focus = 'Please select at least one fitness focus';
    }

    const ageNum = Number(form.age);
    if (form.age && (Number.isNaN(ageNum) || !Number.isFinite(ageNum))) {
      newErrors.age = 'Age must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateClientSide()) return;

    setSaving(true);
    setErrors({});

    try {
      const updatedProfile = await profileAPI.updateProfile({
        age: Number(form.age),
        experience_level: form.experience_level,
        training_location: form.training_location,
        fitness_focus: form.fitness_focus,
      });

      onSave(updatedProfile);
    } catch (e) {
      if (e instanceof ApiError && e.errors) {
        setErrors(e.errors);
      } else if (e instanceof ApiError) {
        setErrors({ detail: e.message });
      } else {
        setErrors({ detail: 'Something went wrong' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !isFirstTime && onClose()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isFirstTime ? 'Complete Your Profile' : 'Edit Profile'}
          </h2>
          {!isFirstTime && (
            <button className="modal-close" onClick={onClose}>×</button>
          )}
        </div>

        <form onSubmit={handleSave} className="modal-form">
          {errors.detail && <div className="modal-alert error">{errors.detail}</div>}

          <div className="modal-field">
            <label className="modal-label" htmlFor="age">
              Age<span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="age"
              className="modal-input"
              value={form.age}
              onChange={e => setField('age', e.target.value)}
              placeholder="Enter your age"
              inputMode="numeric"
              required
            />
            {errors.age && <div className="modal-error">{errors.age}</div>}
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="experience_level">Experience level</label>
            <select
              id="experience_level"
              className="modal-select"
              value={form.experience_level}
              onChange={e => setField('experience_level', e.target.value)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            {errors.experience_level && <div className="modal-error">{errors.experience_level}</div>}
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="training_location">Training location</label>
            <select
              id="training_location"
              className="modal-select"
              value={form.training_location}
              onChange={e => setField('training_location', e.target.value)}
            >
              <option value="home">Home</option>
              <option value="gym">Gym</option>
            </select>
            {errors.training_location && <div className="modal-error">{errors.training_location}</div>}
          </div>

          {/* ✅ CHANGED: Dropdown replaced with checkboxes */}
          <div className="modal-field">
            <label className="modal-label">
              Fitness Focus<span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div className="checkbox-group">
              {FOCUS_OPTIONS.map(opt => (
                <label key={opt.value} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.fitness_focus.includes(opt.value)}
                    onChange={() => handleFocusChange(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {errors.fitness_focus && <div className="modal-error">{errors.fitness_focus}</div>}
          </div>

          <button className="modal-button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : isFirstTime ? 'Create Profile' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
