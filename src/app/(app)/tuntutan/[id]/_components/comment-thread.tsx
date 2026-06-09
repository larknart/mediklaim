"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { addComment, deleteComment } from "@/server/actions/comment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2 } from "lucide-react";

export interface CommentRow {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface Props {
  claimId: string;
  comments: CommentRow[];
  currentUserId: string;
}

export function CommentThread({ claimId, comments, currentUserId }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    if (!body.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await addComment(claimId, body);
        setBody("");
        router.refresh();
        textareaRef.current?.focus();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal hantar komen.");
      }
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      await deleteComment(commentId);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Komen ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Thread */}
        {comments.length > 0 && (
          <div className="space-y-3">
            {comments.map((c) => {
              const isOwn = c.authorId === currentUserId;
              return (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0 mt-0.5">
                    {c.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-gray-800">{c.authorName}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString("ms-MY")}{" "}
                        {new Date(c.createdAt).toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={isPending}
                          className="ml-auto text-gray-300 hover:text-red-400 disabled:opacity-30"
                          aria-label="Padam komen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Composer */}
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
            }}
            placeholder="Tulis komen... (Ctrl+Enter untuk hantar)"
            rows={2}
            className="text-sm resize-none"
            disabled={isPending}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || !body.trim()}
              className=""
            >
              {isPending ? "Menghantar..." : "Hantar"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
