const { findUid } = global.utils;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
	config: {
		name: "adduser",
		aliases:["add"],
		version: "1.4",
		author: "NTKhang",
		countDown: 5,
		role: 1,
		shortDescription: {
			vi: "Thêm thành viên vào box chat",
			en: "Add user to box chat"
		},
		longDescription: {
			vi: "Thêm thành viên vào box chat của bạn",
			en: "Add user to box chat of you"
		},
		category: "𝗚𝗥𝗢𝗨𝗣 𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧",
		guide: {
			en: "   {pn} [link profile | uid] (or reply to a message)"
		}
	},

	langs: {
		vi: {
			alreadyInGroup: "Đã có trong nhóm",
			successAdd: "- Đã thêm thành công %1 thành viên vào nhóm",
			failedAdd: "- Không thể thêm %1 thành viên vào nhóm",
			approve: "- Đã thêm %1 thành viên vào danh sách phê duyệt",
			invalidLink: "Vui lòng nhập link facebook hợp lệ",
			cannotGetUid: "Không thể lấy được uid của người dùng này",
			linkNotExist: "Profile url này không tồn tại",
			cannotAddUser: "Bot bị chặn tính năng hoặc người dùng này chặn người lạ thêm vào nhóm"
		},
		en: {
			alreadyInGroup: "Already in group",
			successAdd: "- Successfully added %1 members to the group",
			failedAdd: "- Failed to add %1 members to the group",
			approve: "- Added %1 members to the approval list",
			invalidLink: "Please enter a valid facebook link",
			cannotGetUid: "Cannot get uid of this user",
			linkNotExist: "This profile url does not exist",
			cannotAddUser: "Bot is blocked or this user blocked strangers from adding to the group"
		}
	},

	onStart: async function ({ message, api, event, args, threadsData, getLang }) {
		const { members, adminIDs, approvalMode } = await threadsData.get(event.threadID);
		const botID = api.getCurrentUserID();

		// যদি কেউ মেসেজ রিপ্লাই দিয়ে কমান্ড চালায়, তাহলে রিপ্লাই করা ইউজারের UID নেওয়া হবে
		if (event.type == "message_reply") {
			args = [event.messageReply.senderID]; // আগের আর্গুমেন্ট মুছে শুধুমাত্র রিপ্লাই করা ইউজারের UID নেওয়া হবে
		}

		const success = [
			{
				type: "success",
				uids: []
			},
			{
				type: "waitApproval",
				uids: []
			}
		];
		const failed = [];

		function checkErrorAndPush(messageError, item) {
			item = item.replace(/(?:https?:\/\/)?(?:www\.)?(?:facebook|fb|m\.facebook)\.(?:com|me)/i, '');
			const findType = failed.find(error => error.type == messageError);
			if (findType)
				findType.uids.push(item);
			else
				failed.push({
					type: messageError,
					uids: [item]
				});
		}

		const regExMatchFB = /(?:https?:\/\/)?(?:www\.)?(?:facebook|fb|m\.facebook)\.(?:com|me)\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[\w\-]*\/)*([\w\-\.]+)(?:\/)?/i;
		for (const item of args) {
			let uid;
			let continueLoop = false;

			if (isNaN(item) && regExMatchFB.test(item)) {
				for (let i = 0; i < 10; i++) {
					try {
						uid = await findUid(item);
						break;
					}
					catch (err) {
						if (err.name == "SlowDown" || err.name == "CannotGetData") {
							await sleep(1000);
							continue;
						}
						else if (i == 9 || (err.name != "SlowDown" && err.name != "CannotGetData")) {
							checkErrorAndPush(
								err.name == "InvalidLink" ? getLang('invalidLink') :
									err.name == "CannotGetData" ? getLang('cannotGetUid') :
										err.name == "LinkNotExist" ? getLang('linkNotExist') :
											err.message,
								item
							);
							continueLoop = true;
							break;
						}
					}
				}
			}
			else if (!isNaN(item))
				uid = item;
			else
				continue;

			if (continueLoop == true)
				continue;

			if (members.some(m => m.userID == uid && m.inGroup)) {
				checkErrorAndPush(getLang("alreadyInGroup"), item);
			}
			else {
				try {
					await api.addUserToGroup(uid, event.threadID);
					if (approvalMode === true && !adminIDs.includes(botID))
						success[1].uids.push(uid);
					else
						success[0].uids.push(uid);
				}
				catch (err) {
					checkErrorAndPush(getLang("cannotAddUser"), item);
				}
			}
		}

		const lengthUserSuccess = success[0].uids.length;
		const lengthUserWaitApproval = success[1].uids.length;
		const lengthUserError = failed.length;

		let msg = "";
		if (lengthUserSuccess)
			msg += `${getLang("successAdd", lengthUserSuccess)}\n`;
		if (lengthUserWaitApproval)
			msg += `${getLang("approve", lengthUserWaitApproval)}\n`;
		if (lengthUserError)
			msg += `${getLang("failedAdd", failed.reduce((a, b) => a + b.uids.length, 0))} ${failed.reduce((a, b) => a += `\n    + ${b.uids.join('\n       ')}: ${b.type}`, "")}`;
		await message.reply(msg);
	}
};
