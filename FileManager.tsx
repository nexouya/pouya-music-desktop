/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FolderPlus, FileAudio, Folder, ChevronRight, Upload, Trash2, Edit2, CornerDownRight, HardDrive, Info, X } from 'lucide-react';
import { Track, FSNode } from './types';
import { useAudioEngine } from './AudioEngine';

interface FileManagerProps {
  curatedTracks: Track[];
  onAddLocalTrack: (track: Track) => void;
  activeDirectoryId: string | null;
  setActiveDirectoryId: (dirId: string | null) => void;
  language: 'en' | 'fa';
  l: any;
}

export const FileManager: React.FC<FileManagerProps> = ({
  curatedTracks,
  onAddLocalTrack,
  activeDirectoryId,
  setActiveDirectoryId,
  language,
  l,
}) => {
  const { playTrack, currentTrack, isPlaying } = useAudioEngine();
  const [nodes, setNodes] = useState<FSNode[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize directory database nodes on mount
  useEffect(() => {
    const savedNodes = localStorage.getItem('pouya_music_fs_nodes_v2');
    if (savedNodes) {
      try {
        setNodes(JSON.parse(savedNodes));
      } catch (e) {
        initDefaultFS();
      }
    } else {
      initDefaultFS();
    }
  }, [curatedTracks]);

  const initDefaultFS = () => {
    // Scaffold default folders/directories inspired by premium music apps like Spotify and Apple Music
    const defaultNodes: FSNode[] = [
      { id: 'dir-curated', name: 'Curated Playlists', type: 'folder', parentId: null },
      { id: 'dir-local', name: 'Imported Offline Audio', type: 'folder', parentId: null },
    ];

    // Populate curated tracks into Curated folder
    curatedTracks.forEach((t) => {
      defaultNodes.push({
        id: `node-${t.id}`,
        name: `${t.title} - ${t.artist}`,
        type: 'file',
        parentId: 'dir-curated',
        trackId: t.id,
      });
    });

    setNodes(defaultNodes);
    localStorage.setItem('pouya_music_fs_nodes_v2', JSON.stringify(defaultNodes));
  };

  const saveNodes = (updatedNodes: FSNode[]) => {
    setNodes(updatedNodes);
    localStorage.setItem('pouya_music_fs_nodes_v2', JSON.stringify(updatedNodes));
  };

  // Directory traversal breadcrumbs helper
  const getBreadcrumbs = () => {
    const defaultName = language === 'fa' ? 'آرشیو من' : 'My Library';
    const crumbs = [{ id: null as string | null, name: defaultName }];
    if (!activeDirectoryId) return crumbs;

    let curr = nodes.find((n) => n.id === activeDirectoryId);
    const pathList = [];
    while (curr) {
      let displayName = curr.name;
      if (curr.id === 'dir-curated') {
        displayName = l.curatedBeats;
      } else if (curr.id === 'dir-local') {
        displayName = l.localDrive;
      }
      pathList.unshift({ id: curr.id, name: displayName });
      curr = curr.parentId ? nodes.find((n) => n.id === curr!.parentId) : undefined;
    }
    return [...crumbs, ...pathList];
  };

  // Create folder under current active directory
  const handleCreateFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName('');
  };

  const confirmCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: FSNode = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      type: 'folder',
      parentId: activeDirectoryId,
    };
    saveNodes([...nodes, newFolder]);
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  // Node deletion helper
  const handleDeleteNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingNodeId(id);
  };

  const confirmDeleteNode = () => {
    if (!deletingNodeId) return;
    const id = deletingNodeId;

    // Recursively delete folder subcontents
    const deleteIds = new Set<string>([id]);
    let prevSize = 0;
    while (deleteIds.size !== prevSize) {
      prevSize = deleteIds.size;
      nodes.forEach((n) => {
        if (n.parentId && deleteIds.has(n.parentId)) {
          deleteIds.add(n.id);
        }
      });
    }

    const filtered = nodes.filter((n) => !deleteIds.has(n.id));
    saveNodes(filtered);
    if (activeDirectoryId && deleteIds.has(activeDirectoryId)) {
      setActiveDirectoryId(null);
    }
    setDeletingNodeId(null);
  };

  // Node renaming controller
  const startRename = (node: FSNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditName(node.name);
  };

  const submitRename = (id: string) => {
    if (editName.trim() === '') return;
    const updated = nodes.map((n) => (n.id === id ? { ...n, name: editName.trim() } : n));
    saveNodes(updated);
    setEditingNodeId(null);
  };

  // Local File imports (HTML5 Reader)
  const loadLocalFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('audio/')) {
        const errText = language === 'fa' ? 'تنها فایل‌های صوتی مجاز هستند (.mp3, .wav, ...)' : 'Invalid format. Audio files only (.mp3, .wav, etc)';
        setErrorMsg(errText);
        return;
      }

      const mediaUrl = URL.createObjectURL(file);
      const trackId = `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create Track representation
      const newTrack: Track = {
        id: trackId,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        artist: language === 'fa' ? 'موزیک آفلاین وارد شده' : 'Offline Audio Track',
        url: mediaUrl,
        duration: 210, // Simulated size estimator, audio duration triggers fully on load
        coverUrl: "https://images.unsplash.com/photo-1614680376739-414d95ff43df?q=80&w=400&fit=crop", // Modern dark glassy cover
        isLocal: true,
        category: language === 'fa' ? 'آفلاین' : "Offline Content"
      };

      onAddLocalTrack(newTrack);

      // Create Node reference and insert into current active folder / or into "dir-local" by default
      const targetFolderId = activeDirectoryId || 'dir-local';
      const fileNode: FSNode = {
        id: `node-${trackId}`,
        name: file.name,
        type: 'file',
        parentId: targetFolderId,
        trackId: trackId
      };

      // Add node
      setNodes((currentNodes) => {
        const nextNodes = [...currentNodes, fileNode];
        localStorage.setItem('pouya_music_fs_nodes_v2', JSON.stringify(nextNodes));
        return nextNodes;
      });
    });
  };

  // Drag & Drop visual controllers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadLocalFiles(e.dataTransfer.files);
    }
  };

  // Double click play track or open folder
  const handleNodeInteract = (node: FSNode) => {
    if (node.type === 'folder') {
      setActiveDirectoryId(node.id);
    } else if (node.type === 'file' && node.trackId) {
      // Find track in curated or active system map
      const foundTrack = curatedTracks.find((t) => t.id === node.trackId);
      if (foundTrack) {
        playTrack(foundTrack);
      } else {
        // Fallback or search in local storage tracks stored by parents
        const savedTracksStr = localStorage.getItem('pouya_music_local_tracks');
        if (savedTracksStr) {
          const lTracks: Track[] = JSON.parse(savedTracksStr);
          const matched = lTracks.find((t) => t.id === node.trackId);
          if (matched) {
            playTrack(matched);
          }
        }
      }
    }
  };

  // Filter children of current workspace directory scale
  const activeChildren = nodes.filter((n) => n.parentId === activeDirectoryId);

  return (
    <div
      dir={l.dir}
      className={`relative rounded-2xl bg-slate-950/45 border border-white/10 shadow-2xl shadow-cyan-500/5 backdrop-blur-3xl overflow-hidden transition-all duration-300 flex flex-col h-full min-h-[480px] p-6 ${
        isDraggingOver ? 'border-cyan-400 bg-cyan-950/20' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* SHINY NEON CORNERS */}
      <div className="absolute top-0 right-0 w-[240px] h-[240px] bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-[240px] h-[240px] bg-purple-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-5 mb-5 z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-mono text-cyan-400 tracking-wider font-semibold uppercase">{l.explorerTitle}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
            {language === 'fa' ? 'آرشیو و کتابخانه فایل‌های من' : 'My Personal Music Library'}
          </h2>
        </div>

        {/* TOP BUTTON ACTIONS */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleCreateFolder}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/20 bg-cyan-950/25 hover:bg-cyan-950/60 hover:border-cyan-400 text-cyan-300 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(34,211,238,0.15)]"
            id="new-folder-btn"
          >
            <FolderPlus className="w-4 h-4" strokeWidth={1.75} />
            {l.newFolder}
          </button>
          
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-500/20 bg-purple-950/25 hover:bg-purple-950/60 hover:border-purple-400 text-purple-300 text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_12px_rgba(168,85,247,0.15)]">
            <Upload className="w-4 h-4" strokeWidth={1.75} />
            {l.injectAudio}
            <input
              type="file"
              multiple
              accept="audio/*"
              onChange={(e) => e.target.files && loadLocalFiles(e.target.files)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* BREADCRUMB STRAPE */}
      <div className="flex items-center gap-1.5 overflow-x-auto font-mono text-xs text-slate-400 py-3 px-4 bg-slate-950/60 rounded-xl border border-slate-900 mb-4 divide-slate-800 scrollbar-none z-10">
        {getBreadcrumbs().map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-500 rotate-0 rtl:rotate-180" strokeWidth={1.75} />}
            <button
              onClick={() => setActiveDirectoryId(crumb.id)}
              className={`hover:text-cyan-400 font-semibold tracking-wide whitespace-nowrap transition-colors ${
                idx === getBreadcrumbs().length - 1 ? 'text-cyan-400 font-bold' : ''
              }`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* DIRECTORY CONTENT PANE */}
      <div className="flex-1 overflow-y-auto scrollbar-thin z-10 pr-1 select-none flex flex-col gap-2 min-h-[220px]">
        {activeChildren.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center gap-4 text-center py-12 px-6 border border-dashed border-slate-900 rounded-2xl bg-slate-950/10">
            <div className="w-12 h-12 rounded-full border border-cyan-500/20 flex items-center justify-center bg-cyan-950/5">
              <Folder className="w-6 h-6 text-cyan-500/60" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-slate-300 text-sm font-semibold">{l.emptyFolder}</p>
              <p className="text-slate-500 text-xs font-mono mt-1">{l.dragHint}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeChildren.map((node) => {
              const fileTrack =
                node.type === 'file'
                  ? curatedTracks.find((ct) => ct.id === node.trackId) ||
                    (localStorage.getItem('pouya_music_local_tracks')
                      ? (JSON.parse(localStorage.getItem('pouya_music_local_tracks')!) as Track[]).find(
                          (ct) => ct.id === node.trackId
                        )
                      : null)
                  : null;

              const isCurrentPlaying = fileTrack && currentTrack && fileTrack.id === currentTrack.id;
              let visualNodeName = node.name;
              if (node.id === 'dir-curated') visualNodeName = l.curatedBeats;
              if (node.id === 'dir-local') visualNodeName = l.localDrive;

              return (
                <div
                  key={node.id}
                  onDoubleClick={() => handleNodeInteract(node)}
                  className={`group relative flex items-center justify-between p-3.5 rounded-xl border border-slate-900 bg-slate-950/30 hover:bg-slate-900/40 hover:border-cyan-500/30 cursor-pointer transition-all duration-200 ${
                    isCurrentPlaying ? 'border-cyan-500/30 bg-cyan-950/10' : ''
                  }`}
                >
                  {/* Item Icon and Label details */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {node.type === 'folder' ? (
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-950/50 transition-all">
                        <Folder className="w-5 h-5 fill-cyan-500/10" strokeWidth={1.75} />
                      </div>
                    ) : (
                      <div
                        onClick={() => handleNodeInteract(node)}
                        className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
                          isCurrentPlaying
                            ? 'bg-cyan-950/40 border border-cyan-500/50 text-cyan-400 font-bold'
                            : 'bg-slate-950 border border-slate-900 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300'
                        }`}
                      >
                        {isCurrentPlaying && isPlaying ? (
                          <div className="flex items-end gap-1 h-4 justify-center">
                            <span className="w-1 bg-cyan-400 animate-[pulse_1s_infinite_alternate]" style={{ height: '70%' }} />
                            <span className="w-1 bg-cyan-400 animate-[pulse_1.2s_infinite_alternate_0.2s]" style={{ height: '100%' }} />
                            <span className="w-1 bg-cyan-400 animate-[pulse_0.8s_infinite_alternate_0.4s]" style={{ height: '50%' }} />
                          </div>
                        ) : (
                          <FileAudio className="w-5 h-5" strokeWidth={1.75} />
                        )}
                      </div>
                    )}

                    {/* Node Text labels */}
                    <div className="min-w-0 flex-grow">
                      {editingNodeId === node.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => submitRename(node.id)}
                          onKeyDown={(e) => e.key === 'Enter' && submitRename(node.id)}
                          autoFocus
                          className="w-full bg-slate-950 text-slate-100 border border-cyan-500/40 rounded px-2 py-1 text-sm font-mono focus:outline-none"
                        />
                      ) : (
                        <div className="truncate pr-4 pl-4">
                          <p
                            className={`text-sm font-semibold truncate ${
                              isCurrentPlaying ? 'text-cyan-300' : 'text-slate-200 group-hover:text-cyan-400'
                            }`}
                          >
                            {visualNodeName}
                          </p>
                          <p className="text-xxs font-mono text-slate-500 mt-0.5 flex items-center gap-1.5">
                            {node.type === 'folder' ? (
                              language === 'fa' ? 'فولدر لیست پخش' : 'PLAYLIST FOLDER'
                            ) : (
                              <>
                                <span>{fileTrack?.category || 'AUDIO'}</span>
                                {fileTrack?.isLocal && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-400 border border-purple-500/20 uppercase tracking-widest font-bold font-mono">
                                    {language === 'fa' ? 'محلی' : 'Local'}
                                  </span>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  {node.id !== 'dir-curated' && node.id !== 'dir-local' && (
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20">
                      <button
                        onClick={(e) => startRename(node, e)}
                        title="Rename item"
                        className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-cyan-400 hover:text-cyan-400 text-slate-400 transition-colors"
                        id={`rename-btn-${node.id}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteNode(node.id, e)}
                        title="Delete item"
                        className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 transition-colors"
                        id={`delete-btn-${node.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeDirectoryId && (
        <button
          onClick={() => {
            const current = nodes.find((n) => n.id === activeDirectoryId);
            setActiveDirectoryId(current ? current.parentId : null);
          }}
          className="mt-4 text-xs font-mono text-slate-500 hover:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 transition-colors self-start pb-1.5"
          id="go-back-btn"
        >
          <CornerDownRight className="w-3.5 h-3.5 rotate-180 rtl:rotate-0" strokeWidth={1.75} />
          {l.back}
        </button>
      )}

      {/* FOOTER INFO RAILS */}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-900 text-xxs font-mono text-slate-500 z-10 select-none">
        <Info className="w-3.5 h-3.5 text-cyan-400/50" strokeWidth={1.75} />
        <span>{l.quantumMax}</span>
      </div>

      {/* CREATE FOLDER MODAL */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">
              {language === 'fa' ? 'ایجاد پوشه جدید' : 'Create New Folder'}
            </h3>
            <input
              type="text"
              autoFocus
              placeholder={language === 'fa' ? 'نام پوشه را وارد کنید...' : 'Folder name...'}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmCreateFolder()}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                {language === 'fa' ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={confirmCreateFolder}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400 transition-colors"
              >
                {language === 'fa' ? 'ایجاد' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingNodeId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 text-center">
            <Trash2 className="w-10 h-10 text-red-500 mx-auto animate-bounce" strokeWidth={1.75} />
            <h3 className="text-base font-bold text-white">
              {language === 'fa' ? 'تأیید حذف' : 'Confirm Delete'}
            </h3>
            <p className="text-xs text-slate-400">
              {language === 'fa' ? 'آیا از بابت حذف دائم این پوشه یا فایل اطمینان دارید؟' : 'Are you sure you want to permanently delete this item?'}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingNodeId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                {language === 'fa' ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={confirmDeleteNode}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                {language === 'fa' ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR TOAST */}
      {errorMsg && (
        <div className="fixed bottom-6 end-6 z-50 bg-red-950/90 border border-red-500/50 text-red-200 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
};
