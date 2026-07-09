import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

// Register Route
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: "Email, password, and username are required." });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email address." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into Supabase
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          email: email.trim().toLowerCase(),
          username: username.trim(),
          password: hashedPassword
        }
      ])
      .select('email', 'username')
      .single();

    if (insertError) {
      throw insertError;
    }

    return res.json({
      success: true,
      user: {
        email: email.trim().toLowerCase(),
        name: username.trim()
      }
    });

  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "An error occurred during registration.", details: error.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Query user from Supabase
    const { data: user, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    return res.json({
      success: true,
      user: {
        email: user.email,
        name: user.username
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "An error occurred during login.", details: error.message });
  }
});

export default router;
