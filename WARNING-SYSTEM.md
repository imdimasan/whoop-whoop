# ⚠️ Warning System Guide

## 🎯 How the Warning System Works

### 📊 Current Default Settings

```
Max Warnings: 3
Ban Threshold: 95% confidence
Mute Threshold: 80% confidence
Delete/Warning Threshold: 30% confidence
```

### 🔄 Warning Flow

1. **Message Analysis**: OpenAI analyzes each message and gives a confidence score (0-100%)

2. **Action Decision**:

   ```
   95%+ confidence → 🚫 Immediate BAN
   80-94% confidence → 🔇 Immediate MUTE (5 minutes)
   30-79% confidence → ⚠️ DELETE + WARNING
   0-29% confidence → ✅ Allow message
   ```

3. **Warning Accumulation**:
   - User gets warning: "⚠️ Warning 1/3"
   - After 3 warnings → Automatic escalation to mute
   - Warnings reset when bot restarts

### 📝 Example Scenarios

#### Scenario 1: Mild Inappropriate Content

```
Message: "this is stupid"
OpenAI Score: 45% confidence
Action: Delete + Warning 1/3
```

#### Scenario 2: Repeated Violations

```
Message: "that's dumb"
OpenAI Score: 40% confidence
User already has 2 warnings
Action: Warning 3/3 → Escalate to MUTE
```

#### Scenario 3: Severe Content

```
Message: "hate speech content"
OpenAI Score: 96% confidence
Action: Immediate BAN (skips warnings)
```

## ⚙️ Configure Warning System

### Method 1: Environment Variables

Add to your `.env` file:

```bash
# Warning settings
MAX_WARNINGS=3
MUTE_DURATION_MINUTES=5

# Thresholds (0.0 to 1.0)
BAN_THRESHOLD=0.95      # 95% confidence for ban
MUTE_THRESHOLD=0.80     # 80% confidence for mute
DELETE_THRESHOLD=0.30   # 30% confidence for warning
```

### Method 2: Setup Wizard

```bash
npm run setup
```

The setup will now ask for threshold settings.

### Method 3: View Current Settings

In your Telegram group, use:

```
/settings
```

## 🎛️ Tuning Recommendations

### More Lenient (More Warnings)

```bash
BAN_THRESHOLD=0.98      # Almost never ban
MUTE_THRESHOLD=0.90     # Rarely mute
DELETE_THRESHOLD=0.20   # Warn for minor issues
MAX_WARNINGS=5          # More chances
```

### More Strict (Fewer Warnings)

```bash
BAN_THRESHOLD=0.85      # Ban easier
MUTE_THRESHOLD=0.70     # Mute easier
DELETE_THRESHOLD=0.50   # Only warn for clear violations
MAX_WARNINGS=2          # Fewer chances
```

### Balanced (Recommended)

```bash
BAN_THRESHOLD=0.95      # Ban for severe content
MUTE_THRESHOLD=0.80     # Mute for serious issues
DELETE_THRESHOLD=0.30   # Warn for questionable content
MAX_WARNINGS=3          # Standard 3 strikes
```

## 📊 Monitoring Warnings

### Check User Warnings

Reply to a user's message and use:

```
/warnings
```

Shows: "User: John - Warnings: 2/3"

### Clear User Warnings (Admin Only)

Reply to a user's message and use:

```
/clearwarnings
```

### View System Stats

```
/stats
```

Shows bot permissions and connection status.

## 🔍 Understanding the Logs

Look for these patterns in your logs:

### Normal Warning Flow

```
[info]: Message analyzed {"shouldModerate":true,"action":"delete"}
[info]: Message deleted and warning added {"warningCount":1}
```

### Warning Escalation

```
[info]: Max warnings reached, escalating {"userId":123,"warnings":3}
[info]: User muted {"userId":123,"duration":5}
```

### Immediate Action (Skipping Warnings)

```
[info]: Message analyzed {"shouldModerate":true,"action":"ban"}
[info]: User banned {"userId":123,"reason":"hate speech"}
```

## 🛠️ Troubleshooting

### "Too Many False Warnings"

- Increase `DELETE_THRESHOLD` from 0.30 to 0.50
- This makes the bot less sensitive

### "Not Catching Bad Content"

- Decrease `DELETE_THRESHOLD` from 0.30 to 0.20
- This makes the bot more sensitive

### "Banning Too Quickly"

- Increase `BAN_THRESHOLD` from 0.95 to 0.98
- More content will get warnings instead of bans

### "Users Not Learning"

- Decrease `MAX_WARNINGS` from 3 to 2
- Faster escalation to mutes

## 📈 Best Practices

1. **Start Conservative**: Use higher thresholds initially
2. **Monitor Logs**: Watch what gets flagged
3. **Adjust Gradually**: Make small threshold changes
4. **Test Changes**: Try different content types
5. **Get Feedback**: Ask group members about bot behavior

---

**Remember**: The warning system is designed to educate users before taking stronger action. Adjust thresholds based on your group's needs!
