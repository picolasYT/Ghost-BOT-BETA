const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

module.exports = async (m, { conn, usedPrefix }) => {
    let quoted = m.quoted

    if (!quoted) {
        return conn.reply(m.chat, `❐ Responde a un mensaje "ver una vez" para verlo.`, m)
    }

    try {
        await m.react('🕒')

        let viewOnceMessage =
            quoted.viewOnce
                ? quoted
                : quoted.message?.imageMessage ||
                  quoted.message?.videoMessage ||
                  quoted.message?.audioMessage

        if (!viewOnceMessage) {
            return conn.reply(m.chat, `❌ No es un mensaje compatible.`, m)
        }

        let messageType = viewOnceMessage.mimetype || quoted.mtype

        let stream = await downloadContentFromMessage(
            viewOnceMessage,
            messageType.split('/')[0]
        )

        let buffer = Buffer.from([])

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }

        if (messageType.includes('video')) {
            await conn.sendMessage(m.chat, {
                video: buffer,
                caption: viewOnceMessage.caption || '',
                mimetype: 'video/mp4'
            }, { quoted: m })

        } else if (messageType.includes('image')) {
            await conn.sendMessage(m.chat, {
                image: buffer,
                caption: viewOnceMessage.caption || ''
            }, { quoted: m })

        } else if (messageType.includes('audio')) {
            await conn.sendMessage(m.chat, {
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: viewOnceMessage.ptt || false
            }, { quoted: m })
        }

        await m.react('✔️')

    } catch (e) {
        await m.react('✖️')
        conn.reply(m.chat, `⚠️ Error:\n${e.message}`, m)
    }
}

// 👇 CONFIG DEL COMANDO
module.exports.command = ['readviewonce', 'read', 'readvo', 'ver']
module.exports.help = ['ver']
module.exports.tags = ['herramientas']