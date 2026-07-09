import express from 'express';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

// Get all chats for a specific user
router.get('/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: "User email is required." });
    }

    const { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_email', email.trim().toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Map fields back to frontend structure if necessary
    const formattedChats = chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      history: chat.history,
      state: chat.state,
      timestamp: chat.timestamp
    }));

    return res.json(formattedChats);

  } catch (error) {
    console.error("Error fetching chats:", error);
    return res.status(500).json({ error: "Failed to retrieve chat sessions.", details: error.message });
  }
});

// Save or update a chat session (Upsert)
router.post('/', async (req, res) => {
  try {
    const { id, user_email, title, history, state, timestamp } = req.body;

    if (!id || !user_email || !title) {
      return res.status(400).json({ error: "Chat ID, User Email, and Title are required." });
    }

    const { data, error } = await supabase
      .from('chats')
      .upsert({
        id: id,
        user_email: user_email.trim().toLowerCase(),
        title: title,
        history: history || [],
        state: state || {},
        timestamp: timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({ success: true, chat: data });

  } catch (error) {
    console.error("Error saving chat:", error);
    return res.status(500).json({ error: "Failed to save chat session.", details: error.message });
  }
});

// Delete a chat session
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Chat ID is required." });
    }

    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("Error deleting chat:", error);
    return res.status(500).json({ error: "Failed to delete chat session.", details: error.message });
  }
});

export default router;
