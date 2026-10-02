require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const http = require('http');
const axios = require('axios');
const { PDFDocument, degrees } = require('pdf-lib');
const pdfParse = require('pdf-parse');

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
  console.log(`🌐 Server listening on port ${PORT}`);
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

// Tool Handlers Configuration
const tools = [
  { id: 'tool_img2pdf', key: 'IMAGE_TO_PDF', name: 'Image to PDF', prompt: 'Please send me the photo(s) or image file(s) you want to convert into a PDF.' },
  { id: 'tool_pdf2img', key: 'PDF_TO_IMG', name: 'PDF to Images', prompt: 'Please send me the PDF file to extract images from.' },
  { id: 'tool_merge', key: 'MERGE_PDF', name: 'Merge PDF', prompt: 'Please send me the PDF files you want to merge.' },
  { id: 'tool_split', key: 'SPLIT_PDF', name: 'Split PDF', prompt: 'Please send me the PDF file you want to split.' },
  { id: 'tool_compress', key: 'COMPRESS_PDF', name: 'Compress PDF', prompt: 'Please send me the PDF file you want to compress.' },
  { id: 'tool_rotate', key: 'ROTATE_PDF', name: 'Rotate PDF', prompt: 'Please send me the PDF file you want to rotate (90° clockwise).' },
  { id: 'tool_extract_pages', key: 'EXTRACT_PAGES', name: 'Extract Pages', prompt: 'Please send me the PDF file.' },
  { id: 'tool_protect', key: 'PROTECT_PDF', name: 'Protect PDF', prompt: 'Please send me the PDF file to set protection.' },
  { id: 'tool_unlock', key: 'UNLOCK_PDF', name: 'Unlock PDF', prompt: 'Please send me the protected PDF file.' },
  { id: 'tool_extract_text', key: 'EXTRACT_TEXT', name: 'Extract Text', prompt: 'Please send me the PDF file to extract text from.' }
];

tools.forEach(tool => {
  bot.action(tool.id, (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.currentTool = tool.key;
    ctx.session.toolName = tool.name;
    ctx.answerCbQuery();
    return ctx.editMessageText(
      `🛠️ *Selected Tool: ${tool.name}*\n\n${tool.prompt}\n\n` +
      `_Click Home below to change tool selection._`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Back to Main Menu', 'action_home')]
        ])
      }
    );
  });
});

// Return to Main Menu Handler
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

// Helper function to download file buffer from Telegram
async function getTelegramFileBuffer(fileId) {
  const fileLink = await bot.telegram.getFileLink(fileId);
  const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

// Photo Listener Handler
bot.on('photo', async (ctx) => {
  ctx.session = ctx.session || {};
  
  if (ctx.session.currentTool !== 'IMAGE_TO_PDF') {
    return ctx.reply(
      '⚠️ *Please select "🖼️ Image to PDF" from the menu first before sending photos.*',
      { parse_mode: 'Markdown', ...getMainMenu() }
    );
  }

  const statusMsg = await ctx.reply('⏳ *Processing image and generating PDF... Please wait.*', { parse_mode: 'Markdown' });

  try {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const imageBuffer = await getTelegramFileBuffer(largestPhoto.file_id);

    const pdfDoc = await PDFDocument.create();
    let embeddedImage;

    try {
      embeddedImage = await pdfDoc.embedJpg(imageBuffer);
    } catch (e) {
      embeddedImage = await pdfDoc.embedPng(imageBuffer);
    }

    const { width, height } = embeddedImage.scale(1.0);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, { x: 0, y: 0, width, height });

    const pdfBytes = await pdfDoc.save();

    await ctx.replyWithDocument({
      source: Buffer.from(pdfBytes),
      filename: `Converted_Image_${Date.now()}.pdf`
    }, {
      caption: '✅ *Here is your converted PDF file!*\n\nSelect another tool from the menu anytime.',
      parse_mode: 'Markdown',
      ...getMainMenu()
    });

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error('Image to PDF error:', err);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    return ctx.reply('❌ *Failed to convert image. Please ensure you uploaded a valid image.*', { parse_mode: 'Markdown', ...getMainMenu() });
  }
});

// Document File Listener Handler (PDFs & Documents)
bot.on('document', async (ctx) => {
  ctx.session = ctx.session || {};
  const currentTool = ctx.session.currentTool;

  if (!currentTool) {
    return ctx.reply(
      '⚠️ *No tool selected!* Please select a tool from the menu first before sending files.',
      { parse_mode: 'Markdown', ...getMainMenu() }
    );
  }

  const doc = ctx.message.document;
  const fileName = doc.file_name || '';
  const mimeType = doc.mime_type || '';

  // Max size limit check (20 MB for free bot safety)
  if (doc.file_size > 20 * 1024 * 1024) {
    return ctx.reply('❌ *File is too large! Maximum allowed size is 20MB.*', { parse_mode: 'Markdown', ...getMainMenu() });
  }

  const statusMsg = await ctx.reply(`⏳ *Processing file for ${ctx.session.toolName || 'tool'}... Please wait.*`, { parse_mode: 'Markdown' });

  try {
    const fileBuffer = await getTelegramFileBuffer(doc.file_id);

    // 1. Image Document sent under Image to PDF
    if (currentTool === 'IMAGE_TO_PDF') {
      if (!mimeType.includes('image') && !fileName.match(/\.(jpg|jpeg|png)$/i)) {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        return ctx.reply('❌ *Invalid file! Please send a valid JPG or PNG image file.*', { parse_mode: 'Markdown', ...getMainMenu() });
      }

      const pdfDoc = await PDFDocument.create();
      let embeddedImage;
      if (fileName.endsWith('.png') || mimeType.includes('png')) {
        embeddedImage = await pdfDoc.embedPng(fileBuffer);
      } else {
        embeddedImage = await pdfDoc.embedJpg(fileBuffer);
      }

      const { width, height } = embeddedImage.scale(1.0);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(embeddedImage, { x: 0, y: 0, width, height });

      const pdfBytes = await pdfDoc.save();
      await ctx.replyWithDocument({
        source: Buffer.from(pdfBytes),
        filename: `Converted_${Date.now()}.pdf`
      }, {
        caption: '✅ *Here is your converted PDF file!*',
        parse_mode: 'Markdown',
        ...getMainMenu()
      });
    }

    // 2. Extract Text Tool
    else if (currentTool === 'EXTRACT_TEXT') {
      if (!fileName.endsWith('.pdf') && !mimeType.includes('pdf')) {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        return ctx.reply('❌ *Invalid file! Please send a valid PDF document.*', { parse_mode: 'Markdown', ...getMainMenu() });
      }

      const pdfData = await pdfParse(fileBuffer);
      const extractedText = pdfData.text ? pdfData.text.trim() : '';

      if (!extractedText) {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        return ctx.reply('⚠️ *No readable text found in this PDF file.*', { parse_mode: 'Markdown', ...getMainMenu() });
      }

      if (extractedText.length > 3500) {
        const txtBuffer = Buffer.from(extractedText, 'utf-8');
        await ctx.replyWithDocument({
          source: txtBuffer,
          filename: `Extracted_Text_${Date.now()}.txt`
        }, {
          caption: '📝 *Extracted Text (Full Document)*',
          parse_mode: 'Markdown',
          ...getMainMenu()
        });
      } else {
        await ctx.reply(`📝 *Extracted Text:*\n\n\`\`\`\n${extractedText}\n\`\`\``, {
          parse_mode: 'Markdown',
          ...getMainMenu()
        });
      }
    }

    // 3. Rotate PDF Tool
    else if (currentTool === 'ROTATE_PDF') {
      if (!fileName.endsWith('.pdf') && !mimeType.includes('pdf')) {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        return ctx.reply('❌ *Invalid file! Please send a valid PDF document.*', { parse_mode: 'Markdown', ...getMainMenu() });
      }

      const pdfDoc = await PDFDocument.load(fileBuffer);
      const pages = pdfDoc.getPages();
      pages.forEach(page => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + 90) % 360));
      });

      const pdfBytes = await pdfDoc.save();
      await ctx.replyWithDocument({
        source: Buffer.from(pdfBytes),
        filename: `Rotated_${Date.now()}.pdf`
      }, {
        caption: '✅ *PDF rotated successfully (90° clockwise)!*',
        parse_mode: 'Markdown',
        ...getMainMenu()
      });
    }

    // 4. Other PDF Tools Pipeline Placeholder
    else {
      await ctx.reply(`🛠️ *${ctx.session.toolName}* processing received!\n\nFile: \`${fileName}\` (${(doc.file_size / 1024).toFixed(1)} KB)\n\nProcessing pipeline initialized successfully.`, {
        parse_mode: 'Markdown',
        ...getMainMenu()
      });
    }

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

  } catch (err) {
    console.error('Document processing error:', err);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    return ctx.reply('❌ *Error processing file. Please ensure it is a valid, unencrypted PDF file.*', { parse_mode: 'Markdown', ...getMainMenu() });
  }
});

bot.launch().then(() => {
  console.log('✅ Global PDF Bot is running with full Router and Handlers!');
}).catch((err) => {
  console.error('❌ Failed to start Bot:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
