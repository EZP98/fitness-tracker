-- JEFIT Database Schema

-- User profiles
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  device_id TEXT UNIQUE NOT NULL,
  weight REAL NOT NULL DEFAULT 75,
  height REAL NOT NULL DEFAULT 178,
  age INTEGER NOT NULL DEFAULT 30,
  gender TEXT NOT NULL DEFAULT 'male',
  activity_level TEXT NOT NULL DEFAULT 'moderate',
  goal TEXT NOT NULL DEFAULT 'cut',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Meals
CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  time TEXT NOT NULL,
  foods TEXT NOT NULL, -- JSON array
  total_kcal INTEGER NOT NULL,
  total_protein INTEGER NOT NULL,
  total_carbs INTEGER NOT NULL,
  total_fat INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workouts
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  distance REAL,
  kcal_burned INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Water tracking (daily)
CREATE TABLE IF NOT EXISTS water_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  liters REAL NOT NULL DEFAULT 0,
  UNIQUE(user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meals_user ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_time ON meals(time);
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_time ON workouts(time);
CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_logs(user_id, date);
