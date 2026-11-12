# 🤖 Whoop Whoop Telegram Moderation Bot

An AI-powered Telegram moderation bot with comprehensive content classification system, image analysis, and community-driven reporting. Specializes in detecting drugs, suspicious job offers, gambling, ticket fraud, financial schemes, and scams.

## ✨ Features

- **🎯 Multi-Category Detection**: Comprehensive content classification for drugs, jobs, gambling, tickets, financial schemes, and scams
- **🖼️ Image Analysis**: Photos are checked by an OpenAI vision model, including ads that consist only of pictures
- **👥 Community Reports**: Users can report messages with `/report` command for community-based moderation
- **⚙️ Interactive Settings**: Group-specific configuration via inline keyboard interface
- **🗄️ Database-Driven**: PostgreSQL storage for persistent settings and message-based reporting
- **🚫 Direct Actions**: No warning system - immediate delete/mute/ban based on AI confidence
- **🧠 Smart Context Analysis**: Advanced AI prompts with context-aware detection and false positive prevention

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 24 installed (the OpenAI SDK requires Node 22+)
- Telegram Bot Token (from @BotFather)
- OpenAI API Key with access to `gpt-6.1-terra` (or another model listed in `src/config/models.ts`)
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

Optional environment variables:

- `OPENAI_MODEL`: classification model, one of `gpt-6.1-terra` (default), `gpt-6-sol`, `gpt-6-luna` (see `src/config/models.ts`); any other value stops the bot at startup
- `IMAGE_ANALYSIS_DAILY_LIMIT`: max images checked per UTC day (default `500`, `0` turns image analysis off)
- `IMAGE_MIN_CONFIDENCE`: minimum confidence (0-1) for acting on an image-based verdict (default `0.8`)

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
- `railpack.json` starts the bot with `node dist/index.js` instead of `npm start`: only then the process receives `SIGTERM` and can shut down gracefully. Leave "Custom Start Command" in the service settings empty (or set it to `node dist/index.js`), otherwise it replaces this.
- Set the draining time (service settings → Deploy, or the `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` variable) to `40` seconds. Railway's default is `0`: the old deployment is killed right after `SIGTERM`. With `40` it finishes the message it is handling (the bot allows itself 35 s) and confirms it to Telegram; a message that takes longer is not confirmed, so the new deployment gets it again.
- Run exactly one replica, and do not run the bot locally with the production token: Telegram allows one poller per token.
- `engines.node` in `package.json` keeps Node.js at major version 24; each build installs the newest 24.x release that is at least 14 days old.

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
- **Scams & dubious services**: Fake documents (driver's licenses, certificates), paid "problem solving" with authorities, data lookups, selling bank cards or accounts, money-recovery fraud (NOT legitimate local services)
- **Default content**: Normal chat, regular marketplace sales, legitimate business ads

### 2. **Image Analysis**

- Photos are classified by the same model and rules as text (OpenAI vision), so ads made only of pictures (pills, a cannabis leaf and «Пишите») are caught too
- The image is checked when the post has no real text (fewer than 10 letters or digits, e.g. only emoji) or when its text contains a link (URL, hidden link, @username, `t.me/…`, URL button); otherwise the text alone is classified
- Albums are checked as one post, images sent as files are checked too; stickers, GIFs and videos are not
- An image-based verdict acts only at confidence ≥ `IMAGE_MIN_CONFIDENCE`, and the ban notice says the picture decided it
- A daily cap (`IMAGE_ANALYSIS_DAILY_LIMIT`) bounds the cost during raids; if the download or the cap prevents an image check, the post is judged by its text

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

- Bot processes text messages and photos for moderation
- Message reports stored in PostgreSQL database
- Group settings stored with chat ID only
- Message texts and photos are sent to OpenAI for classification and processed under its API data policy; the Telegram user id is sent only as a keyed hash (`safety_identifier`)
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
- If OpenAI is unavailable, text messages are left without moderation (there is no keyword fallback, it banned ordinary sellers); the log reports `AI classification keeps failing` after every 20 such messages
- Some hacking-service ads are rejected by OpenAI's cyber safeguard (`Classification blocked by OpenAI cyber policy` in the log); such a post stays and needs a `/report`

### Database issues:

- Verify DATABASE_URL is correct
- Check PostgreSQL server is accessible
- Look for connection errors in logs

### Photos are not checked:

- A photo with a caption of 10+ letters and no link is judged by its caption only (by design)
- Look for `Daily image analysis limit reached` or `Image download failed` in the logs
- `Classification usage` log lines show `imageTokens` when an image reached the model

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
├── helpers/         # Classification, image and album helpers
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
- `src/helpers/image-gate.ts` - When a post's image is checked (no real text, or a link)
- `src/helpers/image-input.ts` - Picking and downloading the image from Telegram
- `src/config/prompts/content-classification.md` - AI prompts for content classification
- `src/config/models.ts` - OpenAI models the bot may use
- `src/config/prompts/image-posts.md` - Extra rules for photo posts
- `src/helpers/classify-content.ts` - Content classification logic

### Adding Custom Detection

Modify prompts in `src/config/prompts/content-classification.md`:

- Content classification categories: `drugs`, `jobs`, `gambling`, `tickets`, `financial`, `scam`, `default`
- Update detection rules and examples
- Adjust confidence thresholds in configuration
- Add a new category to `CONTENT_TYPES` in `src/interfaces/i-content.ts` and give it an action in `src/helpers/get-action.ts`

## 🎯 Bot Focus Areas

### Primary: Multi-Category Content Moderation

- **Drug-related content**: Sales, advertisements, drug names, slang
- **Job offers**: ANY job mentions, employment offers, suspicious hiring (very strict)
- **Gambling content**: Casino promotions, betting sites
- **Financial schemes**: Loans, credits, fast-money offers (NOT regular sales)
- **Scams & dubious services**: Fake documents, paid "problem solving" with authorities, other fraudulent services
- **Ticket sales**: Event tickets, concert tickets
- Analyzes both text and image content (OpenAI vision)
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
