require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');

if (!process.env.BOT_TOKEN) {
  console.error('FATAL ERROR: BOT_TOKEN is missing in environment variables!');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Session Middleware (ইউজার সেশন সংরক্ষণের জন্য)
bot.use(session());

// মূল মেনুর বাটন তৈরি (Global English UI)
const getMainMenu = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🖼️ Image to PDF', 'tool_img2pdf'),
      Markup.button.callback('📑 PDF to Images', 'tool_pdf2img')
    ],
    [
      Markup.button.callback('🔗 Merge PDF', 'tool_merge'),
      Markup.button.callback('✂️ Split PDF', 'tool_split')
    ],
    [
      Markup.button.callback('📉 Compress PDF', 'tool_compress'),
      Markup.button.callback('🔄 Rotate PDF', 'tool_rotate')
    ],
    [
      Markup.button.callback('🔢 Extract Pages', 'tool_extract_pages'),
      Markup.button.callback('🔐 Protect PDF', 'tool_protect')
    ],
    [
      Markup.button.callback('🔓 Unlock PDF', 'tool_unlock'),
      Markup.button.callback('📝 Extract Text', 'tool_extract_text')
    ]
  ]);
};

// /start কমান্ড হ্যান্ডলার
bot.start((ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.currentTool = null;
  return ctx.reply(
    '📄 *Welcome to Global PDF Tools Bot!*\n\n' +
    'Please select a tool from the menu below to get started:',
    {
      parse_mode: 'Markdown',
      ...getMainMenu()
    }
  );
});

// টুলের তালিকা
const tools = [
  { id: 'tool_img2pdf', name: 'Image to PDF' },
  { id: 'tool_pdf2img', name: 'PDF to Images' },
  { id: 'tool_merge', name: 'Merge PDF' },
  { id: 'tool_split', name: 'Split PDF' },
  { id: 'tool_compress', name: 'Compress PDF' },
  { id: 'tool_rotate', name: 'Rotate PDF' },
  { id: 'tool_extract_pages', name: 'Extract Pages' },
  { id: 'tool_protect', name: 'Protect PDF' },
  { id: 'tool_unlock', name: 'Unlock PDF' },
  { id: 'tool_extract_text', name: 'Extract Text' }
];

// বাটন ক্লিকে ইউজার সেশন পরিবর্তন ও রেসপন্স
tools.forEach(tool => {
  bot.action(tool.id, (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.currentTool = tool.name;
    ctx.answerCbQuery();
    return ctx.editMessageText(
      `🛠️ *Selected Tool: ${tool.name}*\n\n` +
      `Status: Active and waiting for session commands...\n\n` +
      `_Click Home below to change selection._`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Back to Main Menu', 'action_home')]
        ])
      }
    );
  });
});

// মূল মেনুতে ফেরার অ্যাকশন
bot.action('action_home', (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.currentTool = null;
  ctx.answerCbQuery();
  return ctx.editMessageText(
    '📄 *Global PDF Tools Bot*\n\n' +
    'Please select a tool from the menu below:',
    {
      parse_mode: 'Markdown',
      ...getMainMenu()
    }
  );
});

// বট চালু করা
bot.launch().then(() => {
  console.log('✅ Global PDF Bot is running successfully!');
}).catch((err) => {
  console.error('❌ Failed to start Bot:', err);
});

// সার্ভার বন্ধ হলে নিরাপদ শাটডাউন
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
