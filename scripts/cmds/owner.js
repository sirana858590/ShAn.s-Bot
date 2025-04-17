const { GoatWrapper } = require('fca-liane-utils');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  config: {
    name: "owner",
    aliases: ["shanke"],
    author: "𝗦𝗵𝗔𝗻",
    role: 0,
    shortDescription: "Show owner information",
    longDescription: "Displays information about the bot owner with a random video",
    category: "𝗜𝗡𝗙𝗢",
    guide: "{pn}"
  },

  onStart: async function ({ api, event }) {
    try {
      const ownerInfo = {
        name: '𝐸𝑊𝑅 𝑆𝐻𝐴𝑁',
        gender: '𝑴𝑨𝑳𝑬',
        birthday: '10-𝟎𝟕-𝟐𝟎𝟎5',
        religion: '𝑰𝑺𝑳𝑨𝑴',
        hobby: '𝑭𝒍𝒊𝒓𝒕𝒊𝒏𝒈 😁',
        facebook: 'https://www.facebook.com/sirana252',
        relationship: '𝑩𝑶𝑳𝑩𝑶 𝑵𝑨',
        height: '5"4'
      };

      const videoLinks = [
        'https://drive.google.com/uc?export=download&id=1J4yQ13L2WTpdOuqcP0yEmzULACdwfvnQ',
        'https://drive.google.com/uc?export=download&id=1J2ph0PcizaIy9QnK9790j4jXGBwBSjG7',
        'https://drive.google.com/uc?export=download&id=1IWXtQBd9V5xuLL7-dADTKLoprAE6XrOS',
        'https://drive.google.com/uc?export=download&id=1IOW6p0wpC6E8MBv1OfAnG1UWmMKfPw5z',
        'https://drive.google.com/uc?export=download&id=1IKA_yxFxPz09116TSmrk-K55DEW3GFB2',
        'https://drive.google.com/uc?export=download&id=1IH8zjj-fH5M8hwPrI1i6JfKFRlmy7AyX',
        'https://drive.google.com/uc?export=download&id=1IEz8wwc5T5chRzsruT8fETfqJUYTk_1g',
        'https://drive.google.com/uc?export=download&id=1I5iOweiVL_aV8W2k3WJqgEHkHD75PY1k',
        'https://drive.google.com/uc?export=download&id=1I3Jte-iy8bF4SehZ_EHN-EOeoeJSscEO',
        'https://drive.google.com/uc?export=download&id=1I1vfvQnpx6OW9iyM55OGAerAge19bUP4',
        'https://drive.google.com/uc?export=download&id=1I0YRd6OzpRHLFM-pqYmoKuDRe9Ldhfht',
        'https://drive.google.com/uc?export=download&id=1HyhkBI92QKm3dTq6NJpDhGWKHFKn8iN8',
        'https://drive.google.com/uc?export=download&id=1Hy9SmvIJzU5aXbjjGTlEUwCihOWIj6Fk',
        'https://drive.google.com/uc?export=download&id=1Hw-0A--3teOH5k9zWsAc85gwGbxgIJJR',
        'https://drive.google.com/uc?export=download&id=1HqWwyPkSHp7G_HgcH5bUNOW4nQrlcUFy'
      ];

      const randomVideoLink = videoLinks[Math.floor(Math.random() * videoLinks.length)];
      
      // Download the video
      const videoPath = path.join(__dirname, 'temp', 'owner_video.mp4');
      const writer = fs.createWriteStream(videoPath);
      
      const response = await axios({
        method: 'get',
        url: randomVideoLink,
        responseType: 'stream'
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const messageBody = `
𓀬 𝐎𝐖𝐍𝐄𝐑 𝐈𝐍𝐅𝐎 𓀬 \n
 ~𝙉𝘼𝙈𝙀: ${ownerInfo.name}
 ~𝙂𝙀𝙉𝘿𝙀𝙍: ${ownerInfo.gender}
 ~𝘽𝙄𝙍𝙏𝙃𝘿𝘼𝙔: ${ownerInfo.birthday}
 ~𝙍𝙀𝙇𝙄𝙂𝙄𝙊𝙉: ${ownerInfo.religion}
 ~𝙍𝙀𝙇𝘼𝙏𝙄𝙊𝙉𝙎𝙃𝙄𝙋: ${ownerInfo.relationship}
 ~𝙃𝙊𝘽𝘽𝙔: ${ownerInfo.hobby}
 ~𝙃𝙀𝙄𝙂𝙃𝙏: ${ownerInfo.height}
 ~𝙁𝘽: ${ownerInfo.facebook}
      `;

      await api.sendMessage({
        body: messageBody,
        attachment: fs.createReadStream(videoPath)
      }, event.threadID, event.messageID);

      // Clean up - delete the downloaded video
      fs.unlinkSync(videoPath);

      api.setMessageReaction('😘', event.messageID, (err) => {}, true);
    } catch (error) {
      console.error('Error in owner command:', error);
      return api.sendMessage('An error occurred while processing the command.', event.threadID);
    }
  }
};

const wrapper = new GoatWrapper(module.exports);
wrapper.applyNoPrefix({ allowPrefix: true });
