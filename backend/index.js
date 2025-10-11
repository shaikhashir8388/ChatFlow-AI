const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors'); 
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const Message = require('./models/Message');
const OpenAI = require('openai');

dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000', // Your frontend
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.id);

  // When a user joins the chat
  socket.on('join', (userId) => {
    socket.join('global-chat');
    console.log(`${userId} joined with socket ID: ${socket.id}`);
  });

  // Handle sending message
  socket.on('sendMessage', async ({ userId, message }) => {
    try {
      // Save user's message to MongoDB
      const newMessage = new Message({
        user: userId,
        content: message,
        timestamp: new Date(),
      });
      await newMessage.save();

      // Broadcast user's message to all clients
      io.to('global-chat').emit('receiveMessage', {
        user: userId,
        content: message,
        timestamp: new Date(),
      });

      // 🤖 OpenAI-powered chat response
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { 
              role: "system", 
              content: "You are a friendly and helpful chat assistant. Keep responses concise and engaging. Use emojis occasionally to be more expressive." 
            },
            { 
              role: "user", 
              content: message 
            }
          ],
          max_tokens: 150
        });

        const botReply = completion.choices[0].message.content;

        const replyMessage = new Message({
          user: 'AI Assistant',
          content: botReply,
          timestamp: new Date(),
        });
        await replyMessage.save();

        // Send the AI's message to all users
        io.to('global-chat').emit('receiveMessage', {
          user: 'AI Assistant',
          content: botReply,
          timestamp: new Date(),
        });
      } catch (aiError) {
        console.error('OpenAI API Error:', aiError);
        // Send a fallback message if AI fails
        io.to('global-chat').emit('receiveMessage', {
          user: 'AI Assistant',
          content: "I'm having trouble processing your request at the moment. Please try again later.",
          timestamp: new Date(),
        });
      }
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  // Load previous messages
  socket.on('loadMessages', async () => {
    const messages = await Message.find().sort({ timestamp: 1 }).limit(50);
    socket.emit('previousMessages', messages);
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
