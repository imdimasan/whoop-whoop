# 🤖 Whoop Whoop Telegram Moderation Bot

An AI-powered Telegram moderation bot that uses OpenAI to automatically detect and handle inappropriate content in group chats.

## ✨ Features

- **AI-Powered Moderation**: Uses OpenAI's moderation API and GPT for content analysis
- **Automatic Actions**: Delete messages, mute users, or ban users based on violation severity
- **Warning System**: Progressive warnings before taking stronger action
- **Admin Commands**: Manage settings, view statistics, and control moderation
- **Flexible Configuration**: Customizable warning limits and mute durations

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Telegram Bot Token (from @BotFather)
- OpenAI API Key

### 2. Installation

```bash
# Clone or download this project
cd whoop-whoop

# Install dependencies (already done)
npm install

# Run the setup wizard
npm run setup
```

### 3. Configuration

The setup wizard will ask for:

- **Telegram Bot Token**: Get from @BotFather on Telegram
- **OpenAI API Key**: Get from https://platform.openai.com/api-keys
- **Bot Username**: Your bot's username (default: whoop_whoop_bot)
- **Max Warnings**: Number of warnings before escalation (default: 3)
- **Mute Duration**: How long to mute users in minutes (default: 5)

### 4. Running the Bot

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run start:prod

# Or build and run separately
npm run build
npm start
```

## 🔧 Bot Setup in Telegram

1. **Add bot to your group**:

   - Search for your bot by username
   - Add it to your group

2. **Make bot an administrator**:

   - Go to group settings → Administrators
   - Add your bot as admin
   - **Required permissions**:
     - ✅ Delete messages
     - ✅ Restrict members
     - ✅ Ban users (optional, for severe violations)

3. **Test the bot**:
   - Send `/start` in the group
   - Send `/help` to see available commands

## 📋 Available Commands

- `/start` - Initialize the bot
- `/help` - Show help message
- `/stats` - View moderation statistics
- `/settings` - Configure bot settings (admin only)
- `/warnings` - Check user warnings (reply to message)
- `/clearwarnings` - Clear user warnings (admin only, reply to message)

## ⚙️ How It Works

1. **Message Analysis**: Every message is analyzed by OpenAI for:

   - Spam content
   - Inappropriate language
   - Hate speech
   - Harassment
   - Scams and phishing

2. **Action Levels**:

   - **Low severity**: Warning + message deletion
   - **Medium severity**: Temporary mute
   - **High severity**: Permanent ban

3. **Warning System**:
   - Users get warnings for violations
   - After max warnings (default: 3), stronger action is taken
   - Warnings are tracked per user

## 🔒 Security & Privacy

- Bot only processes text messages for moderation
- No personal data is stored permanently
- OpenAI processes message content according to their privacy policy
- Warning data is stored in memory (resets on bot restart)

## 🛠️ Troubleshooting

### Bot not responding:

- Check bot token is correct
- Ensure bot is administrator in the group
- Check bot has required permissions

### Moderation not working:

- Verify OpenAI API key is valid
- Check bot has delete messages permission
- Look at console logs for error messages

### Permission errors:

- Bot needs administrator status
- Required: Delete messages + Restrict members permissions

## 📝 Development

### Project Structure

```
src/
├── config/          # Configuration management
├── handlers/        # Message and command handlers
├── services/        # OpenAI integration
├── types/          # TypeScript definitions
├── utils/          # Logging and utilities
└── index.ts        # Main bot file
```

### Adding Custom Rules

You can modify the moderation logic in `src/services/openai.service.ts` to add custom content analysis rules.

## 🤝 Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify your API keys are correct
3. Ensure bot has proper permissions in the group

---

**Note**: This bot requires OpenAI API access which may incur costs based on usage. Monitor your OpenAI usage dashboard.
