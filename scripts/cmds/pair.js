const { GoatWrapper } = require('fca-liane-utils');
const { loadImage, createCanvas, registerFont } = require("canvas");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// Register fonts (make sure you have these font files in your assets)
registerFont(path.join(__dirname, 'assets', 'font', 'Poppins-Bold.ttf'), { family: 'Poppins', weight: 'bold' });
registerFont(path.join(__dirname, 'assets', 'font', 'Poppins-Regular.ttf'), { family: 'Poppins' });

module.exports = {
  config: {
    name: "pair",
    author: "𝗦𝗵𝗔𝗻",
    role: 0,
    shortDescription: "Find your perfect match",
    longDescription: "Pair with someone in your group with detailed compatibility analysis and beautiful visuals",
    category: "𝗟𝗢𝗩𝗘",
    guide: {
      en: "{pn} [@mention] (optional) - Pair with someone specific or get a random match"
    }
  },

  onStart: async function ({ api, event, args, usersData, threadsData }) {
    try {
      api.setMessageReaction("💝", event.messageID, (err) => {}, true);
      
      // Paths for cache files
      const paths = {
        background: __dirname + "/cache/pair_background.png",
        user1: {
          avatar: __dirname + "/cache/pair_user1.png",
          frame: __dirname + "/cache/pair_user1_frame.png"
        },
        user2: {
          avatar: __dirname + "/cache/pair_user2.png",
          frame: __dirname + "/cache/pair_user2_frame.png"
        },
        result: __dirname + "/cache/pair_result.png"
      };

      // Get user information
      const botID = api.getCurrentUserID();
      const id1 = event.senderID;
      const user1 = await usersData.get(id1);
      const name1 = user1.name;
      const gender1 = user1.gender;

      // Determine pairing partner
      let id2, name2, isRandom = true;
      
      // Check if user mentioned someone
      if (Object.keys(event.mentions).length > 0) {
        id2 = Object.keys(event.mentions)[0];
        isRandom = false;
      } else {
        // Get thread information for random pairing
        const ThreadInfo = await api.getThreadInfo(event.threadID);
        const allUsers = ThreadInfo.userInfo;
        
        // Filter potential candidates
        let candidates = [];
        const preferences = {
          "MALE": "FEMALE",
          "FEMALE": "MALE"
        };
        
        const preferredGender = preferences[gender1] || null;
        
        for (const user of allUsers) {
          if (user.id !== id1 && user.id !== botID) {
            if (!preferredGender || user.gender === preferredGender) {
              candidates.push(user.id);
            }
          }
        }
        
        if (candidates.length === 0) {
          return api.sendMessage(
            "❌ No suitable pairing candidates found in this group. Try again later or in a different group!",
            event.threadID,
            event.messageID
          );
        }
        
        id2 = candidates[Math.floor(Math.random() * candidates.length)];
      }
      
      const user2 = await usersData.get(id2);
      name2 = user2.name;
      const gender2 = user2.gender;

      // Generate compatibility metrics
      const compatibility = this.generateCompatibility(id1, id2);
      
      // Download resources
      await this.downloadResources(id1, id2, paths);
      
      // Create the pair image
      await this.createPairImage(paths, {
        user1: { name: name1, compatibility },
        user2: { name: name2, compatibility }
      });
      
      // Generate result message
      const message = this.generateResultMessage(name1, name2, compatibility, isRandom);
      
      // Prepare the reply
      const replyMessage = {
        body: message,
        mentions: [
          { tag: name1, id: id1 },
          { tag: name2, id: id2 }
        ],
        attachment: fs.createReadStream(paths.result)
      };
      
      if (event.messageReply) {
        replyMessage.messageID = event.messageReply.messageID;
      }
      
      // Send the result
      await api.sendMessage(
        replyMessage,
        event.threadID,
        () => {
          // Clean up cache files
          Object.values(paths).forEach(path => {
            if (typeof path === 'string') {
              fs.unlinkSync(path);
            } else {
              Object.values(path).forEach(p => fs.unlinkSync(p));
            }
          });
        },
        event.messageID
      );
      
    } catch (error) {
      console.error("Pair command error:", error);
      api.sendMessage(
        "❌ An error occurred while processing your pairing request. Please try again later.",
        event.threadID,
        event.messageID
      );
    }
  },

  // Helper function to generate compatibility metrics
  generateCompatibility: function(id1, id2) {
    // Create a consistent seed based on user IDs
    const seed = parseInt(id1) + parseInt(id2);
    const random = (min, max) => {
      const x = Math.sin(seed) * 10000;
      return Math.floor((x - Math.floor(x)) * (max - min + 1) + min);
    };
    
    const loveScore = random(0, 100);
    const friendshipScore = random(0, 100);
    const communicationScore = random(0, 100);
    const longevityScore = random(0, 100);
    
    // Determine relationship type based on scores
    let relationshipType;
    if (loveScore > 80) relationshipType = "Soulmates 💞";
    else if (loveScore > 60) relationshipType = "Romantic Partners 💑";
    else if (friendshipScore > 70) relationshipType = "Best Friends 👫";
    else if (communicationScore > 65) relationshipType = "Good Friends 👬";
    else relationshipType = "Acquaintances 👋";
    
    // Generate strengths
    const strengths = [];
    if (loveScore > 70) strengths.push("Strong romantic connection");
    if (friendshipScore > 70) strengths.push("Great friendship potential");
    if (communicationScore > 70) strengths.push("Excellent communication");
    if (longevityScore > 70) strengths.push("Long-term potential");
    if (strengths.length === 0) strengths.push("Unique connection worth exploring");
    
    // Generate challenges
    const challenges = [];
    if (loveScore < 40) challenges.push("Romantic challenges");
    if (friendshipScore < 40) challenges.push("Friendship difficulties");
    if (communicationScore < 40) challenges.push("Communication barriers");
    if (longevityScore < 40) challenges.push("Potential short-term relationship");
    
    return {
      score: loveScore,
      relationshipType,
      strengths,
      challenges,
      details: {
        love: loveScore,
        friendship: friendshipScore,
        communication: communicationScore,
        longevity: longevityScore
      }
    };
  },

  // Helper function to download required resources
  downloadResources: async function(id1, id2, paths) {
    // Background options with different themes
    const backgrounds = [
      "https://i.imgur.com/WX5ZQ0a.png", // Romantic
      "https://i.imgur.com/3JmTQ0a.png", // Elegant
      "https://i.imgur.com/7KmTQ0a.png", // Fun
      "https://i.imgur.com/9KmTQ0a.png"  // Mystical
    ];
    
    const selectedBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    
    // Download all resources in parallel
    await Promise.all([
      // Download avatars
      axios.get(`https://graph.facebook.com/${id1}/picture?width=1000&height=1000&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`, {
        responseType: 'arraybuffer'
      }).then(res => fs.writeFile(paths.user1.avatar, Buffer.from(res.data)),

      axios.get(`https://graph.facebook.com/${id2}/picture?width=1000&height=1000&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`, {
        responseType: 'arraybuffer'
      }).then(res => fs.writeFile(paths.user2.avatar, Buffer.from(res.data))),

      // Download frames (decorative elements around avatars)
      axios.get('https://i.imgur.com/XKmTQ0a.png', { // Heart frame
        responseType: 'arraybuffer'
      }).then(res => fs.writeFile(paths.user1.frame, Buffer.from(res.data))),

      axios.get('https://i.imgur.com/YKmTQ0a.png', { // Flower frame
        responseType: 'arraybuffer'
      }).then(res => fs.writeFile(paths.user2.frame, Buffer.from(res.data))),

      // Download background
      axios.get(selectedBg, {
        responseType: 'arraybuffer'
      }).then(res => fs.writeFile(paths.background, Buffer.from(res.data)))
    ]);
  },

  // Helper function to create the pair image
  createPairImage: async function(paths, data) {
    // Load all images
    const [
      background,
      user1Avatar,
      user2Avatar,
      user1Frame,
      user2Frame
    ] = await Promise.all([
      loadImage(paths.background),
      loadImage(paths.user1.avatar),
      loadImage(paths.user2.avatar),
      loadImage(paths.user1.frame),
      loadImage(paths.user2.frame)
    ]);

    // Create canvas
    const canvas = createCanvas(background.width, background.height);
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    
    // Draw user avatars with frames
    this.drawUserAvatar(ctx, user1Avatar, user1Frame, 150, 200, 300, data.user1);
    this.drawUserAvatar(ctx, user2Avatar, user2Frame, 650, 200, 300, data.user2);
    
    // Draw compatibility info
    this.drawCompatibilityInfo(ctx, data.user1.compatibility, canvas.width, canvas.height);
    
    // Draw decorative elements
    this.drawDecorations(ctx, canvas.width, canvas.height);
    
    // Save the result
    const out = fs.createWriteStream(paths.result);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    
    return new Promise((resolve) => {
      out.on('finish', resolve);
    });
  },

  // Helper function to draw user avatar with frame
  drawUserAvatar: function(ctx, avatar, frame, x, y, size, userData) {
    // Draw circular avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, x, y, size, size);
    ctx.restore();
    
    // Draw frame
    ctx.drawImage(frame, x - 20, y - 20, size + 40, size + 40);
    
    // Draw user name
    ctx.font = 'bold 24px Poppins';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 5;
    ctx.fillText(userData.name, x + size/2, y + size + 50);
    ctx.shadowBlur = 0;
  },

  // Helper function to draw compatibility info
  drawCompatibilityInfo: function(ctx, compatibility, width, height) {
    const centerX = width / 2;
    const startY = height - 250;
    
    // Draw main score
    ctx.font = 'bold 72px Poppins';
    ctx.fillStyle = this.getScoreColor(compatibility.score);
    ctx.textAlign = 'center';
    ctx.fillText(`${compatibility.score}%`, centerX, startY);
    
    // Draw relationship type
    ctx.font = 'bold 36px Poppins';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(compatibility.relationshipType, centerX, startY + 50);
    
    // Draw meter
    this.drawMeter(ctx, centerX - 150, startY + 80, 300, 20, compatibility.score);
    
    // Draw details box
    this.drawDetailsBox(ctx, compatibility, centerX - 175, startY + 120, 350, 120);
  },

  // Helper function to draw the meter
  drawMeter: function(ctx, x, y, width, height, percent) {
    // Draw background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x, y, width, height);
    
    // Draw fill
    const fillWidth = (width * percent) / 100;
    ctx.fillStyle = this.getScoreColor(percent);
    ctx.fillRect(x, y, fillWidth, height);
    
    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  },

  // Helper function to draw details box
  drawDetailsBox: function(ctx, compatibility, x, y, width, height) {
    // Draw box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 15);
    ctx.fill();
    ctx.stroke();
    
    // Draw text
    ctx.font = '18px Poppins';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    
    // Strengths
    ctx.fillText(`✨ Strengths: ${compatibility.strengths.join(', ')}`, x + 15, y + 30);
    
    // Challenges
    ctx.fillText(`⚠️ Challenges: ${compatibility.challenges.join(', ')}`, x + 15, y + 60);
    
    // Details
    ctx.fillText(
      `❤️ ${compatibility.details.love}% 💬 ${compatibility.details.communication}% 👥 ${compatibility.details.friendship}% ⏳ ${compatibility.details.longevity}%`,
      x + 15, y + 90
    );
  },

  // Helper function to draw decorative elements
  drawDecorations: function(ctx, width, height) {
    // Draw hearts
    ctx.fillStyle = 'rgba(255, 100, 100, 0.4)';
    for (let i = 0; i < 10; i++) {
      const size = Math.random() * 20 + 10;
      const x = Math.random() * width;
      const y = Math.random() * height / 2;
      this.drawHeart(ctx, x, y, size);
    }
    
    // Draw sparkles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 15; i++) {
      const size = Math.random() * 5 + 2;
      const x = Math.random() * width;
      const y = Math.random() * height;
      this.drawSparkle(ctx, x, y, size);
    }
  },

  // Helper function to draw a heart shape
  drawHeart: function(ctx, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x, y - size/2, x - size, y - size/2, x - size, y);
    ctx.bezierCurveTo(x - size, y + size/3, x, y + size, x, y + size);
    ctx.bezierCurveTo(x, y + size, x + size, y + size/3, x + size, y);
    ctx.bezierCurveTo(x + size, y - size/2, x, y - size/2, x, y);
    ctx.fill();
    ctx.restore();
  },

  // Helper function to draw a sparkle
  drawSparkle: function(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size, 0);
      ctx.lineTo(size/2, -size/3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  // Helper function to get color based on score
  getScoreColor: function(score) {
    if (score >= 80) return '#ff4d88'; // Hot pink
    if (score >= 60) return '#ff6b9e'; // Pink
    if (score >= 40) return '#ff8cb4'; // Light pink
    if (score >= 20) return '#ffadc9'; // Very light pink
    return '#ffcee0'; // Pale pink
  },

  // Helper function to generate the result message
  generateResultMessage: function(name1, name2, compatibility, isRandom) {
    const randomMessages = {
      high: [
        `✨ Cosmic connection alert! ${name1} and ${name2} are a match made in the stars! ✨`,
        `💘 Love is in the air! ${name1} and ${name2} have incredible chemistry!`,
        `🌟 Wow! ${name1} and ${name2} - this pairing is electric!`
      ],
      medium: [
        `💞 ${name1} and ${name2} have potential! This could blossom into something beautiful!`,
        `👫 ${name1} and ${name2} make a nice pair with room to grow closer!`,
        `💕 There's a spark between ${name1} and ${name2}! Who knows where it might lead?`
      ],
      low: [
        `🤔 ${name1} and ${name2} - an interesting match with some challenges to overcome!`,
        `👋 ${name1} and ${name2} might be better as friends, but stranger things have happened!`,
        `💫 The universe works in mysterious ways! ${name1} and ${name2} have an unusual connection.`
      ]
    };
    
    let messageGroup;
    if (compatibility.score >= 70) messageGroup = randomMessages.high;
    else if (compatibility.score >= 40) messageGroup = randomMessages.medium;
    else messageGroup = randomMessages.low;
    
    const randomMessage = messageGroup[Math.floor(Math.random() * messageGroup.length)];
    
    let matchType = "";
    if (isRandom) {
      matchType = "Random Pairing Result";
    } else {
      matchType = "Compatibility Analysis";
    }
    
    return `${matchType}\n\n${randomMessage}\n\n💖 Compatibility Score: ${compatibility.score}%\n🔮 Relationship Type: ${compatibility.relationshipType}\n\n✨ Strengths: ${compatibility.strengths.join(', ')}\n⚠️ Challenges: ${compatibility.challenges.join(', ')}`;
  }
}; 
const wrapper = new GoatWrapper(module.exports);
wrapper.applyNoPrefix({ allowPrefix: true });
