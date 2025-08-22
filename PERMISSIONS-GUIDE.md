# 🔧 Bot Permissions Troubleshooting Guide

## 🚨 Common Issues from Your Logs

### Issue 1: "Bot lacks necessary permissions"

```
[warn]: Bot lacks necessary permissions {"chatId":-4855899720,"canDelete":false,"canRestrict":false}
```

**Solution**: The bot needs administrator privileges in your Telegram group.

### Issue 2: Actions suggested when shouldModerate is false

```
[info]: Message analyzed {"shouldModerate":false,"action":"mute"}
```

**Fixed**: Updated the logic to only suggest actions when moderation is actually needed.

## 📱 How to Set Bot Permissions

### Step 1: Make Bot an Administrator

1. **Open your Telegram group**
2. **Tap the group name** at the top of the screen
3. **Scroll down and tap "Administrators"**
4. **Tap "Add Administrator"**
5. **Search for your bot**: `@yourbotname_bot`
6. **Tap on your bot** when it appears in the search results

### Step 2: Configure Permissions

When adding the bot as admin, you'll see a permissions screen. Enable these:

```
✅ Delete messages       (Required for removing bad content)
✅ Restrict members      (Required for muting users)
❌ Pin messages         (Not needed)
❌ Invite users         (Not needed)
❌ Change group info    (Not needed)
❌ Add new admins       (Not needed)
```

### Step 3: Verify Permissions

After setting up, send `/stats` in your group to check:

```
📊 Moderation Statistics

Group: Your Group Name
Bot Status: ✅ Properly configured
OpenAI: ✅ Connected

Permissions:
Delete messages: ✅
Restrict members: ✅
```

If you see ❌ marks, the permissions aren't set correctly.

## 🔍 Different Group Types

### Regular Groups

- Look for "Ban users" permission (includes muting)
- May have slightly different permission names

### Supergroups

- Look for "Restrict members" permission
- More granular permission controls available

### Channels

- Bot cannot moderate channels (only groups)
- Convert to supergroup if needed

## 🛠️ Troubleshooting Commands

### Check Bot Status

```
/stats
```

Shows current permissions and connection status.

### Test Moderation

1. Send a test message with inappropriate content
2. Check logs for analysis results
3. Verify action is taken if content violates policies

### Debug Logs

Look for these log patterns:

- `✅ Analyzing message` - Bot is processing
- `✅ Message analyzed` - OpenAI analysis complete
- `⚠️ Bot lacks necessary permissions` - Permission issue
- `✅ User muted/banned` - Action taken successfully

## 🆘 Still Having Issues?

### Check These Common Problems:

1. **Bot not responding to commands**:

   - Verify bot token is correct in `.env`
   - Check bot is actually in the group
   - Ensure bot isn't blocked

2. **Permissions keep resetting**:

   - Group owner needs to set permissions
   - Some group settings may override bot permissions

3. **Moderation not working**:

   - Check OpenAI API key is valid
   - Verify API key has credits/quota
   - Look at console logs for errors

4. **False positives/negatives**:
   - OpenAI moderation can be adjusted
   - Check the confidence scores in logs
   - Consider adjusting thresholds in code

### Getting Help

1. **Check logs** first (look for error messages)
2. **Try `/stats`** command to verify setup
3. **Restart bot** after permission changes
4. **Test with simple messages** first

---

## 📝 Quick Permission Checklist

- [ ] Bot added to group
- [ ] Bot made administrator
- [ ] "Delete messages" enabled
- [ ] "Restrict members" enabled
- [ ] `/stats` shows ✅ for both permissions
- [ ] OpenAI API key configured
- [ ] Bot responds to `/start` command

Once all items are checked, your moderation bot should work correctly!
