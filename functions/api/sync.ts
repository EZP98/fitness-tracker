interface Env {
  DB: D1Database;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Device-ID',
};

// GET: Sync all data for a device
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const deviceId = context.request.headers.get('X-Device-ID');

  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Device ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // Get or create user
    let user = await context.env.DB.prepare(
      'SELECT * FROM users WHERE device_id = ?'
    ).bind(deviceId).first();

    if (!user) {
      // Create new user
      const id = crypto.randomUUID();
      await context.env.DB.prepare(
        `INSERT INTO users (id, device_id) VALUES (?, ?)`
      ).bind(id, deviceId).run();

      user = await context.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(id).first();
    }

    // Get meals (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const meals = await context.env.DB.prepare(
      'SELECT * FROM meals WHERE user_id = ? AND time > ? ORDER BY time DESC'
    ).bind(user!.id, sevenDaysAgo).all();

    // Get workouts (last 7 days)
    const workouts = await context.env.DB.prepare(
      'SELECT * FROM workouts WHERE user_id = ? AND time > ? ORDER BY time DESC'
    ).bind(user!.id, sevenDaysAgo).all();

    // Get today's water
    const today = new Date().toISOString().split('T')[0];
    const water = await context.env.DB.prepare(
      'SELECT liters FROM water_logs WHERE user_id = ? AND date = ?'
    ).bind(user!.id, today).first();

    return new Response(JSON.stringify({
      user: {
        id: user!.id,
        weight: user!.weight,
        height: user!.height,
        age: user!.age,
        gender: user!.gender,
        activityLevel: user!.activity_level,
        goal: user!.goal,
      },
      meals: meals.results.map((m: any) => ({
        id: m.id,
        mealType: m.meal_type,
        time: m.time,
        foods: JSON.parse(m.foods),
        totalKcal: m.total_kcal,
        totalProtein: m.total_protein,
        totalCarbs: m.total_carbs,
        totalFat: m.total_fat,
      })),
      workouts: workouts.results.map((w: any) => ({
        id: w.id,
        workoutType: w.workout_type,
        time: w.time,
        duration: w.duration,
        distance: w.distance,
        kcalBurned: w.kcal_burned,
      })),
      water: water?.liters || 0,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Sync GET error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// POST: Save data
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const deviceId = context.request.headers.get('X-Device-ID');

  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Device ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const body = await context.request.json() as any;
    const { action, data } = body;

    // Get user
    const user = await context.env.DB.prepare(
      'SELECT id FROM users WHERE device_id = ?'
    ).bind(deviceId).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    switch (action) {
      case 'updateUser':
        await context.env.DB.prepare(`
          UPDATE users SET
            weight = ?, height = ?, age = ?, gender = ?,
            activity_level = ?, goal = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          data.weight, data.height, data.age, data.gender,
          data.activityLevel, data.goal, user.id
        ).run();
        break;

      case 'addMeal':
        const mealId = crypto.randomUUID();
        await context.env.DB.prepare(`
          INSERT INTO meals (id, user_id, meal_type, time, foods, total_kcal, total_protein, total_carbs, total_fat)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          mealId, user.id, data.mealType, data.time,
          JSON.stringify(data.foods), data.totalKcal, data.totalProtein, data.totalCarbs, data.totalFat
        ).run();
        return new Response(JSON.stringify({ id: mealId }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

      case 'deleteMeal':
        await context.env.DB.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?')
          .bind(data.id, user.id).run();
        break;

      case 'addWorkout':
        const workoutId = crypto.randomUUID();
        await context.env.DB.prepare(`
          INSERT INTO workouts (id, user_id, workout_type, time, duration, distance, kcal_burned)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          workoutId, user.id, data.workoutType, data.time,
          data.duration, data.distance || null, data.kcalBurned
        ).run();
        return new Response(JSON.stringify({ id: workoutId }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

      case 'deleteWorkout':
        await context.env.DB.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?')
          .bind(data.id, user.id).run();
        break;

      case 'updateWater':
        const today = new Date().toISOString().split('T')[0];
        await context.env.DB.prepare(`
          INSERT INTO water_logs (id, user_id, date, liters) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, date) DO UPDATE SET liters = ?
        `).bind(crypto.randomUUID(), user.id, today, data.liters, data.liters).run();
        break;

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Sync POST error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// OPTIONS: CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};
