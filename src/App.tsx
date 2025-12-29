// ============================================
// JEFIT - Smart Fitness & Nutrition Tracker
// Dynamic TDEE + Goal-based System
// ============================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';

// ============================================
// LOCAL STORAGE HOOK
// ============================================

function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: { deserialize?: (data: T) => T }
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        return options?.deserialize ? options.deserialize(parsed) : parsed;
      }
      return initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback((value) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch (e) {
        console.warn('localStorage error:', e);
      }
      return newValue;
    });
  }, [key]);

  return [storedValue, setValue];
}

// Helper per ottenere la chiave water del giorno
const getWaterKey = () => `jefit_water_${new Date().toISOString().split('T')[0]}`;

// ============================================
// DESIGN TOKENS
// ============================================

const tokens = {
  colors: {
    primary: '#00D4FF',
    primaryLight: '#66E5FF',
    primaryMid: '#00B8E6',
    primaryDark: '#0099CC',
    primaryDeep: '#007ACC',
    primaryForeground: '#000000',

    success: '#00D4FF',
    warning: '#FFB800',
    destructive: '#FF6B6B',

    background: '#000000',
    foreground: '#FFFFFF',
    card: '#0A0A0A',
    muted: '#171717',
    mutedForeground: '#737373',
    border: '#262626',

    ringCalories: '#00D4FF',
    ringProtein: '#00B8E6',
    ringActivity: '#0099CC',
  },
  fonts: {
    sans: 'Inter, -apple-system, sans-serif',
    mono: '"SF Mono", monospace',
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
};

// ============================================
// SMART FITNESS LOGIC
// ============================================

const GOALS = {
  cut: {
    name: 'Definizione',
    emoji: '🔻',
    deficit: -400,
    proteinMultiplier: 2.2,
    description: 'Perdita grasso mantenendo muscolo'
  },
  maintain: {
    name: 'Mantenimento',
    emoji: '⚖️',
    deficit: 0,
    proteinMultiplier: 1.8,
    description: 'Mantieni il tuo peso attuale'
  },
  bulk: {
    name: 'Massa',
    emoji: '🔺',
    deficit: 300,
    proteinMultiplier: 2.0,
    description: 'Aumento massa muscolare'
  },
  recomp: {
    name: 'Ricomposizione',
    emoji: '🔄',
    deficit: -200,
    proteinMultiplier: 2.4,
    description: 'Meno grasso, più muscolo'
  },
};

type GoalKey = keyof typeof GOALS;

const ACTIVITY_LEVELS = {
  sedentary: { name: 'Sedentario', multiplier: 1.2, description: 'Lavoro d\'ufficio, poco movimento' },
  light: { name: 'Leggero', multiplier: 1.375, description: '1-3 allenamenti/settimana' },
  moderate: { name: 'Moderato', multiplier: 1.55, description: '3-5 allenamenti/settimana' },
  active: { name: 'Attivo', multiplier: 1.725, description: '6-7 allenamenti/settimana' },
  veryActive: { name: 'Molto attivo', multiplier: 1.9, description: 'Atleta o lavoro fisico' },
};

type ActivityKey = keyof typeof ACTIVITY_LEVELS;

interface UserProfile {
  weight: number;
  height: number;
  age: number;
  gender: 'male' | 'female';
  activityLevel: ActivityKey;
  goal: GoalKey;
}

const calculateBMR = (user: UserProfile): number => {
  if (user.gender === 'male') {
    return Math.round(10 * user.weight + 6.25 * user.height - 5 * user.age + 5);
  }
  return Math.round(10 * user.weight + 6.25 * user.height - 5 * user.age - 161);
};

const calculateBaseTDEE = (user: UserProfile): number => {
  const bmr = calculateBMR(user);
  return Math.round(bmr * ACTIVITY_LEVELS[user.activityLevel].multiplier);
};

const calculateDailyTarget = (user: UserProfile, todayWorkoutKcal: number) => {
  const bmr = calculateBMR(user);
  const baseTDEE = calculateBaseTDEE(user);
  const goal = GOALS[user.goal];
  const extraWorkoutBonus = todayWorkoutKcal * 0.5;
  const dynamicTDEE = baseTDEE + extraWorkoutBonus;
  const targetKcal = Math.round(dynamicTDEE + goal.deficit);

  return {
    bmr,
    baseTDEE,
    extraWorkoutBonus: Math.round(extraWorkoutBonus),
    dynamicTDEE: Math.round(dynamicTDEE),
    targetKcal,
    protein: Math.round(user.weight * goal.proteinMultiplier),
    fat: Math.round(user.weight * 1),
    carbs: Math.round((targetKcal - (user.weight * goal.proteinMultiplier * 4) - (user.weight * 1 * 9)) / 4),
  };
};

const FOOD_DATABASE: Record<string, { kcal: number; protein: number; carbs: number; fat: number; portion: number }> = {
  'Yogurt greco': { kcal: 97, protein: 9, carbs: 3, fat: 5, portion: 150 },
  'Muesli': { kcal: 367, protein: 10, carbs: 66, fat: 6, portion: 50 },
  'Banana': { kcal: 89, protein: 1, carbs: 23, fat: 0, portion: 120 },
  'Uova': { kcal: 155, protein: 13, carbs: 1, fat: 11, portion: 100 },
  'Pane integrale': { kcal: 247, protein: 8, carbs: 46, fat: 3, portion: 60 },
  'Latte': { kcal: 42, protein: 3, carbs: 5, fat: 1, portion: 200 },
  'Avocado toast': { kcal: 190, protein: 4, carbs: 15, fat: 14, portion: 150 },
  'Riso integrale': { kcal: 111, protein: 3, carbs: 23, fat: 1, portion: 150 },
  'Pasta': { kcal: 131, protein: 5, carbs: 25, fat: 1, portion: 180 },
  'Pollo': { kcal: 165, protein: 31, carbs: 0, fat: 4, portion: 150 },
  'Salmone': { kcal: 208, protein: 20, carbs: 0, fat: 13, portion: 150 },
  'Tonno': { kcal: 132, protein: 29, carbs: 0, fat: 1, portion: 150 },
  'Manzo': { kcal: 250, protein: 26, carbs: 0, fat: 15, portion: 150 },
  'Verdure miste': { kcal: 25, protein: 2, carbs: 5, fat: 0, portion: 200 },
  'Insalata': { kcal: 15, protein: 1, carbs: 3, fat: 0, portion: 100 },
  'Patate': { kcal: 77, protein: 2, carbs: 17, fat: 0, portion: 200 },
  'Legumi': { kcal: 116, protein: 9, carbs: 20, fat: 0, portion: 150 },
  'Frutta secca': { kcal: 607, protein: 20, carbs: 21, fat: 54, portion: 30 },
  'Barretta proteica': { kcal: 200, protein: 20, carbs: 22, fat: 6, portion: 60 },
  'Mela': { kcal: 52, protein: 0, carbs: 14, fat: 0, portion: 180 },
  'Proteine whey': { kcal: 120, protein: 24, carbs: 3, fat: 1, portion: 30 },
};

const WORKOUT_DATABASE: Record<string, { kcalPerMin: number; icon: string; category: string }> = {
  'Corsa': { kcalPerMin: 12, icon: 'Activity', category: 'cardio' },
  'Corsa leggera': { kcalPerMin: 8, icon: 'Activity', category: 'cardio' },
  'Camminata': { kcalPerMin: 5, icon: 'Activity', category: 'cardio' },
  'Ciclismo': { kcalPerMin: 10, icon: 'Activity', category: 'cardio' },
  'Nuoto': { kcalPerMin: 11, icon: 'Activity', category: 'cardio' },
  'Pesi - Upper': { kcalPerMin: 7, icon: 'Dumbbell', category: 'strength' },
  'Pesi - Lower': { kcalPerMin: 8, icon: 'Dumbbell', category: 'strength' },
  'Pesi - Full Body': { kcalPerMin: 7, icon: 'Dumbbell', category: 'strength' },
  'HIIT': { kcalPerMin: 14, icon: 'Bolt', category: 'hiit' },
  'Yoga': { kcalPerMin: 3, icon: 'Heart', category: 'recovery' },
  'Cardio': { kcalPerMin: 9, icon: 'Heart', category: 'cardio' },
  'Crossfit': { kcalPerMin: 13, icon: 'Bolt', category: 'hiit' },
};

// ============================================
// UTILITIES
// ============================================

const calculateFoodNutrients = (foodName: string, portionMultiplier = 1): Food | null => {
  const food = FOOD_DATABASE[foodName];
  if (!food) return null;

  const factor = (food.portion / 100) * portionMultiplier;
  return {
    id: crypto.randomUUID(),
    name: foodName,
    kcal: Math.round(food.kcal * factor),
    protein: Math.round(food.protein * factor),
    carbs: Math.round(food.carbs * factor),
    fat: Math.round(food.fat * factor),
    portion: Math.round(food.portion * portionMultiplier),
  };
};

const calculateWorkoutKcal = (workoutType: string, durationMin: number): number => {
  const workout = WORKOUT_DATABASE[workoutType];
  if (!workout) return 0;
  return Math.round(workout.kcalPerMin * durationMin);
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

const generateId = (): string => Math.random().toString(36).substr(2, 9);

// ============================================
// TYPOGRAPHY
// ============================================

const H1: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style = {} }) => (
  <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', color: tokens.colors.foreground, margin: 0, ...style }}>{children}</h1>
);

const H2: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style = {} }) => (
  <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: tokens.colors.foreground, margin: 0, ...style }}>{children}</h2>
);

const H3: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style = {} }) => (
  <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.foreground, margin: 0, ...style }}>{children}</h3>
);

interface TextProps {
  children: React.ReactNode;
  muted?: boolean;
  small?: boolean;
  mono?: boolean;
  weight?: number;
  style?: React.CSSProperties;
}

const Text: React.FC<TextProps> = ({ children, muted = false, small = false, mono = false, weight = 400, style = {} }) => (
  <span style={{
    fontSize: small ? 13 : 14,
    fontFamily: mono ? tokens.fonts.mono : tokens.fonts.sans,
    fontWeight: weight,
    color: muted ? tokens.colors.mutedForeground : tokens.colors.foreground,
    ...style,
  }}>{children}</span>
);

const Large: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = 'primary', style = {} }) => (
  <span style={{
    fontSize: 48,
    fontWeight: 700,
    fontFamily: tokens.fonts.mono,
    letterSpacing: '-0.03em',
    color: (tokens.colors as Record<string, string>)[color] || color,
    ...style,
  }}>{children}</span>
);

// ============================================
// UI COMPONENTS
// ============================================

const Card: React.FC<{ children: React.ReactNode; bordered?: boolean; style?: React.CSSProperties; onClick?: () => void }> = ({ children, bordered = true, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: tokens.colors.card,
    borderRadius: tokens.radius.lg,
    border: bordered ? `1px solid rgba(255, 255, 255, 0.08)` : 'none',
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  }}>{children}</div>
);

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'default' | 'lg';
  icon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'default', size = 'default', icon, fullWidth, disabled, style = {}, onClick }) => {
  const variants: Record<string, React.CSSProperties> = {
    default: { background: tokens.colors.primary, color: tokens.colors.primaryForeground },
    secondary: { background: 'rgba(255, 255, 255, 0.06)', color: tokens.colors.foreground },
    ghost: { background: 'transparent', color: tokens.colors.foreground },
    outline: { background: 'transparent', color: tokens.colors.foreground, border: '1px solid rgba(255, 255, 255, 0.15)' },
    destructive: { background: tokens.colors.destructive, color: '#fff' },
  };
  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: '8px 14px', fontSize: 13 },
    default: { padding: '10px 18px', fontSize: 14 },
    lg: { padding: '14px 24px', fontSize: 15 },
  };

  return (
    <button onClick={onClick} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      fontFamily: tokens.fonts.sans,
      fontWeight: 500,
      borderRadius: tokens.radius.md,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      width: fullWidth ? '100%' : 'auto',
      ...variants[variant],
      ...sizes[size],
      ...style,
    }} disabled={disabled}>
      {icon}
      {children}
    </button>
  );
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
  style?: React.CSSProperties;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', style = {} }) => {
  const variants: Record<string, React.CSSProperties> = {
    default: { background: tokens.colors.primary, color: tokens.colors.primaryForeground },
    secondary: { background: 'rgba(255, 255, 255, 0.06)', color: tokens.colors.foreground },
    outline: { background: 'transparent', color: tokens.colors.foreground, border: '1px solid rgba(255, 255, 255, 0.15)' },
    success: { background: `${tokens.colors.success}20`, color: tokens.colors.success },
    warning: { background: `${tokens.colors.warning}20`, color: tokens.colors.warning },
    destructive: { background: `${tokens.colors.destructive}20`, color: tokens.colors.destructive },
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 12px',
      fontSize: 12,
      fontWeight: 500,
      borderRadius: tokens.radius.full,
      ...variants[variant],
      ...style,
    }}>{children}</span>
  );
};

const gradients: Record<string, string> = {
  calories: 'linear-gradient(90deg, #007ACC 0%, #00B8E6 50%, #00D4FF 100%)',
  protein: 'linear-gradient(90deg, #0099CC 0%, #00B8E6 50%, #00D4FF 100%)',
  activity: 'linear-gradient(90deg, #007ACC 0%, #0099CC 50%, #00B8E6 100%)',
  water: 'linear-gradient(90deg, #00B8E6 0%, #66E5FF 100%)',
  primary: 'linear-gradient(90deg, #0099CC 0%, #00D4FF 100%)',
  warning: 'linear-gradient(90deg, #CC8800 0%, #FFB800 100%)',
};

interface ProgressProps {
  value: number;
  max?: number;
  gradient?: string;
  height?: number;
}

const Progress: React.FC<ProgressProps> = ({ value, max = 100, gradient = 'primary', height = 6 }) => {
  const isOver = value > max;
  return (
    <div style={{ height, background: 'rgba(255, 255, 255, 0.06)', borderRadius: tokens.radius.full, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${Math.min((value / max) * 100, 100)}%`,
        background: isOver ? tokens.colors.warning : (gradients[gradient] || gradients.primary),
        borderRadius: tokens.radius.full,
        transition: 'width 0.5s ease-out',
      }} />
    </div>
  );
};

interface RingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

const Ring: React.FC<RingProps> = ({ value, max = 100, size = 80, strokeWidth = 6, color = 'primary' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, max) / max) * circumference;
  const isOver = value > max;

  const gradientId = color === tokens.colors.ringCalories ? 'grad-calories'
    : color === tokens.colors.ringProtein ? 'grad-protein'
    : color === tokens.colors.ringActivity ? 'grad-activity'
    : 'grad-primary';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="grad-calories" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#007ACC" />
            <stop offset="50%" stopColor="#00B8E6" />
            <stop offset="100%" stopColor="#00D4FF" />
          </linearGradient>
          <linearGradient id="grad-protein" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0099CC" />
            <stop offset="50%" stopColor="#00B8E6" />
            <stop offset="100%" stopColor="#66E5FF" />
          </linearGradient>
          <linearGradient id="grad-activity" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#005C99" />
            <stop offset="50%" stopColor="#007ACC" />
            <stop offset="100%" stopColor="#0099CC" />
          </linearGradient>
          <linearGradient id="grad-primary" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0099CC" />
            <stop offset="100%" stopColor="#00D4FF" />
          </linearGradient>
          <linearGradient id="grad-warning" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#CC8800" />
            <stop offset="100%" stopColor="#FFB800" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255, 255, 255, 0.06)" strokeWidth={strokeWidth} />
        <circle
          cx={size/2}
          cy={size/2}
          r={radius}
          fill="none"
          stroke={isOver ? 'url(#grad-warning)' : `url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: tokens.fonts.mono, fontSize: size * 0.22, fontWeight: 600, color: isOver ? tokens.colors.warning : tokens.colors.foreground }}>{Math.round(value)}</span>
        <span style={{ fontSize: size * 0.11, color: tokens.colors.mutedForeground }}>/{max}</span>
      </div>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 430,
        maxHeight: '85vh',
        background: tokens.colors.card,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: `${tokens.radius.xl}px ${tokens.radius.xl}px 0 0`,
        overflow: 'hidden',
      }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${tokens.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <H3>{title}</H3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: tokens.colors.mutedForeground, cursor: 'pointer', fontSize: 24 }}>×</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(85vh - 70px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================
// ICONS
// ============================================

const Icons = {
  Bolt: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  Flame: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  ),
  Utensils: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>
  ),
  Dumbbell: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>
    </svg>
  ),
  Target: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  User: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Plus: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
  ),
  Minus: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
    </svg>
  ),
  Check: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  Trash: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  ),
  Activity: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  Heart: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  ),
  Droplet: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  ),
  Clock: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  TrendingUp: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  TrendingDown: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>
    </svg>
  ),
  Settings: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Sparkles: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  ),
  RefreshCw: ({ size = 20, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
    </svg>
  ),
};

// ============================================
// LIQUID GLASS NAV
// ============================================

const LiquidGlassFilter = () => (
  <svg xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
    <defs>
      <filter id="glass-distortion" x="-10%" y="-10%" width="120%" height="120%" filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.015 0.015" numOctaves="2" seed="42" result="noise">
          <animate attributeName="seed" values="42;50;42" dur="8s" repeatCount="indefinite" />
        </feTurbulence>
        <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
        <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="30" xChannelSelector="R" yChannelSelector="G" result="displaced" />
        <feSpecularLighting in="softNoise" surfaceScale="2.5" specularConstant="0.7" specularExponent="40" lightingColor="#00D4FF" result="specular">
          <fePointLight x="-50" y="-80" z="150" />
        </feSpecularLighting>
      </filter>
    </defs>
  </svg>
);

interface FloatingNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const FloatingNav: React.FC<FloatingNavProps> = ({ activeTab, onTabChange }) => (
  <>
    <LiquidGlassFilter />
    <nav style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
    }}>
      <div style={{
        position: 'absolute',
        inset: -4,
        borderRadius: tokens.radius.full,
        background: 'radial-gradient(ellipse at center, rgba(0, 212, 255, 0.15) 0%, transparent 70%)',
        filter: 'blur(8px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 58,
        padding: '0 6px',
        borderRadius: tokens.radius.full,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: tokens.radius.full,
          zIndex: 1,
          backdropFilter: 'blur(6px) saturate(150%)',
          WebkitBackdropFilter: 'blur(6px) saturate(150%)',
        }} />

        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: tokens.radius.full,
          zIndex: 2,
          background: `linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 50%, rgba(0, 212, 255, 0.06) 100%)`,
        }} />

        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: tokens.radius.full,
          zIndex: 3,
          boxShadow: `inset 0 0 0 1px rgba(0, 212, 255, 0.2), inset 1.5px 1.5px 1px rgba(255, 255, 255, 0.4), inset -1px -1px 1px rgba(0, 212, 255, 0.15)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { id: 'home', icon: Icons.Bolt },
            { id: 'food', icon: Icons.Utensils },
            { id: 'workout', icon: Icons.Dumbbell },
            { id: 'goals', icon: Icons.Target },
            { id: 'profile', icon: Icons.User },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 46,
                  height: 46,
                  borderRadius: tokens.radius.full,
                  background: isActive ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? `0 2px 12px rgba(0, 212, 255, 0.3)` : 'none',
                }}
              >
                <Icon size={22} color={isActive ? tokens.colors.background : 'rgba(255, 255, 255, 0.9)'} />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: tokens.radius.full,
        boxShadow: `0 10px 40px rgba(0, 0, 0, 0.35), 0 4px 15px rgba(0, 212, 255, 0.1)`,
        pointerEvents: 'none',
        zIndex: 0,
      }} />
    </nav>
  </>
);

// ============================================
// TYPES
// ============================================

interface Food {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: number;
}

interface Meal {
  id: string;
  mealType: string;
  time: Date;
  foods: Food[];
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

interface Workout {
  id: string;
  workoutType: string;
  time: Date;
  duration: number;
  distance: number | null;
  kcalBurned: number;
}

// ============================================
// HOME PAGE
// ============================================

interface HomePageProps {
  user: UserProfile;
  meals: Meal[];
  workouts: Workout[];
  water: number;
  dailyTarget: ReturnType<typeof calculateDailyTarget>;
}

const HomePage: React.FC<HomePageProps> = ({ user, meals, workouts, water, dailyTarget }) => {
  const totalKcalIn = meals.reduce((sum, m) => sum + m.totalKcal, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.totalProtein, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.totalCarbs, 0);
  const totalFat = meals.reduce((sum, m) => sum + m.totalFat, 0);
  const totalWorkoutKcal = workouts.reduce((sum, w) => sum + w.kcalBurned, 0);
  const totalActiveMin = workouts.reduce((sum, w) => sum + w.duration, 0);

  const remaining = dailyTarget.targetKcal - totalKcalIn;
  const goal = GOALS[user.goal];

  const [coachAdvice, setCoachAdvice] = useState<string>('');
  const [coachLoading, setCoachLoading] = useState(false);

  const getCoachAdvice = async () => {
    setCoachLoading(true);
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userData: {
            weight: user.weight,
            height: user.height,
            age: user.age,
            goal: GOALS[user.goal].name,
            todayKcal: totalKcalIn,
            targetKcal: dailyTarget.targetKcal,
            todayProtein: totalProtein,
            targetProtein: dailyTarget.protein,
            workoutDone: totalWorkoutKcal > 0,
          },
        }),
      });
      const data = await response.json();
      setCoachAdvice(data.advice || 'Non ho consigli al momento.');
    } catch {
      setCoachAdvice('Connessione al coach non disponibile.');
    } finally {
      setCoachLoading(false);
    }
  };

  useEffect(() => {
    getCoachAdvice();
  }, []);

  const timeline = useMemo(() => {
    const items = [
      ...meals.map(m => ({ ...m, type: 'meal' as const, sortTime: m.time })),
      ...workouts.map(w => ({ ...w, type: 'workout' as const, sortTime: w.time })),
    ].sort((a, b) => a.sortTime.getTime() - b.sortTime.getTime());
    return items;
  }, [meals, workouts]);

  return (
    <>
      <div style={{ padding: '48px 16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 24 }}>
          <div>
            <Text muted small style={{ marginBottom: 4, display: 'block' }}>Obiettivo: {goal.emoji} {goal.name}</Text>
            <H1>Dashboard</H1>
          </div>
          <Badge variant={remaining >= 0 ? 'success' : 'warning'}>
            {remaining >= 0 ? <Icons.TrendingDown size={12} /> : <Icons.TrendingUp size={12} />}
            {goal.deficit > 0 ? 'Surplus' : goal.deficit < 0 ? 'Deficit' : 'Balance'}
          </Badge>
        </div>

        <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, ${tokens.colors.card} 0%, rgba(0, 212, 255, 0.05) 100%)` }}>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text muted small>Target dinamico oggi</Text>
              {dailyTarget.extraWorkoutBonus > 0 && (
                <Badge variant="success" style={{ fontSize: 10 }}>
                  +{dailyTarget.extraWorkoutBonus} dal workout
                </Badge>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <Large color={remaining >= 0 ? 'primary' : 'warning'}>
                {remaining >= 0 ? remaining : Math.abs(remaining)}
              </Large>
              <Text muted>kcal {remaining >= 0 ? 'disponibili' : 'in eccesso'}</Text>
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <Text muted>BMR: {dailyTarget.bmr}</Text>
              <Text muted>TDEE: {dailyTarget.dynamicTDEE}</Text>
              <Text style={{ color: tokens.colors.primary }}>Target: {dailyTarget.targetKcal}</Text>
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <Badge variant="secondary"><Icons.Utensils size={12} color={tokens.colors.ringProtein} /> {totalKcalIn} in</Badge>
          <Badge variant="secondary"><Icons.Flame size={12} color={tokens.colors.ringCalories} /> {totalWorkoutKcal} burned</Badge>
          <Badge variant="outline"><Icons.Clock size={12} /> {totalActiveMin} min</Badge>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: 24, display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <Ring value={totalKcalIn} max={dailyTarget.targetKcal} color={tokens.colors.ringCalories} />
              <Text muted small style={{ marginTop: 8, display: 'block' }}>Calorie</Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Ring value={totalProtein} max={dailyTarget.protein} color={tokens.colors.ringProtein} />
              <Text muted small style={{ marginTop: 8, display: 'block' }}>Proteine</Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Ring value={totalActiveMin} max={60} color={tokens.colors.ringActivity} />
              <Text muted small style={{ marginTop: 8, display: 'block' }}>Attivita</Text>
            </div>
          </div>
        </Card>

        <Card style={{ marginBottom: 16, background: `${tokens.colors.primary}10`, border: `1px solid ${tokens.colors.primary}30` }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Sparkles size={16} color={tokens.colors.primary} />
                <Text small style={{ color: tokens.colors.primary, fontWeight: 600 }}>AI Coach</Text>
              </div>
              <button
                onClick={getCoachAdvice}
                disabled={coachLoading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: coachLoading ? 'not-allowed' : 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: coachLoading ? 0.5 : 1,
                }}
              >
                <Icons.RefreshCw size={14} color={tokens.colors.primary} style={{ animation: coachLoading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
            <Text style={{ lineHeight: 1.6 }}>
              {coachLoading ? 'Analizzando i tuoi dati...' : coachAdvice}
            </Text>
          </div>
        </Card>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        <div style={{ marginBottom: 16 }}>
          <H3 style={{ marginBottom: 12 }}>Timeline</H3>
          <Card>
            {timeline.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Text muted>Nessuna attivita oggi</Text>
              </div>
            ) : (
              timeline.map((item, i) => {
                const isMeal = item.type === 'meal';
                const Icon = isMeal ? Icons.Utensils : Icons.Activity;
                const color = isMeal ? tokens.colors.ringProtein : tokens.colors.ringCalories;

                return (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderBottom: i < timeline.length - 1 ? `1px solid ${tokens.colors.border}` : 'none',
                  }}>
                    <Icon size={18} color={color} />
                    <div style={{ flex: 1 }}>
                      <Text weight={500}>{isMeal ? (item as Meal).mealType : (item as Workout).workoutType}</Text>
                      <Text muted small style={{ display: 'block', marginTop: 2 }}>
                        {isMeal
                          ? `${(item as Meal).totalKcal} kcal - ${(item as Meal).totalProtein}g prot`
                          : `${(item as Workout).duration} min - ${(item as Workout).kcalBurned} kcal`
                        }
                      </Text>
                    </div>
                    <Text mono muted style={{ fontSize: 13 }}>{formatTime(item.time)}</Text>
                  </div>
                );
              })
            )}
          </Card>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: 20 }}>
            <H3 style={{ marginBottom: 20 }}>Macronutrienti</H3>
            {[
              { label: 'Proteine', value: totalProtein, max: dailyTarget.protein, gradient: 'protein' },
              { label: 'Carboidrati', value: totalCarbs, max: dailyTarget.carbs, gradient: 'calories' },
              { label: 'Grassi', value: totalFat, max: dailyTarget.fat, gradient: 'activity' },
            ].map((m, i) => (
              <div key={i} style={{ marginBottom: i < 2 ? 16 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text muted small>{m.label}</Text>
                  <Text small><Text mono weight={500}>{m.value}g</Text> <Text muted>/ {m.max}g</Text></Text>
                </div>
                <Progress value={m.value} max={m.max} gradient={m.gradient} />
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ marginBottom: 100 }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Droplet size={18} color={tokens.colors.primaryLight} />
                <H3>Acqua</H3>
              </div>
              <Text><Text mono weight={600}>{water.toFixed(1)}L</Text> <Text muted>/ 2.5L</Text></Text>
            </div>
            <Progress value={water} max={2.5} gradient="water" />
          </div>
        </Card>
      </div>
    </>
  );
};

// ============================================
// FOOD PAGE (simplified)
// ============================================

interface FoodPageProps {
  meals: Meal[];
  setMeals: React.Dispatch<React.SetStateAction<Meal[]>>;
  water: number;
  setWater: React.Dispatch<React.SetStateAction<number>>;
  dailyTarget: ReturnType<typeof calculateDailyTarget>;
}

const FoodPage: React.FC<FoodPageProps> = ({ meals, setMeals, water, setWater, dailyTarget }) => {
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('Pranzo');
  const [selectedFoods, setSelectedFoods] = useState<Food[]>([]);

  const totalKcalIn = meals.reduce((sum, m) => sum + m.totalKcal, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.totalProtein, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.totalCarbs, 0);
  const totalFat = meals.reduce((sum, m) => sum + m.totalFat, 0);

  const addFoodToSelection = (foodName: string) => {
    const nutrients = calculateFoodNutrients(foodName);
    if (nutrients) {
      setSelectedFoods([...selectedFoods, { ...nutrients, id: generateId() }]);
    }
  };

  const removeFoodFromSelection = (id: string) => {
    setSelectedFoods(selectedFoods.filter(f => f.id !== id));
  };

  const saveMeal = () => {
    if (selectedFoods.length === 0) return;

    const newMeal: Meal = {
      id: generateId(),
      mealType: selectedMealType,
      time: new Date(),
      foods: selectedFoods,
      totalKcal: selectedFoods.reduce((sum, f) => sum + f.kcal, 0),
      totalProtein: selectedFoods.reduce((sum, f) => sum + f.protein, 0),
      totalCarbs: selectedFoods.reduce((sum, f) => sum + f.carbs, 0),
      totalFat: selectedFoods.reduce((sum, f) => sum + f.fat, 0),
    };

    setMeals([...meals, newMeal]);
    setSelectedFoods([]);
    setShowAddMeal(false);
  };

  const deleteMeal = (id: string) => {
    setMeals(meals.filter(m => m.id !== id));
  };

  return (
    <>
      <div style={{ padding: '48px 16px 24px' }}>
        <H1 style={{ marginBottom: 4 }}>Dieta</H1>
        <Text muted>Target: {dailyTarget.targetKcal} kcal - {dailyTarget.protein}g proteine</Text>
      </div>

      <div style={{ padding: '0 16px' }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <Ring value={totalKcalIn} max={dailyTarget.targetKcal} size={100} strokeWidth={8} color={tokens.colors.ringCalories} />
              <div style={{ flex: 1 }}>
                {[
                  { label: 'Proteine', value: totalProtein, max: dailyTarget.protein, gradient: 'protein' },
                  { label: 'Carb', value: totalCarbs, max: dailyTarget.carbs, gradient: 'calories' },
                  { label: 'Grassi', value: totalFat, max: dailyTarget.fat, gradient: 'activity' },
                ].map((m, i) => (
                  <div key={i} style={{ marginBottom: i < 2 ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text muted small>{m.label}</Text>
                      <Text small mono>{m.value}g</Text>
                    </div>
                    <Progress value={m.value} max={m.max} gradient={m.gradient} height={4} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <H3 style={{ marginBottom: 12 }}>Pasti</H3>

        {meals.map(meal => (
          <Card key={meal.id} style={{ marginBottom: 12 }}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                <div>
                  <H3>{meal.mealType}</H3>
                  <Text muted small>{formatTime(meal.time)}</Text>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge>{meal.totalKcal} kcal</Badge>
                  <button onClick={() => deleteMeal(meal.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Icons.Trash size={16} color={tokens.colors.mutedForeground} />
                  </button>
                </div>
              </div>
              <Text muted small>{meal.foods.map(f => f.name).join(' - ')}</Text>
            </div>
          </Card>
        ))}

        <Button
          variant="outline"
          fullWidth
          onClick={() => { setSelectedMealType('Pranzo'); setShowAddMeal(true); }}
          style={{ marginBottom: 16 }}
        >
          <Icons.Plus size={16} /> Aggiungi pasto
        </Button>

        <Card style={{ marginBottom: 100 }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Droplet size={18} color={tokens.colors.primaryLight} />
                <H3>Acqua</H3>
              </div>
              <Text><Text mono weight={600}>{water.toFixed(1)}L</Text> <Text muted>/ 2.5L</Text></Text>
            </div>
            <Progress value={water} max={2.5} gradient="water" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button variant="secondary" style={{ flex: 1 }} onClick={() => setWater(Math.min(water + 0.25, 5))}>+ 250ml</Button>
              <Button variant="secondary" style={{ flex: 1 }} onClick={() => setWater(Math.min(water + 0.5, 5))}>+ 500ml</Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal isOpen={showAddMeal} onClose={() => { setShowAddMeal(false); setSelectedFoods([]); }} title={`Aggiungi ${selectedMealType}`}>
        <div style={{ marginBottom: 16 }}>
          <Text weight={500} style={{ marginBottom: 8, display: 'block' }}>Tipo pasto:</Text>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Colazione', 'Pranzo', 'Cena', 'Snack'].map(type => (
              <Button
                key={type}
                variant={selectedMealType === type ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setSelectedMealType(type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        {selectedFoods.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Text weight={500} style={{ marginBottom: 12, display: 'block' }}>Selezionati:</Text>
            {selectedFoods.map(food => (
              <div key={food.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${tokens.colors.border}` }}>
                <div>
                  <Text>{food.name}</Text>
                  <Text muted small style={{ display: 'block' }}>{food.portion}g - {food.kcal} kcal - {food.protein}g prot</Text>
                </div>
                <button onClick={() => removeFoodFromSelection(food.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Icons.Trash size={16} color={tokens.colors.destructive} />
                </button>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: 12, background: tokens.colors.muted, borderRadius: tokens.radius.md }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text weight={500}>Totale</Text>
                <Text mono weight={600}>{selectedFoods.reduce((s, f) => s + f.kcal, 0)} kcal</Text>
              </div>
            </div>
          </div>
        )}

        <Text weight={500} style={{ marginBottom: 12, display: 'block' }}>Aggiungi cibi:</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(FOOD_DATABASE).map(food => (
            <Button
              key={food}
              variant="secondary"
              size="sm"
              onClick={() => addFoodToSelection(food)}
            >
              {food}
            </Button>
          ))}
        </div>

        <Button
          fullWidth
          disabled={selectedFoods.length === 0}
          onClick={saveMeal}
          style={{ marginTop: 24 }}
        >
          Salva {selectedMealType}
        </Button>
      </Modal>
    </>
  );
};

// ============================================
// WORKOUT PAGE (simplified)
// ============================================

interface WorkoutPageProps {
  workouts: Workout[];
  setWorkouts: React.Dispatch<React.SetStateAction<Workout[]>>;
  dailyTarget: ReturnType<typeof calculateDailyTarget>;
}

const WorkoutPage: React.FC<WorkoutPageProps> = ({ workouts, setWorkouts, dailyTarget }) => {
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [duration, setDuration] = useState(30);

  const totalKcalBurned = workouts.reduce((sum, w) => sum + w.kcalBurned, 0);
  const totalActiveMin = workouts.reduce((sum, w) => sum + w.duration, 0);

  const saveWorkout = () => {
    if (!selectedType || duration <= 0) return;

    const kcalBurned = calculateWorkoutKcal(selectedType, duration);

    const newWorkout: Workout = {
      id: generateId(),
      workoutType: selectedType,
      time: new Date(),
      duration,
      distance: null,
      kcalBurned,
    };

    setWorkouts([...workouts, newWorkout]);
    setShowAddWorkout(false);
    setSelectedType('');
  };

  const deleteWorkout = (id: string) => {
    setWorkouts(workouts.filter(w => w.id !== id));
  };

  return (
    <>
      <div style={{ padding: '48px 16px 24px' }}>
        <H1 style={{ marginBottom: 4 }}>Sport</H1>
        <Text muted>Bonus extra dal workout: +{dailyTarget.extraWorkoutBonus} kcal</Text>

        <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
          <div>
            <Large color="success">{totalKcalBurned}</Large>
            <Text muted small style={{ display: 'block', marginTop: 4 }}>Kcal bruciate</Text>
          </div>
          <div>
            <Large>{totalActiveMin}</Large>
            <Text muted small style={{ display: 'block', marginTop: 4 }}>Min attivi</Text>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <H3 style={{ marginBottom: 12 }}>Oggi</H3>

        {workouts.length === 0 ? (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Text muted>Nessun workout ancora</Text>
            </div>
          </Card>
        ) : (
          workouts.map(workout => (
            <Card key={workout.id} style={{ marginBottom: 12 }}>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Icons.Activity size={24} color={tokens.colors.ringCalories} />
                    <div>
                      <H3>{workout.workoutType}</H3>
                      <Text muted small>{formatTime(workout.time)}</Text>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge style={{ background: tokens.colors.success, color: '#000' }}>{workout.kcalBurned} kcal</Badge>
                    <button onClick={() => deleteWorkout(workout.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      <Icons.Trash size={16} color={tokens.colors.mutedForeground} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <Text><Icons.Clock size={14} color={tokens.colors.mutedForeground} /> {workout.duration} min</Text>
                </div>
              </div>
            </Card>
          ))
        )}

        <H3 style={{ marginTop: 24, marginBottom: 12 }}>Inizia workout</H3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 100 }}>
          {[
            { type: 'Corsa', icon: Icons.Activity, color: tokens.colors.ringCalories },
            { type: 'Pesi - Full Body', icon: Icons.Dumbbell, color: tokens.colors.primary },
            { type: 'Cardio', icon: Icons.Heart, color: tokens.colors.ringProtein },
            { type: 'HIIT', icon: Icons.Bolt, color: tokens.colors.ringActivity },
          ].map(w => (
            <Card key={w.type} style={{ cursor: 'pointer' }} onClick={() => { setSelectedType(w.type); setShowAddWorkout(true); }}>
              <div style={{ padding: 20, textAlign: 'center' }}>
                <w.icon size={28} color={w.color} />
                <Text weight={500} style={{ display: 'block', marginTop: 8 }}>{w.type.replace(' - Full Body', '')}</Text>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Modal isOpen={showAddWorkout} onClose={() => setShowAddWorkout(false)} title="Nuovo Workout">
        <Text weight={500} style={{ marginBottom: 12, display: 'block' }}>Tipo di workout:</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {Object.keys(WORKOUT_DATABASE).map(type => (
            <Button
              key={type}
              variant={selectedType === type ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setSelectedType(type)}
            >
              {type}
            </Button>
          ))}
        </div>

        <Text weight={500} style={{ marginBottom: 12, display: 'block' }}>Durata (minuti):</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <Button variant="secondary" onClick={() => setDuration(Math.max(5, duration - 5))}>
            <Icons.Minus size={16} />
          </Button>
          <Text mono style={{ fontSize: 32, fontWeight: 600, width: 80, textAlign: 'center' }}>{duration}</Text>
          <Button variant="secondary" onClick={() => setDuration(duration + 5)}>
            <Icons.Plus size={16} />
          </Button>
        </div>

        {selectedType && (
          <div style={{ padding: 16, background: tokens.colors.muted, borderRadius: tokens.radius.md, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Calorie stimate:</Text>
              <Text mono weight={600} style={{ color: tokens.colors.ringCalories }}>
                ~{calculateWorkoutKcal(selectedType, duration)} kcal
              </Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Text muted small>Bonus extra (50%):</Text>
              <Text mono small style={{ color: tokens.colors.success }}>
                +{Math.round(calculateWorkoutKcal(selectedType, duration) * 0.5)} kcal
              </Text>
            </div>
          </div>
        )}

        <Button
          fullWidth
          disabled={!selectedType || duration <= 0}
          onClick={saveWorkout}
        >
          Salva Workout
        </Button>
      </Modal>
    </>
  );
};

// ============================================
// GOALS PAGE
// ============================================

interface GoalsPageProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  dailyTarget: ReturnType<typeof calculateDailyTarget>;
}

const GoalsPage: React.FC<GoalsPageProps> = ({ user, setUser, dailyTarget }) => {
  return (
    <>
      <div style={{ padding: '48px 16px 24px' }}>
        <H1 style={{ marginBottom: 4 }}>Obiettivo</H1>
        <Text muted>Configura il tuo piano personalizzato</Text>
      </div>

      <div style={{ padding: '0 16px' }}>
        <H3 style={{ marginBottom: 12 }}>Il tuo obiettivo</H3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {(Object.keys(GOALS) as GoalKey[]).map(key => {
            const goal = GOALS[key];
            const isActive = user.goal === key;
            return (
              <Card
                key={key}
                onClick={() => setUser({ ...user, goal: key })}
                style={{
                  cursor: 'pointer',
                  border: isActive ? `2px solid ${tokens.colors.primary}` : undefined,
                  background: isActive ? `${tokens.colors.primary}10` : undefined,
                }}
              >
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <span style={{ fontSize: 28 }}>{goal.emoji}</span>
                  <Text weight={600} style={{ display: 'block', marginTop: 8 }}>{goal.name}</Text>
                  <Text muted small style={{ display: 'block', marginTop: 4 }}>{goal.description}</Text>
                  <Badge
                    variant={goal.deficit > 0 ? 'warning' : goal.deficit < 0 ? 'success' : 'secondary'}
                    style={{ marginTop: 8 }}
                  >
                    {goal.deficit > 0 ? '+' : ''}{goal.deficit} kcal
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>

        <H3 style={{ marginBottom: 12 }}>Livello attivita</H3>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: 16 }}>
            {(Object.keys(ACTIVITY_LEVELS) as ActivityKey[]).map((key, i, arr) => {
              const level = ACTIVITY_LEVELS[key];
              const isActive = user.activityLevel === key;
              return (
                <div
                  key={key}
                  onClick={() => setUser({ ...user, activityLevel: key })}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    cursor: 'pointer',
                    borderBottom: i < arr.length - 1 ? `1px solid ${tokens.colors.border}` : 'none',
                  }}
                >
                  <div>
                    <Text weight={isActive ? 600 : 400} style={{ color: isActive ? tokens.colors.primary : undefined }}>{level.name}</Text>
                    <Text muted small style={{ display: 'block' }}>{level.description}</Text>
                  </div>
                  {isActive && <Icons.Check size={20} color={tokens.colors.primary} />}
                </div>
              );
            })}
          </div>
        </Card>

        <H3 style={{ marginBottom: 12 }}>I tuoi target giornalieri</H3>
        <Card style={{ marginBottom: 100 }}>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: 16, background: tokens.colors.muted, borderRadius: tokens.radius.md }}>
                <Text muted small>BMR</Text>
                <Text mono weight={600} style={{ fontSize: 24, display: 'block' }}>{dailyTarget.bmr}</Text>
                <Text muted small>kcal</Text>
              </div>
              <div style={{ textAlign: 'center', padding: 16, background: tokens.colors.muted, borderRadius: tokens.radius.md }}>
                <Text muted small>TDEE Base</Text>
                <Text mono weight={600} style={{ fontSize: 24, display: 'block' }}>{dailyTarget.baseTDEE}</Text>
                <Text muted small>kcal</Text>
              </div>
              <div style={{ textAlign: 'center', padding: 16, background: `${tokens.colors.primary}20`, borderRadius: tokens.radius.md }}>
                <Text muted small>Target Kcal</Text>
                <Text mono weight={600} style={{ fontSize: 24, display: 'block', color: tokens.colors.primary }}>{dailyTarget.targetKcal}</Text>
                <Text muted small>kcal/giorno</Text>
              </div>
              <div style={{ textAlign: 'center', padding: 16, background: `${tokens.colors.ringProtein}20`, borderRadius: tokens.radius.md }}>
                <Text muted small>Proteine</Text>
                <Text mono weight={600} style={{ fontSize: 24, display: 'block', color: tokens.colors.ringProtein }}>{dailyTarget.protein}</Text>
                <Text muted small>g/giorno</Text>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};

// ============================================
// PROFILE PAGE
// ============================================

interface ProfilePageProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, setUser }) => {
  const [editMode, setEditMode] = useState(false);
  const [tempUser, setTempUser] = useState(user);

  const saveProfile = () => {
    setUser(tempUser);
    setEditMode(false);
  };

  return (
    <>
      <div style={{ padding: '48px 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: tokens.radius.full, background: tokens.colors.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icons.User size={28} color={tokens.colors.mutedForeground} />
          </div>
          <div>
            <H2>Il tuo profilo</H2>
            <Badge style={{ marginTop: 4 }}>{GOALS[user.goal].emoji} {GOALS[user.goal].name}</Badge>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <H3>Dati fisici</H3>
              <Button variant="ghost" size="sm" onClick={() => { setTempUser(user); setEditMode(!editMode); }}>
                <Icons.Settings size={16} /> {editMode ? 'Annulla' : 'Modifica'}
              </Button>
            </div>

            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Text muted small style={{ display: 'block', marginBottom: 8 }}>Peso (kg)</Text>
                  <input
                    type="number"
                    value={tempUser.weight}
                    onChange={(e) => setTempUser({ ...tempUser, weight: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: 12,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: tokens.radius.md,
                      color: tokens.colors.foreground,
                      fontSize: 16,
                    }}
                  />
                </div>
                <div>
                  <Text muted small style={{ display: 'block', marginBottom: 8 }}>Altezza (cm)</Text>
                  <input
                    type="number"
                    value={tempUser.height}
                    onChange={(e) => setTempUser({ ...tempUser, height: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: 12,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: tokens.radius.md,
                      color: tokens.colors.foreground,
                      fontSize: 16,
                    }}
                  />
                </div>
                <div>
                  <Text muted small style={{ display: 'block', marginBottom: 8 }}>Eta</Text>
                  <input
                    type="number"
                    value={tempUser.age}
                    onChange={(e) => setTempUser({ ...tempUser, age: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: 12,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: tokens.radius.md,
                      color: tokens.colors.foreground,
                      fontSize: 16,
                    }}
                  />
                </div>
                <div>
                  <Text muted small style={{ display: 'block', marginBottom: 8 }}>Sesso</Text>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant={tempUser.gender === 'male' ? 'default' : 'secondary'}
                      onClick={() => setTempUser({ ...tempUser, gender: 'male' })}
                      style={{ flex: 1 }}
                    >
                      Maschio
                    </Button>
                    <Button
                      variant={tempUser.gender === 'female' ? 'default' : 'secondary'}
                      onClick={() => setTempUser({ ...tempUser, gender: 'female' })}
                      style={{ flex: 1 }}
                    >
                      Femmina
                    </Button>
                  </div>
                </div>
                <Button fullWidth onClick={saveProfile}>Salva modifiche</Button>
              </div>
            ) : (
              <>
                {[
                  { label: 'Peso', value: `${user.weight} kg` },
                  { label: 'Altezza', value: `${user.height} cm` },
                  { label: 'Eta', value: `${user.age} anni` },
                  { label: 'Sesso', value: user.gender === 'male' ? 'Maschio' : 'Femmina' },
                  { label: 'Attivita', value: ACTIVITY_LEVELS[user.activityLevel].name },
                ].map((item, i, arr) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < arr.length - 1 ? `1px solid ${tokens.colors.border}` : 'none' }}>
                    <Text muted>{item.label}</Text>
                    <Text mono weight={500}>{item.value}</Text>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>

        <Card style={{ marginBottom: 100, background: `${tokens.colors.primary}10`, border: `1px solid ${tokens.colors.primary}30` }}>
          <div style={{ padding: 16 }}>
            <Text small style={{ lineHeight: 1.6 }}>
              <strong>JEFIT</strong> calcola automaticamente i tuoi fabbisogni in base ai dati fisici, livello attivita e obiettivo.
              Il target giornaliero si aggiusta dinamicamente con ogni workout!
            </Text>
          </div>
        </Card>
      </div>
    </>
  );
};

// ============================================
// MAIN APP
// ============================================

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  // Persistenza con localStorage
  const [user, setUser] = useLocalStorage<UserProfile>('jefit_user', {
    weight: 75,
    height: 178,
    age: 30,
    gender: 'male',
    activityLevel: 'moderate',
    goal: 'cut',
  });

  const [meals, setMeals] = useLocalStorage<Meal[]>('jefit_meals', [], {
    deserialize: (data) => data.map(m => ({ ...m, time: new Date(m.time) }))
  });

  const [workouts, setWorkouts] = useLocalStorage<Workout[]>('jefit_workouts', [], {
    deserialize: (data) => data.map(w => ({ ...w, time: new Date(w.time) }))
  });

  const [water, setWater] = useLocalStorage<number>(getWaterKey(), 0);

  // Cleanup dati > 7 giorni
  useEffect(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    setMeals(prev => prev.filter(m => new Date(m.time).getTime() > sevenDaysAgo));
    setWorkouts(prev => prev.filter(w => new Date(w.time).getTime() > sevenDaysAgo));
  }, []);

  const totalWorkoutKcal = workouts.reduce((sum, w) => sum + w.kcalBurned, 0);
  const dailyTarget = useMemo(() => calculateDailyTarget(user, totalWorkoutKcal), [user, totalWorkoutKcal]);

  const pages: Record<string, React.ReactNode> = {
    home: <HomePage user={user} meals={meals} workouts={workouts} water={water} dailyTarget={dailyTarget} />,
    food: <FoodPage meals={meals} setMeals={setMeals} water={water} setWater={setWater} dailyTarget={dailyTarget} />,
    workout: <WorkoutPage workouts={workouts} setWorkouts={setWorkouts} dailyTarget={dailyTarget} />,
    goals: <GoalsPage user={user} setUser={setUser} dailyTarget={dailyTarget} />,
    profile: <ProfilePage user={user} setUser={setUser} />,
  };

  return (
    <div style={{ minHeight: '100vh', background: tokens.colors.background, fontFamily: tokens.fonts.sans, paddingBottom: 100 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${tokens.colors.background}; }
        input::placeholder { color: ${tokens.colors.mutedForeground}; }
        input:focus { outline: none; border-color: ${tokens.colors.primary}; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 430, margin: '0 auto' }}>
        {pages[activeTab]}
      </div>

      <FloatingNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
