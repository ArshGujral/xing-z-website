import { MessageCircle } from 'lucide-react'
import { external, whatsappLink } from '../content/site.js'

// Always-visible WhatsApp button, since most buyers decide over WhatsApp.
export default function WhatsAppFab() {
  return (
    <a
      href={whatsappLink()}
      {...external}
      aria-label="Chat with Xing-Z on WhatsApp"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 mb-[env(safe-area-inset-bottom)] z-50 flex items-center gap-2 rounded-full bg-[#25D366] text-[#06331a] p-3.5 sm:px-5 sm:py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(37,211,102,0.35)] hover:brightness-105 transition"
    >
      <MessageCircle className="w-6 h-6 sm:w-5 sm:h-5" />
      <span className="hidden sm:inline">WhatsApp us</span>
    </a>
  )
}
