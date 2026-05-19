// api/planets.js
// Vercel serverless function — fetches live planetary positions
// Called by the app on load to populate the sky bar and position cards
// Uses Swiss Ephemeris precision via astrology-api.io
// Free tier: 50 requests/month. Cache for 1 hour to stay within limits.

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms
let cache = { data: null, timestamp: 0 };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Return cached data if fresh
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
    return res.status(200).json({ source: 'cache', ...cache.data });
  }

  try {
    // Option A: Use astrology-api.io (free tier, Swiss Ephemeris precision)
    // Sign up at astrology-api.io to get your API key
    // Set ASTROLOGY_API_KEY in your Vercel environment variables
    const apiKey = process.env.ASTROLOGY_API_KEY;

    if (!apiKey) {
      // Fallback to static data if no API key configured yet
      return res.status(200).json(getFallbackData());
    }

    const now_dt = new Date();
    const response = await fetch('https://astrology-api.io/api/v1/planets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        year: now_dt.getUTCFullYear(),
        month: now_dt.getUTCMonth() + 1,
        day: now_dt.getUTCDate(),
        hour: now_dt.getUTCHours(),
        minute: now_dt.getUTCMinutes(),
        latitude: 0,
        longitude: 0
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    // Transform API response to Táukamí format
    const planets = transformApiResponse(data);

    // Cache it
    cache = { data: planets, timestamp: now };

    return res.status(200).json({ source: 'live', ...planets });

  } catch (err) {
    console.error('Planet API error:', err);
    // Graceful fallback — return last cached or static data
    if (cache.data) return res.status(200).json({ source: 'cache', ...cache.data });
    return res.status(200).json(getFallbackData());
  }
}

function transformApiResponse(data) {
  // Map API planet names to Táukamí format
  const planetMap = {
    sun: { symbol: '☀', name: 'SUN' },
    moon: { symbol: '☽', name: 'MOON' },
    mercury: { symbol: '☿', name: 'MERCURY' },
    venus: { symbol: '♀', name: 'VENUS' },
    mars: { symbol: '♂', name: 'MARS' },
    jupiter: { symbol: '♃', name: 'JUPITER' },
    saturn: { symbol: '♄', name: 'SATURN' },
    uranus: { symbol: '♅', name: 'URANUS' },
    neptune: { symbol: '♆', name: 'NEPTUNE' },
    pluto: { symbol: '♇', name: 'PLUTO' },
  };

  const signs = ['Ari','Tau','Gem','Can','Leo','Vir','Lib','Sco','Sag','Cap','Aqu','Pis'];
  const signsFull = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

  const result = { planets: [], updatedAt: new Date().toISOString() };

  Object.entries(planetMap).forEach(([key, meta]) => {
    const planet = data[key] || data[key.charAt(0).toUpperCase() + key.slice(1)];
    if (!planet) return;

    const signIndex = Math.floor((planet.longitude || 0) / 30);
    const degree = ((planet.longitude || 0) % 30).toFixed(0);
    const minutes = Math.floor(((planet.longitude || 0) % 1) * 60);

    result.planets.push({
      key,
      symbol: meta.symbol,
      name: meta.name,
      sign: signsFull[signIndex] || 'Unknown',
      signAbbr: signs[signIndex] || '???',
      degree: `${degree}°${minutes}'`,
      retrograde: planet.retrograde || planet.is_retrograde || false,
      longitude: planet.longitude
    });
  });

  return result;
}

function getFallbackData() {
  // Static verified data for May 9, 2026
  // Replace weekly when no API key is configured
  return {
    source: 'static',
    updatedAt: '2026-05-09T00:00:00Z',
    planets: [
      { key: 'sun', symbol: '☀', name: 'SUN', sign: 'Taurus', signAbbr: 'Tau', degree: "18°37'", retrograde: false },
      { key: 'moon', symbol: '☽', name: 'MOON', sign: 'Aquarius', signAbbr: 'Aqu', degree: "11°18'", retrograde: false },
      { key: 'mercury', symbol: '☿', name: 'MERCURY', sign: 'Taurus', signAbbr: 'Tau', degree: "12°18'", retrograde: false },
      { key: 'venus', symbol: '♀', name: 'VENUS', sign: 'Gemini', signAbbr: 'Gem', degree: "18°14'", retrograde: false },
      { key: 'mars', symbol: '♂', name: 'MARS', sign: 'Aries', signAbbr: 'Ari', degree: "22°39'", retrograde: false },
      { key: 'jupiter', symbol: '♃', name: 'JUPITER', sign: 'Cancer', signAbbr: 'Can', degree: "20°07'", retrograde: false },
      { key: 'saturn', symbol: '♄', name: 'SATURN', sign: 'Aries', signAbbr: 'Ari', degree: "10°03'", retrograde: false },
      { key: 'uranus', symbol: '♅', name: 'URANUS', sign: 'Gemini', signAbbr: 'Gem', degree: "0°44'", retrograde: false },
      { key: 'neptune', symbol: '♆', name: 'NEPTUNE', sign: 'Aries', signAbbr: 'Ari', degree: "3°30'", retrograde: false },
      { key: 'pluto', symbol: '♇', name: 'PLUTO', sign: 'Aquarius', signAbbr: 'Aqu', degree: "5°30'", retrograde: true }
    ]
  };
}
