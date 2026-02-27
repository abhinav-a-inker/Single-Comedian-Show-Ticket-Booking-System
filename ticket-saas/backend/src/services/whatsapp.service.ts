import axios from "axios";

const BASE_URL = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
const HEADERS = {
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  "Content-Type": "application/json",
};

// ─── Send plain text ──────────────────────────────────────────────────────────
export const sendWhatsAppMessage = async (to: string, message: string) => {
  try {
    await axios.post(`${BASE_URL}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }, { headers: HEADERS });
    console.log(`[WhatsApp] ✅ Text sent to ${to}`);
  } catch (err: any) {
    console.error("[WhatsApp Send Error]", err.response?.data || err.message);
  }
};

// ─── Send image with caption ──────────────────────────────────────────────────
export const sendWhatsAppImage = async (to: string, imageUrl: string, caption: string) => {
  try {
    await axios.post(`${BASE_URL}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    }, { headers: HEADERS });
    console.log(`[WhatsApp] ✅ Image sent to ${to}`);
  } catch (err: any) {
    console.error("[WhatsApp Image Error]", err.response?.data || err.message);
    // Fallback to text if image fails
    await sendWhatsAppMessage(to, caption);
  }
};

// ─── Send reply buttons (max 3) ───────────────────────────────────────────────
export const sendWhatsAppButtons = async (
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  headerText?: string,
  footerText?: string
) => {
  try {
    await axios.post(`${BASE_URL}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        ...(headerText && { header: { type: "text", text: headerText } }),
        body: { text: bodyText },
        ...(footerText && { footer: { text: footerText } }),
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: { id: btn.id, title: btn.title },
          })),
        },
      },
    }, { headers: HEADERS });
    console.log(`[WhatsApp] ✅ Buttons sent to ${to}`);
  } catch (err: any) {
    console.error("[WhatsApp Buttons Error]", err.response?.data || err.message);
    await sendWhatsAppMessage(to, bodyText);
  }
};

// ─── Send list message (dropdown) ────────────────────────────────────────────
export const sendWhatsAppList = async (
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[],
  headerText?: string,
  footerText?: string
) => {
  try {
    await axios.post(`${BASE_URL}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        ...(headerText && { header: { type: "text", text: headerText } }),
        body: { text: bodyText },
        ...(footerText && { footer: { text: footerText } }),
        action: {
          button: buttonLabel,
          sections,
        },
      },
    }, { headers: HEADERS });
    console.log(`[WhatsApp] ✅ List sent to ${to}`);
  } catch (err: any) {
    console.error("[WhatsApp List Error]", err.response?.data || err.message);
    await sendWhatsAppMessage(to, bodyText);
  }
};