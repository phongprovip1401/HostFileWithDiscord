const mysql = require('mysql2/promise');
const { Client } = require('discord.js');

class ImageDatabase {
  constructor() {
    this.pool = null;
    this.initialized = false;
    this.dbName = 'discord_img';
    this.initDatabase();
  }

  async initDatabase() {
    try {
      this.pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: this.dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      try {
        await this.pool.query(`CREATE DATABASE IF NOT EXISTS ${this.dbName}`);
        
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS images (
            id INT AUTO_INCREMENT PRIMARY KEY,
            discord_url VARCHAR(255) NOT NULL,
            message_id VARCHAR(255) NOT NULL,
            channel_id VARCHAR(255) NOT NULL,
            upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_renewal TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            chunks_data TEXT
          )
        `);
        
        try {
          await this.pool.query(`
            ALTER TABLE images 
            ADD COLUMN chunks_data TEXT AFTER last_renewal
          `);
          console.log('Da them cot chunks_data vao bang images');
        } catch (columnError) {
          if (!columnError.message.includes('Duplicate column')) {
            console.error('Loi khi kiem tra/them cot chunks_data:', columnError);
          }
        }

        this.initialized = true;
        console.log('Khoi tao database thanh cong');
        
        this.startRenewalCheck();
      } catch (error) {
        console.error('Loi khi tao bang database:', error);
      }
    } catch (error) {
      console.error('Loi khi ket noi database:', error);
    }
  }

  async addImage(discordUrl, messageId, channelId, chunksData = null) {
    if (!this.initialized) {
      await this.waitForInitialization();
    }
    
    try {
      const [result] = await this.pool.query(
        'INSERT INTO images (discord_url, message_id, channel_id, chunks_data) VALUES (?, ?, ?, ?)',
        [discordUrl, messageId, channelId, chunksData]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Loi khi them anh vao database:', error);
      return null;
    }
  }

  async getImage(id) {
    if (!this.initialized) {
      await this.waitForInitialization();
    }
    
    try {
      const [rows] = await this.pool.query(
        'SELECT discord_url FROM images WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? rows[0].discord_url : null;
    } catch (error) {
      console.error('Loi khi lay anh tu database:', error);
      return null;
    }
  }

  async hasImage(id) {
    if (!this.initialized) {
      await this.waitForInitialization();
    }
    
    try {
      const [rows] = await this.pool.query(
        'SELECT COUNT(*) as count FROM images WHERE id = ?',
        [id]
      );
      
      return rows[0].count > 0;
    } catch (error) {
      console.error('Loi khi kiem tra anh trong database:', error);
      return false;
    }
  }

  async updateImageUrl(id, newUrl) {
    if (!this.initialized) {
      await this.waitForInitialization();
    }
    
    try {
      await this.pool.query(
        'UPDATE images SET discord_url = ?, last_renewal = CURRENT_TIMESTAMP WHERE id = ?',
        [newUrl, id]
      );
      
      return true;
    } catch (error) {
      console.error('Loi khi cap nhat URL anh:', error);
      return false;
    }
  }

  async getImagesNeedingRenewal() {
    if (!this.initialized) {
      await this.waitForInitialization();
    }
    
    try {
      const [rows] = await this.pool.query(
        'SELECT id, message_id, channel_id FROM images'
      );
      
      return rows;
    } catch (error) {
      console.error('Loi khi lay danh sach anh can lam moi:', error);
      return [];
    }
  }

  startRenewalCheck() {
    setInterval(async () => {
      await this.renewExpiredImages();
    }, 60 * 60 * 1000);
    
    this.renewExpiredImages();
  }

  async renewExpiredImages() {
    try {
      const discordClient = global.discordClient;
      if (!discordClient || !discordClient.isReady()) {
        console.warn('Bot Discord chua san sang');
        return;
      }

      const imagesToRenew = await this.getImagesNeedingRenewal();
      console.log(`Tim thay ${imagesToRenew.length} anh can lam moi`);

      for (const image of imagesToRenew) {
        try {
          const channel = await discordClient.channels.fetch(image.channel_id);
          if (!channel) {
            console.error(`Khong tim thay kenh ${image.channel_id} cho anh ${image.id}`);
            continue;
          }

          const message = await channel.messages.fetch(image.message_id);
          if (!message) {
            console.error(`Khong tim thay tin nhan ${image.message_id} cho anh ${image.id}`);
            continue;
          }

          const attachment = message.attachments.first();
          if (!attachment) {
            console.error(`Khong tim thay file dinh kem trong tin nhan ${image.message_id} cho anh ${image.id}`);
            continue;
          }

          const newUrl = attachment.url;
          await this.updateImageUrl(image.id, newUrl);
          console.log(`Da lam moi anh ${image.id} voi URL moi`);
        } catch (error) {
          console.error(`Loi khi lam moi anh ${image.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Loi trong qua trinh lam moi anh:', error);
    }
  }

  waitForInitialization() {
    return new Promise((resolve) => {
      const checkInit = () => {
        if (this.initialized) {
          resolve();
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }
}

module.exports = new ImageDatabase(); 