export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Handle Zod validation errors
  if (err.name === 'ZodError' || Array.isArray(err.errors)) {
    const msg = err.errors?.[0]?.message || 'Validation failed';
    return res.status(400).json({ error: msg });
  }

  const messages = {
    '23505': 'A record with that value already exists',
    '23503': 'This record is still in use',
    '23514': 'One or more values are invalid',
    '23P01': 'Vehicle is already booked for these dates',
    'P0001': err.message,
  };

  const message = messages[err.code] || err.message || 'Request failed';
  const status = err.status || (err.code ? 400 : 500);

  res.status(status).json({ error: message });
}
