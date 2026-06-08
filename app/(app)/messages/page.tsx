"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatView } from "@/components/messages/chat-view";
import { EmptyState } from "@/components/ui/states";
import { useConversations } from "@/lib/hooks";
import { useRole } from "@/lib/role-context";
import { visibleConversations } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { data: conversationsData } = useConversations();
  const conversations = conversationsData ?? [];
  const { user } = useRole();
  const visible = visibleConversations({ conversations, user });
  const [selectedId, setSelectedId] = useState<string | null>(
    visible[0]?.id ?? null
  );
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const effectiveSelectedId =
    selectedId && visible.some((c) => c.id === selectedId)
      ? selectedId
      : visible[0]?.id ?? null;

  function selectMobile(id: string) {
    setSelectedId(id);
    setMobileChatOpen(true);
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <div
        className={cn(
          "md:flex md:w-80 lg:w-96 shrink-0",
          mobileChatOpen ? "hidden md:flex" : "flex flex-1 md:flex-initial"
        )}
      >
        <ConversationList
          selectedId={effectiveSelectedId}
          onSelect={(id) => {
            setSelectedId(id);
            selectMobile(id);
          }}
        />
      </div>
      <div
        className={cn(
          "flex-1 min-w-0",
          mobileChatOpen ? "flex" : "hidden md:flex"
        )}
      >
        {effectiveSelectedId ? (
          <ChatView
            conversationId={effectiveSelectedId}
            onBack={() => setMobileChatOpen(false)}
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No conversations yet"
            description="Start a DM or open the team channel from the list."
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
}
