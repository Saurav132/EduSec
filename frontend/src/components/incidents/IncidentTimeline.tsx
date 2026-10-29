import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  User,
  Activity,
  AlertCircle,
} from 'lucide-react';

import type { IncidentNote, IncidentTimelineEntry } from '../../types';

interface IncidentTimelineProps {
  timeline: IncidentTimelineEntry[];
  notes: IncidentNote[];
  onAddNote: (content: string, author: string) => Promise<void>;
  addingNote: boolean;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({
  timeline,
  notes,
  onAddNote,
  addingNote,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes'>('timeline');
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('Security Analyst');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      setValidationError('Investigation note content cannot be empty.');
      return;
    }
    if (noteContent.trim().length < 4) {
      setValidationError('Note must contain at least 4 characters.');
      return;
    }
    if (!noteAuthor.trim()) {
      setValidationError('Analyst name or identifier is required.');
      return;
    }

    setValidationError(null);
    try {
      await onAddNote(noteContent.trim(), noteAuthor.trim());
      setNoteContent('');
    } catch {
      setValidationError('Failed to post note. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle */}
      <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'timeline'
                ? 'border border-[#FDE68A] bg-[#FEF3C7] text-[#18181B]'
                : 'text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-[#A16207]" />
            <span>Activity Trail ({timeline.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'notes'
                ? 'border border-[#FDE68A] bg-[#FEF3C7] text-[#18181B]'
                : 'text-[#71717A] hover:bg-zinc-100 hover:text-[#18181B]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-[#A16207]" />
            <span>Analyst Notes ({notes.length})</span>
          </button>
        </div>
      </div>

      {/* Tab: Activity Trail */}
      {activeTab === 'timeline' && (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E4E4E7]">
          {timeline.length === 0 ? (
            <p className="text-xs text-[#71717A]">No timeline activity recorded yet.</p>
          ) : (
            timeline.map((entry) => (
              <div key={entry.id} className="relative group">
                {/* Dot */}
                <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white">
                  <span className="h-2 w-2 rounded-full bg-[#EAB308]" />
                </div>

                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-semibold text-[#18181B]">{entry.action}</span>
                    <span className="font-mono text-[10px] text-[#71717A]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#71717A]">
                    <User className="h-3 w-3" />
                    <span>{entry.actor}</span>
                  </div>
                  {entry.details && (
                    <p className="mt-1 text-xs text-[#18181B] bg-zinc-50 border border-[#E4E4E7] rounded-md p-2">
                      {entry.details}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Analyst Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {notes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#E4E4E7] p-5 text-center text-xs text-[#71717A]">
              No investigation notes added yet. Use the form below to record findings or triage hypotheses.
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-[#E4E4E7] bg-white p-3.5 shadow-xs"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-[#18181B]">
                      <User className="h-3.5 w-3.5 text-[#A16207]" />
                      <span>{note.author}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#71717A]">
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#18181B] whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Investigation Note Form */}
      <form onSubmit={handleSubmitNote} className="pt-3 border-t border-[#E4E4E7]">
        <h5 className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-2">
          Add Investigation Note
        </h5>

        {validationError && (
          <div className="mb-2 flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <label htmlFor="note-author" className="text-xs font-medium text-[#71717A] shrink-0">
              Analyst:
            </label>
            <input
              id="note-author"
              type="text"
              value={noteAuthor}
              onChange={(e) => setNoteAuthor(e.target.value)}
              className="rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs text-[#18181B] focus:border-[#FACC15] focus:outline-hidden"
              placeholder="Analyst Name / ID"
              required
            />
          </div>

          <textarea
            rows={3}
            value={noteContent}
            onChange={(e) => {
              setNoteContent(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="Record evidence analysis, containment steps, or hypothesis..."
            className="w-full rounded-lg border border-[#E4E4E7] bg-white p-2.5 text-xs text-[#18181B] placeholder:text-[#71717A] focus:border-[#FACC15] focus:outline-hidden"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingNote || !noteContent.trim()}
              className="flex items-center gap-1.5 rounded-md border border-[#EAB308] bg-[#FACC15] hover:bg-[#EAB308] px-3 py-1.5 text-xs font-semibold text-[#18181B] transition disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{addingNote ? 'Posting...' : 'Post Note'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
