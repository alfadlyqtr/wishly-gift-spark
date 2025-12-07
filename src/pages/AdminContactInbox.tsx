import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, CheckCircle2, Loader2, AlertCircle, User, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: "new" | "in_progress" | "done";
  created_at: string;
  user_id: string | null;
  handled_by: string | null;
};

const statusConfig = {
  new: {
    label: "New",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: AlertCircle,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Loader2,
  },
  done: {
    label: "Done",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
  },
};

const topicLabels: Record<string, string> = {
  abuse: "Abuse Report",
  feedback: "Feedback",
  question: "Question",
  tech_issue: "Technical Issue",
  feature_request: "Feature Request",
  other: "Other",
};

const AdminContactInbox = () => {
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "in_progress" | "done">("all");

  // Fetch contact messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin-contact-messages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Error fetching contact_messages:", error.message);
        return [];
      }
      return (data ?? []) as ContactMessage[];
    },
  });

  // Update message status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("contact_messages")
        .update({ status, handled_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-new-messages-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-total-messages-count"] });
      toast.success("Status updated");
    },
    onError: (err: any) => {
      toast.error("Failed to update status: " + err.message);
    },
  });

  const filteredMessages = (messages ?? []).filter((m) => {
    if (statusFilter === "all") return true;
    return m.status === statusFilter;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const newCount = (messages ?? []).filter((m) => m.status === "new").length;
  const inProgressCount = (messages ?? []).filter((m) => m.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Contact Inbox</h1>
          <p className="text-sm text-slate-400 mt-1">
            {messages?.length ?? 0} messages • {newCount} new • {inProgressCount} in progress
          </p>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "new", "in_progress", "done"] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(status)}
            className={statusFilter === status ? "" : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}
          >
            {status === "all" ? "All" : statusConfig[status].label}
            {status === "new" && newCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500 text-white">
                {newCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Messages Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Messages List */}
        <Card className="border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-medium text-slate-300">Messages</h2>
          </div>
          <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500">Loading messages...</div>
            ) : filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No messages found</p>
                <p className="text-xs mt-1">Messages from the Contact page will appear here</p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const config = statusConfig[msg.status];
                const StatusIcon = config.icon;
                return (
                  <button
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`w-full text-left p-4 hover:bg-slate-800/30 transition-colors ${
                      selectedMessage?.id === msg.id ? "bg-slate-800/50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-200 truncate">{msg.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{msg.email}</p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{msg.message}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-[10px] bg-slate-800 border-slate-700 text-slate-400">
                          {topicLabels[msg.topic] || msg.topic}
                        </Badge>
                        <p className="text-[10px] text-slate-500 mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Message Detail */}
        <Card className="border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-medium text-slate-300">Message Details</h2>
          </div>
          {selectedMessage ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-200">{selectedMessage.name}</p>
                  <p className="text-sm text-slate-400">{selectedMessage.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-300">
                  {topicLabels[selectedMessage.topic] || selectedMessage.topic}
                </Badge>
                <Badge variant="outline" className={statusConfig[selectedMessage.status].color}>
                  {statusConfig[selectedMessage.status].label}
                </Badge>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Received: {formatDate(selectedMessage.created_at)}
              </div>

              {/* Status Actions */}
              <div className="pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-400 mb-2">Update status:</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={selectedMessage.status === "new" ? "default" : "outline"}
                    onClick={() => updateStatus.mutate({ id: selectedMessage.id, status: "new" })}
                    disabled={updateStatus.isPending}
                    className={selectedMessage.status === "new" ? "" : "bg-slate-800 border-slate-700 text-slate-300"}
                  >
                    New
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedMessage.status === "in_progress" ? "default" : "outline"}
                    onClick={() => updateStatus.mutate({ id: selectedMessage.id, status: "in_progress" })}
                    disabled={updateStatus.isPending}
                    className={selectedMessage.status === "in_progress" ? "" : "bg-slate-800 border-slate-700 text-slate-300"}
                  >
                    In Progress
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedMessage.status === "done" ? "default" : "outline"}
                    onClick={() => updateStatus.mutate({ id: selectedMessage.id, status: "done" })}
                    disabled={updateStatus.isPending}
                    className={selectedMessage.status === "done" ? "" : "bg-slate-800 border-slate-700 text-slate-300"}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Select a message to view details</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminContactInbox;
