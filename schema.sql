-- Database schema for whoop-whoop bot

-- Message reports table (message-based reporting)
CREATE TABLE IF NOT EXISTS message_reports (
  id SERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  target_user_id BIGINT NOT NULL,
  reporter_user_id BIGINT NOT NULL,
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, reporter_user_id)
);

-- Group settings table (for future /settings command)
CREATE TABLE IF NOT EXISTS group_settings (
  chat_id BIGINT PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_reports_message_id ON message_reports(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_chat_id ON message_reports(chat_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_target_user ON message_reports(target_user_id);
CREATE INDEX IF NOT EXISTS idx_group_settings_chat_id ON group_settings(chat_id); 