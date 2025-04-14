const axios = require("axios");
const fs = require("fs-extra");

module.exports = {
  config: {
    name: "join",
    version: "2.3",
    author: "𝗦𝗵𝗔𝗻",
    countDown: 5,
    role: 2,
    shortDescription: "Join/leave groups where bot is present",
    longDescription: "View and manage groups the bot is in - join groups or remove the bot",
    category: "𝗢𝗪𝗡𝗘𝗥",
    guide: {
      en: "{p}join - view groups\n{p}join [number] - join group\n{p}join out[number] - remove bot",
    },
  },

  onStart: async function ({ api, event, args }) {
    try {
      // Get the first 100 groups (increased from 10)
      const groupList = await api.getThreadList(100, null, ['INBOX']);
      
      if (!groupList || groupList.length === 0) {
        return api.sendMessage('❌ No group chats found.', event.threadID);
      }

      // Process group list with better formatting
      const formattedList = groupList
        .filter(group => group.isGroup)
        .map((group, index) => {
          const groupName = group.threadName || "𝗨𝗻𝗻𝗮𝗺𝗲𝗱 𝗚𝗿𝗼𝘂𝗽";
          const memberCount = group.participantIDs?.length || "Unknown";
          const isMember = group.participantIDs?.includes(event.senderID);
          
          return `[${index + 1}] ${groupName}
  ┣ 𝗜𝗗: ${group.threadID}
  ┣ 𝗠𝗲𝗺𝗯𝗲𝗿𝘀: ${memberCount}
  ┗ 𝗬𝗼𝘂𝗿 𝗦𝘁𝗮𝘁𝘂𝘀: ${isMember ? "✅ Joined" : "❌ Not Joined"}`;
        });

      // Check if command was called with arguments
      if (args[0]) {
        return this.handleJoinRequest(api, event, args[0], groupList);
      }

      // Show group list if no arguments
      const message = `📋 𝗚𝗿𝗼𝘂𝗽 𝗟𝗶𝘀𝘁 (${formattedList.length} groups)\n\n` +
        formattedList.join("\n\n") +
        `\n\n𝗥𝗲𝗽𝗹𝘆 𝘄𝗶𝘁𝗵:\n` +
        `• ${this.config.guide.en.replace(/\{p\}/g, this.config.prefix)}\n` +
        `• "out[number]" to remove bot (e.g., out1)`;

      await api.sendMessage(message, event.threadID);

    } catch (error) {
      console.error("Error in join command:", error);
      api.sendMessage('❌ An error occurred. Please try again later.', event.threadID);
    }
  },

  handleJoinRequest: async function (api, event, arg, groupList) {
    try {
      // Handle leave request (outX)
      if (/^out\d+$/i.test(arg)) {
        const groupIndex = parseInt(arg.match(/\d+/)[0], 10) - 1;
        
        if (groupIndex < 0 || groupIndex >= groupList.length) {
          return api.sendMessage('⚠️ Invalid group number.', event.threadID);
        }

        const group = groupList[groupIndex];
        await this.confirmLeave(api, event, group);
        return;
      }

      // Handle join request
      const groupIndex = parseInt(arg, 10) - 1;
      
      if (isNaN(groupIndex) || groupIndex < 0 || groupIndex >= groupList.length) {
        return api.sendMessage('⚠️ Invalid group number.', event.threadID);
      }

      const group = groupList[groupIndex];
      await this.joinGroup(api, event, group);

    } catch (error) {
      console.error("Error handling join request:", error);
      api.sendMessage('❌ Failed to process your request.', event.threadID);
    }
  },

  joinGroup: async function (api, event, group) {
    try {
      const groupID = group.threadID;
      const groupName = group.threadName || "Unnamed Group";
      const userID = event.senderID;

      // Check if user is already in group
      const threadInfo = await api.getThreadInfo(groupID);
      if (threadInfo.participantIDs.includes(userID)) {
        return api.sendMessage(`ℹ️ You're already in "${groupName}"`, event.threadID);
      }

      // Check group capacity
      if (threadInfo.participantIDs.length >= 250) {
        return api.sendMessage(`⚠️ "${groupName}" is full (250/250 members)`, event.threadID);
      }

      // Try to add user
      await api.addUserToGroup(userID, groupID);
      return api.sendMessage(`✅ Joined "${groupName}"`, event.threadID);

    } catch (error) {
      console.error("Join error:", error);
      
      let errorMessage = `❌ Failed to join group.`;
      if (error.errorDescription) {
        if (error.errorDescription.includes("permission")) {
          errorMessage += "\nBot lacks permission to add members.";
        } else if (error.errorDescription.includes("approval")) {
          errorMessage += "\nJoin request sent - waiting for admin approval.";
        }
      }

      api.sendMessage(errorMessage, event.threadID);
    }
  },

  confirmLeave: async function (api, event, group) {
    try {
      const groupName = group.threadName || "Unnamed Group";
      const confirmMessage = await api.sendMessage(
        `⚠️ Are you sure you want to remove the bot from "${groupName}"?\n` +
        `React with 😾 to confirm or 🙀 to cancel.`,
        event.threadID
      );

      // Set up reaction handler
      global.GoatBot.onReaction.set(confirmMessage.messageID, {
        commandName: this.config.name,
        messageID: confirmMessage.messageID,
        author: event.senderID,
        groupToLeave: group
      });

    } catch (error) {
      console.error("Confirm leave error:", error);
      api.sendMessage("❌ Failed to process leave request.", event.threadID);
    }
  },

  onReaction: async function ({ api, event, Reaction }) {
    if (!Reaction || event.userID !== Reaction.author) return;

    try {
      const { groupToLeave, messageID } = Reaction;
      const groupName = groupToLeave.threadName || "Unnamed Group";

      // Check reaction type
      if (event.reaction === "😾") {
        // Leave the group
        await api.sendMessage(`👋 Goodbye! Bot is leaving by admin request.`, groupToLeave.threadID);
        await api.removeUserFromGroup(api.getCurrentUserID(), groupToLeave.threadID);
        await api.sendMessage(`✅ Bot has left "${groupName}"`, event.threadID);
      } else if (event.reaction === "🙀") {
        await api.sendMessage(`❌ Leave request canceled for "${groupName}"`, event.threadID);
      }

      // Clean up
      global.GoatBot.onReaction.delete(messageID);

    } catch (error) {
      console.error("Reaction handler error:", error);
      api.sendMessage("❌ Failed to process reaction.", event.threadID);
    }
  }
};
