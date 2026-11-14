export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Sign in to continue' });
  }
  req.user = req.session.user;
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Sign in to continue' });
  }
  req.user = req.session.user;
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this resource' });
  }
  next();
};
