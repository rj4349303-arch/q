import express from 'express';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { getSystemPrompt } from '../utils/systemPrompt.js';

dotenv.config();

const router = express.Router();

// Initialize Groq client
// It will pull GROQ_API_KEY from environment variables
let groq;
try {
  groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
  });
} catch (error) {
  console.error("Failed to initialize Groq SDK:", error);
}

router.post('/', async (req, res) => {
  try {
    const { message, history = [], state } = req.body;

    if (!groq) {
      return res.status(500).json({
        error: "Server configuration error: Groq API client is not initialized. Please verify the GROQ_API_KEY in your .env file."
      });
    }

    // Initialize state if not present
    const currentState = state || {
      step: 1,
      depth: 'Medium',
      variables: {}
    };

    const userMessage = message ? message.trim() : '';

    // Update state variables based on the CURRENT step before calling Groq
    if (userMessage) {
      switch (currentState.step) {
        case 1:
          currentState.variables.decision = userMessage;
          break;
        case 2:
          currentState.variables.emotions = userMessage;
          break;
        case 3:
          currentState.variables.financials = userMessage;
          break;
        case 4:
          currentState.variables.experience = userMessage;
          break;
        case 5:
          // The slider choice is captured directly via currentState.depth
          break;
        case 6:
          currentState.variables.stakeholders = userMessage;
          break;
        case 7:
          currentState.variables.pressureResponse = userMessage;
          break;
        case 8:
          currentState.variables.regretReview = userMessage;
          break;
      }
    }

    // Generate system prompt for the active step
    const systemPrompt = getSystemPrompt(
      currentState.step,
      currentState.depth,
      currentState.variables
    );

    // Format history for Groq API
    // Ensure the system prompt is injected as the system message at the start
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...history
    ];

    // If there's a new user message, append it to the call (frontend might not have appended it to history yet)
    if (userMessage && (history.length === 0 || history[history.length - 1].content !== userMessage)) {
      apiMessages.push({ role: 'user', content: userMessage });
    }

    const modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    
    // Call Groq API
    const completion = await groq.chat.completions.create({
      messages: apiMessages,
      model: modelName,
      temperature: 0.5,
      max_tokens: currentState.step === 9 ? 2048 : 500, // Allocate more tokens for Step 9 Stress Report
    });

    const aiResponse = completion.choices[0]?.message?.content || "No response received.";

    // Increment step counter after successful API response
    if (currentState.step < 10) {
      currentState.step += 1;
    }

    // Return AI response and updated conversation state
    return res.json({
      response: aiResponse,
      state: currentState
    });

  } catch (error) {
    console.error("Error handling chat request:", error);
    return res.status(500).json({
      error: "An error occurred while communicating with the AI service.",
      details: error.message
    });
  }
});

export default router;
