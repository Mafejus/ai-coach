import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">AI Chat</h1>
      </div>
      <div className="flex-1 bg-card border border-border rounded-lg p-6 flex items-center justify-center">
        <div className="text-center space-y-2">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-foreground font-medium">AI trenér</p>
          <p className="text-muted-foreground text-sm max-w-md">
            Chat UI bude implementován v Fázi 3. Trenér bude mít přístup k tvým zdravotním datům, tréninkovému plánu a kalendáři.
          </p>
        </div>
      </div>
    </div>
  );
}
