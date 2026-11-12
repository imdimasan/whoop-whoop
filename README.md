# 🤖 Whoop Whoop Telegram Moderation Bot

An AI-powered Telegram moderation bot with comprehensive content classification system, OCR support, and community-driven reporting. Specializes in detecting drugs, suspicious job offers, gambling, ticket fraud, and financial schemes.

## ✨ Features

- **🎯 Multi-Category Detection**: Comprehensive content classification for drugs, jobs, gambling, tickets, and financial schemes
- **🔍 OCR Support**: Analyzes text within images to detect hidden advertisements
- **👥 Community Reports**: Users can report messages with `/report` command for community-based moderation
- **⚙️ Interactive Settings**: Group-specific configuration via inline keyboard interface
- **🗄️ Database-Driven**: PostgreSQL storage for persistent settings and message-based reporting
- **🚫 Direct Actions**: No warning system - immediate delete/mute/ban based on AI confidence
- **🧠 Smart Context Analysis**: Advanced AI prompts with context-aware detection and false positive prevention

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 24 installed
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

### 5. Deploying on Railway

- Set the bot's `DATABASE_URL` to the reference variable `${{Postgres.DATABASE_URL}}` so it connects over the private network. Do not paste the public `*.proxy.rlwy.net` URL: it stops working as soon as the database's public TCP proxy is removed or changed, and the running bot keeps the stale address.
- The bot keeps moderating while the database is unreachable (settings, reports and moderation history are disabled until it is back) and logs `Database is unavailable` on every retry, so check the logs after changing database settings.
- `railpack.json` starts the bot with `node dist/index.js` instead of `npm start`: only then the process receives `SIGTERM` and can shut down gracefully.
- The Node.js version is pinned by `engines.node` in `package.json`.

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

- `/start` - Initialize the bot (works in both private chats and groups)
- `/help` - Show help message and bot focus areas (auto-deletes after 60 seconds)
- `/stats` - View moderation statistics and bot permissions (group only, auto-deletes after 45 seconds)
- `/settings` - Interactive group configuration with inline keyboard (admin only)
- `/report` - Report a message by replying to it (group only, community-based moderation)

## ⚙️ How It Works

### 1. **AI-Powered Content Classification**

The bot uses advanced AI classification to detect and categorize content into:

- **Drug-related content**: Sales, advertisements, drug names, slang, controlled substances
- **Job offers**: ANY job mentions, employment offers, suspicious hiring (very strict detection)
- **Gambling content**: Casino promotions, betting sites, gambling advertisements
- **Ticket sales**: Event tickets, concert tickets, sports tickets
- **Financial schemes**: Loans, credits, fast-money offers, get-rich-quick promises (NOT regular sales)
- **Default content**: Normal chat, regular marketplace sales, legitimate business ads

### 2. **OCR Image Analysis**

- Automatically scans single images without text captions
- Detects hidden advertisements in images across all categories
- Uses Russian + English OCR recognition with Tesseract.js
- Processes extracted text through the same AI classification pipeline
- Smart detection prevents false positives (e.g., "фен" as hair dryer vs drug slang)

### 3. **Action Levels**

- **Delete**: Low-severity violations with auto-deleting warning message
- **Mute**: Medium-severity violations with temporary restriction
- **Ban**: High-severity violations with permanent removal

### 4. **Community Reporting System**

- Users reply to problematic messages with `/report` command
- Message-based tracking (not user-based) with PostgreSQL storage
- Configurable threshold per group (default: 10 reports, range: 1-30)
- Automatic ban when threshold reached with community notification
- Prevents spam reports with duplicate detection

### 5. **Database-Driven Settings**

Each group can configure via `/settings` command:

- **Mute Duration**: 5 minutes to 24 hours (configurable per group)
- **Report Threshold**: 1-30 reports needed for ban (default: 10)
- **Action Thresholds**: AI confidence levels for ban/mute/delete actions
- Settings persist across bot restarts with PostgreSQL storage
- Admin-only configuration with inline keyboard interface

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

### User gets banned accidentally:

- Check user ID in database moderation logs
- Use `/stats` command to view recent moderation actions
- Check console logs for moderation decisions and AI confidence scores
- Adjust action thresholds in group settings if needed
- Review AI classification reasoning in logs

### How to find username by user ID:

```bash
# Using curl to get user information
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getChatMember" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "<CHAT_ID>",
    "user_id": "<USER_ID>"
  }'
```

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

- `src/services/openai.ts` - AI analysis and content classification
- `src/handlers/settings.ts` - Interactive settings interface with inline keyboards
- `src/handlers/moderation.ts` - Message processing and action handling
- `src/services/database.ts` - PostgreSQL operations and moderation tracking
- `src/helpers/ocr.ts` - Image text extraction with Tesseract.js
- `src/config/prompts/content-classification.md` - AI prompts for content classification
- `src/config/stems.ts` - Drug detection stems and false positive prevention
- `src/helpers/classify-content.ts` - Content classification logic

### Adding Custom Detection

Modify prompts in `src/config/prompts/content-classification.md`:

- Content classification categories: `drugs`, `jobs`, `gambling`, `tickets`, `financial`, `default`
- Update detection rules and examples
- Adjust confidence thresholds in configuration
- Add new stems in `src/config/stems.ts` for keyword-based detection

## 🎯 Bot Focus Areas

### Primary: Multi-Category Content Moderation

- **Drug-related content**: Sales, advertisements, drug names, slang
- **Job offers**: ANY job mentions, employment offers, suspicious hiring (very strict)
- **Gambling content**: Casino promotions, betting sites
- **Financial schemes**: Loans, credits, fast-money offers (NOT regular sales)
- **Ticket sales**: Event tickets, concert tickets
- Analyzes both text and image content with OCR
- Immediate action without warnings based on AI confidence

### Secondary: Community Safety

- Community-driven reporting system via `/report` command
- Group-specific moderation settings via `/settings`
- Transparent moderation actions with auto-deleting notifications
- Message-based tracking (not user-based) for fair moderation

## 🤝 Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify your API keys and database connection
3. Ensure bot has proper permissions in the group
4. Test with `/stats` and `/settings` commands
5. Check database connectivity and table creation

---

**Note**: This bot requires OpenAI API access and PostgreSQL database, which may incur costs based on usage. Monitor your usage dashboards accordingly.
