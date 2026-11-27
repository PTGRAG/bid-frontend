import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Gavel,
  Gift,
  Lock,
  PencilLine,
  PlayCircle,
  Trophy,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  participation_confirmed: CheckCircle2,
  bid_placed: PencilLine,
  bid_updated: PencilLine,
  bid_submitted: PencilLine,
  auction_submitted: PencilLine,
  auction_winner: Trophy,
  winner_paid: Trophy,
  bid_drawn: Trophy,
  winner_confirmation_request: Trophy,
  auction_no_winner: Lock,
  auction_closed: Lock,
  auction_result: Lock,
  auction_activated: PlayCircle,
  auction_postponed: Clock,
  winner_payment_reminder: Clock,
  winner_payment_expired: Clock,
  auction_cancelled: XCircle,
  bid_rejected: XCircle,
  auction_rejected: XCircle,
  free_bid: Gift,
  payment_success: CreditCard,
  payment_failed: AlertTriangle,
  prize_not_delivered: AlertTriangle,
  refund_completed: Wallet,
  payout_completed: Wallet,
  winner_compensated: Wallet,
  payout_ready: Wallet,
  bid_approved: Gavel,
  auction_approved: Gavel,
  legal_document_updated: FileText,
};

export function NotificationTypeIcon({
  type,
  className = "h-5 w-5",
}: {
  type: string;
  className?: string;
}) {
  const Icon = ICONS[type] ?? Bell;
  return <Icon className={className} aria-hidden />;
}
