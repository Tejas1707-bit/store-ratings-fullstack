export const passwordPattern = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}$/;
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateUserFields(body, { password = true } = {}) {
  body ||= {};
  const errors = {};
  if (!body.name || body.name.trim().length < 20 || body.name.trim().length > 60) errors.name = 'Name must be between 20 and 60 characters.';
  if (!emailPattern.test(body.email || '')) errors.email = 'Enter a valid email address.';
  if (!body.address || body.address.trim().length > 400) errors.address = 'Address is required and must be at most 400 characters.';
  if (password && !passwordPattern.test(body.password || '')) errors.password = 'Password must be 8-16 characters with an uppercase letter and special character.';
  return errors;
}
export function validationError(errors) { const error = new Error('Please correct the highlighted fields.'); error.status = 400; error.details = errors; return error; }