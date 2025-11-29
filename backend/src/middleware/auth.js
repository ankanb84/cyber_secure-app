const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer "))
      return res.status(401).json({ error: 'No token' });

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { userId: decoded.userId, username: decoded.username };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
