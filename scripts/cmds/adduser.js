const { findUid } = global.utils;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  config: {
    name: "adduser",
    aliases: ["add"],
    version: "2.1",
    author: "NTKhang (fixed by AI)",
    countDown: 10,
    role: 1,
    shortDescription: "Add user to group chat",
    longDescription: "Add users via UID, profile link, or by replying to their message",
    category: "GROUP MANAGEMENT",
    guide: {
      en: "{pn} [profile link | UID] (or reply to a message)"
    }
  },

  langs: {
    en: {
      alreadyInGroup: "🔄 User is already in the group",
      successAdd: "✅ Successfully added %1 user(s)",
      failedAdd: "❌ Failed to add %1 user(s)",
      approve: "⏳ %1 user(s) pending admin approval",
      invalidLink: "⚠️ Invalid profile link - must be direct Facebook profile URL",
      cannotGetUid: "⚠️ Couldn't fetch UID - profile may be private or link incorrect",
      linkNotExist: "⚠️ Profile doesn't exist or can't be accessed",
      cannotAddUser: "⚠️ Couldn't add user - they may restrict group adds or bot is blocked",
      noPermission: "🔒 Bot needs admin rights to add users in this group",
      rateLimit: "⏸️ Pausing due to Facebook rate limits - please wait",
      unexpectedError: "⚠️ An unexpected error occurred. Please try again."
    }
  },

  onStart: async function ({ message, api, event, args, threadsData, getLang }) {
    try {
      const { members, adminIDs, approvalMode } = await threadsData.get(event.threadID);
      const botID = api.getCurrentUserID();
      const isBotAdmin = adminIDs.some(admin => admin.id === botID);

      // If command is a reply, use the sender's UID
      if (event.type === "message_reply") {
        args = [event.messageReply.senderID];
      }

      const results = {
        added: [],
        needsApproval: [],
        failed: []
      };

      // Enhanced Facebook URL pattern matching
      const profilePatterns = [
        /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/(profile\.php\?id=)?([a-zA-Z0-9\.\-]+)(?:\/|$)/i,
        /(?:https?:\/\/)?(?:www\.|m\.)?fb\.com\/(profile\.php\?id=)?([a-zA-Z0-9\.\-]+)(?:\/|$)/i
      ];

      for (const item of args) {
        if (!item) continue;
        
        let uid;
        let identifier = item;

        try {
          // If numeric UID
          if (!isNaN(item)) {
            uid = item;
          } 
          // If Facebook profile URL
          else {
            let profileMatch;
            for (const pattern of profilePatterns) {
              profileMatch = item.match(pattern);
              if (profileMatch) break;
            }

            if (!profileMatch) {
              throw new Error("invalidLink");
            }

            // Extract username/ID from URL
            const profileId = profileMatch[2];
            identifier = `facebook.com/${profileId}`;

            // Get UID with retry logic
            let attempts = 0;
            while (attempts < 3) {
              try {
                uid = await findUid(`https://facebook.com/${profileId}`);
                await sleep(2000);
                break;
              } catch (err) {
                attempts++;
                if (attempts === 3) {
                  if (err.name === "InvalidLink") throw new Error("invalidLink");
                  if (err.name === "CannotGetData") throw new Error("cannotGetUid");
                  if (err.name === "LinkNotExist") throw new Error("linkNotExist");
                  throw new Error("cannotAddUser");
                }
                await sleep(3000);
              }
            }
          }

          // Check if already in group
          if (members.some(m => m.userID === uid && m.inGroup)) {
            throw new Error("alreadyInGroup");
          }

          // Attempt to add user
          try {
            await api.addUserToGroup(uid, event.threadID);
            
            if (approvalMode && !isBotAdmin) {
              results.needsApproval.push(identifier);
            } else {
              results.added.push(identifier);
            }
          } catch (err) {
            console.error("Add User Error:", err);
            if (err.message.includes("rate limit")) {
              await sleep(30000);
              throw new Error("rateLimit");
            }
            throw new Error("cannotAddUser");
          }

        } catch (error) {
          results.failed.push({
            identifier,
            reason: getLang(error.message) || getLang("unexpectedError")
          });
          
          if (error.message === "rateLimit") {
            await sleep(30000);
          }
        }
      }

      // Generate comprehensive result message
      let replyMsg = "";
      
      if (results.added.length) {
        replyMsg += getLang("successAdd", results.added.length) + "\n";
        if (results.added.length <= 5) {
          replyMsg += `› ${results.added.join("\n› ")}\n\n`;
        }
      }
      
      if (results.needsApproval.length) {
        replyMsg += getLang("approve", results.needsApproval.length) + "\n";
        if (results.needsApproval.length <= 5) {
          replyMsg += `› ${results.needsApproval.join("\n› ")}\n\n`;
        }
      }
      
      if (results.failed.length) {
        replyMsg += getLang("failedAdd", results.failed.length) + "\n";
        results.failed.slice(0, 5).forEach(fail => {
          replyMsg += `› ${fail.identifier}: ${fail.reason}\n`;
        });
        if (results.failed.length > 5) {
          replyMsg += `› ...and ${results.failed.length - 5} more\n`;
        }
      }

      await message.reply(replyMsg || getLang("unexpectedError"));
    } catch (error) {
      console.error("Command Error:", error);
      await message.reply(getLang("unexpectedError"));
    }
  }
};
