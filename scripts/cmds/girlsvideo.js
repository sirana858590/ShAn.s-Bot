const axios = require('axios');

module.exports = {
  config: { 
    name: "girlsvideo",
    aliases: ["girls"],
    version: "2.0",
    author: "𝗦𝗵𝗔𝗻", // DO NOT CHANGE AUTHOR INFORMATION
    countDown: 20,
    role: 0,
    shortDescription: "",
    longDescription: "send you a hot girl video",
    category: "18+",
    guide: "{p}{n}",
  },

  onStart: async function ({ message }) {
    try {
      // Send loading message
      const loadingMessage = await message.reply("⏳কিরে লুচ্চা 🤨 দারা দিতেছি 😜...");
      
      const response = await axios.get('https://shans-api.onrender.com/ShAn/girlsvideo', {
        timeout: 10000 // 10 seconds timeout
      });
      
      if (!response.data || !response.data.url) {
        throw new Error("❌ Invalid API response format");
      }
      
      const videoUrl = response.data.url;
      
      // Send the video with caption
      message.reply({
        body: '「 এই নে বোকাচুলা দেখ 🥵💦 」',
        attachment: await global.utils.getStreamFromURL(videoUrl)
      });
      
      // Delete the loading message
      await message.unsend(loadingMessage.messageID);
      
    } catch (error) {
      console.error('Error:', error);
      
      try {
        await message.reply("⚠️ Sorry, the video couldn't be loaded right now. Possible reasons:\n\n• API server is down\n• Slow internet connection\n• Content not available\n\nPlease try again later...");
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
    }
  }
};
