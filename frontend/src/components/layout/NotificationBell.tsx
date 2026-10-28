import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCheck, Clock, Mail } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { timeAgo } from '../../api/adapters';
import type { NotificationDto } from '../../api/backend';

const SEVERITY_DOT: Record<NotificationDto['severity'], string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-400',
  low: 'bg-sky-400',
};

/** Personal notification inbox (anomalies, overdue assignments), live via `notification:created`. */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const notifications = useFleetStore((state) => state.notifications);
  const unread = useFleetStore((state) => state.unreadNotifications);
  const markRead = useFleetStore((state) => state.markNotificationRead);
  const markAllRead = useFleetStore((state) => state.markAllNotificationsRead);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openItem = (item: NotificationDto) => {
    void markRead(item.id);
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-white rounded-lg hover:bg-ops-card transition-colors border border-transparent hover:border-ops-border"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-ops-panel border border-ops-borderHighlight rounded-xl shadow-2xl p-3 z-50">
          <div className="flex items-center justify-between pb-2 border-b border-ops-border">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-brand-teal" />
              Notifications {unread > 0 && <span className="text-rose-300">({unread} unread)</span>}
            </span>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  className="text-[10px] text-brand-teal hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/dashboard/settings');
                }}
                className="text-[10px] text-gray-400 hover:text-white"
              >
                Settings
              </button>
            </div>
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto space-y-1.5">
            {notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-6 italic text-xs">No notifications yet.</p>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openItem(item)}
                  className={`w-full text-left p-2 rounded-lg border transition-colors ${
                    item.readAt
                      ? 'bg-ops-base border-ops-border opacity-70 hover:opacity-100'
                      : 'bg-ops-card border-ops-borderHighlight hover:bg-ops-hover'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[item.severity]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white text-xs truncate">{item.title}</span>
                        {item.kind === 'assignment_overdue' ? (
                          <Clock className="w-3 h-3 text-amber-300 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-rose-300 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{item.body}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-1">
                        <span>{timeAgo(item.createdAt)}</span>
                        {item.emailStatus === 'sent' && (
                          <span className="flex items-center gap-0.5" title="Also emailed">
                            <Mail className="w-3 h-3" /> emailed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
