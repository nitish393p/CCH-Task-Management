export function shareByGmail(email, subject, message) {
  if (!email || email === "-") throw new Error("No email address is saved for this user.");
  const params = new URLSearchParams({ view: "cm", fs: "1", to: email, su: subject, body: message });
  window.open(`https://mail.google.com/mail/?${params}`, "_blank", "noopener,noreferrer");
}

export function shareByWhatsApp(phone, message) {
  const number = (phone || "").replace(/\D/g, "");
  if (!number) throw new Error("No WhatsApp number is saved for this user.");
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

export async function copyToClipboard(text) {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable in this browser.");
  await navigator.clipboard.writeText(text);
}
