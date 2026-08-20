"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { createMemory, deleteMemory, listMemory } from "@/lib/workspace/repository";
import type { MemoryRecord } from "@/lib/workspace/types";

export default function MemoryPage() {
  const { workspace, user } = useWorkspace(); const [items, setItems] = useState<MemoryRecord[]>([]);
  const [content, setContent] = useState(""); const [memoryType, setMemoryType] = useState<MemoryRecord["memory_type"]>("context"); const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => { if (workspace) setItems(await listMemory(workspace.id)); }, [workspace]);
  useEffect(() => { void reload().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load memory.")); }, [reload]);
  async function add(event: FormEvent) { event.preventDefault(); if (!workspace || !user || !content.trim()) return; try { await createMemory({ workspaceId: workspace.id, userId: user.id, memoryType, content }); setContent(""); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save memory."); } }
  return <><h1 className="page-title">Memory</h1><p className="page-lede">Keep explicit facts, preferences, and context you want available to your future Workspace tools.</p><section className="grid two"><article className="card"><h2>Add entry</h2><form className="form-grid" onSubmit={add}><label>Type<select value={memoryType} onChange={(event) => setMemoryType(event.target.value as MemoryRecord["memory_type"])}><option value="context">Context</option><option value="fact">Fact</option><option value="preference">Preference</option><option value="relationship">Relationship</option></select></label><label>Entry<textarea required value={content} onChange={(event) => setContent(event.target.value)} /></label><button className="button">Save memory</button></form></article><article className="card"><h2>No automatic extraction</h2><p className="notice">Memory remains user-authored. The extraction does not turn conversation or integration data into memory automatically.</p></article></section><section className="card" style={{ marginTop: 18 }}><h2>Saved entries</h2>{error ? <p className="error">{error}</p> : null}{items.length ? items.map((item) => <article className="item" key={item.id}><div className="row"><div><span className="pill">{item.memory_type}</span><p>{item.content}</p></div><button className="button danger" onClick={() => void deleteMemory(item.id).then(reload).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not delete memory."))}>Delete</button></div></article>) : <p className="empty">No saved entries.</p>}</section></>;
}
