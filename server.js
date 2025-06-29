require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits, Events } = require('discord.js');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Import the database module
const imageDatabase = require('./database');

// Make the Discord client globally available for the renewal system
global.discordClient = client;

// Discord bot login
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot Ready ${readyClient.user.tag}!`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload single file endpoint with progress tracking
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Khong co file nao duoc tai len' });
    }

    const guild = client.guilds.cache.get(process.env.SERVER_ID);
    if (!guild) {
      return res.status(500).json({ error: 'Khong tim thay may chu Discord' });
    }

    // Get all text channels
    const textChannels = guild.channels.cache.filter(channel => 
      channel.type === 0 // 0 is the value for text channels in discord.js v14
    );

    if (textChannels.size === 0) {
      return res.status(500).json({ error: 'Khong tim thay kenh van ban nao trong may chu' });
    }

    // Set up response headers for JSON
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Select a random channel
    const randomChannel = textChannels.random();
    
    // Upload to Discord
    const message = await randomChannel.send({
      files: [{
        attachment: req.file.path,
        name: req.file.originalname
      }]
    });

    // Get the URL of the uploaded file
    const attachment = message.attachments.first();
    const discordUrl = attachment.url;
    
    // Store in our database
    const imageId = await imageDatabase.addImage(
      discordUrl,
      message.id,
      randomChannel.id
    );
    
    // Delete the temporary file
    fs.unlinkSync(req.file.path);
    
    // Return the custom URL
    const customUrl = `${req.protocol}://${req.get('host')}/image?id=${imageId}`;
    res.end(JSON.stringify({ 
      success: true, 
      fileUrl: customUrl,
      id: imageId,
      originalName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size
    }));
    
  } catch (error) {
    console.error('Loi khi tai len Discord:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Khong the tai file len Discord' });
    } else {
      res.end(JSON.stringify({ error: 'Khong the tai file len Discord' }));
    }
  }
});

// Upload multiple files endpoint
app.post('/upload-multiple', upload.array('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Khong co file nao duoc tai len' });
    }

    const guild = client.guilds.cache.get(process.env.SERVER_ID);
    if (!guild) {
      return res.status(500).json({ error: 'Khong tim thay may chu Discord' });
    }

    // Get all text channels
    const textChannels = guild.channels.cache.filter(channel => 
      channel.type === 0 // 0 is the value for text channels in discord.js v14
    );

    if (textChannels.size === 0) {
      return res.status(500).json({ error: 'Khong tim thay kenh van ban nao trong may chu' });
    }

    // Set up SSE for progress tracking
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const results = [];
    const totalFiles = req.files.length;
    
    // Calculate progress steps - 50% for upload to server (already done), 50% for Discord upload
    // Each file gets an equal portion of the remaining 50%
    const baseProgress = 50;
    const progressPerFile = 50 / totalFiles;

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        // Select a random channel for each file
        const randomChannel = textChannels.random();
        
        // Update progress - starting Discord upload for this file
        const currentProgress = baseProgress + (i * progressPerFile);
        
        // Upload to Discord
        const message = await randomChannel.send({
          files: [{
            attachment: file.path,
            name: file.originalname
          }]
        });

        // Get the URL of the uploaded file
        const attachment = message.attachments.first();
        const discordUrl = attachment.url;
        
        // Store in our database
        const imageId = await imageDatabase.addImage(
          discordUrl,
          message.id,
          randomChannel.id
        );
        
        // Delete the temporary file
        fs.unlinkSync(file.path);
        
        // Update progress - finished Discord upload for this file
        const fileCompleteProgress = baseProgress + ((i + 1) * progressPerFile);
        
        // Add to results
        const customUrl = `${req.protocol}://${req.get('host')}/image?id=${imageId}`;
        results.push({ 
          success: true, 
          fileUrl: customUrl,
          id: imageId,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size
        });
      } catch (error) {
        console.error('Loi khi tai file len Discord:', error);
        results.push({
          success: false,
          error: 'Khong the tai file len',
          originalName: file.originalname
        });
      }
    }
    
    // Send final response
    res.end(JSON.stringify({ 
      success: true, 
      results: results
    }));
    
  } catch (error) {
    console.error('Loi khi tai len Discord:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Khong the tai cac file len Discord' });
    } else {
      res.end(JSON.stringify({ error: 'Khong the tai cac file len Discord' }));
    }
  }
});

// Serve image by ID
app.get('/image', async (req, res) => {
  const imageId = req.query.id;
  
  try {
    if (!imageId || !(await imageDatabase.hasImage(imageId))) {
      return res.status(404).json({ error: 'Khong tim thay anh' });
    }
    
    const imageData = await imageDatabase.getImage(imageId);
    
    // For non-chunked files, just redirect to the Discord CDN URL
    res.redirect(imageData);
  } catch (error) {
    console.error('Loi khi phuc vu anh:', error);
    res.status(500).json({ error: 'Khong the truy xuat anh' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`May chu dang chay tai http://localhost:${port}`);
}); 