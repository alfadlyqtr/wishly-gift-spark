import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageCircle, CheckCircle, X, Clock, Mail, User, Building2, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface SupportMessage {
  id: string;
  user_id: string;
  username: string;
  email: string;
  message: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
  user_profile?: {
    account_type?: string;
    avatar_url?: string;
    full_name?: string;
    username?: string;
    brandName?: string;
    brandLogo?: string;
  } | null;
}

const AdminSupportMessages = () => {
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const queryClient = useQueryClient();

  // Fetch all support messages with user profile and brand data
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["admin-support-messages"],
    queryFn: async () => {
      // First get support messages
      const { data: messagesData, error: messagesError } = await (supabase as any)
        .from("support_messages")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (messagesError) throw messagesError;
      if (!messagesData || messagesData.length === 0) return [];
      
      // Then get user profiles for each message (ignore errors - RLS might block)
      const userIds = [...new Set(messagesData.map((m: any) => m.user_id))];
      const { data: profilesData } = await (supabase as any)
        .from("user_profiles")
        .select("id, account_type, avatar_url, full_name, username")
        .in("id", userIds);
      
      // Get brands for business accounts
      const { data: brandsData } = await (supabase as any)
        .from("brands")
        .select("owner_id, name, logo_url")
        .in("owner_id", userIds);
      
      // Map profiles and brands to messages
      const profilesMap = new Map<string, any>(profilesData?.map((p: any) => [p.id, p]) || []);
      const brandsMap = new Map<string, any>(brandsData?.map((b: any) => [b.owner_id, b]) || []);
      
      return messagesData.map((m: any) => {
        const profile = profilesMap.get(m.user_id);
        const brand = brandsMap.get(m.user_id);
        return {
          ...m,
          user_profile: profile ? {
            account_type: profile.account_type,
            avatar_url: profile.avatar_url,
            full_name: profile.full_name,
            username: profile.username,
            brandName: brand?.name || undefined,
            brandLogo: brand?.logo_url || undefined
          } : null
        };
      }) as SupportMessage[];
    },
  });

  // Update message status
  const updateMessageStatus = useMutation({
    mutationFn: async ({ messageId, status }: { messageId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("support_messages")
        .update({ status })
        .eq("id", messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-messages"] });
      toast.success("Message status updated");
      setSelectedMessage(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update status");
    },
  });

  // Delete message
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await (supabase as any)
        .from("support_messages")
        .delete()
        .eq("id", messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-messages"] });
      toast.success("Message deleted");
      setSelectedMessage(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete message");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-900/50 text-amber-400 border-amber-900/50">Pending</Badge>;
      case 'resolved':
        return <Badge className="bg-green-900/50 text-green-400 border-green-900/50">Resolved</Badge>;
      case 'dismissed':
        return <Badge className="bg-slate-700 text-slate-400 border-slate-600">Dismissed</Badge>;
      default:
        return <Badge className="bg-slate-700 text-slate-400 border-slate-600">Unknown</Badge>;
    }
  };

  const getUserTypeBadge = (accountType?: string, brandName?: string) => {
    if (accountType === 'business') {
      return (
        <Badge className="bg-purple-900/50 text-purple-400 border-purple-900/50 flex items-center gap-1">
          <Building2 className="w-3 h-3" /> {brandName || 'Business'}
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-900/50 text-blue-400 border-blue-900/50 flex items-center gap-1">
        <User className="w-3 h-3" /> Personal
      </Badge>
    );
  };
  
  // Get display name - prioritize brand name for business accounts
  const getDisplayName = (message: SupportMessage) => {
    if (message.user_profile?.brandName) {
      return message.user_profile.brandName;
    }
    if (message.user_profile?.full_name) {
      return message.user_profile.full_name;
    }
    return message.username;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pendingCount = messages.filter(m => m.status === 'pending').length;
  const resolvedCount = messages.filter(m => m.status === 'resolved').length;
  const dismissedCount = messages.filter(m => m.status === 'dismissed').length;

  // Filter messages based on active tab
  const filteredMessages = messages.filter(m => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return m.status === 'pending';
    if (activeTab === 'resolved') return m.status === 'resolved';
    if (activeTab === 'dismissed') return m.status === 'dismissed';
    if (activeTab === 'business') return m.user_profile?.account_type === 'business';
    if (activeTab === 'personal') return m.user_profile?.account_type !== 'business';
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-blue-400" />
            Support Messages
          </h1>
          <p className="text-slate-400">
            Manage user support requests and appeals
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="text-2xl font-bold text-white">{messages.length}</div>
            <div className="text-sm text-slate-400">Total Messages</div>
          </Card>
          <Card className="p-4 bg-amber-900/20 border-amber-900/50">
            <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
            <div className="text-sm text-amber-400/70">Pending</div>
          </Card>
          <Card className="p-4 bg-green-900/20 border-green-900/50">
            <div className="text-2xl font-bold text-green-400">{resolvedCount}</div>
            <div className="text-sm text-green-400/70">Resolved</div>
          </Card>
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <div className="text-2xl font-bold text-slate-400">{dismissedCount}</div>
            <div className="text-sm text-slate-500">Dismissed</div>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-800">
              All ({messages.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-amber-900/50 data-[state=active]:text-amber-400">
              Pending ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="data-[state=active]:bg-green-900/50 data-[state=active]:text-green-400">
              Resolved ({resolvedCount})
            </TabsTrigger>
            <TabsTrigger value="dismissed" className="data-[state=active]:bg-slate-700">
              Dismissed ({dismissedCount})
            </TabsTrigger>
            <TabsTrigger value="business" className="data-[state=active]:bg-purple-900/50 data-[state=active]:text-purple-400">
              <Building2 className="w-3 h-3 mr-1" /> Business
            </TabsTrigger>
            <TabsTrigger value="personal" className="data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-400">
              <User className="w-3 h-3 mr-1" /> Personal
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Messages List */}
        <div className="grid gap-4">
          {filteredMessages.length === 0 ? (
            <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
              <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No messages in this category</p>
            </Card>
          ) : (
            filteredMessages.map((message) => (
              <Card 
                key={message.id} 
                className={`p-5 border transition-all cursor-pointer hover:shadow-lg ${
                  message.status === 'pending' 
                    ? 'bg-slate-900/80 border-amber-900/50 hover:border-amber-700' 
                    : message.status === 'resolved'
                    ? 'bg-slate-900/50 border-green-900/30 hover:border-green-700'
                    : 'bg-slate-900/30 border-slate-800 hover:border-slate-600'
                }`}
                onClick={() => setSelectedMessage(message)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-slate-700">
                      <AvatarImage src={message.user_profile?.brandLogo || message.user_profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-slate-800 text-slate-300 text-lg">
                        {getDisplayName(message).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-white text-lg">{getDisplayName(message)}</span>
                        {getUserTypeBadge(message.user_profile?.account_type, message.user_profile?.brandName)}
                        {getStatusBadge(message.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {message.email}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(message.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {message.status === 'pending' && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  )}
                </div>
                
                <div className="mt-3 text-slate-300 line-clamp-2 bg-slate-800/30 rounded-lg p-3">
                  {message.message}
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Message Detail Dialog */}
        {selectedMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Avatar className="w-14 h-14 border-2 border-slate-700">
                    <AvatarImage src={selectedMessage.user_profile?.brandLogo || selectedMessage.user_profile?.avatar_url || ""} />
                    <AvatarFallback className="bg-slate-800 text-slate-300 text-xl">
                      {getDisplayName(selectedMessage).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-white">{getDisplayName(selectedMessage)}</h2>
                      {getUserTypeBadge(selectedMessage.user_profile?.account_type, selectedMessage.user_profile?.brandName)}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedMessage.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(selectedMessage.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedMessage.status)}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedMessage(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-400 mb-2">Message</h3>
                <div className="bg-slate-800/50 rounded-xl p-4 text-slate-200 whitespace-pre-wrap border border-slate-700">
                  {selectedMessage.message}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {selectedMessage.status === 'pending' ? (
                  <>
                    <Button
                      className="bg-slate-700 text-white hover:bg-slate-600"
                      onClick={() => updateMessageStatus.mutate({ 
                        messageId: selectedMessage.id, 
                        status: 'dismissed' 
                      })}
                      disabled={updateMessageStatus.isPending}
                    >
                      <X className="w-4 h-4 mr-2" /> Dismiss
                    </Button>
                    <Button
                      className="bg-green-600 text-white hover:bg-green-700"
                      onClick={() => updateMessageStatus.mutate({ 
                        messageId: selectedMessage.id, 
                        status: 'resolved' 
                      })}
                      disabled={updateMessageStatus.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Mark Resolved
                    </Button>
                  </>
                ) : (
                  <Button
                    className="bg-red-600 text-white hover:bg-red-700"
                    onClick={() => deleteMessage.mutate(selectedMessage.id)}
                    disabled={deleteMessage.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Message
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSupportMessages;
