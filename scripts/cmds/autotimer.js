(cmd install autotime.js module.exports = {
  config: {
    name: "dhakatime",
    version: "4.0",
    role: 0,
    author: "𝗦𝗵𝗔𝗻",
    description: "২৪/৭ ঢাকা সময় ও নামাজের রিমাইন্ডার (চালু/বন্ধ করা যায়)",
    category: "𝗢𝗪𝗡𝗘𝗥",
    countDown: 5,
    guide: "{p}dhakatime [on|off|status] - টগল করুন"
  },

  onStart: async function ({ message, event, args, api }) {
    const action = args[0]?.toLowerCase();
    const { threadID } = event;

    // Initialize with persistent storage
    if (!global.dhakaTime) {
      global.dhakaTime = {
        activeThreads: [],
        disabledThreads: [],
        intervals: {},
        apiInstance: api
      };
    }

    const timeData = global.dhakaTime;

    switch (action) {
      case "on":
        if (timeData.activeThreads.includes(threadID)) {
          return message.reply("🔴 ইতিমধ্যেই এই চ্যাটে চালু আছে!");
        }
        
        // Remove from disabled list if present
        timeData.disabledThreads = timeData.disabledThreads.filter(id => id !== threadID);
        
        timeData.activeThreads.push(threadID);
        startTimeUpdates(threadID, api);
        message.reply("🟢 ২৪/৭ ঢাকা সময় রিমাইন্ডার চালু হলো!");
        break;

      case "off":
        if (!timeData.activeThreads.includes(threadID)) {
          return message.reply("🔴 এই চ্যাটে চালু ছিল না!");
        }
        
        timeData.activeThreads = timeData.activeThreads.filter(id => id !== threadID);
        timeData.disabledThreads.push(threadID);
        clearInterval(timeData.intervals[threadID]);
        delete timeData.intervals[threadID];
        message.reply("🔴 সময় রিমাইন্ডার বন্ধ করা হলো!");
        break;

      case "status":
        const status = timeData.activeThreads.includes(threadID) 
          ? "🟢 চালু" 
          : "🔴 বন্ধ";
        message.reply(`📊 বর্তমান অবস্থা: ${status}\n\n"${getRandomQuote()}"`);
        break;

      default:
        message.reply("⚙️ ব্যবহার:\n" +
          "• dhakatime on - চালু করুন\n" +
          "• dhakatime off - বন্ধ করুন\n" +
          "• dhakatime status - অবস্থা দেখুন");
    }
  },

  onLoad: function ({ api }) {
    // Initialize or restore state
    if (!global.dhakaTime) {
      global.dhakaTime = {
        activeThreads: [],
        disabledThreads: [],
        intervals: {},
        apiInstance: api
      };
    } else {
      // Restore API instance after restart
      global.dhakaTime.apiInstance = api;
      
      // Restart updates for active threads
      global.dhakaTime.activeThreads.forEach(threadID => {
        if (!global.dhakaTime.disabledThreads.includes(threadID)) {
          startTimeUpdates(threadID, api);
        }
      });
    }
  }
};

// ========================
// CORE FUNCTIONALITY
// ========================

function startTimeUpdates(threadID, api) {
  // Clear existing interval
  if (global.dhakaTime.intervals[threadID]) {
    clearInterval(global.dhakaTime.intervals[threadID]);
  }

  // Send immediately
  sendTimeUpdate(threadID, api);

  // Set hourly interval
  global.dhakaTime.intervals[threadID] = setInterval(() => {
    sendTimeUpdate(threadID, api);
  }, 3600000); // 1 hour
}

async function sendTimeUpdate(threadID, api) {
  try {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTotal = hours * 60 + minutes;

    // Skip if thread is disabled
    if (global.dhakaTime.disabledThreads.includes(threadID)) return;

    // Get prayer info
    const { nextPrayer } = await getPrayerInfo(currentTotal);
    const banglaTime = formatBanglaTime(hours, minutes);

    // Compose message
    let message = `🕌 ঢাকা সময়: ${banglaTime}\n\n`;

    // Add prayer reminder if within 30 minutes
    if (nextPrayer.remaining <= 30) {
      message += `⏳ পরবর্তী নামাজ: ${nextPrayer.name} (${nextPrayer.time})\n`;
      message += `📿 ${getPrayerReminder(nextPrayer.name)}\n\n`;
    }

    // Add time-specific message
    message += `${getTimeMessage(hours)}\n\n`;
    message += `"${getRandomQuote()}"\n`;
    message += `▬▬▬▬▬▬▬▬▬▬▬▬`;

    // Send message
    await api.sendMessage(message, threadID);
  } catch (err) {
    console.error("আপডেট পাঠাতে ব্যর্থ:", err);
  }
}

// ========================
// HELPER FUNCTIONS
// ========================

async function getPrayerInfo(currentTotal) {
  // Sample prayer times (replace with API)
  const prayers = [
    { name: "ফজর", time: "5:30" },
    { name: "যোহর", time: "12:15" },
    { name: "আসর", time: "15:45" },
    { name: "মাগরিব", time: "18:15" },
    { name: "ইশা", time: "19:45" }
  ];

  // Convert to minutes and find next prayer
  let nextPrayer = null;
  for (const prayer of prayers) {
    const [h, m] = prayer.time.split(':').map(Number);
    const prayerTotal = h * 60 + m;
    
    if (prayerTotal > currentTotal) {
      nextPrayer = {
        name: prayer.name,
        time: format12Hour(h, m),
        remaining: prayerTotal - currentTotal
      };
      break;
    }
  }

  // If no prayer left today, use tomorrow's Fajr
  return { 
    nextPrayer: nextPrayer || {
      name: "ফজর",
      time: "5:30 AM",
      remaining: (24*60 - currentTotal) + (5*60 + 30)
    }
  };
}

function formatBanglaTime(hours, minutes) {
  const banglaNumbers = ["১২", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯", "১০", "১১"];
  const banglaHour = hours % 12 || 12;
  const period = hours >= 12 ? "অপরাহ্ণ" : "পূর্বাহ্ণ";
  return `${banglaNumbers[banglaHour]}টা ${minutes.toString().padStart(2, '0')}মিনিট ${period}`;
}

function format12Hour(hours, minutes) {
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function getPrayerReminder(prayerName) {
  const reminders = {
    "ফজর": "ফজরের আজানের প্রস্তুতি নিন, তাহাজ্জুদ পড়ার শেষ সুযোগ",
    "যোহর": "যোহরের নামাজ পড়ুন, দুপুরের খাবারের আগে",
    "আসর": "আসরের নামাজ পড়ুন, দিনের শেষ প্রহরে",
    "মাগরিব": "মাগরিবের নামাজ পড়ুন, সূর্যাস্তের পরপরই",
    "ইশা": "ইশার নামাজ পড়ে রাত্রি যাপন করুন"
  };
  return reminders[prayerName] || "নামাজের সময় হয়েছে";
}

function getTimeMessage(hours) {
  const messages = {
    0: "🌃 মধ্যরাত: তাহাজ্জুদ পড়ার উত্তম সময়",
    1: "🌜 রাত ১টা: আল্লাহর জিকির করুন",
    2: "🌠 রাত ২টা: কুরআন তেলাওয়াত করুন",
    3: "🌌 রাত ৩টা: ফজরের প্রস্তুতি নিন",
    4: "🌄 রাত ৪টা: শেষ রাতের দোয়া কবুলের সময়",
    5: "🌅 ভোর ৫টা: ফজরের আজান হলো",
    6: "🌞 সকাল ৬টা: ইশরাকের নামাজ পড়ুন",
    7: "☀️ সকাল ৭টা: নাস্তা সেরে দিন শুরু করুন",
    8: "⏰ সকাল ৮টা: কর্মব্যস্ত দিনের শুরু",
    9: "💼 সকাল ৯টা: কাজে মনোযোগ দিন",
    10: "🏢 সকাল ১০টা: গুরুত্বপূর্ণ মিটিং এর সময়",
    11: "☕ সকাল ১১টা: ছোট বিরতি নিন",
    12: "🕛 দুপুর ১২টা: যোহরের নামাজের প্রস্তুতি",
    13: "🍽️ দুপুর ১টা: লাঞ্চের পর বিশ্রাম নিন",
    14: "🕑 দুপুর ২টা: কাজে ফিরুন",
    15: "🕒 বিকাল ৩টা: আসরের নামাজের সময় আসছে",
    16: "🏫 বিকাল ৪টা: স্কুল ছুটির সময়",
    17: "🚗 বিকাল ৫টা: বাড়ি ফেরার প্রস্তুতি নিন",
    18: "🌆 সন্ধ্যা ৬টা: মাগরিবের আজান হলো",
    19: "🕖 সন্ধ্যা ৭টা: ইশার নামাজের প্রস্তুতি",
    20: "🌃 রাত ৮টা: পরিবারের সাথে সময় কাটান",
    21: "📖 রাত ৯টা: কুরআন তেলাওয়াত করুন",
    22: "🛌 রাত ১০টা: ঘুমানোর প্রস্তুতি নিন",
    23: "🌙 রাত ১১টা: শীঘ্রই ঘুমান"
  };
  return messages[hours] || "আল্লাহর স্মরণে সময় কাটান";
}

function getRandomQuote() {
  const quotes = [
    "নামাজই মুমিনের মিরাজ",
    "সময় আল্লাহর নিয়ামত, অপচয় করো না",
    "যে নামাজের হিফাজত করে, নামাজ তাকে সব অশ্লীল কাজ থেকে হিফাজত করে",
    "সবচেয়ে ভালো আমল হলো সময় মতো নামাজ পড়া",
    "কুরআন তেলাওয়াত করুন, এটি হৃদয়ের প্রশান্তি আনে"
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}
