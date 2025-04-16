const axios = require("axios");

const dApi = async () => {
  const base = await axios.get(
    "https://raw.githubusercontent.com/nazrul4x/Noobs/main/Apis.json"
  );
  return base.data.alldl;
};

module.exports.config = {
  name: "autodl",
  version: "1.6.9",
  author: "Nazrul",
  role: 0,
  description: "Automatically download videos from supported platforms!",
  category: "𝗠𝗘𝗗𝗜𝗔",
  countDown: 10,
  guide: {
    en: "Send a valid video link from supported platforms (TikTok, Facebook, YouTube, Twitter, Instagram, etc.), and the bot will download it automatically.",
  },
};

const platforms = {
  TikTok: {
    regex: /(?:https?:\/\/)?(?:www\.)?tiktok\.com/,
    endpoint: "/nazrul/tikDL?url=",
  },
  Facebook: {
    regex: /(?:https?:\/\/)?(?:www\.)?(facebook\.com|fb\.watch|facebook\.com\/share\/v)/,
    endpoint: "/nazrul/fbDL?url=",
  },
  YouTube: {
    regex: /(?:https?:\/\/)?(?:www\.)?(youtube\.com|youtu\.be)/,
    endpoint: "/nazrul/ytDL?uri=",
  },
  Twitter: {
    regex: /(?:https?:\/\/)?(?:www\.)?x\.com/,
    endpoint: "/nazrul/alldl?url=",
  },
  Instagram: {
    regex: /(?:https?:\/\/)?(?:www\.)?instagram\.com/,
    endpoint: "/nazrul/instaDL?url=",
  },
  Threads: {
    regex: /(?:https?:\/\/)?(?:www\.)?threads\.net/,
    endpoint: "/nazrul/alldl?url=",
  },
};

const detectPlatform = (url) => {
  for (const [platform, data] of Object.entries(platforms)) {
    if (data.regex.test(url)) {
      return { platform, endpoint: data.endpoint };
    }
  }
  return null;
};

const downloadVideo = async (apiUrl, url) => {
  const match = detectPlatform(url);
  if (!match) {
    throw new Error("No matching platform for the provided URL.");
  }
  const { platform, endpoint } = match;
  const endpointUrl = `${apiUrl}${endpoint}${encodeURIComponent(url)}`;
  console.log(`🔗 Fetching from: ${endpointUrl}`);
  try {
    const res = await axios.get(endpointUrl);
    console.log(`✅ API Response:`, res.data);
    const videoUrl = res.data?.videos?.[0]?.url || res.data?.url;
    if (videoUrl) {
      return { downloadUrl: videoUrl, platform };
    }
  } catch (error) {
    console.error(`❌ Error fetching data from ${endpointUrl}:`, error.message);
    throw new Error("Download link not found.");
  }
  throw new Error("No video URL found in the API response.");
};

module.exports.onChat = async ({ api, event }) => {
  const { body, threadID, messageID } = event;
  if (!body) return;
  
  const urlMatch = body.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return;

  try {
    // Set initial reaction
    api.setMessageReaction("🔄", event.messageID, (err) => {
      if (err) console.error("Reaction error:", err);
    }, true);

    const url = urlMatch[0];
    const platformMatch = detectPlatform(url);
    if (!platformMatch) {
      api.setMessageReaction("❌", event.messageID, (err) => {}, true);
      return;
    }

    const apiUrl = await dApi();
    api.setMessageReaction("✅", event.messageID, (err) => {}, true);
    
    const { downloadUrl, platform } = await downloadVideo(apiUrl, url);
    const videoStream = await axios.get(downloadUrl, { responseType: "stream" });
    
    api.sendMessage(
      {
        body: `✅ Successfully downloaded the video!\n🔖 Platform: ${platform}\n😜Power by Ew'r ShAn's😪`,
        attachment: videoStream.data,
      },
      threadID,
      messageID
    );
    
  } catch (error) {
    console.error(`❌ Error while processing the URL:`, error.message);
    api.setMessageReaction("❌", event.messageID, (err) => {
      if (err) console.error("Failed to set reaction:", err);
    }, true);
  }
};
