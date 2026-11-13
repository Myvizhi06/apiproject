/**
 * API Sentinel - Authentication Controller
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { User } = require('../models');

class AuthController {
  static async register(req, res, next) {
    try {
      const { name, email, password } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Name, email, and password are required.',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Password must be at least 6 characters.',
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'User with this email already exists.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        createdAt: new Date(),
      });

      const token = jwt.sign(
        { id: user._id || user.id, email: user.email, name: user.name },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: 'Registration successful',
        user: { id: user._id || user.id, name: user.name, email: user.email },
        token,
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Email and password are required.',
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password.',
        });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password.',
        });
      }

      const token = jwt.sign(
        { id: user._id || user.id, email: user.email, name: user.name },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      res.json({
        message: 'Login successful',
        user: { id: user._id || user.id, name: user.name, email: user.email },
        token,
      });
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'NotFound', message: 'User not found.' });
      }
      res.json({
        user: { id: user._id || user.id, name: user.name, email: user.email },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;

