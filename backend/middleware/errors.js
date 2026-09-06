export function notFound(req, res) { res.status(404).json({ message: 'Route not found.' }); }
export function errorHandler(error, req, res, next) {
  console.error(error);
  if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('users.email')) return res.status(409).json({ message: 'Email is already registered.' });
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A record with those unique details already exists.' });
  res.status(error.status || 500).json({ message: error.status ? error.message : 'An unexpected server error occurred.' });
}