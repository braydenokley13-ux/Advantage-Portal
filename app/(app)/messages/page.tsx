"use client";

import { useEffect, useState } from "react";
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatView } from "@/components/messages/chat-view";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/role-context";
import { visibleConversations } from "@/lib/permissions";

export default function MessagesPage() {
  const { conversations } = useStore();
  const { user } = useRole();
  const visible = visibleConversations({ conversations, user });
  const [selectedId, setSelectedId] = useState<string | null>(
    visible[0]?.id ?? null
  );

  useEffect(() => {
    if (selectedId && !visible.some((c) => c.id === selectedId)) {
      setSelectedId(visible[0]?.id ?? null);
    }
  }, [selectedId, visible]);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <div className="hidden md:flex md:w-80 lg:w-96 shrink-0">
        <ConversationList
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
        />
      </div>
      <div className="flex flex-1 min-w-0">
        {selectedId ? (
          <ChatView conversationId={selectedId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No conversations yet.
          </div>
        )}
      </div>
    </div>
  );
}
