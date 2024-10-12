const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize Discord bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// Environment variables for tokens
const discordToken = process.env.DISCORD_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

// OpenAI configuration
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Upgrade link
const UPGRADE_LINK = 'https://www.patreon.com/craftycodeai/membership'; // Replace with your actual upgrade link

// Function to handle OpenAI Assistant interactions
async function useAssistant(assistantId, question) {
  try {
    console.log(`Sending question to OpenAI Assistant ${assistantId}: ${question}`);
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question
    });
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    let runStatus;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    } while (runStatus.status !== "completed");

    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessageForRun = messages.data
      .filter(message => message.run_id === run.id && message.role === "assistant")
      .pop();
      
    console.log(lastMessageForRun.content[0].text.value);
    return lastMessageForRun.content[0].text.value;
  } catch (error) {
    console.error("Error using assistant:", error);
    return "Sorry, something went wrong while processing your request.";
  }
}

// Assistant functions
const assistants = {
  java: async (question) => useAssistant("input your openai assistant id here", question),
  skript: async (question) => useAssistant("input your openai assistant id here", question),
  commandblock: async (question) => useAssistant("input your openai assistant id here", question),
  superhero: async (question) => useAssistant("input your openai assistant id here", question),
  html: async (question) => useAssistant("input your openai assistant id here", question),
  python: async (question) => useAssistant("input your openai assistant id here", question),
};

// Usage tracking
const userUsage = new Map();
const DAILY_LIMIT_NORMAL = 20;
const DAILY_LIMIT_PREMIUM = 100;
const DAILY_LIMIT_BOOSTER = 30;
const PREMIUM_ROLE_NAME = 'Premium';
const SERVER_BOOSTER_ROLE_NAME = 'Server Booster';

// New Map to track invitation rewards
const invitationRewards = new Map();

// New Set to track invited users
const invitedUsers = new Set();

// ID of the channel where join messages are sent
const JOIN_CHANNEL_ID = 'Join channel id goes here';

// Track the last reset time
let lastResetTime = Date.now();

// Function to save invited users to a file
function saveInvitedUsers() {
  fs.writeFileSync('invitedUsers.json', JSON.stringify([...invitedUsers]));
}

// Function to load invited users from a file
function loadInvitedUsers() {
  try {
    if (fs.existsSync('invitedUsers.json')) { //make the json file for invite rewards
      const data = fs.readFileSync('invitedUsers.json', 'utf8');
      if (data.trim() !== '') {
        const loadedUsers = JSON.parse(data);
        invitedUsers.clear();
        loadedUsers.forEach(user => invitedUsers.add(user));
      } else {
        console.log('invitedUsers.json is empty. Starting with an empty set.');
      }
    } else {
      console.log('invitedUsers.json does not exist. Starting with an empty set.');
    }
  } catch (error) {
    console.error('Error loading invited users:', error);
    console.log('Starting with an empty set of invited users.');
  }
}

// Load invited users when the bot starts
loadInvitedUsers();

// Function to calculate the time until the next reset
function getTimeUntilReset() {
  const currentTime = Date.now();
  const nextResetTime = lastResetTime + 24 * 60 * 60 * 1000;
  const timeUntilReset = nextResetTime - currentTime;
  const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
  const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} hours and ${minutes} minutes`;
}

// Reset usage daily
function resetUsage() {
  userUsage.clear();
  lastResetTime = Date.now();
}

// Set interval to reset usage daily
setInterval(resetUsage, 24 * 60 * 60 * 1000);

function incrementUsage(userId) {
  const usage = userUsage.get(userId) || 0;
  userUsage.set(userId, usage + 1);
}

function checkUsageLimit(member) {
  const usage = userUsage.get(member.id) || 0;
  let limit = DAILY_LIMIT_NORMAL;
  let userType = 'Normal';

  if (member.roles.cache.some(role => role.name === PREMIUM_ROLE_NAME)) {
    limit = DAILY_LIMIT_PREMIUM;
    userType = 'Premium';
  } else if (member.roles.cache.some(role => role.name === SERVER_BOOSTER_ROLE_NAME)) {
    limit = DAILY_LIMIT_BOOSTER;
    userType = 'Server Booster';
  }

  // Add invitation rewards
  const rewardedRequests = invitationRewards.get(member.id) || 0;
  limit += rewardedRequests;

  return { withinLimit: usage < limit, usage, limit, userType, rewardedRequests };
}

function removeCodeFormatting(code) {
  return code
    .replace(/```(?:java|vb|html|css|python|javascript|js)?/g, '')
    .replace(/\nhttps:\/\/html\.onlineviewer\.net\/\s*$/, '')
    .trim();
}

// Help command function
function sendHelpMessage(message) {
  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('Bot Commands')
    .setDescription('Here are the available commands:')
    .addFields(
      { name: '!usage', value: 'Check your current usage statistics' },
      { name: '!help', value: 'Display this help message' },
      { name: '!ping', value: 'Check if the bot is responsive' },
      { name: '!createchannel', value: 'Create a private channel for premium users' },
      { name: '!java <question>', value: 'Ask a Java-related question' },
      { name: '!HTML <question>', value: 'Ask a HTML-related question' },
      { name: '!python <question>', value: 'Ask a python-related question' },
      { name: '!skript <question>', value: 'Ask a Skript-related question' },
      { name: '!commandblock <question>', value: 'Ask a Minecraft Command Block-related question' },
      { name: '!superhero <question>', value: 'Create config files for the Minecraft superheroes plugin (Premium only)' },
      { name: '!inviterewards', value: 'Check your current invitation rewards' },
      { name: 'Reply to Bot Messages', value: 'You can reply to the bot\'s messages, including files sent for long responses, to maintain context.' }
    )
    .setFooter({ text: 'Use ! followed by a command' });

  message.reply({ embeds: [embed] });
}

// Create upgrade button
function createUpgradeButton() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Upgrade to Premium')
        .setURL(UPGRADE_LINK)
    );
}

// Function to save long content to a file and send it
async function sendAsFile(message, content) {
  const fileName = `response_${Date.now()}.txt`;
  fs.writeFileSync(fileName, content);
  const attachment = new AttachmentBuilder(fileName);
  const replyMessage = await message.reply({ files: [attachment], components: [createUpgradeButton()] });
  fs.unlinkSync(fileName); // Delete the file after sending it
  return replyMessage; // Return the message with the attachment
}

// Map to track AI responses
const aiResponses = new Map();

// When the bot is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Handle new member joins
client.on('guildMemberAdd', async (member) => {
  try {
    console.log(`New member joined: ${member.user.tag}`);

    if (invitedUsers.has(member.id)) {
      console.log(`${member.user.tag} has joined before. No reward given.`);
      return;
    }

    const channel = await member.guild.channels.fetch(JOIN_CHANNEL_ID);
    if (!channel) {
      console.error(`Join channel with ID ${JOIN_CHANNEL_ID} not found`);
      return;
    }

    console.log('Waiting for join message...');
    const filter = m => m.content.includes(`Welcome <@${member.id}>!`);
    const collected = await channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
    const joinMessage = collected.first();

    if (joinMessage) {
      console.log('Join message found:', joinMessage.content);
      const inviterMatch = joinMessage.content.match(/\(Invited by (.+?)\)/);
      if (inviterMatch) {
        const inviterMention = inviterMatch[1];
        console.log(`Inviter mention extracted: ${inviterMention}`);
        
        // Extract user ID from mention
        const inviterIdMatch = inviterMention.match(/<@!?(\d+)>/);
        if (inviterIdMatch) {
          const inviterId = inviterIdMatch[1];
          console.log(`Inviter ID extracted: ${inviterId}`);
          
          try {
            const inviter = await member.guild.members.fetch(inviterId);
            
            if (inviter) {
              console.log(`Inviter found: ${inviter.user.tag}`);
              const currentReward = invitationRewards.get(inviter.id) || 0;
              invitationRewards.set(inviter.id, currentReward + 5);
              
              invitedUsers.add(member.id);
              saveInvitedUsers();

              await channel.send(`Congratulations ${inviter}! You've earned 5 extra requests for inviting ${member}. Your total extra requests: ${currentReward + 5}`);
              console.log(`Reward given to ${inviter.user.tag}`);
            } else {
              console.log(`Inviter with ID ${inviterId} not found in the server.`);
            }
          } catch (fetchError) {
            console.error('Error fetching inviter:', fetchError);
          }
        } else {
          console.log('Could not extract inviter ID from mention.');
        }
      } else {
        console.log('Could not extract inviter mention from join message.');
      }
    } else {
      console.log('No join message found within the time limit.');
    }
  } catch (error) {
    console.error('Error handling member join:', error);
  }
});
// Handle messages
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  console.log(`Received command: ${command}`);

  try {
    if (command === '' || command === 'help') {
      sendHelpMessage(message);
    } else if (command === 'ping') {
      await message.reply('Pong!');
    } else if (['java', 'skript', 'commandblock', 'superhero', 'html', 'python'].includes(command)) {
      // Check usage limit
      const { withinLimit, usage, limit, userType, rewardedRequests } = checkUsageLimit(message.member);
      if (!withinLimit) {
        const timeUntilReset = getTimeUntilReset();
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Usage Limit Reached')
          .setDescription(`You've reached your daily limit of ${limit} requests. The limit resets every 24 hours.`)
          .addFields(
            { name: 'Current Usage', value: `${usage}/${limit}` },
            { name: 'Time Until Reset', value: `Your usage limit will reset in ${timeUntilReset}.` },
            { name: 'Your Plan', value: `You are on the ${userType} plan.` },
            { name: 'Invitation Rewards', value: `You have ${rewardedRequests} extra requests from invitations.` },
            { name: 'Upgrade', value: userType === 'Normal' ? 'Consider upgrading to our premium plan for a higher usage limit!' : 'You are on an enhanced plan with a higher usage limit.' }
          )
          .setFooter({ text: 'Usage resets daily' });
        await message.reply({ embeds: [embed], components: userType === 'Normal' ? [createUpgradeButton()] : [] });
        return;
      }

      if (command === 'superhero' && !message.member.roles.cache.some(role => [PREMIUM_ROLE_NAME].includes(role.name))) {
        await message.reply('You need to be a premium user or a server booster to use the !superhero command. Consider upgrading or boosting the server to access this feature.');
        return;
      }

      const question = args.join(' ');
      if (!question) {
        await message.reply(`Please provide a ${command} question or task.`);
        return;
      }

      let contextMessage = question;

      // Check if the message is a reply to the bot
      if (message.reference) {
        const referenceMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (referenceMessage.author.id === client.user.id) {
          if (aiResponses.has(referenceMessage.id)) {
            contextMessage = aiResponses.get(referenceMessage.id) + "\n" + question;
          } else if (referenceMessage.attachments.size > 0) {
            const attachment = referenceMessage.attachments.first();
            const attachmentContent = fs.readFileSync(attachment.url, 'utf8');
            contextMessage = attachmentContent + "\n" + question;
          }
        }
      }

      const replyMessage = await message.reply('Processing your request...');

      try {
        // Increment usage before making the API call
        incrementUsage(message.author.id);

        const answer = await assistants[command](contextMessage);

        if (answer.length > 2000) {
          const cleanedAnswer = removeCodeFormatting(answer);
          const fileReplyMessage = await sendAsFile(message, cleanedAnswer);
          aiResponses.set(fileReplyMessage.id, cleanedAnswer);
          await replyMessage.delete(); // Delete the "Processing your request..." message
        } else {
          await replyMessage.edit({ content: answer, components: [createUpgradeButton()] });
          aiResponses.set(replyMessage.id, answer);
        }
      } catch (error) {
        console.error(error);
        await replyMessage.edit('Sorry, something went wrong.');
      }
    } else if (command === 'usage') {
      const { usage, limit, userType, rewardedRequests } = checkUsageLimit(message.member);
      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('Your Usage Statistics')
        .setDescription(`Here's your current usage for today:`)
        .addFields(
          { name: 'Requests Used', value: `${usage}/${limit}` },
          { name: 'Requests Remaining', value: `${Math.max(0, limit - usage)}` },
          { name: 'Your Plan', value: userType },
          { name: 'Invitation Rewards', value: `You have ${rewardedRequests} extra requests from invitations.` }
        )
        .setFooter({ text: 'Usage resets daily' });
      await message.reply({ embeds: [embed], components: userType === 'Normal' ? [createUpgradeButton()] : [] });
    } else if (command === 'createchannel') {
      if (message.member.roles.cache.some(role => [PREMIUM_ROLE_NAME].includes(role.name))) {
        const categoryID = '1265378793950810265'; // Change this to your actual category ID
        const channelName = `private-${message.author.username}`;
        try {
          const channel = await message.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryID,
            permissionOverwrites: [
              {
                id: message.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
              {
                id: message.author.id,
                allow: [PermissionsBitField.Flags.ViewChannel],
              },
            ],
          });
          await message.reply(`Your private channel has been created: ${channel}`);
        } catch (error) {
          console.error('Error creating private channel:', error);
          await message.reply('An error occurred while creating the private channel.');
        }
      } else {
        await message.reply('You need to be a premium user or a server booster to create a private channel.');
      }
    } else if (command === 'inviterewards') {
      const rewardedRequests = invitationRewards.get(message.author.id) || 0;
      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('Your Invitation Rewards')
        .setDescription(`You have earned ${rewardedRequests} extra requests from invitations.`)
        .addFields(
          { name: 'How to earn more', value: 'Invite more people to the server using the server\'s invite link!' },
          { name: 'Note', value: 'You only earn rewards for inviting new members who haven\'t joined before.' }
        )
        .setFooter({ text: 'Keep inviting to earn more rewards!' });
      await message.reply({ embeds: [embed] });
    } else {
      await message.reply("I don't recognize that command. Type !help for a list of available commands.");
    }
  } catch (error) {
    console.error('Error handling command:', error);
    await message.reply('An error occurred while processing the command.');
  }
});

// Login to Discord
client.login(discordToken);
