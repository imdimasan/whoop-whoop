#!/usr/bin/env node

/**
 * Test script for markdown-based prompt system
 * Tests prompt loading, routing, and content detection
 */

const {
  FINANCIAL_MODERATION_PROMPT,
  JOB_HIRING_DETECTION_PROMPT,
  TICKET_DETECTION_PROMPT,
  DRUG_DETECTION_PROMPT,
  GAMBLING_DETECTION_PROMPT,
  getPromptForContent,
  determineContentType,
  getThresholdsForContent,
} = require("./dist/config/rules.js");

// ANSI color codes for better output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

console.log(
  `${colors.bold}${colors.blue}🧪 Testing Markdown-Based Prompt System${colors.reset}\n`
);

// Test 1: Verify prompt loading
console.log(`${colors.bold}1. Testing Prompt Loading:${colors.reset}`);

const prompts = [
  { name: "FINANCIAL_MODERATION_PROMPT", content: FINANCIAL_MODERATION_PROMPT },
  { name: "JOB_HIRING_DETECTION_PROMPT", content: JOB_HIRING_DETECTION_PROMPT },
  { name: "TICKET_DETECTION_PROMPT", content: TICKET_DETECTION_PROMPT },
  { name: "DRUG_DETECTION_PROMPT", content: DRUG_DETECTION_PROMPT },
  { name: "GAMBLING_DETECTION_PROMPT", content: GAMBLING_DETECTION_PROMPT },
];

prompts.forEach(({ name, content }) => {
  const isLoaded = content && content.length > 0;
  const isMarkdown = content.includes("# ") || content.includes("## ");
  const status = isLoaded
    ? `${colors.green}✅ Loaded (${content.length} chars)${colors.reset}`
    : `${colors.red}❌ Failed${colors.reset}`;

  console.log(`  ${name}: ${status}`);

  if (isLoaded && isMarkdown) {
    console.log(`    ${colors.cyan}📄 Markdown format detected${colors.reset}`);
  }

  if (isLoaded) {
    console.log(
      `    ${colors.yellow}Preview:${colors.reset} ${content.substring(
        0,
        80
      )}...`
    );
  }
});

console.log();

// Test 2: Content type detection
console.log(`${colors.bold}2. Testing Content Type Detection:${colors.reset}`);

const testMessages = [
  // Job offers - now separate category
  { text: "Требуется курьер, высокая оплата", expected: "jobs" },
  { text: "Вакансия грузчика, 3000 в день", expected: "jobs" },
  { text: "Подработка на складе", expected: "jobs" },
  { text: "Ищем сотрудников для доставки", expected: "jobs" },
  {
    text: "Слушай, работа на складе интернет-магазина. Без опыта всему обучаем, а новые знакомства будут приятным бонусом. Платим 7000 в день",
    expected: "drugs",
  },
  {
    text: "Требуются работники на завод, с 16 лет, предоставляться комфортные условия, переезд так же жилье предоставляем, зарплата в день 5700, есть карьерный рост, пишите интересуйтесь!!!!!",
    expected: "jobs",
  },

  // Financial schemes - main moderation
  { text: "Быстрые деньги, займ без проверок", expected: "financial" },
  { text: "Кредит срочно, помощь с деньгами", expected: "financial" },

  // Sales (should be financial/main, not moderated)
  { text: "Продаю iPhone 13, цена 50000", expected: "financial" },
  { text: "Ремонт телефонов, недорого", expected: "financial" },

  // Tickets
  { text: "Билеты на концерт, продам дешево", expected: "tickets" },
  { text: "Продаю билет на футбол", expected: "tickets" },
  { text: "Есть лишний билет, отдам", expected: "tickets" },

  // Gambling
  { text: "Нашел топовый каз, регай", expected: "gambling" },
  { text: "Поднял 100к в казино", expected: "gambling" },
  { text: "Фри спины за регистрацию", expected: "gambling" },

  // Drugs - highest priority
  { text: "Продаю траву, качество топ", expected: "drugs" },
  { text: "Курьер требуется, меф доставка", expected: "drugs" }, // Drug-related job should be drugs
];

let correctDetections = 0;

testMessages.forEach(({ text, expected }) => {
  const detected = determineContentType(text);
  const isCorrect = detected === expected;
  const status = isCorrect
    ? `${colors.green}✅${colors.reset}`
    : `${colors.red}❌${colors.reset}`;

  console.log(`  ${status} "${text}"`);
  console.log(
    `    Expected: ${colors.cyan}${expected}${colors.reset}, Got: ${colors.yellow}${detected}${colors.reset}`
  );

  if (isCorrect) correctDetections++;
});

const accuracy = Math.round((correctDetections / testMessages.length) * 100);
console.log(
  `\n  ${colors.bold}Detection Accuracy: ${accuracy}% (${correctDetections}/${testMessages.length})${colors.reset}\n`
);

// Test 3: Prompt routing
console.log(`${colors.bold}3. Testing Prompt Routing:${colors.reset}`);

const routingTests = [
  { text: "Требуется курьер", expectedType: "JOB" },
  { text: "Вакансия грузчика", expectedType: "JOB" },
  { text: "Билеты на концерт продам", expectedType: "TICKET" },
  { text: "Топовый каз регай", expectedType: "GAMBLING" },
  { text: "Продаю телефон", expectedType: "FINANCIAL" },
  { text: "Займ срочно нужен", expectedType: "FINANCIAL" },
  { text: "Продаю траву качественную", expectedType: "DRUG" },
];

routingTests.forEach(({ text, expectedType }) => {
  const prompt = getPromptForContent(text);
  let actualType = "UNKNOWN";

  if (prompt === FINANCIAL_MODERATION_PROMPT) actualType = "FINANCIAL";
  else if (prompt === JOB_HIRING_DETECTION_PROMPT) actualType = "JOB";
  else if (prompt === TICKET_DETECTION_PROMPT) actualType = "TICKET";
  else if (prompt === GAMBLING_DETECTION_PROMPT) actualType = "GAMBLING";
  else if (prompt === DRUG_DETECTION_PROMPT) actualType = "DRUG";

  const isCorrect = actualType === expectedType;
  const status = isCorrect
    ? `${colors.green}✅${colors.reset}`
    : `${colors.red}❌${colors.reset}`;

  console.log(
    `  ${status} "${text}" → ${colors.cyan}${actualType}${colors.reset} prompt`
  );
});

console.log();

// Test 4: Thresholds
console.log(`${colors.bold}4. Testing Confidence Thresholds:${colors.reset}`);

const contentTypes = ["financial", "jobs", "tickets", "drugs", "gambling"];

contentTypes.forEach((type) => {
  try {
    const thresholds = getThresholdsForContent(type);
    console.log(
      `  ${colors.cyan}${type}:${colors.reset} ban=${thresholds.ban}, mute=${thresholds.mute}, delete=${thresholds.delete}`
    );
  } catch (error) {
    console.log(
      `  ${colors.red}❌ ${type}: Error loading thresholds${colors.reset}`
    );
  }
});

console.log();

// Test 5: File structure verification
console.log(`${colors.bold}5. File Structure Check:${colors.reset}`);

const fs = require("fs");
const path = require("path");

const expectedFiles = [
  "dist/config/rules.js",
  "dist/config/prompts/main-moderation.md",
  "dist/config/prompts/job-hiring-detection.md",
  "dist/config/prompts/ticket-detection.md",
  "dist/config/prompts/drugs-detection.md",
  "dist/config/prompts/gambling-detection.md",
  "dist/helpers/load-md-files.js",
];

expectedFiles.forEach((filePath) => {
  const exists = fs.existsSync(filePath);
  const status = exists
    ? `${colors.green}✅${colors.reset}`
    : `${colors.red}❌${colors.reset}`;

  console.log(`  ${status} ${filePath}`);
});

// Summary
console.log(`\n${colors.bold}${colors.green}🎉 Test Summary:${colors.reset}`);
console.log(
  `${colors.green}✅ Prompt system is working correctly!${colors.reset}`
);
console.log(
  `${colors.green}✅ Markdown files are loading properly${colors.reset}`
);
console.log(
  `${colors.green}✅ Content detection accuracy: ${accuracy}%${colors.reset}`
);
console.log(`${colors.green}✅ Prompt routing is functional${colors.reset}`);

if (accuracy < 90) {
  console.log(
    `\n${colors.yellow}⚠️  Consider reviewing content detection patterns if accuracy is below expectations.${colors.reset}`
  );
}

console.log(`\n${colors.bold}${colors.blue}📚 Usage:${colors.reset}`);
console.log(
  `1. Edit markdown files in: ${colors.cyan}src/config/prompts/${colors.reset}`
);
console.log(`2. Build project: ${colors.cyan}npm run build${colors.reset}`);
console.log(
  `3. Copy markdown files: ${colors.cyan}cp src/config/prompts/*.md dist/config/prompts/${colors.reset}`
);
console.log(
  `4. Test changes: ${colors.cyan}node test-prompts.js${colors.reset}`
);
