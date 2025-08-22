# 🤖 Whoop Whoop Telegram Moderation Bot

An AI-powered Telegram moderation bot that specializes in anti-drug enforcement with OCR support and community-driven reporting system.

## ✨ Features

- **🎯 Anti-Drug Focus**: Specialized detection of drug-related content and suspicious job offers
- **🔍 OCR Support**: Analyzes text within images to detect drug advertisements
- **👥 Community Reports**: Users can report messages with `/report` command for community-based moderation
- **⚙️ Interactive Settings**: Group-specific configuration via inline keyboard interface
- **🗄️ Database-Driven**: PostgreSQL storage for persistent settings and message-based reporting
- **🚫 Direct Actions**: No warning system - immediate delete/mute/ban based on AI confidence

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Telegram Bot Token (from @BotFather)
- OpenAI API Key
- PostgreSQL Database (Railway, Supabase, etc.)

### 2. Installation

```bash
# Clone or download this project
cd whoop-whoop

# Install dependencies
npm install

# Run the setup wizard
npm run setup:env
```

### 3. Configuration

The setup wizard will ask for:

- **Telegram Bot Token**: Get from @BotFather on Telegram
- **OpenAI API Key**: Get from https://platform.openai.com/api-keys
- **Bot Username**: Your bot's username (default: yourbotname_bot)
- **Database URL**: PostgreSQL connection string
  - Example: `postgresql://username:password@host:port/database`
- **Action Thresholds**: AI confidence levels for ban/mute/delete actions (0.0-1.0)

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
     - ✅ Ban users

3. **Configure group settings**:

   - Send `/settings` in the group (admin only)
   - Set mute duration and report thresholds per group

4. **Test the bot**:
   - Send `/start` in the group
   - Send `/help` to see available commands

## 📋 Available Commands

- `/start` - Initialize the bot
- `/help` - Show help message and bot focus areas
- `/stats` - View moderation statistics
- `/settings` - Interactive group configuration (admin only)
- `/report` - Report a message (reply to target message)

## ⚙️ How It Works

### 1. **Specialized Content Analysis**

The bot focuses on detecting:

- **Drug-related content**: Sales, advertisements, suspicious substances
- **Suspicious job offers**: Courier/delivery jobs that may be drug-related
- **Ticket fraud**: Warnings about ticket sales (community reports for other content)

### 2. **OCR Image Analysis**

- Automatically scans single images without text captions
- Detects drug advertisements hidden in images
- Uses Russian + English OCR recognition
- Processes images through the same AI analysis pipeline

### 3. **Action Levels**

- **Delete**: Low-severity violations with auto-deleting warning message
- **Mute**: Medium-severity violations with temporary restriction
- **Ban**: High-severity violations with permanent removal

### 4. **Community Reporting System**

- Users reply to problematic messages with `/report`
- Message-based tracking (not user-based)
- Configurable threshold per group (default: 10 reports)
- Automatic ban when threshold reached

### 5. **Database-Driven Settings**

Each group can configure:

- **Mute Duration**: 5 minutes to 24 hours
- **Report Threshold**: 1-30 reports needed for ban
- Settings persist across bot restarts

## 🔒 Security & Privacy

- Bot processes text messages and single images for moderation
- Message reports stored in PostgreSQL database
- Group settings stored with chat ID only
- OpenAI processes content according to their privacy policy
- No personal data stored beyond moderation needs

## 🛠️ Troubleshooting

### Bot not responding:

- Check bot token is correct
- Ensure bot is administrator in the group
- Check bot has required permissions
- Verify database connection

### Moderation not working:

- Verify OpenAI API key is valid and has credits
- Check bot has delete messages permission
- Look at console logs for error messages
- Test with `/stats` command

### Database issues:

- Verify DATABASE_URL is correct
- Check PostgreSQL server is accessible
- Look for connection errors in logs

### OCR not working:

- Check if tesseract.js files are downloaded
- Verify image is a single photo (not media group)
- Look for OCR-related errors in logs

## 📝 Development

### Project Structure

```
src/
├── config/          # Configuration and prompts
├── handlers/        # Message, settings, and moderation handlers
├── helpers/         # OCR and drug detection utilities
├── interfaces/      # TypeScript definitions
├── services/        # OpenAI and database services
├── database/        # PostgreSQL connection
├── utils/           # Logging utilities
└── index.ts         # Main bot file
```

### Key Files

- `src/services/openai.ts` - AI analysis and custom prompts
- `src/handlers/settings.ts` - Interactive settings interface
- `src/services/database.ts` - Database operations
- `src/helpers/ocr.ts` - Image text extraction
- `src/config/prompts.ts` - AI prompts and detection logic

### Adding Custom Detection

Modify prompts in `src/config/prompts.ts`:

- `MAIN_MODERATION_PROMPT` - General suspicious job offers
- `DRUG_DETECTION_PROMPT` - Drug-related content
- `TICKET_DETECTION_PROMPT` - Ticket sales detection

## 🎯 Bot Focus Areas

### Primary: Anti-Drug Enforcement

- Detects drug sales and advertisements
- Identifies suspicious courier/delivery job offers
- Analyzes both text and image content
- Immediate action without warnings

### Secondary: Community Safety

- Ticket sale fraud warnings
- Community-driven reporting system
- Group-specific moderation settings
- Transparent moderation actions

## 🤝 Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify your API keys and database connection
3. Ensure bot has proper permissions in the group
4. Test with `/stats` and `/settings` commands
5. Check database connectivity and table creation

---

**Note**: This bot requires OpenAI API access and PostgreSQL database, which may incur costs based on usage. Monitor your usage dashboards accordingly.
