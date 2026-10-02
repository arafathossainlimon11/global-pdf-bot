require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const http = require('http');
const axios = require('axios');
const { PDFDocument } = require('pdf-lib');

if (!process.env.BOT_TOKEN) {
  console.error('FATAL ERROR: BOT_TOKEN is missing!');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Render Health-check Server
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Global PDF Tools Bot is active!');
}).listen(PORT, () => {
  console.log(`🌐 Server is listening on port ${PORT}`);
});

bot.use(session());

// Global English Main Menu
const getMainMenu = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🖼️ Image to PDF', 'tool_img2pdf'),
      Markup.button.callback('📑 PDF to Images', 'tool_pdf2img')
    ],
    [
      Markup.button.callback('🔗 Merge PDF', 'tool_merge'),
      Markup.button.callback('✂️️ Split PDF', 'tool_split')
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

// Start Command
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

// Tool Handlers
const tools = [
  { id: 'tool_img2pdf', name: 'Image to PDF', prompt: 'Please send me the photo(s) you want to convert into a PDF.' },
  { id: 'tool_pdf2img', name: 'PDF to Images', prompt: 'Please send me the PDF file to convert into images.' },
  { id: 'tool_merge', name: 'Merge PDF', prompt: 'Please send me the PDF files you want to merge.' },
  { id: 'tool_split', name: 'Split PDF', prompt: 'Please send me the PDF file you want to split.' },
  { id: 'tool_compress', name: 'Compress PDF', prompt: 'Please send me the PDF file you want to compress.' },
  { id: 'tool_rotate', name: 'Rotate PDF', prompt: 'Please send me the PDF file you want to rotate.' },
  { id: 'tool_extract_pages', name: 'Extract Pages', prompt: 'Please send me the PDF file.' },
  { id: 'tool_protect', name: 'Protect PDF', prompt: 'Please send me the PDF file to set a password.' },
  { id: 'tool_unlock', name: 'Unlock PDF', prompt: 'Please send me the protected PDF file.' },
  { id: 'tool_extract_text', name: 'Extract Text', prompt: 'Please send me the PDF file to extract text from.' }
];

tools.forEach(tool => {
  bot.action(tool.id, (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.currentTool = tool.name;
    ctx.answerCbQuery();
    return ctx.editMessageText(
      `🛠️️ *Selected Tool: ${tool.name}*\n\n${tool.prompt}\n\n` +
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

// Photo Listener (Handling Image to PDF)
bot.on('photo', async (ctx) => {
  ctx.session = ctx.session || {};
  
  if (ctx.session.currentTool !== 'Image to PDF') {
    return ctx.reply(
      '⚠️ *Please select "🖼️ Image to PDF" from the menu first before sending an image.*',
      { parse_mode: 'Markdown', ...getMainMenu() }
    );
  }

  const statusMsg = await ctx.reply('⏳ *Processing image and generating PDF... Please wait.*', { parse_mode: 'Markdown' });

  try {
    // 1. High resolution photo file path
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);

    // 2. Download image buffer
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);

    // 3. Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create();
    let embeddedImage;

    if (fileLink.href.endsWith('.png')) {
      embeddedImage = await pdfDoc.embedPng(imageBuffer);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imageBuffer);
    }

    const { width, height } = embeddedImage.scale(1.0);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: width,
      height: height,
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // 4. Send generated PDF document to user
    await ctx.replyWithDocument({
      source: pdfBuffer,
      filename: `Converted_Image_${Date.now()}.pdf`
    }, {
      caption: '✅ *Here is your converted PDF file!*',
      parse_mode: 'Markdown'
    });

    // Clean up status message
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

  } catch (err) {
    console.error('Image to PDF Error:', err);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    return ctx.reply('❌ *Failed to convert image. Please ensure you uploaded a valid JPG/PNG file.*', { parse_mode: 'Markdown' });
  }
});

// Document listener for other files
bot.on('document', (ctx) => {
  return ctx.reply('ℹ️ *Please select a tool from the menu first.*', { parse_mode: 'Markdown', ...getMainMenu() });
});

// Return to Home Action
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

bot.launch().then(() => {
  console.log('✅ Global PDF Bot with File Processing is active!');
}).catch((err) => {
  console.error('❌ Failed to start Bot:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
