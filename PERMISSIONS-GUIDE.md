# 🔧 Bot Permissions & Setup Guide

## 🚨 Common Issues & Solutions

### Issue 1: "Bot lacks necessary permissions"

```
[warn]: Bot lacks necessary permissions {"chatId":-4855899720,"canDelete":false,"canRestrict":false}
```

**Solution**: The bot needs administrator privileges in your Telegram group with specific permissions.

### Issue 2: Database Connection Issues

```
[error]: Failed to initialize database tables
[error]: Database error adding report
```

**Solution**: Verify your DATABASE_URL is correct and PostgreSQL server is accessible.

### Issue 3: OCR Not Working

```
[error]: OCR path failed
```

**Solution**: Check if tesseract.js language files are downloaded and image is a single photo.

## 📱 How to Set Bot Permissions

### Step 1: Make Bot an Administrator

1. **Open your Telegram group**
2. **Tap the group name** at the top of the screen
3. **Scroll down and tap "Administrators"**
4. **Tap "Add Administrator"**
5. **Search for your bot**: `@yourbotname_bot`
6. **Tap on your bot** when it appears in the search results

### Step 2: Configure Required Permissions

When adding the bot as admin, enable these essential permissions:

```
✅ Delete messages       (Required - removes violating content)
✅ Restrict members      (Required - mutes users for violations)
✅ Ban users             (Required - bans users for severe violations)
❌ Pin messages         (Not needed)
❌ Invite users         (Not needed)
❌ Change group info    (Not needed)
❌ Add new admins       (Not needed)
```

### Step 3: Configure Group Settings

After setting permissions, configure group-specific settings:

1. **Send `/settings` in your group** (admin only)
2. **Set mute duration**: Choose from 5 minutes to 24 hours
3. **Set report threshold**: Choose how many `/report` commands trigger a ban (1-30)

### Step 4: Verify Setup

Send `/stats` in your group to verify everything is working:

```
📊 Moderation Statistics

Group: Your Group Name
Bot Status: ✅ Properly configured
Database: ✅ Connected
OpenAI: ✅ Connected

Current Settings:
Mute Duration: 60 minutes
Report Threshold: 10 reports

Permissions:
Delete messages: ✅
Restrict members: ✅
Ban users: ✅
```

If you see ❌ marks, check the corresponding issue below.

## 🔍 Different Group Types

### Regular Groups

- Look for "Ban users" permission (includes muting)
- May have slightly different permission names
- Limited to 200 members

### Supergroups

- Look for "Restrict members" permission
- More granular permission controls available
- Unlimited members supported
- **Recommended for this bot**

### Channels

- Bot cannot moderate channels (only groups)
- Convert to supergroup if needed for moderation

## 🛠️ Available Commands

### User Commands

```
/start          - Initialize the bot
/help           - Show help message and focus areas
/stats          - View moderation statistics
/report         - Report a message (reply to target message)
```

### Admin Commands

```
/settings       - Interactive group configuration
                 • Set mute duration (5 min - 24 hours)
                 • Set report threshold (1-30 reports)
```

## 🎯 Testing Your Setup

### 1. Test Basic Functionality

```
/start          - Should show welcome message
/help           - Should show current commands and focus
/stats          - Should show group stats and permissions
```

### 2. Test Admin Features (Admin Only)

```
/settings       - Should show interactive settings menu
```

### 3. Test Community Reporting

1. Have a user reply to any message with `/report`
2. Check if report is logged in statistics
3. Multiple users can report the same message
4. User gets banned when threshold is reached

### 4. Test OCR (if applicable)

1. Send a single image without text caption
2. Check logs for OCR processing
3. Verify AI analysis of extracted text

## 🐛 Troubleshooting Commands

### Check Bot Status

```
/stats
```

Shows:

- Current permissions status
- Database connectivity
- OpenAI API status
- Group-specific settings
- Recent moderation activity

### Debug Common Issues

**Bot not responding to commands:**

- Verify bot token in `.env` file
- Check bot is in the group and not blocked
- Ensure bot has basic message reading permissions

**Settings command not working:**

- User must be admin/creator
- Bot must have administrator status
- Check database connectivity

**Reports not working:**

- Verify DATABASE_URL is correct
- Check PostgreSQL server accessibility
- Look for database errors in logs

**OCR not processing images:**

- Ensure image is single photo (not media group)
- Check for tesseract.js download errors
- Verify image has readable text content

## 🔍 Log Patterns to Look For

### Successful Operations

```
[info]: Database tables initialized successfully
[info]: Message analyzed {"shouldModerate":true,"action":"delete"}
[info]: Report processed {"reportCount":5,"alreadyReported":false}
[info]: OCR message analyzed {"shouldModerate":false}
```

### Warning Signs

```
[warn]: Bot lacks necessary permissions
[error]: Database error adding report
[error]: OCR path failed
[error]: OpenAI analysis failed
```

## 🆘 Still Having Issues?

### Database Problems

1. **Verify DATABASE_URL format:**
   ```
   postgresql://username:password@host:port/database
   ```
2. **Check PostgreSQL server status**
3. **Verify network connectivity**
4. **Look for database connection errors in logs**

### Permission Problems

1. **Remove and re-add bot as admin**
2. **Ensure group owner sets permissions**
3. **Check if group settings override bot permissions**
4. **Try in a test group first**

### AI/OCR Problems

1. **Verify OpenAI API key has credits**
2. **Check API key permissions**
3. **Test with simple text messages first**
4. **For OCR: verify image contains readable text**

### Getting Help

1. **Check console logs** for specific error messages
2. **Use `/stats`** to verify current status
3. **Test in smaller group** first
4. **Restart bot** after configuration changes

---

## 📝 Quick Setup Checklist

- [ ] Bot added to group
- [ ] Bot made administrator
- [ ] "Delete messages" permission enabled
- [ ] "Restrict members" permission enabled
- [ ] "Ban users" permission enabled
- [ ] DATABASE_URL configured correctly
- [ ] PostgreSQL server accessible
- [ ] `/stats` shows all ✅ status
- [ ] `/settings` works for admins
- [ ] OpenAI API key has credits
- [ ] Bot responds to `/start` command

Once all items are checked, your anti-drug moderation bot should work correctly!

## 🎯 Bot Specialization

This bot is specifically designed for:

- **Anti-drug enforcement** (primary focus)
- **Community-driven moderation** via `/report`
- **OCR-based image analysis** for hidden content
- **Group-specific settings** via database storage

For general content moderation, consider using additional community reporting or other moderation tools alongside this specialized bot.
